# Read-only environment check for the Pi Windows 7 package.
# Compatible with Windows PowerShell 2.0 (Windows 7 default).
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Show($label, $value) { Write-Host ("{0,-34} {1}" -f $label, $value) }

Write-Host "=== Pi Windows 7 package verification (read-only) ==="
$os = Get-WmiObject Win32_OperatingSystem
Show "OS version" ($os.Caption + " " + $os.Version)
Show "PSVersion" $PSVersionTable.PSVersion

Write-Host ""
Write-Host "--- runtime ---"
$node = Join-Path $root "node\node.exe"
if (Test-Path $node) {
  Show "node.exe present" "yes"
  Show "node --version" (& $node --version)
  # Indexed rather than Select-Object -Skip: -Skip needs PowerShell 3.0, and
  # Windows 7 ships 2.0.
  Show "node exe sha256" ((certutil -hashfile $node SHA256)[1].Trim())
} else { Show "node.exe present" "MISSING" }

Write-Host ""
Write-Host "--- pi ---"
$env:PI_CODING_AGENT_DIR = Join-Path $root "agent"
$env:PI_OFFLINE = "1"
$cli = Join-Path $root "pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js"
if (Test-Path $cli) {
  Show "cli.js present" "yes"
  Show "pi --version" (& $node $cli --version 2>&1)
} else { Show "cli.js present" "MISSING" }

Write-Host ""
Write-Host "--- search tools (must come from agent\bin, never downloaded) ---"
foreach ($t in @("rg", "fd")) {
  $p = Join-Path $root ("agent\bin\" + $t + ".exe")
  if (Test-Path $p) {
    Show ($t + ".exe present") "yes"
    Show ($t + " --version") ((& $p --version 2>&1 | Select-Object -First 1))
  } else {
    Show ($t + ".exe present") "MISSING - Pi would download a build that cannot run on Windows 7"
  }
}

Write-Host ""
Write-Host "--- manual step this script cannot do for you ---"
Write-Host "  Run pi.bat in the console and confirm the input box, the footer and Chinese text."
Write-Host "  The pi --version check above runs node directly, so it loads none of the three"
Write-Host "  console shims pi.bat passes with --require; judge the interface through pi.bat."
