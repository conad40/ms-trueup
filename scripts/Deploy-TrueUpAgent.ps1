<#
.SYNOPSIS
    Deploy the TrueUp Agent as a daily scheduled task on target servers.
    Run this via GPO startup script, SCCM, or manually on each server.

.DESCRIPTION
    - Copies TrueUp-Agent.ps1 to C:\ProgramData\TrueUp\
    - Creates a scheduled task "TrueUp Inventory Agent" that runs daily at 3 AM as SYSTEM
    - Stores the API URL and key in the task arguments (not in plaintext files)
    - Idempotent: safe to run multiple times (updates existing task)

.PARAMETER ApiUrl
    Base URL of the TrueUp API (e.g. http://trueup.corp.local:8000)

.PARAMETER ApiKey
    Shared secret matching the agent_api_key in the TrueUp dashboard.

.PARAMETER ScriptSource
    UNC path or local path to TrueUp-Agent.ps1.
    Default: same directory as this deploy script.

.PARAMETER ScheduleTime
    Time to run daily (24h format). Default: "03:00"

.PARAMETER TaskName
    Name of the scheduled task. Default: "TrueUp Inventory Agent"

.PARAMETER Uninstall
    Remove the scheduled task and agent files.
#>

param(
    [string]$ApiUrl = "http://xdcvudocker01.emplify.org:8000",

    [string]$ApiKey = "0CJo79gwVOEewsE53PzgrY93crCGsWXMjd0F6knt1p8",

    [string]$ScriptSource = "",

    [string]$ScheduleTime = "03:00",

    [string]$TaskName = "TrueUp Inventory Agent",

    [switch]$Uninstall
)

$InstallDir = "C:\ProgramData\TrueUp"
$AgentScript = Join-Path $InstallDir "TrueUp-Agent.ps1"

# ─── Uninstall ───
if ($Uninstall) {
    Write-Host "Removing TrueUp Agent..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
    Write-Host "Done."
    exit 0
}

# ─── Install / Update ───
Write-Host "Deploying TrueUp Agent..."

# 1. Create install directory
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 2. Copy agent script
if (!$ScriptSource) {
    $ScriptSource = Join-Path $PSScriptRoot "TrueUp-Agent.ps1"
}
if (!(Test-Path $ScriptSource)) {
    Write-Error "Agent script not found at $ScriptSource"
    exit 1
}
Copy-Item -Path $ScriptSource -Destination $AgentScript -Force
Write-Host "  Copied agent script to $AgentScript"

# 3. Create / update scheduled task
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$AgentScript`" -ApiUrl `"$ApiUrl`" -ApiKey `"$ApiKey`""

$trigger = New-ScheduledTaskTrigger -Daily -At $ScheduleTime

# Add random delay (0-30 min) so all servers don't hit the API at once
$trigger.RandomDelay = "PT30M"

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5)

if ($existingTask) {
    Set-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    Write-Host "  Updated existing scheduled task"
} else {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Collects Microsoft licensing inventory and reports to TrueUp server" | Out-Null
    Write-Host "  Created scheduled task"
}

Write-Host "  Schedule: Daily at $ScheduleTime (+ up to 30 min random delay)"
Write-Host "  Run as: SYSTEM"
Write-Host "  API: $ApiUrl"

# 4. Run it once now to verify
Write-Host ""
Write-Host "Running agent now to verify..."
$result = Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 5
$info = Get-ScheduledTaskInfo -TaskName $TaskName
if ($info.LastTaskResult -eq 0) {
    Write-Host "  SUCCESS - agent reported in." -ForegroundColor Green
} else {
    Write-Host "  First run may still be in progress. Check C:\ProgramData\TrueUp\agent.log" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deployment complete. To deploy via GPO:" -ForegroundColor Cyan
Write-Host "  1. Copy TrueUp-Agent.ps1 and Deploy-TrueUpAgent.ps1 to a network share (e.g. \\dc\NETLOGON\TrueUp\)"
Write-Host "  2. Create a GPO > Computer Configuration > Policies > Windows Settings > Scripts > Startup"
Write-Host "  3. Add: powershell.exe -ExecutionPolicy Bypass -File \\dc\NETLOGON\TrueUp\Deploy-TrueUpAgent.ps1 -ApiUrl $ApiUrl -ApiKey $ApiKey"
Write-Host "  4. Link the GPO to your server OUs"
