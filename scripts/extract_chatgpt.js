/*
 * ChatGPT cited-sources extraction — run on chatgpt.com AFTER submitting a prompt.
 * Inject via Chrome DevTools MCP `evaluate_script` (ChatGPT needs a logged-in
 * session, so the Playwright isolated browser won't work).
 *
 * Self-contained: it WAITS for the answer to finish (stop-button gone AND text
 * stable for two consecutive polls — the combination verified by live calibration;
 * the stop button alone flickers between tokens), then extracts. Anchored on the
 * stable attribute `data-message-author-role="assistant"`, so it is resilient to
 * ChatGPT's obfuscated class names. Citations render as anchor links carrying
 * `?utm_source=chatgpt.com`; the same domain often repeats and is de-duplicated.
 *
 * Returns one of:
 *   { blocked: true }                                   -> Cloudflare/anti-bot: STOP, report
 *   { loggedOut: true }                                 -> not signed in: STOP, ask user to log in
 *   { hasAnswer: false }                                -> no assistant turn appeared
 *   { streaming: true, partialLen }                     -> still generating after the cap; re-call to keep waiting
 *   { hasAnswer: true, text, citationCount, hosts }     -> done; hosts = ordered cited domains (may be empty)
 *
 * hosts empty + hasAnswer true is a REAL result: ChatGPT answered without citing
 * sources (it didn't web-search). Record it honestly; never invent sources.
 */
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const bodyText0 = document.body.innerText || "";

  if (
    /Verify you are human|Just a moment|Checking your browser|needs to review the security/i.test(bodyText0) ||
    document.querySelector('#challenge-form, iframe[src*="challenges.cloudflare"], iframe[title*="Cloudflare"]')
  ) {
    return { blocked: true };
  }

  const isStreaming = () =>
    !!document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop" i]');
  const lastAssistant = () => {
    const a = document.querySelectorAll('[data-message-author-role="assistant"]');
    return a.length ? a[a.length - 1] : null;
  };

  // Wait for completion: stop-button gone AND text stable across two polls (~35s cap).
  let last = -1, stable = 0, waited = 0;
  while (waited < 35000) {
    const el = lastAssistant();
    const cur = el ? (el.innerText || "").length : 0;
    if (!isStreaming() && cur > 0 && cur === last) {
      stable++;
      if (stable >= 2) break;
    } else {
      stable = 0;
    }
    last = cur;
    await sleep(2500);
    waited += 2500;
  }

  const el = lastAssistant();
  if (!el) {
    const loginish = /log in|sign up|create your account|welcome back/i.test(document.body.innerText || "");
    const hasComposer = !!document.querySelector('#prompt-textarea, textarea, [contenteditable="true"]');
    if (loginish && !hasComposer) return { loggedOut: true };
    return { hasAnswer: false };
  }
  if (isStreaming()) return { streaming: true, partialLen: (el.innerText || "").length };

  const text = (el.innerText || "").trim();
  const seen = new Set();
  const hosts = [];
  for (const a of el.querySelectorAll("a[href]")) {
    let h = "";
    try { h = new URL(a.href, location.href).hostname.replace(/^www\./, ""); } catch (_) {}
    if (!h) continue;
    if (/(^|\.)openai\.com$|(^|\.)chatgpt\.com$|oaiusercontent|(^|\.)bing\.com$|google\.com\/search/i.test(h)) continue;
    if (seen.has(h)) continue;
    seen.add(h);
    hosts.push(h);
  }
  return { hasAnswer: true, blocked: false, loggedOut: false, streaming: false, text, citationCount: hosts.length, hosts };
}
