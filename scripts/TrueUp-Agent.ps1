<#
.SYNOPSIS
    MS License True-Up Agent - runs locally as SYSTEM, collects inventory, POSTs to the API.

.DESCRIPTION
    Deploy this as a scheduled task (via GPO or manually) on each Windows Server.
    It collects OS info, CPU/core counts, SQL Server instances, and installed MS products,
    then sends the data to the TrueUp API over HTTPS/HTTP.

    No WinRM, no remote credentials, no firewall rules needed on target servers.
    Only requires outbound HTTP(S) to the API server.

.PARAMETER ApiUrl
    Base URL of the TrueUp API (e.g. http://trueup.corp.local:8000)

.PARAMETER ApiKey
    Shared secret matching the agent_api_key setting in the TrueUp dashboard.

.PARAMETER LogPath
    Optional log file path. Defaults to C:\ProgramData\TrueUp\agent.log
#>

param(
    [string]$ApiUrl = "http://xdcvudocker01.emplify.org:8000",

    [string]$ApiKey = "0CJo79gwVOEewsE53PzgrY93crCGsWXMjd0F6knt1p8",

    [string]$LogDir = "C:\ProgramData\TrueUp\logs"
)

$ErrorActionPreference = "Continue"

if (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$LogPath = Join-Path $LogDir ("agent-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$ts [$Level] $Message"
    Add-Content -Path $LogPath -Value $line
    if ($Level -eq "ERROR") { Write-Error $Message }
}

Write-Log "TrueUp Agent starting"

# 1. Host Info
try {
    $os  = Get-CimInstance Win32_OperatingSystem
    $cs  = Get-CimInstance Win32_ComputerSystem
    $cpu = @(Get-CimInstance Win32_Processor)

    # Skip workstations
    if ($os.Caption -notmatch 'Server') {
        Write-Log "Skipping: not a Server OS ($($os.Caption))"
        exit 0
    }

    $isVirtual = $cs.Model -match 'Virtual|VMware|KVM|Xen|HyperV'
    $hypervisor = $null
    if ($isVirtual) { $hypervisor = $cs.Manufacturer }

    $edition = switch -Regex ($os.Caption) {
        'Datacenter'  { 'Datacenter' }
        'Standard'    { 'Standard' }
        'Essentials'  { 'Essentials' }
        'Foundation'  { 'Foundation' }
        'Web'         { 'Web' }
        default       { 'Unknown' }
    }

    # Get the server's primary IP
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.PrefixOrigin -ne 'WellKnown' -and $_.IPAddress -ne '127.0.0.1' } |
        Sort-Object -Property InterfaceIndex |
        Select-Object -First 1).IPAddress

    $hostInfo = @{
        hostname        = $env:COMPUTERNAME
        ip_address      = $ip
        domain          = $cs.Domain
        os_name         = $os.Caption
        os_version      = $os.Version
        os_edition      = $edition
        is_virtual      = [bool]$isVirtual
        hypervisor_host = $hypervisor
        cpu_sockets     = $cpu.Count
        cpu_cores       = ($cpu | Measure-Object -Property NumberOfCores -Sum).Sum
        cpu_logical     = ($cpu | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
        cpu_model       = ($cpu | Select-Object -First 1).Name
        ram_gb          = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
    }

    Write-Log "Host: $($hostInfo.hostname), Edition: $edition, Cores: $($hostInfo.cpu_cores), Virtual: $isVirtual"
} catch {
    Write-Log "Failed to collect host info: $_" "ERROR"
    exit 1
}

# 2. SQL Server Instances
$sqlInstances = @()
try {
    $services = Get-Service | Where-Object { $_.Name -match '^MSSQL\$|^MSSQLSERVER$' -and $_.Status -eq 'Running' }

    foreach ($svc in $services) {
        $instanceName = $svc.Name -replace '^MSSQL\$', ''
        if ($svc.Name -eq 'MSSQLSERVER') { $instanceName = 'MSSQLSERVER' }

        try {
            $reg = [Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine', 'Default')
            $sqlKey = $reg.OpenSubKey("SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL")
            $instId = $sqlKey.GetValue($instanceName)
            $setupKey = $reg.OpenSubKey("SOFTWARE\Microsoft\Microsoft SQL Server\$instId\Setup")

            $sqlEdition  = $setupKey.GetValue('Edition')
            $sqlVersion  = $setupKey.GetValue('Version')
            $patchLevel  = $setupKey.GetValue('PatchLevel')

            $licModel = switch -Regex ($sqlEdition) {
                'Enterprise' { 'core' }
                'Standard'   { 'core' }
                'Express'    { 'express' }
                'Developer'  { 'developer' }
                'Web'        { 'core' }
                default      { 'unknown' }
            }

            $versionName = switch -Regex ($sqlVersion) {
                '^16\.' { 'SQL Server 2022' }
                '^15\.' { 'SQL Server 2019' }
                '^14\.' { 'SQL Server 2017' }
                '^13\.' { 'SQL Server 2016' }
                '^12\.' { 'SQL Server 2014' }
                '^11\.' { 'SQL Server 2012' }
                default  { "SQL Server ($sqlVersion)" }
            }

            $clusterKey = $reg.OpenSubKey("SOFTWARE\Microsoft\Microsoft SQL Server\$instId\Cluster")
            $isClustered = $null -ne $clusterKey
            $clusterName = $null
            if ($isClustered) { $clusterName = $clusterKey.GetValue('ClusterName') }

            $sqlInstances += @{
                instance_name = $instanceName
                edition       = $sqlEdition
                version       = $patchLevel
                version_name  = $versionName
                license_model = $licModel
                is_clustered  = $isClustered
                cluster_name  = $clusterName
            }

            Write-Log "SQL: $instanceName ($sqlEdition, $versionName)"
        } catch {
            $sqlInstances += @{
                instance_name = $instanceName
                edition       = 'Unknown'
                version       = 'Unknown'
                version_name  = 'Unknown'
                license_model = 'unknown'
                is_clustered  = $false
                cluster_name  = $null
            }
            Write-Log "SQL instance $instanceName - partial info: $_" "WARN"
        }
    }
} catch {
    Write-Log "SQL discovery error (non-fatal): $_" "WARN"
}

# 3. Installed Microsoft Products
$products = @()
try {
    $msProducts = Get-CimInstance Win32_Product |
        Where-Object { $_.Vendor -match 'Microsoft' -and $_.Name -match
            'Exchange|System Center|SharePoint|Skype|Lync|BizTalk|Dynamics|Visual Studio|Project Server|Remote Desktop' }

    foreach ($p in $msProducts) {
        $family = switch -Regex ($p.Name) {
            'Exchange'       { 'Exchange' }
            'System Center'  { 'SystemCenter' }
            'SharePoint'     { 'SharePoint' }
            'Skype|Lync'     { 'SkypeForBusiness' }
            'BizTalk'        { 'BizTalk' }
            'Dynamics'       { 'Dynamics' }
            'Visual Studio'  { 'VisualStudio' }
            'Remote Desktop' { 'RDS' }
            default          { 'Other' }
        }
        $products += @{
            product_name   = $p.Name
            product_family = $family
            version        = $p.Version
            edition        = ''
        }
    }

    # Windows features/roles
    try {
        $features = Get-WindowsFeature | Where-Object { $_.Installed -and $_.Name -match
            'RDS-|ADFS|AD-Domain|DHCP|DNS|Hyper-V|WSUS|WDS' }
        foreach ($f in $features) {
            $family = switch -Regex ($f.Name) {
                'RDS-'    { 'RDS' }
                'Hyper-V' { 'HyperV' }
                'ADFS'    { 'ADFS' }
                'WSUS'    { 'WSUS' }
                default   { 'WindowsRole' }
            }
            $products += @{
                product_name   = $f.DisplayName
                product_family = $family
                version        = ''
                edition        = ''
            }
        }
    } catch {
        Write-Log "WindowsFeature not available (non-fatal): $_" "WARN"
    }

    Write-Log "Products found: $($products.Count)"
} catch {
    Write-Log "Product discovery error (non-fatal): $_" "WARN"
}

# 4. Build and Send Payload
$payload = @{
    host               = $hostInfo
    sql_instances      = $sqlInstances
    installed_products = $products
} | ConvertTo-Json -Depth 5 -Compress

$uri = "$($ApiUrl.TrimEnd('/'))/api/ingest"

try {
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $response = Invoke-RestMethod -Uri $uri -Method POST -Body $payload `
            -ContentType 'application/json' -Headers @{ 'X-Api-Key' = $ApiKey } `
            -SkipCertificateCheck -TimeoutSec 30
    } else {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
        $response = Invoke-RestMethod -Uri $uri -Method POST -Body $payload `
            -ContentType 'application/json' -Headers @{ 'X-Api-Key' = $ApiKey } `
            -TimeoutSec 30
    }

    Write-Log "Report sent OK: host_id=$($response.host_id)"
} catch {
    Write-Log "Failed to send report to ${uri}: $_" "ERROR"
    exit 1
}

Write-Log "TrueUp Agent finished"

# Keep only the last 10 log files
$logs = Get-ChildItem -Path $LogDir -Filter "agent-*.log" | Sort-Object Name -Descending
if ($logs.Count -gt 10) {
    $logs | Select-Object -Skip 10 | Remove-Item -Force
}
