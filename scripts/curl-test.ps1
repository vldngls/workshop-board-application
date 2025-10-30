# Configuration
$ErrorActionPreference = "Stop"
$FrontendBase = "http://localhost:3000/api"
$BackendBase  = "http://localhost:4000"
$EncTokenCookie = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..9aT131k999ubRvR0.5myM2_cFKIssWcbyzfs4RUA7rxARGFn0z-VFM_ycifzWzEzKk8EC6QYTIFsMnU3Uo_W8TlRC-i2M5VUUXtATvc1WugHZI1RoKy2PHoBEX19K2yUA2Z42U_CPHpKC61xluwjHgAt97-HdmeHhOc-ItXWAFOTDsKvCkXWGEB9UoaarxCLm62qVkpLfvKku-P6AfwBEczgUEykszkzjtNILkU0DIlBfnXtSJFcqotxkLsTf4Xz83bd-uifkyxc8CaTLvzOCr5gqBa4lYis.fzo9fAIzKnO4Iab4QF-UJg"
# Backend probably needs a raw JWT. We'll try with the provided token first.
$RawBearer = $EncTokenCookie

function Wait-For-Ok {
    param(
        [string]$Url,
        [int]$TimeoutSec = 45
    )
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $code = & curl.exe -sS -o NUL -w "%{http_code}" $Url
            if ($code -match "^2\\d\\d$") { return $true }
        } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

function Invoke-Curl {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = ""
    )
    $headerArgs = @()
    foreach ($k in $Headers.Keys) { $headerArgs += @("-H", ($k + ": " + $Headers[$k])) }
    $bodyArgs = @()
    if ($Body -ne "") { $bodyArgs = @("-d", $Body) }

    $status = & curl.exe -sS -o NUL -w "%{http_code}" -X $Method $Url @headerArgs @bodyArgs
    Write-Output ("[{0}] {1} -> {2}" -f $Method, $Url, $status)
}

Write-Host "Waiting for frontend health (via /api/manifest)..."
if (-not (Wait-For-Ok -Url "$FrontendBase/manifest" -TimeoutSec 60)) {
    Write-Warning "Frontend not responding OK within timeout. Continuing anyway."
}

Write-Host "Waiting for backend health (via /health)..."
if (-not (Wait-For-Ok -Url "$BackendBase/health" -TimeoutSec 60)) {
    Write-Warning "Backend not responding OK within timeout. Continuing anyway."
}

# ---------- FRONTEND API (Next.js, expects cookie "token") ----------
$frontendHeaders = @{ "Cookie" = "token=$EncTokenCookie"; "Content-Type" = "application/json" }

$frontendRoutes = @(
  @{ m="GET";    p="/users" }
  @{ m="POST";   p="/users"; body='{"email":"test@example.com","name":"Test","role":"technician","password":"x"}' }
  @{ m="GET";    p="/users/me" }
  @{ m="PUT";    p="/users/000000000000000000000000"; body='{"name":"Updated"}' }
  @{ m="DELETE"; p="/users/000000000000000000000000" }

  @{ m="GET";    p="/system-logs" }

  @{ m="GET";    p="/maintenance/status" }
  @{ m="GET";    p="/maintenance/stats" }
  @{ m="GET";    p="/maintenance/settings" }
  @{ m="PUT";    p="/maintenance/settings"; body='{"isUnderMaintenance":false}' }

  @{ m="POST";   p="/login"; body='{"email":"placeholder","password":"placeholder"}' }

  @{ m="GET";    p="/job-orders" }
  @{ m="POST";   p="/job-orders"; body='{"customerName":"X","vehicle":"Y","services":[]}' }
  @{ m="GET";    p="/job-orders/technicians/available" }
  @{ m="GET";    p="/job-orders/walk-in-slots" }
  @{ m="GET";    p="/job-orders/workshop-slots" }
  @{ m="GET";    p="/job-orders/snapshot/2024-01-01" }
  @{ m="GET";    p="/job-orders/snapshots" }
  @{ m="POST";   p="/job-orders/end-of-day" }
  @{ m="POST";   p="/job-orders/check-carry-over" }
  @{ m="GET";    p="/job-orders/000000000000000000000000" }
  @{ m="PUT";    p="/job-orders/000000000000000000000000"; body='{"note":"update"}' }
  @{ m="DELETE"; p="/job-orders/000000000000000000000000" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/toggle-important" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/submit-qi" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/approve-qi" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/reject-qi" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/complete" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/mark-complete" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/redo" }

  @{ m="POST";   p="/bug-reports"; body='{"title":"bug","description":"desc"}' }
  @{ m="GET";    p="/bug-reports" }
  @{ m="GET";    p="/bug-reports/000000000000000000000000" }
  @{ m="PUT";    p="/bug-reports/000000000000000000000000"; body='{"status":"closed"}' }
  @{ m="DELETE"; p="/bug-reports/000000000000000000000000" }

  @{ m="GET";    p="/dashboard" }

  @{ m="GET";    p="/auth/me" }

  @{ m="GET";    p="/appointments" }
  @{ m="POST";   p="/appointments"; body='{"customerName":"A","scheduledAt":"2025-01-01T09:00:00Z"}' }
  @{ m="GET";    p="/appointments/000000000000000000000000" }
  @{ m="PUT";    p="/appointments/000000000000000000000000"; body='{"note":"update"}' }
  @{ m="DELETE"; p="/appointments/000000000000000000000000" }
  @{ m="POST";   p="/appointments/000000000000000000000000/check-conflicts" }
  @{ m="POST";   p="/appointments/000000000000000000000000/resolve-conflicts" }
  @{ m="POST";   p="/appointments/000000000000000000000000/create-job-order" }
  @{ m="DELETE"; p="/appointments/delete-all-no-show" }

  @{ m="GET";    p="/manifest" }
  @{ m="POST";   p="/logout" }
)

Write-Host "=== FRONTEND API (cookie auth) ==="
foreach ($r in $frontendRoutes) {
  $url = "$FrontendBase$($r.p)"
  $body = $r.ContainsKey("body") ? $r.body : ""
  Invoke-Curl -Method $r.m -Url $url -Headers $frontendHeaders -Body $body
}

# ---------- BACKEND API (Express, expects Bearer raw JWT) ----------
$backendHeaders = @{ "Authorization" = "Bearer $RawBearer"; "Content-Type" = "application/json" }

$backendRoutes = @(
  @{ m="GET";    p="/health" }
  @{ m="GET";    p="/" }

  @{ m="POST";   p="/auth/login"; body='{"email":"placeholder","password":"placeholder"}' }

  @{ m="GET";    p="/users/me" }
  @{ m="GET";    p="/users" }
  @{ m="POST";   p="/users"; body='{"email":"test@example.com","name":"Test","role":"technician","password":"x"}' }
  @{ m="PUT";    p="/users/000000000000000000000000"; body='{"name":"Updated"}' }
  @{ m="DELETE"; p="/users/000000000000000000000000" }

  @{ m="GET";    p="/job-orders" }
  @{ m="GET";    p="/job-orders/technicians/available" }
  @{ m="GET";    p="/job-orders/walk-in-slots" }
  @{ m="GET";    p="/job-orders/workshop-slots" }
  @{ m="GET";    p="/job-orders/available-for-slot" }
  @{ m="GET";    p="/job-orders/dashboard" }
  @{ m="GET";    p="/job-orders/000000000000000000000000" }
  @{ m="POST";   p="/job-orders"; body='{"customerName":"X","vehicle":"Y","services":[]}' }
  @{ m="PUT";    p="/job-orders/000000000000000000000000"; body='{"note":"update"}' }
  @{ m="DELETE"; p="/job-orders/000000000000000000000000" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/toggle-important" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/submit-qi" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/approve-qi" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/reject-qi" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/complete" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/mark-complete" }
  @{ m="PATCH";  p="/job-orders/000000000000000000000000/redo" }
  @{ m="POST";   p="/job-orders/end-of-day" }
  @{ m="POST";   p="/job-orders/check-carry-over" }
  @{ m="POST";   p="/job-orders/mark-carry-over" }
  @{ m="GET";    p="/job-orders/snapshot/2024-01-01" }
  @{ m="GET";    p="/job-orders/snapshots" }

  @{ m="GET";    p="/appointments" }
  @{ m="GET";    p="/appointments/000000000000000000000000" }
  @{ m="POST";   p="/appointments"; body='{"customerName":"A","scheduledAt":"2025-01-01T09:00:00Z"}' }
  @{ m="PUT";    p="/appointments/000000000000000000000000"; body='{"note":"update"}' }
  @{ m="POST";   p="/appointments/000000000000000000000000/check-conflicts" }
  @{ m="POST";   p="/appointments/000000000000000000000000/resolve-conflicts" }
  @{ m="POST";   p="/appointments/000000000000000000000000/create-job-order" }
  @{ m="DELETE"; p="/appointments/delete-all-no-show" }
  @{ m="DELETE"; p="/appointments/000000000000000000000000" }

  @{ m="POST";   p="/bug-reports"; body='{"title":"bug","description":"desc"}' }
  @{ m="GET";    p="/bug-reports" }
  @{ m="GET";    p="/bug-reports/000000000000000000000000" }
  @{ m="PUT";    p="/bug-reports/000000000000000000000000"; body='{"status":"closed"}' }
  @{ m="DELETE"; p="/bug-reports/000000000000000000000000" }

  @{ m="GET";    p="/maintenance/stats" }
  @{ m="GET";    p="/maintenance/settings/public" }
  @{ m="GET";    p="/maintenance/settings" }
  @{ m="PUT";    p="/maintenance/settings"; body='{"isUnderMaintenance":false}' }

  @{ m="GET";    p="/system-logs" }

  @{ m="GET";    p="/admin-only" }
)

Write-Host "`n=== BACKEND API (Bearer auth; may need raw JWT) ==="
foreach ($r in $backendRoutes) {
  $url = "$BackendBase$($r.p)"
  $body = $r.ContainsKey("body") ? $r.body : ""
  Invoke-Curl -Method $r.m -Url $url -Headers $backendHeaders -Body $body
}


