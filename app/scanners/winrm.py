"""WinRM scanner — connects to Windows hosts and collects OS, CPU, SQL, and product info."""
import asyncio, logging, ipaddress, re
from concurrent.futures import ThreadPoolExecutor

log = logging.getLogger("trueup.winrm")

# PowerShell scripts
PS_HOST_INFO = r"""
$cs = Get-WmiObject Win32_ComputerSystem
$os = Get-WmiObject Win32_OperatingSystem
$cpu = @(Get-WmiObject Win32_Processor)
$bios = Get-WmiObject Win32_BIOS

$isVirtual = $false
$hypervisor = ''
$model = $cs.Model
if ($model -match 'Virtual|VMware|Xen|HVM|KVM|QEMU' -or $cs.Manufacturer -match 'Microsoft Corporation|VMware|Xen|QEMU') {
    $isVirtual = $true
    # Try to get hypervisor host from registry
    $regPath = 'HKLM:\SOFTWARE\Microsoft\Virtual Machine\Guest\Parameters'
    if (Test-Path $regPath) {
        $hypervisor = (Get-ItemProperty $regPath -ErrorAction SilentlyContinue).PhysicalHostNameFullyQualified
    }
}

@{
    hostname = $cs.Name
    domain = $cs.Domain
    os_name = $os.Caption
    os_version = $os.Version
    ip_address = (Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled } | Select-Object -First 1).IPAddress[0]
    cpu_sockets = @($cpu).Count
    cpu_cores = ($cpu | Measure-Object -Property NumberOfCores -Sum).Sum
    cpu_logical = ($cpu | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
    cpu_model = $cpu[0].Name
    ram_gb = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
    is_virtual = $isVirtual
    hypervisor_host = $hypervisor
} | ConvertTo-Json
"""

PS_OS_EDITION = r"""
$ed = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue).EditionID
if (-not $ed) { $ed = (Get-WmiObject Win32_OperatingSystem).Caption }
if ($ed -match 'Datacenter') { 'Datacenter' }
elseif ($ed -match 'Standard') { 'Standard' }
else { $ed }
"""

PS_SQL_INSTANCES = r"""
$instances = @()
$regPaths = @(
    'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL',
    'HKLM:\SOFTWARE\Wow6432Node\Microsoft\Microsoft SQL Server\Instance Names\SQL'
)
foreach ($path in $regPaths) {
    if (Test-Path $path) {
        $names = Get-ItemProperty $path -ErrorAction SilentlyContinue
        foreach ($prop in $names.PSObject.Properties) {
            if ($prop.Name -notmatch '^PS') {
                $instName = $prop.Name
                $instId = $prop.Value
                $setupPath = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instId\Setup"
                $setup = Get-ItemProperty $setupPath -ErrorAction SilentlyContinue
                $instances += @{
                    instance_name = $instName
                    edition = $setup.Edition -replace ' Edition',''
                    version = $setup.Version
                    version_name = switch -Regex ($setup.Version) {
                        '^16\.' { 'SQL Server 2022' }
                        '^15\.' { 'SQL Server 2019' }
                        '^14\.' { 'SQL Server 2017' }
                        '^13\.' { 'SQL Server 2016' }
                        '^12\.' { 'SQL Server 2014' }
                        '^11\.' { 'SQL Server 2012' }
                        default  { 'SQL Server' }
                    }
                    license_model = if ($setup.Edition -match 'Express|Developer|Evaluation') { 'free' } else { 'core' }
                }
            }
        }
    }
}
$instances | ConvertTo-Json -Depth 3
"""

PS_PRODUCTS = r"""
$products = @()
$paths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$seen = @{}
Get-ItemProperty $paths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match 'Microsoft|SQL Server|Visual Studio|SharePoint|Exchange|System Center|Office' } |
    ForEach-Object {
        $name = $_.DisplayName
        if (-not $seen[$name]) {
            $seen[$name] = $true
            $family = switch -Regex ($name) {
                'SQL Server'      { 'SQLServer' }
                'Visual Studio'   { 'VisualStudio' }
                'SharePoint'      { 'SharePoint' }
                'Exchange'        { 'Exchange' }
                'System Center'   { 'SystemCenter' }
                'Office'          { 'Office' }
                'Project'         { 'Project' }
                'Visio'           { 'Visio' }
                default           { 'Other' }
            }
            $products += @{
                product_name = $name
                product_family = $family
                version = $_.DisplayVersion
                edition = ''
            }
        }
    }
$products | ConvertTo-Json -Depth 3
"""

PS_CLUSTER = r"""
try {
    $cluster = Get-Cluster -ErrorAction Stop
    @{ is_clustered=$true; cluster_name=$cluster.Name } | ConvertTo-Json
} catch {
    @{ is_clustered=$false; cluster_name='' } | ConvertTo-Json
}
"""


def _expand_targets(targets):
    """Expand subnets into individual IPs."""
    result = []
    for t in targets:
        if t.get("is_subnet") and "/" in t["hostname"]:
            try:
                net = ipaddress.ip_network(t["hostname"], strict=False)
                for ip in net.hosts():
                    result.append({**t, "hostname": str(ip), "is_subnet": False})
            except ValueError:
                result.append(t)
        else:
            result.append(t)
    return result


def _run_ps(session, script):
    """Execute PowerShell via WinRM and return stdout."""
    import winrm
    result = session.run_ps(script)
    if result.status_code != 0:
        raise RuntimeError(result.std_err.decode("utf-8", errors="replace"))
    return result.std_out.decode("utf-8", errors="replace").strip()


def _scan_host_sync(hostname, cred):
    """Synchronous scan of a single host via WinRM. Called in thread pool."""
    import winrm, json
    transport = cred.get("transport", "ntlm")
    port = cred.get("port", 5985)
    scheme = "https" if cred.get("use_https") else "http"
    url = f"{scheme}://{hostname}:{port}/wsman"
    username = cred.get("username", "")
    if cred.get("domain") and "\\" not in username:
        username = f"{cred['domain']}\\{username}"
    session = winrm.Session(url, auth=(username, cred.get("password", "")),
        transport=transport, server_cert_validation="ignore" if not cred.get("verify_ssl") else "validate")

    host_json = _run_ps(session, PS_HOST_INFO)
    host_data = json.loads(host_json) if host_json else {}
    edition = _run_ps(session, PS_OS_EDITION).strip()
    if edition:
        host_data["os_edition"] = edition

    sql_json = _run_ps(session, PS_SQL_INSTANCES)
    sql_instances = json.loads(sql_json) if sql_json and sql_json != "null" else []
    if isinstance(sql_instances, dict):
        sql_instances = [sql_instances]

    cluster_json = _run_ps(session, PS_CLUSTER)
    cluster_info = json.loads(cluster_json) if cluster_json else {}

    prod_json = _run_ps(session, PS_PRODUCTS)
    products = json.loads(prod_json) if prod_json and prod_json != "null" else []
    if isinstance(products, dict):
        products = [products]

    for inst in sql_instances:
        inst["is_clustered"] = cluster_info.get("is_clustered", False)
        inst["cluster_name"] = cluster_info.get("cluster_name", "")

    return {"host": host_data, "sql_instances": sql_instances, "installed_products": products}


async def scan(pool, targets, cred, scan_id=None):
    """Scan all WinRM targets. Returns (scanned, failed, errors)."""
    expanded = _expand_targets(targets)
    executor = ThreadPoolExecutor(max_workers=10)
    loop = asyncio.get_event_loop()
    scanned = 0
    failed = 0
    errors = []

    from main import upsert_host, upsert_sql_instance, upsert_product

    for target in expanded:
        hostname = target["hostname"]
        try:
            result = await loop.run_in_executor(executor, _scan_host_sync, hostname, cred)
            async with pool.acquire() as conn:
                host_id = await upsert_host(conn, result["host"], "winrm")
                for inst in (result.get("sql_instances") or []):
                    if inst.get("instance_name"):
                        await upsert_sql_instance(conn, host_id, inst)
                for prod in (result.get("installed_products") or []):
                    if prod.get("product_name"):
                        await upsert_product(conn, host_id, prod)
            scanned += 1
            log.info(f"WinRM scanned: {hostname}")
        except Exception as e:
            failed += 1
            err_msg = str(e)[:500]
            errors.append({"hostname": hostname, "error_type": "winrm", "error_message": err_msg})
            log.warning(f"WinRM failed: {hostname}: {err_msg}")

    executor.shutdown(wait=False)
    return scanned, failed, errors
