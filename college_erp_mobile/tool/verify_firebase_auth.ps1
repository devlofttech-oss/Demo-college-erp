param(
  [Parameter(Mandatory = $true)]
  [string]$Email,
  [Parameter(Mandatory = $true)]
  [string]$Password
)

$ErrorActionPreference = "Stop"
$mobileRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRoot = Resolve-Path (Join-Path $mobileRoot "..")
$envPath = Join-Path $repoRoot ".env"
$serviceAccountPath = Join-Path $repoRoot "serviceAccountKey.json"

if (!(Test-Path $envPath)) {
  throw "Root .env was not found at $envPath"
}
if (!(Test-Path $serviceAccountPath)) {
  throw "serviceAccountKey.json was not found at $serviceAccountPath"
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

$env:VERIFY_EMAIL = $Email
$env:VERIFY_PASSWORD = $Password
$env:VERIFY_FIREBASE_API_KEY = $envMap["VITE_FIREBASE_API_KEY"]
$env:VERIFY_SERVICE_ACCOUNT_PATH = $serviceAccountPath

try {
@'
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const email = process.env.VERIFY_EMAIL;
const password = process.env.VERIFY_PASSWORD;
const apiKey = process.env.VERIFY_FIREBASE_API_KEY;

const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
});
const result = await response.json();
if (!response.ok) {
  console.log(JSON.stringify({ authOk: false, email, error: result.error?.message || 'unknown' }, null, 2));
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(process.env.VERIFY_SERVICE_ACCOUNT_PATH, 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const profileSnapshot = await getFirestore().collection('users').doc(result.localId).get();
const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
console.log(JSON.stringify({
  authOk: true,
  email,
  uidHasProfile: profileSnapshot.exists,
  roleId: profile?.roleId || null,
  status: profile?.status || null
}, null, 2));
'@ | node --input-type=module
} finally {
  Remove-Item Env:\VERIFY_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:\VERIFY_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:\VERIFY_FIREBASE_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\VERIFY_SERVICE_ACCOUNT_PATH -ErrorAction SilentlyContinue
}
