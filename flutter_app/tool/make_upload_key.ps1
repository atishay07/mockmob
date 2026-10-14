<#
.SYNOPSIS
  Creates the MockMob upload keystore and android/key.properties. THE OWNER RUNS THIS, not an agent.

.DESCRIPTION
  Run from the flutter_app folder in PowerShell:
      powershell -ExecutionPolicy Bypass -File tool\make_upload_key.ps1

  What it does
    1. Asks you for a keystore password (twice, hidden). The password is never written into the
       repo, never put on a command line, and never printed. keytool receives it through an
       environment variable that exists only for this run.
    2. Creates the upload keystore (PKCS12, RSA 2048, valid about 27 years) OUTSIDE the repo, in
       %USERPROFILE%\mockmob-keys by default.
    3. Writes android\key.properties (git ignores it) so `flutter build appbundle --release`
       signs with your upload key. key.properties holds the password in plain text because
       Gradle needs it; it lives only on this PC and is gitignored.
    4. Prints the SHA-1 and SHA-256 fingerprints and the backup steps.

  It refuses to overwrite an existing keystore or key.properties. Losing the keystore or its
  password does not lose the app (Play App Signing holds the real signing key), but replacing a
  lost upload key needs a request to Google Play support, so back it up now.

.PARAMETER KeystorePath
  Where to create the keystore. Default: $env:USERPROFILE\mockmob-keys\mockmob-upload.jks

.PARAMETER KeyPropertiesPath
  Where to write key.properties. Default: android\key.properties next to this script's project.

.PARAMETER Alias
  Key alias inside the keystore. Default: upload

.PARAMETER DistinguishedName
  Certificate subject. Default: CN=MockMob, O=MockMob, C=IN

.PARAMETER PasswordEnvVar
  For automated tests only: name of an environment variable holding the password, instead of
  prompting. Leave unset when you run this yourself.
#>
[CmdletBinding()]
param(
  [string]$KeystorePath = (Join-Path $env:USERPROFILE 'mockmob-keys\mockmob-upload.jks'),
  [string]$KeyPropertiesPath = '',
  [string]$Alias = 'upload',
  [string]$DistinguishedName = 'CN=MockMob, O=MockMob, C=IN',
  [string]$PasswordEnvVar = ''
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $KeyPropertiesPath) { $KeyPropertiesPath = Join-Path $projectRoot 'android\key.properties' }

function Find-Keytool {
  $candidates = @()
  if ($env:JAVA_HOME) { $candidates += (Join-Path $env:JAVA_HOME 'bin\keytool.exe') }
  $candidates += 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
  $candidates += 'C:\Program Files\Android\Android Studio\jre\bin\keytool.exe'
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  $onPath = Get-Command keytool -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  throw 'keytool not found. Install Android Studio (it bundles a JDK) or set JAVA_HOME.'
}

function ConvertTo-PlainText([System.Security.SecureString]$secure) {
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$keytool = Find-Keytool
Write-Host "Using keytool: $keytool"

if (Test-Path $KeystorePath) {
  throw "A keystore already exists at $KeystorePath. Not overwriting it. Move it away or pass -KeystorePath."
}
if (Test-Path $KeyPropertiesPath) {
  throw "$KeyPropertiesPath already exists. Not overwriting it. Delete it first if you really want a new key."
}

# Make sure git will never see the secrets, even if someone copies this script elsewhere.
$androidIgnore = Join-Path $projectRoot 'android\.gitignore'
if (Test-Path $androidIgnore) {
  $ignoreText = Get-Content $androidIgnore -Raw
  if ($ignoreText -notmatch '(?m)^key\.properties\s*$' -or $ignoreText -notmatch '(?m)^\*\*/\*\.jks\s*$') {
    throw 'android\.gitignore does not ignore key.properties and *.jks. Fix that before creating a key.'
  }
}

$keystoreDir = Split-Path -Parent $KeystorePath
if (-not (Test-Path $keystoreDir)) { New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null }

Write-Host ''
Write-Host 'Choose a keystore password (at least 8 characters). You will need it for every release build.'
Write-Host 'Store it in your password manager now.'
if ($PasswordEnvVar) {
  $plain1 = [Environment]::GetEnvironmentVariable($PasswordEnvVar)
  $plain2 = $plain1
} else {
  $p1 = Read-Host 'Keystore password' -AsSecureString
  $p2 = Read-Host 'Repeat password' -AsSecureString
  $plain1 = ConvertTo-PlainText $p1
  $plain2 = ConvertTo-PlainText $p2
}
if ($plain1 -ne $plain2) { throw 'The two passwords do not match. Nothing was created.' }
if ($plain1.Length -lt 8) { throw 'Use at least 8 characters. Nothing was created.' }
if ($plain1 -match '[\r\n]') { throw 'The password must be a single line.' }

$env:MOCKMOB_KS_PASS = $plain1
try {
  # PKCS12 keystores use one password for the store and the key, so -keypass matches -storepass.
  & $keytool -genkeypair -keystore $KeystorePath -alias $Alias `
    -keyalg RSA -keysize 2048 -validity 10000 -storetype PKCS12 `
    -dname $DistinguishedName `
    '-storepass:env' MOCKMOB_KS_PASS '-keypass:env' MOCKMOB_KS_PASS
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $KeystorePath)) { throw 'keytool failed. Nothing was written.' }

  # Gradle reads this with java.util.Properties: forward slashes avoid backslash escapes.
  $storeForGradle = ($KeystorePath -replace '\\', '/')
  $lines = @(
    "storePassword=$plain1",
    "keyPassword=$plain1",
    "keyAlias=$Alias",
    "storeFile=$storeForGradle"
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($KeyPropertiesPath, (($lines -join "`n") + "`n"), $utf8NoBom)

  Write-Host ''
  Write-Host "Keystore:       $KeystorePath"
  Write-Host "key.properties: $KeyPropertiesPath  (git-ignored)"
  Write-Host ''
  Write-Host 'Certificate fingerprints of the UPLOAD key:'
  $listing = & $keytool -list -v -keystore $KeystorePath -alias $Alias '-storepass:env' MOCKMOB_KS_PASS
  $sha1 = ($listing | Select-String 'SHA1:').ToString().Trim()
  $sha256 = ($listing | Select-String 'SHA256:').ToString().Trim()
  Write-Host "  $sha1"
  Write-Host "  $sha256"
}
finally {
  Remove-Item Env:\MOCKMOB_KS_PASS -ErrorAction SilentlyContinue
  $plain1 = $null; $plain2 = $null
}

Write-Host @"

NEXT STEPS

1. BACK UP NOW (two separate places, for example your password manager's file storage and an
   encrypted USB stick or private cloud vault):
     - $KeystorePath
     - the password you just chose
   Never email it, never commit it, never paste it into chat.

2. Build the signed bundle:
     bash tool/flutter_locked.sh build appbundle --release --dart-define-from-file=dart_defines/prod.json --obfuscate --split-debug-info=build/symbols
   (full steps: docs/RELEASE.md)

3. Where these fingerprints go (read docs/RELEASE.md, "Fingerprints"):
   - The SHA-1/SHA-256 above are the UPLOAD key. Play re-signs your app with a different
     key, the app signing key. After the first upload open Play Console > Release > Setup >
     App signing and copy the "App signing key certificate" SHA-1 and SHA-256.
   - Google sign-in (Credential Manager): create an Android OAuth client in Google Cloud Console
     for package in.mockmob.app with the app signing key SHA-1. Add the upload key SHA-1 as a
     second Android client if you also want sideloaded release builds to sign in.
   - App links (https://www.mockmob.in/.well-known/assetlinks.json): the server's
     ANDROID_CERT_SHA256 must be the app signing key SHA-256 (add the upload key SHA-256 too
     for sideloaded builds).
"@
