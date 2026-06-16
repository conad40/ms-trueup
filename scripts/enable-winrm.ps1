# Run this on target servers (or deploy via GPO) to enable WinRM for the collector
# Must be run as Administrator

# Enable WinRM
Enable-PSRemoting -Force -SkipNetworkProfileCheck

# Allow HTTP (port 5985) from the Docker host IP
$dockerHostIP = Read-Host "Enter the Docker host IP address"
Set-Item WSMan:\localhost\Client\TrustedHosts -Value $dockerHostIP -Force

# Configure firewall
New-NetFirewallRule -Name "WinRM-HTTP" -DisplayName "WinRM HTTP" `
    -Direction Inbound -Protocol TCP -LocalPort 5985 -Action Allow `
    -RemoteAddress $dockerHostIP -ErrorAction SilentlyContinue

# Increase max shell memory for large inventories
Set-Item WSMan:\localhost\Shell\MaxMemoryPerShellMB 512

Write-Host "WinRM configured. Test with: Test-WSMan -ComputerName $env:COMPUTERNAME" -ForegroundColor Green
