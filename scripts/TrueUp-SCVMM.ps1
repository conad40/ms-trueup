<#
.SYNOPSIS
    MS License True-Up - SCVMM Collector.
    Queries System Center Virtual Machine Manager for Hyper-V host and VM inventory,
    then POSTs each host to the TrueUp API.

.DESCRIPTION
    Run this as a scheduled task on each SCVMM server. It enumerates:
    - All Hyper-V hosts managed by this VMM instance (physical cores, sockets, RAM)
    - All VMs and their host placement (for VM-to-physical-host mapping)
    - Cluster membership
    - Host OS edition

    Each physical host and VM is reported individually to /api/ingest with scan_source='scvmm'.

.PARAMETER ApiUrl
    Base URL of the TrueUp API (e.g. http://trueup.corp.local:8000)

.PARAMETER ApiKey
    Shared secret matching the agent_api_key setting in the TrueUp dashboard.

.PARAMETER VMMServer
    VMM server to connect to. Defaults to localhost.

.PARAMETER LogPath
    Optional log file path. Defaults to C:\ProgramData\TrueUp\scvmm-collector.log
#>

param(
    [string]$ApiUrl = "http://xdcvudocker01.emplify.org:8000",

    [string]$ApiKey = "0CJo79gwVOEewsE53PzgrY93crCGsWXMjd0F6knt1p8",

    [string]$VMMServer = "localhost",

    [string]$LogDir = "C:\ProgramData\TrueUp\logs"
)

$ErrorActionPreference = "Continue"

if (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$LogPath = Join-Path $LogDir ("scvmm-collector-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$ts [$Level] $Message"
    Add-Content -Path $LogPath -Value $line
}

function Send-Report {
    param([hashtable]$Payload)
    $json = $Payload | ConvertTo-Json -Depth 5 -Compress
    $uri = "$($ApiUrl.TrimEnd('/'))/api/ingest"
    try {
        if ($PSVersionTable.PSVersion.Major -ge 6) {
            $response = Invoke-RestMethod -Uri $uri -Method POST -Body $json `
                -ContentType 'application/json' -Headers @{ 'X-Api-Key' = $ApiKey } `
                -SkipCertificateCheck -TimeoutSec 30
        } else {
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
            $response = Invoke-RestMethod -Uri $uri -Method POST -Body $json `
                -ContentType 'application/json' -Headers @{ 'X-Api-Key' = $ApiKey } `
                -TimeoutSec 30
        }
        return $response
    } catch {
        Write-Log "Failed to send report: $_" "ERROR"
        return $null
    }
}

Write-Log "SCVMM Collector starting - VMM server: $VMMServer"

try {
    Import-Module VirtualMachineManager -ErrorAction Stop
} catch {
    Write-Log "Failed to import VirtualMachineManager module. Is the VMM console installed? $_" "ERROR"
    exit 1
}

try {
    $vmm = Get-SCVMMServer -ComputerName $VMMServer -ErrorAction Stop
    Write-Log "Connected to VMM: $($vmm.Name)"
} catch {
    Write-Log "Failed to connect to VMM server ${VMMServer}: $_" "ERROR"
    exit 1
}

# Collect Hyper-V Hosts
Write-Log "Enumerating Hyper-V hosts..."
$vmmHosts = Get-SCVMHost -VMMServer $vmm
$hostCount = 0
$vmCount = 0

foreach ($h in $vmmHosts) {
    try {
        # Resolve hostname with fallbacks
        $hostName = $h.ComputerName
        if (-not $hostName) { $hostName = $h.Name }
        if (-not $hostName) { $hostName = $h.FQDN }
        if (-not $hostName) {
            Write-Log "Skipping host with no name (FQDN: $($h.FQDN))" "WARN"
            continue
        }

        $osName = ''
        if ($h.OperatingSystem) { $osName = $h.OperatingSystem.Name }
        $osVersion = ''
        if ($h.OperatingSystem -and $h.OperatingSystem.Version) {
            $osVersion = $h.OperatingSystem.Version.ToString()
        }

        $edition = switch -Regex ($osName) {
            'Datacenter'  { 'Datacenter' }
            'Standard'    { 'Standard' }
            'Essentials'  { 'Essentials' }
            default       { 'Unknown' }
        }

        $cluster = $h.HostCluster
        $clusterName = $null
        if ($cluster) { $clusterName = $cluster.Name }

        $hostCores = 0
        if ($h.CoresPerCPU -and $h.PhysicalCPUCount) {
            $hostCores = [int]($h.CoresPerCPU) * [int]($h.PhysicalCPUCount)
        } elseif ($h.LogicalCPUCount) {
            $hostCores = [int]($h.LogicalCPUCount)
        }

        # Get IP as a plain string
        $ipAddr = $null
        $rawIp = $h.ManagedIPs | Select-Object -First 1
        if ($rawIp) { $ipAddr = "$rawIp" }

        $ramGb = 0
        if ($h.TotalMemory -and $h.TotalMemory -gt 0) {
            $ramGb = [math]::Round($h.TotalMemory / 1GB, 2)
        }

        $cpuSockets = 0
        if ($h.PhysicalCPUCount) { $cpuSockets = [int]($h.PhysicalCPUCount) }
        $cpuLogical = 0
        if ($h.LogicalCPUCount) { $cpuLogical = [int]($h.LogicalCPUCount) }

        $cpuModel = $null
        if ($h.ProcessorModel) { $cpuModel = "$($h.ProcessorModel)" }

        $hostInfo = @{
            hostname        = $hostName
            ip_address      = $ipAddr
            domain          = $h.DomainName
            os_name         = $osName
            os_version      = $osVersion
            os_edition      = $edition
            is_virtual      = $false
            hypervisor_host = $null
            cpu_sockets     = $cpuSockets
            cpu_cores       = $hostCores
            cpu_logical     = $cpuLogical
            cpu_model       = $cpuModel
            ram_gb          = $ramGb
        }

        Write-Log "DEBUG host payload: hostname=$hostName, ip=$ipAddr, cores=$hostCores, sockets=$cpuSockets, ram=$ramGb, os=$osName"

        $hostVmCount = ($h.VMs | Measure-Object).Count

        $scvmmMeta = @{
            vmm_server  = $VMMServer
            cluster     = $clusterName
            host_status = $h.OverallState.ToString()
            vm_count    = $hostVmCount
        }

        $payload = @{
            host               = $hostInfo
            scan_source        = 'scvmm'
            scvmm_metadata     = $scvmmMeta
            sql_instances      = @()
            installed_products = @()
        }

        $result = Send-Report -Payload $payload
        if ($result) {
            Write-Log "Host: $($h.ComputerName) - $($hostInfo.cpu_sockets)S/$($hostInfo.cpu_cores)C, $edition, Cluster: $clusterName"
            $hostCount++
        }
    } catch {
        Write-Log "Failed to process host $($h.ComputerName): $_" "ERROR"
    }
}

# Collect VMs
Write-Log "Enumerating VMs..."
$vms = Get-SCVirtualMachine -VMMServer $vmm

foreach ($vm in $vms) {
    try {
        if (-not $vm.VMHost) { continue }

        # Resolve VM hostname with fallbacks
        $vmHostname = $vm.ComputerName
        if (-not $vmHostname) { $vmHostname = $vm.Name }
        if (-not $vmHostname) {
            Write-Log "Skipping VM with no name" "WARN"
            continue
        }

        $osName = ''
        if ($vm.OperatingSystem) { $osName = $vm.OperatingSystem.Name }

        # Skip non-server OS if we can detect it
        if ($osName -and $osName -notmatch 'Server' -and $osName -notmatch 'Unknown') {
            continue
        }

        $edition = switch -Regex ($osName) {
            'Datacenter'  { 'Datacenter' }
            'Standard'    { 'Standard' }
            'Essentials'  { 'Essentials' }
            default       { 'Unknown' }
        }

        $vmIp = $null
        $adapters = $vm.VirtualNetworkAdapters
        if ($adapters) {
            $rawVmIp = $adapters | ForEach-Object { $_.IPv4Addresses } | Select-Object -First 1
            if ($rawVmIp) { $vmIp = "$rawVmIp" }
        }

        $hostClusterName = $null
        if ($vm.VMHost.HostCluster) { $hostClusterName = $vm.VMHost.HostCluster.Name }

        $vmCpu = 0
        if ($vm.CPUCount) { $vmCpu = [int]($vm.CPUCount) }

        $vmRam = 0
        if ($vm.Memory -and $vm.Memory -gt 0) { $vmRam = [math]::Round($vm.Memory / 1024, 2) }

        $hypervisorHost = $null
        if ($vm.VMHost.ComputerName) { $hypervisorHost = $vm.VMHost.ComputerName }

        $vmInfo = @{
            hostname        = $vmHostname
            ip_address      = $vmIp
            domain          = ''
            os_name         = $osName
            os_version      = ''
            os_edition      = $edition
            is_virtual      = $true
            hypervisor_host = $hypervisorHost
            cpu_sockets     = 1
            cpu_cores       = $vmCpu
            cpu_logical     = $vmCpu
            ram_gb          = $vmRam
        }

        Write-Log "DEBUG VM payload: hostname=$vmHostname, ip=$vmIp, cores=$vmCpu, ram=$vmRam, host=$hypervisorHost"

        $scvmmMeta = @{
            vmm_server   = $VMMServer
            vm_status    = $vm.Status.ToString()
            vm_id        = $vm.VMId.ToString()
            host_cluster = $hostClusterName
        }

        $payload = @{
            host               = $vmInfo
            scan_source        = 'scvmm'
            scvmm_metadata     = $scvmmMeta
            sql_instances      = @()
            installed_products = @()
        }

        $result = Send-Report -Payload $payload
        if ($result) {
            $vmCount++
        }
    } catch {
        Write-Log "Failed to process VM $($vm.Name): $_" "WARN"
    }
}

Write-Log "SCVMM Collector finished - $hostCount hosts, $vmCount VMs reported from $VMMServer"

# Keep only the last 10 log files
$logs = Get-ChildItem -Path $LogDir -Filter "scvmm-collector-*.log" | Sort-Object Name -Descending
if ($logs.Count -gt 10) {
    $logs | Select-Object -Skip 10 | Remove-Item -Force
}
