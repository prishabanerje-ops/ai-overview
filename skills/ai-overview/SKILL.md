---
name: ai-overview
description: Scrape AI-search citations for a set of prompts and produce a citation-position competitive analysis (Excel matrix + raw JSON + verbatim text + on-screen leaderboard). Covers Google AI Overviews AND ChatGPT web-search sources. Use whenever the user wants to capture, track, audit, or analyze what sources AI search engines cite — e.g. "scrape AI overview", "/ai-overview", "which sites does Google's AI cite", "are we cited in AI Overviews", "scrape ChatGPT sources", "what does ChatGPT cite for these keywords", "AI Overview citations", "GEO/AEO citation tracking", "LLM citation audit". Invoke even if the user just gives a topic and says they want the AI citation data.
---

# /ai-overview — AI-search citation tracker (Google AI Overview + ChatGPT)

Capture AI-search answers for many prompts, then show **who the AI cites and in what order** — so a brand can see its visibility gap. Generic for any topic; the **tracked brand is set by the chosen business unit** — `policybazaar.ae` or `paisabazaar.ae` (mapping in step 1).

The scripts and the scraper agent do the heavy lifting. This file is the orchestration.

## Ask these questions IN ORDER, then act
1. **"Which business unit are we tracking?"** — ALWAYS ask this first and show the table below. The unit the user picks sets the **tracked brand** (`$BRAND`) for the whole run and is the default topic.

   | Business unit | Tracked brand |
   |---|---|
   | Credit Card | `paisabazaar.ae` |
   | Personal Loan | `paisabazaar.ae` |
   | Bank Account | `paisabazaar.ae` |
   | Credit Score | `paisabazaar.ae` |
   | Car Loan | `paisabazaar.ae` |
   | Home Loan | `paisabazaar.ae` |
   | Car Insurance | `policybazaar.ae` |
   | Term Insurance | `policybazaar.ae` |
   | Health Insurance | `policybazaar.ae` |
   | Travel Insurance | `policybazaar.ae` |
   | Business Insurance | `policybazaar.ae` |
   | Investment | `policybazaar.ae` |
   | Home Insurance | `policybazaar.ae` |
   | Group Insurance | `policybazaar.ae` |

   Rule of thumb if the user names something off-list: **credit / loan / banking / score** products → `paisabazaar.ae`; **insurance / investment** products → `policybazaar.ae`. If still ambiguous, ask which of the two brands to track (don't silently default).
2. **"What topic do you want to track?"** — default to the chosen unit's name (e.g. *Health Insurance*); accept a narrower angle if the user gives one.
3. **"Will you (1) provide the prompts yourself, or (2) should I generate them from the topic?"**
4. **"Which engine(s): (1) Google AI Overview, (2) ChatGPT, or (3) both?"** Default to **Google AI Overview** if unstated.
5. Region: assume **UAE / English** (`google.ae`, `gl=ae`, `hl=en`) unless the user says otherwise or named a different market. Only ask if genuinely ambiguous.

Optional overrides the user may state anytime — honor silently: prompt count (default **50** when generating), a **different brand** (overrides the unit mapping for `$BRAND`), region, or output folder.

**If ChatGPT is selected, say this up front:** ChatGPT scraping uses the **Chrome DevTools engine and your logged-in chatgpt.com session** — make sure you're signed into ChatGPT in Chrome. It's **slow and block-prone** (Cloudflare/login can stop it), and many prompts will legitimately return **no sources** (ChatGPT only cites when it actually web-searches). This is the fragile path; Google AI Overview is the reliable one.

## Branch (1) — user provides prompts
Take their list verbatim (one per line). Don't pad or trim. Go to **Scrape**.

## Branch (2) — Claude generates the prompts
Generate **~50** distinct, natural prompts across intent buckets so the analysis is representative (not 50 rewordings of "best X"):
- **Provider/product discovery** — "best / top / cheapest / most affordable <topic>", segment variants (families, expats, seniors, students, SMEs, by city/region).
- **Cost / price** — "how much does <topic> cost", "average price of …".
- **Process / eligibility / regulation** — "how to get/buy/renew <topic>", "is <topic> mandatory", "requirements for …".
- **Types / coverage / features** — "does <topic> cover …", "best <topic> for <specific need>".
- **Specific brand / product** — "is <Brand> good", "<Brand> reviews", "<Brand A> vs <Brand B>".
- **Comparison / decision** — "how to choose <topic>", "X vs Y", "best value …".

Adapt buckets to the topic. Then **scrape immediately — no approval step** (user's chosen default). Show the generated list as you start so they can interrupt if it's off-target.

## Scrape — dispatch the ai-overview-scraper agent (once per selected engine)
Resolve this skill's base directory (announced when the skill loads) as `$SKILL`. Pick `$WORK` (current dir unless the user named one) and today's date (`date +%F`). For **each** selected engine, dispatch the **ai-overview-scraper** agent with: engine (`google` or `chatgpt`), the full prompt list, region, brand (`$BRAND` — the chosen unit's brand, `paisabazaar.ae` or `policybazaar.ae`), the topic, and:
- google → `extract_fn_path` = `$SKILL/scripts/extract_aio.js`, `out_path` = `$WORK/aio_<slug>_<date>__google.json`
- chatgpt → `extract_fn_path` = `$SKILL/scripts/extract_chatgpt.js`, `out_path` = `$WORK/aio_<slug>_<date>__chatgpt.json`

The agent picks the browser (google: Playwright→Chrome; chatgpt: Chrome only, logged in), scrapes sequentially, writes the dataset JSON, and returns a short summary. If it reports a **block / login wall / no browser MCP**, relay that honestly and stop for that engine — do not fabricate the missing prompts. Run engines sequentially (one browser at a time). For tiny lists (≤ ~5) you may scrape inline with the matching extract script instead of spawning the agent.

## Analyze — build the report (one workbook, a sheet per engine)
Pass each engine's dataset as a `Label=path` pair:
```bash
python3 "$SKILL/scripts/build_matrix.py" \
  --data "Google AIO=$WORK/aio_<slug>_<date>__google.json" "ChatGPT=$WORK/aio_<slug>_<date>__chatgpt.json" \
  --out "$WORK/AIO_<slug>_<date>.xlsx" --brand "$BRAND" --min-prompts 2
```
(`$BRAND` is the chosen unit's brand — `paisabazaar.ae` or `policybazaar.ae`. Only include the engines you actually scraped.) Each engine gets a positions matrix sheet + a verbatim-text sheet; columns = domains cited in ≥2 prompts ranked by frequency; brand highlighted; NA = not cited; "cited in" + "avg position" summary rows. The script prints per-engine leaderboards + a cross-engine brand line. Copy the `.xlsx` to `~/Downloads/`.

## Present
- engine(s) used + coverage per engine (e.g. "Google: 48/50 had an Overview, 0 blocks; ChatGPT: 31/50 answered, 18 cited sources, stopped by a login wall at #32"),
- the **leaderboard(s)**,
- **where the tracked brand lands** per engine (coverage + avg position vs top competitors — the visibility gap),
- file paths: the `.xlsx` (+ `~/Downloads` copy) and the raw `.json`(s).

## Non-negotiables (data integrity)
- Never present inferred/guessed AI content as scraped. No Overview / no ChatGPT sources → say so. A block → report exactly how far it got.
- AI answers are **personalized and non-deterministic** — state this is one snapshot from one session/region, not a stable ranking. (ChatGPT especially varies per account/run.)
- "Position" = order in the answer's cited-sources list (closest proxy to rank these surfaces expose), **not** a classic blue-link SERP rank — say so.

## Bundled files
- `scripts/extract_aio.js` — Google AI Overview extraction (inject via browser JS-eval).
- `scripts/extract_chatgpt.js` — ChatGPT sources extraction (Chrome DevTools, logged-in).
- `scripts/build_matrix.py` — builds the multi-engine `.xlsx` + leaderboards (needs `openpyxl`).
- Agent: `ai-overview-scraper` (drives the browser per engine, writes the dataset JSON).
