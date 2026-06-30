# Installer for the /ai-overview Claude Code skill + ai-overview-scraper agent (Windows / PowerShell).
# Mirrors install.sh. NOTE: provided for convenience but NOT verified on Windows
# (this tool was developed and tested on macOS). Run with:  pwsh ./install.ps1
$ErrorActionPreference = "Stop"

$RepoDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE ".claude" }

Write-Host "==> Installing /ai-overview into: $ClaudeDir"

# 1. Copy the skill and the agent into place.
New-Item -ItemType Directory -Force -Path (Join-Path $ClaudeDir "skills\ai-overview") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ClaudeDir "agents") | Out-Null
Copy-Item -Recurse -Force (Join-Path $RepoDir "skills\ai-overview\*") (Join-Path $ClaudeDir "skills\ai-overview")
Copy-Item -Force (Join-Path $RepoDir "agents\ai-overview-scraper.md") (Join-Path $ClaudeDir "agents\ai-overview-scraper.md")
Write-Host "    copied skill + agent"

# 2. Python + openpyxl.
Write-Host "==> Checking Python + openpyxl"
if (Get-Command python -ErrorAction SilentlyContinue) {
  python --version
  python -c "import openpyxl" 2>$null
  if ($LASTEXITCODE -ne 0) { python -m pip install --user openpyxl } else { Write-Host "    openpyxl: present" }
} else {
  Write-Host "    !! python not found. Install Python 3.8+ from https://www.python.org/downloads/"
}

# 3. Node.js / npx.
Write-Host "==> Checking Node.js / npx"
if (Get-Command npx -ErrorAction SilentlyContinue) { Write-Host "    npx present" }
else { Write-Host "    !! npx not found. Install Node.js from https://nodejs.org/" }

# 4. Chrome DevTools MCP (user server named exactly 'chrome-devtools').
Write-Host "==> Configuring Chrome DevTools MCP server"
if (Get-Command claude -ErrorAction SilentlyContinue) {
  $list = claude mcp list 2>$null
  if ($list -match "(?m)^chrome-devtools:") { Write-Host "    already configured" }
  else { claude mcp add chrome-devtools --scope user -- npx chrome-devtools-mcp@latest --autoConnect }
} else {
  Write-Host "    !! 'claude' CLI not found; add the server manually (see README)."
}

# 5. Playwright plugin (run inside Claude Code).
Write-Host @"
==> Playwright MCP (one-time, run these INSIDE Claude Code):
        /plugin marketplace add anthropics/claude-plugins-official
        /plugin install playwright@claude-plugins-official
"@

Write-Host ""
Write-Host "==> Done. Restart Claude Code, then run:  /ai-overview"
