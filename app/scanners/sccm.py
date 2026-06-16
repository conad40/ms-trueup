"""SCCM scanner — pulls device inventory from SCCM Admin Service REST API."""
import logging, re
import httpx
from httpx_ntlm import HttpNtlmAuth

log = logging.getLogger("trueup.sccm")

# OData endpoints
DEVICES_ENDPOINT = "/AdminService/v1.0/Device"
DEVICE_DETAIL = "/AdminService/wmi/SMS_G_System_COMPUTER_SYSTEM"
PROCESSOR_DETAIL = "/AdminService/wmi/SMS_G_System_PROCESSOR"
OS_DETAIL = "/AdminService/wmi/SMS_G_System_OPERATING_SYSTEM"
SQL_DETAIL = "/AdminService/wmi/SMS_G_System_ADD_REMOVE_PROGRAMS"


def _is_server_os(name):
    return "server" in (name or "").lower()


def _extract_edition(caption):
    if not caption: return None
    if "datacenter" in caption.lower(): return "Datacenter"
    if "standard" in caption.lower(): return "Standard"
    return None


async def scan(pool, instances):
    """Scan all configured SCCM instances. Returns (scanned, failed, errors)."""
    from main import upsert_host, upsert_product

    total_scanned = 0
    total_failed = 0
    all_errors = []

    for inst in instances:
        base_url = (inst.get("server_url") or "").rstrip("/")
        inst_name = inst.get("name", base_url)
        inst_id = inst.get("id")
        verify_ssl = bool(inst.get("verify_ssl", False))
        cred = inst.get("_credential", {})
        username = cred.get("username", "")
        password = cred.get("password", "")
        domain = cred.get("domain", "")

        if not base_url or not username:
            log.warning(f"SCCM instance {inst_name}: not configured, skipping")
            continue

        # NTLM uses DOMAIN\username format
        if domain and "@" not in username and "\\" not in username:
            username = f"{domain}\\{username}"

        auth = HttpNtlmAuth(username, password)
        scanned = 0
        failed = 0
        errors = []

        try:
            async with httpx.AsyncClient(auth=auth, verify=verify_ssl, timeout=60) as client:
                # Get all devices
                resp = await client.get(f"{base_url}{DEVICES_ENDPOINT}")
                resp.raise_for_status()
                devices = resp.json().get("value", [])

                for device in devices:
                    hostname = (device.get("Name") or "").strip()
                    if not hostname:
                        continue
                    try:
                        resource_id = device.get("MachineId") or device.get("ResourceId")
                        host_data = {
                            "hostname": hostname,
                            "domain": device.get("Domain"),
                            "os_name": device.get("OperatingSystemNameandVersion"),
                            "ip_address": device.get("IPAddresses", [None])[0] if device.get("IPAddresses") else None,
                            "is_virtual": device.get("IsVirtualMachine", False),
                        }

                        # Try to get more detail via WMI classes
                        if resource_id:
                            try:
                                cs_resp = await client.get(f"{base_url}{DEVICE_DETAIL}?$filter=ResourceId eq {resource_id}")
                                if cs_resp.status_code == 200:
                                    cs_list = cs_resp.json().get("value", [])
                                    if cs_list:
                                        cs = cs_list[0]
                                        host_data["cpu_sockets"] = cs.get("NumberOfProcessors")
                            except Exception:
                                pass

                            try:
                                cpu_resp = await client.get(f"{base_url}{PROCESSOR_DETAIL}?$filter=ResourceId eq {resource_id}")
                                if cpu_resp.status_code == 200:
                                    cpus = cpu_resp.json().get("value", [])
                                    if cpus:
                                        host_data["cpu_model"] = cpus[0].get("Name")
                                        host_data["cpu_cores"] = sum(c.get("NumberOfCores", 0) for c in cpus)
                                        host_data["cpu_logical"] = sum(c.get("NumberOfLogicalProcessors", 0) for c in cpus)
                            except Exception:
                                pass

                            try:
                                os_resp = await client.get(f"{base_url}{OS_DETAIL}?$filter=ResourceId eq {resource_id}")
                                if os_resp.status_code == 200:
                                    os_list = os_resp.json().get("value", [])
                                    if os_list:
                                        os_info = os_list[0]
                                        caption = os_info.get("Caption", "")
                                        host_data["os_name"] = caption or host_data.get("os_name")
                                        host_data["os_version"] = os_info.get("Version")
                                        host_data["os_edition"] = _extract_edition(caption)
                                        ram_kb = os_info.get("TotalVisibleMemorySize")
                                        if ram_kb:
                                            host_data["ram_gb"] = round(int(ram_kb) / 1048576, 2)
                            except Exception:
                                pass

                        async with pool.acquire() as conn:
                            host_id = await upsert_host(conn, host_data, "sccm")

                            # Get installed MS products
                            if resource_id:
                                try:
                                    prod_resp = await client.get(
                                        f"{base_url}{SQL_DETAIL}?$filter=ResourceId eq {resource_id} and "
                                        f"substringof('Microsoft',DisplayName0) eq true")
                                    if prod_resp.status_code == 200:
                                        for p in prod_resp.json().get("value", []):
                                            name = p.get("DisplayName0", "")
                                            if name:
                                                family = "Other"
                                                if "SQL" in name: family = "SQLServer"
                                                elif "Office" in name: family = "Office"
                                                elif "Visual Studio" in name: family = "VisualStudio"
                                                elif "SharePoint" in name: family = "SharePoint"
                                                await upsert_product(conn, host_id, {
                                                    "product_name": name, "product_family": family,
                                                    "version": p.get("Version0"), "edition": ""})
                                except Exception:
                                    pass

                        scanned += 1
                    except Exception as e:
                        failed += 1
                        errors.append({"hostname": hostname, "error_type": "sccm", "error_message": str(e)[:500]})
                        log.warning(f"SCCM {inst_name} failed for {hostname}: {e}")

            # Update instance stats
            if inst_id is not None:
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE sccm_instances SET last_scan=NOW(), hosts_found=$1 WHERE id=$2",
                        scanned, inst_id)

        except Exception as e:
            log.error(f"SCCM instance {inst_name} connection failed: {e}")
            errors.append({"hostname": inst_name, "error_type": "sccm_connection", "error_message": str(e)[:500]})

        total_scanned += scanned
        total_failed += failed
        all_errors.extend(errors)
        log.info(f"SCCM {inst_name}: scanned={scanned}, failed={failed}")

    return total_scanned, total_failed, all_errors
