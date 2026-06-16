"""vCenter scanner — connects via pyVmomi, discovers ESXi hosts and VMs."""
import logging, ssl, atexit
from concurrent.futures import ThreadPoolExecutor
import asyncio

log = logging.getLogger("trueup.vcenter")


def _connect(host, user, password, port=443, verify_ssl=False):
    """Connect to vCenter and return ServiceInstance."""
    from pyVmomi import vim
    from pyVim.connect import SmartConnect, Disconnect
    ctx = None
    if not verify_ssl:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    si = SmartConnect(host=host, user=user, pwd=password, port=int(port), sslContext=ctx)
    atexit.register(Disconnect, si)
    return si


def _get_all_vms_and_hosts(si):
    """Walk the inventory and return (esxi_hosts, vms)."""
    from pyVmomi import vim
    content = si.RetrieveContent()
    container = content.viewManager.CreateContainerView(content.rootFolder, [vim.HostSystem], True)
    esxi_hosts = list(container.view)
    container.Destroy()

    container = content.viewManager.CreateContainerView(content.rootFolder, [vim.VirtualMachine], True)
    vms = list(container.view)
    container.Destroy()

    return esxi_hosts, vms


def _scan_sync(host, user, password, port, verify_ssl):
    """Synchronous vCenter scan. Runs in thread pool."""
    si = _connect(host, user, password, port, verify_ssl)
    esxi_hosts, vms = _get_all_vms_and_hosts(si)

    results = {"hosts": [], "vms": []}

    for h in esxi_hosts:
        hw = h.hardware
        try:
            results["hosts"].append({
                "hostname": h.name,
                "os_name": f"VMware ESXi {h.config.product.version}" if h.config else "VMware ESXi",
                "os_version": h.config.product.version if h.config else None,
                "cpu_sockets": hw.cpuInfo.numCpuPackages,
                "cpu_cores": hw.cpuInfo.numCpuCores,
                "cpu_logical": hw.cpuInfo.numCpuThreads,
                "cpu_model": hw.cpuPkg[0].description if hw.cpuPkg else None,
                "ram_gb": round(hw.memorySize / (1024**3), 2),
                "is_virtual": False,
                "ip_address": None,
            })
        except Exception as e:
            log.warning(f"Failed to read ESXi host {h.name}: {e}")

    for vm in vms:
        if vm.config and vm.config.template:
            continue
        try:
            runtime = vm.runtime
            guest = vm.guest
            host_system = runtime.host
            hyp_name = host_system.name if host_system else ""

            # For VMs: cpu_sockets=1 (not numCPU which is vCPU count)
            results["vms"].append({
                "hostname": vm.name,
                "os_name": guest.guestFullName if guest else (vm.config.guestFullName if vm.config else None),
                "cpu_sockets": 1,  # VMs always 1 socket
                "cpu_cores": vm.config.hardware.numCPU if vm.config else None,
                "cpu_logical": vm.config.hardware.numCPU if vm.config else None,
                "ram_gb": round(vm.config.hardware.memoryMB / 1024, 2) if vm.config else None,
                "is_virtual": True,
                "hypervisor_host": hyp_name,
                "ip_address": guest.ipAddress if guest else None,
            })
        except Exception as e:
            log.warning(f"Failed to read VM {vm.name}: {e}")

    return results


async def scan(pool, instances):
    """Scan all configured vCenter instances. Returns (scanned, failed, errors)."""
    from main import upsert_host

    executor = ThreadPoolExecutor(max_workers=4)
    loop = asyncio.get_event_loop()
    total_scanned = 0
    total_failed = 0
    all_errors = []

    for inst in instances:
        vc_host = inst["hostname"]
        cred = inst.get("_credential", {})
        if not cred.get("username"):
            log.warning(f"vCenter {vc_host}: no credentials")
            continue

        try:
            user = cred["username"]
            domain = cred.get("domain", "")
            if domain and "@" not in user and "\\" not in user:
                user = f"{user}@{domain}"
            result = await loop.run_in_executor(executor, _scan_sync,
                vc_host, user, cred.get("password", ""),
                int(cred.get("port") or 443), bool(cred.get("verify_ssl", False)))

            async with pool.acquire() as conn:
                for h in result["hosts"]:
                    await upsert_host(conn, h, "vcenter")
                    total_scanned += 1

                for vm in result["vms"]:
                    await upsert_host(conn, vm, "vcenter")
                    total_scanned += 1

                # Update vcenter_instances stats
                await conn.execute(
                    "UPDATE vcenter_instances SET last_scan=NOW(), hosts_found=$1, vms_found=$2 WHERE id=$3",
                    len(result["hosts"]), len(result["vms"]), inst["id"])

            log.info(f"vCenter {vc_host}: {len(result['hosts'])} hosts, {len(result['vms'])} VMs")
        except Exception as e:
            total_failed += 1
            all_errors.append({"hostname": vc_host, "error_type": "vcenter", "error_message": str(e)[:500]})
            log.error(f"vCenter {vc_host} failed: {e}")

    executor.shutdown(wait=False)
    return total_scanned, total_failed, all_errors
