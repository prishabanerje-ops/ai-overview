# /ai-overview — AI-search citation tracker

A [Claude Code](https://claude.com/claude-code) **skill + agent** that captures *who AI search engines cite* — across **Google AI Overviews** and **ChatGPT web search** — for a list of prompts, then builds a citation-position competitive matrix (Excel + raw JSON + an on-screen leaderboard). Generic for any topic; the tracked brand is set by the **business unit** you pick — `policybazaar.ae` (insurance / investment) or `paisabazaar.ae` (credit / lending / banking).

> **What "position" means:** the order a domain appears in the answer's cited-sources list (1 = first cited) — the closest proxy these AI surfaces expose. It is **not** a classic blue-link SERP rank.

---

## What's in this repo

```
skills/ai-overview/
  SKILL.md                  # the /ai-overview orchestration (defines the slash command)
  scripts/
    build_matrix.py         # builds the .xlsx matrix + leaderboards (needs openpyxl)
    extract_aio.js          # Google AI Overview extractor (evaluated in the browser page)
    extract_chatgpt.js      # ChatGPT sources extractor (evaluated in the browser page)
agents/
  ai-overview-scraper.md    # subagent that drives the browser per engine and writes the dataset JSON
install.sh                  # installer (macOS / Linux)
install.ps1                 # installer (Windows / PowerShell — see note)
requirements.txt            # Python dependency (openpyxl)
LICENSE                     # MIT
```

## How it works

1. You run **`/ai-overview`** in Claude Code.
2. The **skill** (`SKILL.md`) asks for topic → prompts → engine(s) → region, then dispatches the **`ai-overview-scraper` agent** once per selected engine.
3. The agent drives a real browser through an **MCP server** and runs the matching extractor in the page:
   - **Google AI Overview** → Playwright MCP (preferred), falling back to Chrome DevTools MCP.
   - **ChatGPT** → Chrome DevTools MCP only, using your **logged-in chatgpt.com** session.
   It writes a dataset JSON (verbatim answer text + ordered citation domains per prompt).
4. **`build_matrix.py`** turns the dataset(s) into an `.xlsx` (one positions matrix + one verbatim-text sheet per engine) and prints leaderboards.

Both pieces are required: the **skill** provides `/ai-overview`, and it dispatches the **agent by name** (`ai-overview-scraper`). Installing one without the other will not work.

---

## System requirements

| Component | Required | Verified on this setup | Notes |
|---|---|---|---|
| **Claude Code** | ✅ | 2.1.161 (macOS) | The skill and agent run inside Claude Code. |
| **Python 3** | ✅ (for the report) | 3.12.13 | 3.8+ recommended. `build_matrix.py` uses only the standard library plus `openpyxl`. |
| **openpyxl** | ✅ (for the report) | 3.1.5 | `pip install -r requirements.txt` |
| **Node.js + npx** | ✅ | v24.15.0 | Both MCP servers launch via `npx`. Use a current LTS. |
| **Google Chrome** | ✅ | — | Chrome DevTools MCP drives real Chrome; the ChatGPT engine needs a logged-in chatgpt.com session in it. |
| **Playwright MCP** (plugin) | ✅ | `playwright@claude-plugins-official` | Preferred engine for Google AIO. Must be installed as the **plugin** so its tools are `mcp__plugin_playwright_playwright__*`. |
| **Chrome DevTools MCP** | ✅ | `chrome-devtools-mcp` 1.1.1 | Required for ChatGPT and as the Google fallback. Must be a user MCP server **named exactly `chrome-devtools`** so its tools are `mcp__chrome-devtools__*`. |

> ⚠️ **MCP server names are not cosmetic — the agent hardcodes the tool namespaces.**
> - Playwright must resolve as `mcp__plugin_playwright_playwright__*` → only happens when installed as the **plugin** `playwright@claude-plugins-official`. Installing it as a plain server (`claude mcp add playwright …`) yields `mcp__playwright__*`, which the agent's Playwright path will **not** match.
> - Chrome DevTools must resolve as `mcp__chrome-devtools__*` → only happens when the server is **named `chrome-devtools`** (the plain user server, *not* the `chrome-devtools-mcp` plugin, which would be `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`).
>
> If you can't match the Playwright namespace, edit the one ToolSearch line in `agents/ai-overview-scraper.md` to your actual tool names.

---

## Install

### Option A — script

**macOS / Linux**
```bash
git clone https://github.com/prishabanerje-ops/ai-overview.git
cd ai-overview
./install.sh
```

**Windows (PowerShell)**
```powershell
git clone https://github.com/prishabanerje-ops/ai-overview.git
cd ai-overview
pwsh ./install.ps1
```
> The Windows script is provided for convenience but was **not verified on Windows** (developed and tested on macOS). It targets `%USERPROFILE%\.claude`.

The script copies the skill to `~/.claude/skills/ai-overview/` and the agent to `~/.claude/agents/`, checks Python/openpyxl and Node/npx, adds the `chrome-devtools` MCP server, and prints the one in-app command needed for the Playwright plugin.

### Option B — manual

1. **Copy the skill and agent** into your Claude Code config dir (`~/.claude`, or `%USERPROFILE%\.claude` on Windows):
   ```bash
   cp -R skills/ai-overview        ~/.claude/skills/
   cp    agents/ai-overview-scraper.md  ~/.claude/agents/
   ```
2. **Python dependency:**
   ```bash
   python3 -m pip install -r requirements.txt
   ```
3. **MCP servers** — see below.
4. **Restart Claude Code** so it re-scans `~/.claude/skills` and `~/.claude/agents`.

### MCP servers (required, both engines)

**Chrome DevTools** — add as a user server named exactly `chrome-devtools`:
```bash
claude mcp add chrome-devtools --scope user -- npx chrome-devtools-mcp@latest --autoConnect
```

**Playwright** — install the official plugin from **inside Claude Code**:
```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install playwright@claude-plugins-official
```

Confirm both are healthy:
```bash
claude mcp list
# expect:  chrome-devtools: ... ✓ Connected
#          plugin:playwright:playwright: ... ✓ Connected
```

---

## Verify the install

- In Claude Code, run **`/ai-overview`** — it should start by asking for your topic. If the command isn't found, restart Claude Code so it re-scans the skills folder.
- Smoke-test the report builder **without scraping** (proves Python + openpyxl + the script work):
  ```bash
  echo '{"topic":"demo","engine":"google","region":{"google":"google.ae","gl":"ae","hl":"en"},"date":"2026-01-01","brand":"policybazaar.ae","keywords":[{"q":"best health insurance uae","present":true,"text":"...","hosts":["policybazaar.ae","bupa.ae"]}]}' > /tmp/aio_demo.json
  python3 ~/.claude/skills/ai-overview/scripts/build_matrix.py --data "Google AIO=/tmp/aio_demo.json" --out /tmp/aio_demo.xlsx
  ```
  `Wrote /tmp/aio_demo.xlsx` plus a printed leaderboard means the analysis side is working.

---

## Usage

Run **`/ai-overview`**. It asks, in order:
1. **Business unit** — sets the tracked brand. e.g. *Credit Card / Personal Loan / Bank Account / Credit Score / Car Loan / Home Loan* → `paisabazaar.ae`; *Car / Term / Health / Travel / Business / Home / Group Insurance & Investment* → `policybazaar.ae`.
2. **Topic** to track (defaults to the chosen unit's name; accepts a narrower angle).
3. **Provide your own prompts**, or have it **generate** ~50 across intent buckets.
4. **Engine(s):** Google AI Overview, ChatGPT, or both (defaults to Google AIO).
5. **Region** (defaults to UAE / English: `google.ae`, `gl=ae`, `hl=en`).

For the **ChatGPT** engine, open Chrome and sign in to chatgpt.com first — it scrapes your logged-in session and is slower and more block-prone than Google.

**Output:** an `.xlsx` workbook (a positions matrix + verbatim-text sheet per engine, brand highlighted, `NA` = not cited), the raw `.json` dataset(s), and an on-screen leaderboard showing where the tracked brand lands versus competitors.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/ai-overview` not listed | Confirm `~/.claude/skills/ai-overview/SKILL.md` exists; restart Claude Code. |
| "agent `ai-overview-scraper` not found" | Confirm `~/.claude/agents/ai-overview-scraper.md` exists. |
| MCP server not connected | `claude mcp list`; re-add per the commands above. Chrome DevTools needs Chrome running (and logged into chatgpt.com for the ChatGPT engine). |
| Playwright path skipped | If its tools resolve as `mcp__playwright__*` instead of `mcp__plugin_playwright_playwright__*`, you installed it as a plain server — install the **plugin** instead (or edit the agent's ToolSearch line). |
| Playwright "browser not installed" | `npx playwright install chromium` |
| `ModuleNotFoundError: openpyxl` | `python3 -m pip install -r requirements.txt` |
| ChatGPT returns no sources / stops early | Expected — ChatGPT only cites when it actually web-searches, and Cloudflare/login can halt it. The agent stops and reports how far it got rather than inventing data. |

---

## Data-integrity notes

- AI answers are **personalized and non-deterministic** — every run is one snapshot from one session/region, not a stable ranking (ChatGPT especially varies per account/run).
- **Empty citations are a real result** and are never padded; a no-Overview / no-sources outcome is reported as such.
- A CAPTCHA / Cloudflare / login wall makes the agent **stop and report exactly how far it got** — it never fabricates the remaining prompts.

## License

[MIT](LICENSE) © 2026 Aakash Srivastava
