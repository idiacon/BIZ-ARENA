param(
  [int[]]$Ports = @(3000, 3099),
  [switch]$SetPrivate
)

$ErrorActionPreference = 'Stop'
$firewallProfiles = @('Private', 'Public')

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host ''
Write-Host 'Biz Arena: Windows Firewall setup' -ForegroundColor Cyan
Write-Host '---------------------------------'

if (-not (Test-IsAdmin)) {
  Write-Host 'Run this file as Administrator.' -ForegroundColor Yellow
  exit 1
}

foreach ($port in $Ports) {
  $ruleName = "BizArena-Classroom-TCP-$port"
  $displayName = "Biz Arena Classroom Server (TCP $port)"

  Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule
  Get-NetFirewallRule -DisplayName "Biz Arena Classroom TCP $port" -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule

  New-NetFirewallRule `
    -Name $ruleName `
    -DisplayName $displayName `
    -Group 'Biz Arena Classroom' `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $port `
    -Profile $firewallProfiles `
    -RemoteAddress LocalSubnet | Out-Null
  Write-Host "Allowed TCP $port from the local subnet." -ForegroundColor Green
}

Get-NetFirewallRule -Name 'BizArena-Classroom-Program-*' -ErrorAction SilentlyContinue |
  Remove-NetFirewallRule

$programCandidates = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Biz Arena\Biz Arena.exe')
)

$portableSearchRoots = @(
  (Join-Path $PSScriptRoot '..'),
  (Join-Path $PSScriptRoot '..\dist')
)

foreach ($searchRoot in $portableSearchRoots) {
  $portable = Get-ChildItem -LiteralPath $searchRoot -Filter 'BizArena-Server-*-Portable-x64.exe' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($portable) {
    $programCandidates += $portable.FullName
  }
}

$programIndex = 0
foreach ($candidate in ($programCandidates | Select-Object -Unique)) {
  $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction SilentlyContinue
  if (-not $resolved) {
    continue
  }

  $programIndex += 1
  New-NetFirewallRule `
    -Name "BizArena-Classroom-Program-$programIndex" `
    -DisplayName "Biz Arena Classroom Server executable $programIndex" `
    -Group 'Biz Arena Classroom' `
    -Direction Inbound `
    -Action Allow `
    -Program $resolved.Path `
    -Profile $firewallProfiles `
    -RemoteAddress LocalSubnet | Out-Null
  Write-Host ("Allowed executable: {0}" -f $resolved.Path) -ForegroundColor Green
}

if ($SetPrivate) {
  Write-Host ''
  Write-Host 'Checking Windows network profiles:' -ForegroundColor Cyan
  $profiles = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'NoTraffic' }
  foreach ($profile in $profiles) {
    if ($profile.NetworkCategory -eq 'Public') {
      try {
        Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Private
        Write-Host ("Changed network to Private: {0} ({1})" -f $profile.Name, $profile.InterfaceAlias) -ForegroundColor Green
      } catch {
        Write-Host ("Could not change network profile: {0}. {1}" -f $profile.InterfaceAlias, $_.Exception.Message) -ForegroundColor Yellow
      }
    } else {
      Write-Host ("Network is already not Public: {0} ({1}) -> {2}" -f $profile.Name, $profile.InterfaceAlias, $profile.NetworkCategory) -ForegroundColor Green
    }
  }
}

Write-Host ''
Write-Host 'IPv4 addresses on this computer:' -ForegroundColor Cyan
$addresses = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Sort-Object InterfaceAlias, IPAddress

if (-not $addresses) {
  Write-Host 'No LAN IPv4 address found. Check the network connection.' -ForegroundColor Yellow
} else {
  Write-Host 'For phones, normally use 192.168.x.x, 10.x.x.x, or 172.16-31.x.x.' -ForegroundColor Yellow
  foreach ($address in $addresses) {
    $isPrivateLan = $address.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'
    $tag = if ($isPrivateLan) { 'LAN' } else { 'VPN/service' }
    $color = if ($isPrivateLan) { 'Green' } else { 'DarkYellow' }
    Write-Host ("- {0} ({1}) [{2}]" -f $address.IPAddress, $address.InterfaceAlias, $tag) -ForegroundColor $color
    foreach ($port in $Ports) {
      Write-Host ("  health: http://{0}:{1}/api/health" -f $address.IPAddress, $port)
      Write-Host ("  client: http://{0}:{1}/client" -f $address.IPAddress, $port)
    }
  }
}

Write-Host ''
Write-Host 'If /api/health works on the teacher PC but not on a student device, the network may isolate clients. Use a separate router or hotspot.' -ForegroundColor Yellow
