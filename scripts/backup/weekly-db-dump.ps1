<#
.SYNOPSIS
  Weekly MockMob database backup (schema plus data) from a Supabase Postgres.

.DESCRIPTION
  Reads the connection string from $env:SUPABASE_DB_URL (never printed, never written to disk).
  Uses pg_dump if installed, else the Supabase CLI via npx. Writes a dated compressed file to
  $env:MOCKMOB_BACKUP_DIR (default: Documents\MockMob backups), keeps the newest 8, checks the
  file is non-empty, lists its tables and appends a redacted line to backup.log.

.PARAMETER DryRun
  Validate the URL shape, detect the tool, print the plan with the URL redacted. No network,
  no files written.

.PARAMETER Keep
  How many dumps to keep (default 8).

.PARAMETER Tool
  auto (default), pg_dump or supabase.

.EXAMPLE
  powershell -File scripts\backup\weekly-db-dump.ps1 -DryRun
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [int]$Keep = 8,
  [ValidateSet('auto', 'pg_dump', 'supabase')][string]$Tool = 'auto'
)

$ErrorActionPreference = 'Stop'
$script:Secrets = @()

function Add-Secret([string]$s) {
  if ($s -and $s.Length -ge 3 -and ($script:Secrets -notcontains $s)) { $script:Secrets += $s }
}

# Replace every known secret form with ***. Longest first so the URL goes before its parts.
function Redact([string]$text) {
  if ($null -eq $text) { return '' }
  foreach ($s in ($script:Secrets | Sort-Object Length -Descending)) {
    $text = $text.Replace($s, '***')
  }
  return ($text -replace '(postgres(?:ql)?://[^:/@\s]+:)[^@\s]+@', '$1***@')
}

function Say([string]$msg) { Write-Host (Redact $msg) }

function Write-Log([string]$msg, [string]$dir) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), (Redact $msg)
  if ($dir -and (Test-Path -LiteralPath $dir)) {
    Add-Content -LiteralPath (Join-Path $dir 'backup.log') -Value $line -Encoding UTF8
  }
}

function Fail([string]$msg, [string]$dir, [int]$code = 1) {
  Say "FAILED: $msg"
  Write-Log "FAILED: $msg" $dir
  exit $code
}

# 1. URL
$url = $env:SUPABASE_DB_URL
if ([string]::IsNullOrWhiteSpace($url)) {
  Fail 'SUPABASE_DB_URL is not set. Set it as a Windows user environment variable, then open a new terminal.' $null 2
}
$url = $url.Trim()
Add-Secret $url
if ($url -notmatch '^postgres(ql)?://') {
  Fail 'SUPABASE_DB_URL must start with postgresql:// or postgres://.' $null 2
}
# Split by hand: the password may contain characters System.Uri rejects. The password is the
# text between the first ':' after the scheme and the LAST '@' before the path.
$rest = $url -replace '^postgres(ql)?://', ''
$slash = $rest.IndexOf('/')
$authority = if ($slash -ge 0) { $rest.Substring(0, $slash) } else { $rest }
$pathQuery = if ($slash -ge 0) { $rest.Substring($slash) } else { '' }
$at = $authority.LastIndexOf('@')
if ($at -lt 1) { Fail 'SUPABASE_DB_URL needs user:password@host.' $null 2 }
$userInfo = $authority.Substring(0, $at)
$hostPort = $authority.Substring($at + 1)
$sep = $userInfo.IndexOf(':')
$dbUser = if ($sep -ge 0) { $userInfo.Substring(0, $sep) } else { $userInfo }
$rawPass = if ($sep -ge 0) { $userInfo.Substring($sep + 1) } else { '' }
if (-not $hostPort) { Fail 'SUPABASE_DB_URL has no host.' $null 2 }
try { $dbPass = [System.Uri]::UnescapeDataString($rawPass) } catch { $dbPass = $rawPass }
Add-Secret $rawPass
Add-Secret $dbPass
$hostName = $hostPort; $port = 5432
if ($hostPort -match '^(.+):(\d+)$') { $hostName = $Matches[1]; $port = [int]$Matches[2] }
$qIdx = $pathQuery.IndexOf('?')
$pathOnly = if ($qIdx -ge 0) { $pathQuery.Substring(0, $qIdx) } else { $pathQuery }
$dbName = $pathOnly.TrimStart('/')
if (-not $dbName) { $dbName = 'postgres' }
$query = if ($qIdx -ge 0) { $pathQuery.Substring($qIdx) } else { '' }
# Connection string without the password; the password travels in PGPASSWORD instead.
$safeUrl = 'postgresql://{0}@{1}:{2}/{3}{4}' -f $dbUser, $hostName, $port, $dbName, $query
$hostLabel = '{0}:{1}/{2}' -f $hostName, $port, $dbName

# 2. Folder
$backupDir = $env:MOCKMOB_BACKUP_DIR
if ([string]::IsNullOrWhiteSpace($backupDir)) {
  $backupDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'MockMob backups'
}

# 3. Tool
$hasPg = [bool](Get-Command pg_dump -ErrorAction SilentlyContinue)
$hasNpx = [bool](Get-Command npx -ErrorAction SilentlyContinue)
$chosen = $null
if ($Tool -eq 'pg_dump') { if ($hasPg) { $chosen = 'pg_dump' } }
elseif ($Tool -eq 'supabase') { if ($hasNpx) { $chosen = 'supabase' } }
else { if ($hasPg) { $chosen = 'pg_dump' } elseif ($hasNpx) { $chosen = 'supabase' } }

if (-not $chosen) {
  Say 'No dump tool found. Install one of these, then run again:'
  Say '  1. PostgreSQL client tools (pg_dump), version 17 or newer: https://www.postgresql.org/download/windows/'
  Say '     (the installer lets you pick only "Command Line Tools"), then add its bin folder to PATH.'
  Say '  2. Or Node.js (for npx) plus Docker Desktop, then the script uses: npx supabase db dump'
  if ($DryRun) { Say 'Dry run continues without a tool.' } else { Fail 'no pg_dump and no npx found.' $null 3 }
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$outName = if ($chosen -eq 'supabase') { "mockmob-$stamp.sql.gz" } else { "mockmob-$stamp.dump" }
$outPath = Join-Path $backupDir $outName

Say "Source:  $hostLabel (user $dbUser, password hidden)"
Say "Tool:    $(if ($chosen) { $chosen } else { 'none found' })"
Say "Output:  $outPath"
Say "Keep:    newest $Keep"

if ($DryRun) {
  Say 'Dry run: nothing was connected to or written.'
  if ($chosen -eq 'pg_dump') {
    Say "Would run: pg_dump --format=custom --compress=9 --no-owner --no-acl --file `"$outPath`" `"$safeUrl`" (password via PGPASSWORD)"
  } elseif ($chosen -eq 'supabase') {
    Say 'Would run: npx --yes supabase db dump --db-url <redacted> (schema), then again with --data-only, gzip both into one file'
  }
  exit 0
}

# 4. Dump
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$started = Get-Date
try {
  if ($chosen -eq 'pg_dump') {
    $env:PGPASSWORD = $dbPass
    $env:PGCONNECT_TIMEOUT = '30'
    $errText = & pg_dump --format=custom --compress=9 --no-owner --no-acl --file $outPath $safeUrl 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "pg_dump exited $LASTEXITCODE. $errText" }
  } else {
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("mockmob-dump-" + [guid]::NewGuid().ToString('N') + '.sql')
    try {
      $errText = & npx --yes supabase db dump --db-url $url --file $tmp 2>&1 | Out-String
      if ($LASTEXITCODE -ne 0) { throw "supabase schema dump exited $LASTEXITCODE. $errText" }
      $tmpData = $tmp + '.data'
      $errText = & npx --yes supabase db dump --db-url $url --data-only --use-copy --file $tmpData 2>&1 | Out-String
      if ($LASTEXITCODE -ne 0) { throw "supabase data dump exited $LASTEXITCODE. $errText" }
      $in = [IO.File]::OpenWrite($outPath)
      $gz = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionLevel]::Optimal)
      foreach ($f in @($tmp, $tmpData)) {
        $src = [IO.File]::OpenRead($f); $src.CopyTo($gz); $src.Dispose()
      }
      $gz.Dispose(); $in.Dispose()
    } finally {
      Remove-Item -LiteralPath $tmp, ($tmp + '.data') -Force -ErrorAction SilentlyContinue
    }
  }
} catch {
  Remove-Item -LiteralPath $outPath -Force -ErrorAction SilentlyContinue
  $m = ($_.Exception.Message) -replace '\s+', ' '
  if ($m.Length -gt 500) { $m = '...' + $m.Substring($m.Length - 500) }
  Fail $m $backupDir 4
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# 5. Verify: non-empty and lists tables
if (-not (Test-Path -LiteralPath $outPath) -or (Get-Item -LiteralPath $outPath).Length -lt 1024) {
  Remove-Item -LiteralPath $outPath -Force -ErrorAction SilentlyContinue
  Fail 'dump file is missing or under 1 KB; removed it.' $backupDir 5
}
$tables = @()
if ($chosen -eq 'pg_dump') {
  $toc = & pg_restore --list $outPath 2>$null
  foreach ($l in $toc) { if ($l -match '^\d+;\s+\d+\s+\d+\s+TABLE\s+(\S+)\s+(\S+)\s') { $tables += "$($Matches[1]).$($Matches[2])" } }
} else {
  $fs = [IO.File]::OpenRead($outPath)
  $gzr = New-Object IO.Compression.GZipStream($fs, [IO.Compression.CompressionMode]::Decompress)
  $rd = New-Object IO.StreamReader($gzr)
  while ($null -ne ($l = $rd.ReadLine())) {
    if ($l -match '^CREATE TABLE (?:IF NOT EXISTS )?(\S+)') { $tables += ($Matches[1] -replace '"', '') }
  }
  $rd.Dispose()
}
if ($tables.Count -eq 0) { Fail 'dump contains no tables; keeping the file for inspection.' $backupDir 6 }

$sizeMb = [math]::Round((Get-Item -LiteralPath $outPath).Length / 1MB, 2)
Say "Tables ($($tables.Count)): $($tables -join ', ')"

# 6. Retention: keep newest N
$old = Get-ChildItem -LiteralPath $backupDir -File | Where-Object { $_.Name -match '^mockmob-\d{4}-\d{2}-\d{2}_\d{4}\.(dump|sql\.gz)$' } |
  Sort-Object Name -Descending | Select-Object -Skip $Keep
foreach ($f in $old) { Remove-Item -LiteralPath $f.FullName -Force; Say "Removed old backup $($f.Name)" }

$secs = [int]((Get-Date) - $started).TotalSeconds
$summary = "OK $outName, $sizeMb MB, $($tables.Count) tables, $secs s, tool $chosen, source $hostLabel"
Say $summary
Write-Log $summary $backupDir
exit 0
