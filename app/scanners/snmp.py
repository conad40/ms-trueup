"""SNMP scanner — lightweight host discovery via SNMP. Gets hostname, OS, basic info."""
import asyncio, logging

log = logging.getLogger("trueup.snmp")

# Standard OIDs
OID_SYS_NAME = "1.3.6.1.2.1.1.5.0"
OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0"
OID_HR_CPU = "1.3.6.1.2.1.25.3.3.1.2"  # hrProcessorLoad table
OID_HR_MEM_SIZE = "1.3.6.1.2.1.25.2.2.0"
OID_IF_DESCR = "1.3.6.1.2.1.2.2.1.2"


async def _query_host(target, community, version="2c"):
    """Query a single host via SNMP."""
    from pysnmp.hlapi.v3arch.asyncio import (
        get_cmd, SnmpEngine, CommunityData, UdpTransportTarget,
        ContextData, ObjectType, ObjectIdentity
    )
    engine = SnmpEngine()
    transport = await UdpTransportTarget.create((target, 161), timeout=5, retries=1)
    community_data = CommunityData(community, mpModel=1 if version == "2c" else 0)

    results = {}
    oids = [OID_SYS_NAME, OID_SYS_DESCR, OID_HR_MEM_SIZE]

    for oid in oids:
        try:
            err_indication, err_status, err_index, var_binds = await get_cmd(
                engine, community_data, transport, ContextData(),
                ObjectType(ObjectIdentity(oid)))
            if not err_indication and not err_status and var_binds:
                results[oid] = str(var_binds[0][1])
        except Exception:
            pass

    if not results:
        return None

    hostname = results.get(OID_SYS_NAME, target)
    descr = results.get(OID_SYS_DESCR, "")

    os_name = None
    is_virtual = False
    if "Windows" in descr:
        os_name = descr.split("\r\n")[0] if "\r\n" in descr else descr[:200]
    elif "Linux" in descr:
        os_name = "Linux"
    elif "VMware" in descr or "ESXi" in descr:
        os_name = "VMware ESXi"

    mem_kb = results.get(OID_HR_MEM_SIZE)
    ram_gb = round(int(mem_kb) / 1048576, 2) if mem_kb and mem_kb.isdigit() else None

    return {
        "hostname": hostname.split(".")[0] if hostname else target,
        "ip_address": target,
        "os_name": os_name,
        "ram_gb": ram_gb,
        "is_virtual": is_virtual,
    }


async def scan(pool, targets, community="public", version="2c"):
    """Scan targets via SNMP. Returns (scanned, failed, errors)."""
    from main import upsert_host

    scanned = 0
    failed = 0
    errors = []

    tasks = []
    for t in targets:
        hostname = t["hostname"]
        tasks.append((hostname, _query_host(hostname, community, version)))

    for hostname, coro in tasks:
        try:
            result = await asyncio.wait_for(coro, timeout=15)
            if result:
                async with pool.acquire() as conn:
                    await upsert_host(conn, result, "snmp")
                scanned += 1
                log.info(f"SNMP scanned: {hostname}")
            else:
                failed += 1
                errors.append({"hostname": hostname, "error_type": "snmp", "error_message": "No SNMP response"})
        except asyncio.TimeoutError:
            failed += 1
            errors.append({"hostname": hostname, "error_type": "snmp", "error_message": "Timeout"})
        except Exception as e:
            failed += 1
            errors.append({"hostname": hostname, "error_type": "snmp", "error_message": str(e)[:500]})
            log.warning(f"SNMP failed: {hostname}: {e}")

    return scanned, failed, errors
