param(
  [Parameter(Position = 0)]
  [string]$ServerUrl = ''
)

$ErrorActionPreference = 'Stop'

function Normalize-BizArenaUrl([string]$Value) {
  $url = ($Value -replace '\s+', '').Trim()
  if (-not $url) {
    throw 'Введите адрес сервера, например 192.168.0.10:3000 или http://192.168.0.10:3000'
  }
  if ($url -notmatch '^https?://') {
    $url = "http://$url"
  }
  return $url.TrimEnd('/')
}

function Test-Endpoint([string]$Url, [string]$Name) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
      Write-Host "[OK] $Name -> $Url" -ForegroundColor Green
      return $true
    }
    Write-Host "[FAIL] $Name -> HTTP $($response.StatusCode)" -ForegroundColor Red
    return $false
  } catch {
    Write-Host "[FAIL] $Name -> $Url" -ForegroundColor Red
    Write-Host "       $($_.Exception.Message)" -ForegroundColor DarkYellow
    return $false
  }
}

Write-Host ''
Write-Host 'Biz Arena: проверка подключения к серверу' -ForegroundColor Cyan
Write-Host '---------------------------------------'

if (-not $ServerUrl) {
  $ServerUrl = Read-Host 'Введите IP/URL сервера преподавателя'
}

$base = Normalize-BizArenaUrl $ServerUrl
$okHealth = Test-Endpoint "$base/api/health" '/api/health'
$okMeta = Test-Endpoint "$base/api/meta" '/api/meta'
$okClient = Test-Endpoint "$base/client" '/client'

Write-Host ''
if ($okHealth -and $okMeta -and $okClient) {
  Write-Host 'Подключение работает. В BizArena Client можно вводить этот адрес сервера:' -ForegroundColor Green
  Write-Host $base -ForegroundColor Cyan
  exit 0
}

Write-Host 'Подключение не прошло полностью.' -ForegroundColor Yellow
Write-Host 'Что проверить:'
Write-Host '1. BizArena Server запущен на компьютере преподавателя.'
Write-Host '2. Windows Firewall разрешает входящие TCP подключения на порт 3000.'
Write-Host '3. Компьютеры находятся в одной LAN/Wi-Fi сети.'
Write-Host '4. В Wi-Fi не включена изоляция клиентов (client isolation).'
Write-Host '5. Если LAN закрыт, подключите класс к отдельному роутеру/точке доступа или проведите localhost-demo на одном ПК.'
exit 1
