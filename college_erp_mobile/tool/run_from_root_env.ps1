param(
  [string]$Device = "",
  [string]$Target = "lib/main.dart"
)

$ErrorActionPreference = "Stop"
$mobileRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRoot = Resolve-Path (Join-Path $mobileRoot "..")
$envPath = Join-Path $repoRoot ".env"

if (!(Test-Path $envPath)) {
  throw "Root .env was not found at $envPath"
}

$envMap = @{}
Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if ($line.Length -eq 0 -or $line.StartsWith("#")) { return }
  $parts = $line.Split("=", 2)
  if ($parts.Length -eq 2) {
    $envMap[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
}

$defines = @(
  "--dart-define=FIREBASE_API_KEY=$($envMap["VITE_FIREBASE_API_KEY"])",
  "--dart-define=FIREBASE_AUTH_DOMAIN=$($envMap["VITE_FIREBASE_AUTH_DOMAIN"])",
  "--dart-define=FIREBASE_PROJECT_ID=$($envMap["VITE_FIREBASE_PROJECT_ID"])",
  "--dart-define=FIREBASE_STORAGE_BUCKET=$($envMap["VITE_FIREBASE_STORAGE_BUCKET"])",
  "--dart-define=FIREBASE_MESSAGING_SENDER_ID=$($envMap["VITE_FIREBASE_MESSAGING_SENDER_ID"])",
  "--dart-define=FIREBASE_APP_ID=$($envMap["VITE_FIREBASE_APP_ID"])",
  "--dart-define=FIREBASE_MEASUREMENT_ID=$($envMap["VITE_FIREBASE_MEASUREMENT_ID"])",
  "--dart-define=FIREBASE_IOS_BUNDLE_ID=com.devlofttech.collegesoft"
)

Push-Location $mobileRoot
try {
  $args = @("run", "-t", $Target) + $defines
  if ($Device.Trim().Length -gt 0) {
    $args += @("-d", $Device)
  }
  & flutter @args
} finally {
  Pop-Location
}
