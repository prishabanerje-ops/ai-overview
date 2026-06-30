#!/usr/bin/env bash
# Installer for the /ai-overview Claude Code skill + ai-overview-scraper agent.
# Copies the skill and agent into your Claude Code config dir, checks the Python
# and Node deps, and configures the Chrome DevTools MCP server. Playwright (a
# plugin) must be installed from inside Claude Code — the script prints how.
#
# Usage:  ./install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

echo "==> Installing /ai-overview into: $CLAUDE_DIR"

# 1. Copy the skill and the agent into place.
mkdir -p "$CLAUDE_DIR/skills/ai-overview" "$CLAUDE_DIR/agents"
cp -R "$REPO_DIR/skills/ai-overview/." "$CLAUDE_DIR/skills/ai-overview/"
cp "$REPO_DIR/agents/ai-overview-scraper.md" "$CLAUDE_DIR/agents/ai-overview-scraper.md"
echo "    skill -> $CLAUDE_DIR/skills/ai-overview/"
echo "    agent -> $CLAUDE_DIR/agents/ai-overview-scraper.md"

# 2. Python + openpyxl (used by build_matrix.py to write the .xlsx report).
echo "==> Checking Python + openpyxl"
if command -v python3 >/dev/null 2>&1; then
  echo "    $(python3 --version 2>&1)"
  if python3 -c "import openpyxl" 2>/dev/null; then
    echo "    openpyxl: present"
  else
    echo "    openpyxl: missing -> installing"
    python3 -m pip install --user openpyxl \
      || echo "    !! pip failed; run manually: python3 -m pip install openpyxl"
  fi
else
  echo "    !! python3 not found. Install Python 3.8+ from https://www.python.org/downloads/"
fi

# 3. Node.js / npx (both MCP servers launch via npx).
echo "==> Checking Node.js / npx"
if command -v npx >/dev/null 2>&1; then
  echo "    node $(node --version 2>/dev/null), npx present"
else
  echo "    !! npx not found. Install Node.js from https://nodejs.org/ (the MCP servers run via npx)."
fi

# 4. Chrome DevTools MCP — must be a user server named exactly 'chrome-devtools'
#    so its tools resolve as mcp__chrome-devtools__* (what the agent references).
echo "==> Configuring Chrome DevTools MCP server"
if command -v claude >/dev/null 2>&1; then
  if claude mcp list 2>/dev/null | grep -q '^chrome-devtools:'; then
    echo "    'chrome-devtools' already configured"
  else
    claude mcp add chrome-devtools --scope user -- npx chrome-devtools-mcp@latest --autoConnect \
      && echo "    added 'chrome-devtools'" \
      || echo "    !! failed; add it manually (see README)"
  fi
else
  echo "    !! 'claude' CLI not found; add the server manually (see README)."
fi

# 5. Playwright MCP — installed as a plugin so tools resolve as
#    mcp__plugin_playwright_playwright__* (what the agent's preferred path uses).
cat <<'EOF'
==> Playwright MCP (one-time, run these INSIDE Claude Code):
        /plugin marketplace add anthropics/claude-plugins-official
        /plugin install playwright@claude-plugins-official
EOF

echo
echo "==> Done. Restart Claude Code, then run:  /ai-overview"
echo "    Verify servers with:  claude mcp list"
