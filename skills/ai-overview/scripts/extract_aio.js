/*
 * AI Overview extraction function — inject into the Google results page.
 *
 * Run it via the browser MCP's JS-evaluation tool:
 *   - Playwright MCP:      browser_evaluate  with  function = (the whole arrow fn below)
 *   - Chrome DevTools MCP:  evaluate_script   with  function = (the whole arrow fn below)
 *
 * It is idempotent and self-contained: detects a CAPTCHA, detects whether an
 * AI Overview is present, expands "Show more" (body) and "Show all" (sources),
 * then returns the full verbatim text plus the ordered, de-duplicated list of
 * cited external domains.
 *
 * CITATION ORDER — important:
 *   An AI Overview exposes citations in TWO different orders:
 *     1. the ranked "Show all" SOURCES PANEL (a role=dialog) — this is the order a
 *        user sees and the closest proxy to a citation rank; and
 *     2. inline links embedded in the answer body text, plus a separate
 *        "Related links" widget — both ordered differently.
 *   This function PREFERS the sources-panel order and reports which order it used
 *   in the `order` field. It falls back to the inline-body order only when no
 *   sources panel is present. (Older versions returned only the inline order,
 *   which mis-ranked domains vs. what users actually see.)
 *
 * Returns one of:
 *   { hasCaptcha: true }                                          -> STOP, report a block
 *   { hasAIO: false, hasCaptcha: false }                          -> no Overview for this query (record honestly)
 *   { hasAIO: true, hasCaptcha: false, order, text, citationCount, hosts }
 *       order = "sources-panel" (ranked panel) | "inline" (body fallback)
 *
 * Never fabricate a result when this errors or returns hasCaptcha — report the failure.
 */
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const bodyText = document.body.innerText || "";

  const hasCaptcha =
    /unusual traffic|not a robot|recaptcha|systems have detected/i.test(bodyText) ||
    !!document.querySelector("form#captcha-form");
  if (hasCaptcha) return { hasCaptcha: true };

  const hasAIO = /AI Overview/i.test(bodyText);
  if (!hasAIO) return { hasAIO: false, hasCaptcha: false };

  // Expand the Overview body ("Show more") AND open the full ranked sources list
  // ("Show all") so every citation loads in panel order.
  const clickByText = (re) =>
    Array.from(
      document.querySelectorAll(
        'div[role="button"], button, a[role="button"], span[role="button"], div[role="link"], a'
      )
    )
      .filter((e) => re.test((e.innerText || "").trim()))
      .forEach((e) => { try { e.click(); } catch (_) {} });
  clickByText(/^\s*show more\s*$/i);
  clickByText(/^\s*show all\s*$/i);
  await sleep(1500);

  // Ordered, de-duplicated external citation hosts within a container (drop
  // Google's own links). De-dup by host so each domain appears once, at its
  // first (highest) position — matching how the analysis assigns "position".
  const hostsOf = (root) => {
    const seen = new Set();
    const hosts = [];
    Array.from(root.querySelectorAll("a[href]")).forEach((a) => {
      let host = "";
      try { host = new URL(a.href).hostname.replace(/^www\./, ""); } catch (_) {}
      if (!host || /google\.|gstatic|youtube\.com\/redirect/i.test(host)) return;
      if (seen.has(host)) return;
      seen.add(host);
      hosts.push(host);
    });
    return hosts;
  };

  // --- Verbatim answer text (from the AI Overview body container) ---
  const all = Array.from(document.querySelectorAll("div,h1,h2,h3,span"));
  const heading = all.find(
    (e) =>
      (e.childElementCount === 0 || /H[123]/.test(e.tagName)) &&
      /^\s*AI Overview\s*$/i.test((e.innerText || "").trim())
  );
  let bodyContainer = null;
  let text = "";
  if (heading) {
    bodyContainer = heading;
    for (let i = 0; i < 8; i++) {
      if (bodyContainer.parentElement) bodyContainer = bodyContainer.parentElement;
      if ((bodyContainer.innerText || "").length > 600) break;
    }
    text = (bodyContainer.innerText || "").replace(/^\s*AI Overview\s*/i, "").trim();
  }

  // --- PRIMARY: the "Show all" sources panel (Google's ranked source list) ---
  // It renders as a role=dialog holding >=3 external source links. Exclude the
  // separate "Related links" widget (ordered differently) and any chrome dialogs
  // (feedback, ad centre — they have no source links). Pick the remaining
  // candidate with the most source links (ties -> longest text).
  const panels = Array.from(document.querySelectorAll('[role="dialog"]'))
    .map((d) => ({ aria: d.getAttribute("aria-label") || "", hosts: hostsOf(d), len: (d.innerText || "").length }))
    .filter((d) => d.hosts.length >= 3 && !/related/i.test(d.aria))
    .sort((a, b) => (b.hosts.length - a.hosts.length) || (b.len - a.len));

  if (panels.length) {
    const hosts = panels[0].hosts;
    return { hasAIO: true, hasCaptcha: false, order: "sources-panel", text, citationCount: hosts.length, hosts };
  }

  // --- FALLBACK: inline citation order from the AI Overview body container ---
  if (!bodyContainer) return { hasAIO: true, hasCaptcha: false, error: "heading not found" };
  const hosts = hostsOf(bodyContainer);
  return { hasAIO: true, hasCaptcha: false, order: "inline", text, citationCount: hosts.length, hosts };
}
