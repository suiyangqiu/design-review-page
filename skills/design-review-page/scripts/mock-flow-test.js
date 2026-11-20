// The review page's comment flows against the mock store. Run it through the Playwright MCP with
// browser_run_code_unsafe and filename set to this file, while serve-mock.cjs serves the built page on
// port 18765. It uses the page's first figure, so it works for any review page. Result: { pass, checks, ... }.
async (page) => {
  const BASE = "http://127.0.0.1:18765/";
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });

  const go = async (who, opts, settle) => {
    await page.goto(BASE);
    await page.evaluate(([w, o]) => {
      for (const k of ["mockro", "mockslow", "mockflaky", "mockhang", "mocklostack", "mockfull"]) sessionStorage.removeItem(k);
      sessionStorage.setItem("mockme", w);
      for (const k of Object.keys(o || {})) sessionStorage.setItem(k, o[k]);
    }, [who, opts || {}]);
    await page.reload();
    await page.locator("#rail-list li").first().waitFor();
    await page.waitForTimeout(settle == null ? 400 : settle);
  };
  const post = async (text) => {
    await page.locator("#composer-text").fill(text);
    await page.locator(".composer button[type=submit]").click();
    await page.waitForTimeout(300);
  };
  const names = (sel) => page.evaluate((s) => [...document.querySelectorAll(s + " .cmt-head .who, " + s + " .evt-head strong")]
    .map((n) => (n.classList.contains("is-pending") ? "[pending]" : n.textContent)), sel);

  await page.goto(BASE);
  await page.evaluate(() => sessionStorage.clear());
  await go("u_reviewer");
  const fig = "#" + (await page.locator("figure.figure").first().getAttribute("id"));
  const r = { figure: fig, figures: await page.locator("figure.figure").count(), checks: {} };
  const ok = (name, value) => { r.checks[name] = value; };

  ok("writable as a contributor", await page.evaluate(() => document.body.classList.contains("can-write")));

  // A pin on the first screenshot, written straight under the image.
  const img = page.locator(fig + " .shot img");
  await img.scrollIntoViewIfNeeded();
  const b = await img.boundingBox();
  await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.2);
  ok("composer opens right under the image", await page.locator(fig).evaluate((f) => !!f.querySelector(".slot .composer") && f.querySelector(".slot").previousElementSibling.classList.contains("shot")));
  await post("Test pin: could this be lighter?");
  ok("one pin shows", (await page.locator(fig + " .pin").count()) === 1);
  ok("comment shows under its figure", (await page.locator(fig + " .thread .cmt").count()) === 1);

  // A general note.
  await page.locator("#general .btn.ghost-note").click();
  await post("Test note: overall this matches the design.");
  ok("general note shows", (await page.locator("#general .cmt").count()) === 1);

  // Someone else marks it resolved, which needs a note; it is resolved at once.
  await go("u_owner");
  await page.locator(fig + " .cmt").first().getByRole("button", { name: "Mark resolved" }).click();
  await page.locator(".composer button[type=submit]").click();
  await page.waitForTimeout(200);
  ok("resolving someone else's comment needs a note", await page.locator(".composer .err").isVisible());
  await post("Test resolution: done in a follow-up.");
  ok("marked resolved shows as resolved", (await page.locator(fig + " .chip.st-resolved").count()) === 1);
  ok("pin turns green", ((await page.locator(fig + " .pin").getAttribute("class")) || "").includes("st-resolved"));
  ok("open count is 1 (the note)", (await page.locator("#total-count").textContent()) === "1");

  // The commenter disagrees and reopens it, which needs a reason.
  await go("u_reviewer");
  await page.locator(fig + " .cmt").first().getByRole("button", { name: "Reopen" }).click();
  await page.locator(".composer button[type=submit]").click();
  await page.waitForTimeout(200);
  ok("reopening needs a reason", await page.locator(".composer .err").isVisible());
  await post("Test reopen: what about the dark theme?");
  ok("reopened shows red", (await page.locator(fig + " .chip.st-reopened").count()) === 1);
  ok("pin turns red", ((await page.locator(fig + " .pin").getAttribute("class")) || "").includes("st-reopened"));
  ok("reopened counts as open again", (await page.locator("#total-count").textContent()) === "2");

  // Resolved again, by the commenter this time: no note needed.
  await page.locator(fig + " .cmt").first().getByRole("button", { name: "Mark resolved" }).click();
  await page.locator(".composer button[type=submit]").click();
  await page.waitForTimeout(300);
  ok("the commenter resolves their own with no note", (await page.locator(fig + " .chip.st-resolved").count()) === 1);
  ok("open count is back to 1", (await page.locator("#total-count").textContent()) === "1");
  ok("thread shows resolved, reopened, resolved", (await page.locator(fig + " .evt .mark").allTextContents()).join(" | ") === "✓ Marked resolved | ↺ Reopened | ✓ Marked resolved");

  // All feedback view.
  await page.locator("#view-feedback").click();
  await page.waitForTimeout(200);
  r.feedbackContexts = await page.locator("#feedback .fb-item .context").allTextContents();
  ok("all feedback lists both", r.feedbackContexts.length === 2);
  r.tallies = await page.locator("#feedback .tally").allTextContents();
  ok("tallies count reopened, open and resolved", r.tallies.some((t) => t === "0 reopened · 0 open · 1 resolved"));
  await page.locator("#view-screens").click();

  // Read-only viewer.
  await go("u_viewer", { mockro: "1" });
  ok("viewer is read-only", !(await page.evaluate(() => document.body.classList.contains("can-write"))));
  ok("viewer sees the comments", (await page.locator(fig + " .cmt").count()) === 1);

  // Names arrive late: a placeholder, never "Someone", then the names.
  await go("u_owner", { mockslow: "1500" }, 150);
  const early = await names(fig);
  await page.waitForTimeout(1700);
  const late = await names(fig);
  r.slowNames = { early, late };
  ok("slow names show a placeholder first", early.length > 0 && early.every((n) => n === "[pending]"));
  ok("slow names arrive after one round trip", late.includes("Riley Chen"));

  // A first answer that cannot name anyone: "Someone", then the retry fills it in.
  await go("u_owner", { mockflaky: "1", mockslow: "300" }, 450);
  const first = await names(fig);
  await page.waitForTimeout(3000);
  const retried = await names(fig);
  r.flakyNames = { first, retried };
  ok("unnamed shows Someone", first.includes("Someone"));
  ok("retry fills the name in", retried.includes("Riley Chen"));

  // Rows from pages built before resolving was direct: a proposal reads as resolved, a decline as reopened.
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem("mockstore") || "{}");
    const row = (kind, parent, author, at, body) => ({ kind: kind, ticket: null, section: "general", figure: null, x: null, y: null,
      parent: parent, body: body, author: author, createdAt: "2026-11-01T0" + at + ":00:00.000Z", resolved: false });
    s.legacy1 = row("comment", null, "u_viewer", 1, "Legacy comment one");
    s.legacy1p = row("propose", "legacy1", "u_owner", 2, "Legacy proposal");
    s.legacy2 = row("comment", null, "u_viewer", 3, "Legacy comment two");
    s.legacy2p = row("propose", "legacy2", "u_owner", 4, "Legacy proposal");
    s.legacy2d = row("decline", "legacy2", "u_viewer", 5, "Legacy decline");
    sessionStorage.setItem("mockstore", JSON.stringify(s));
  });
  await go("u_owner");
  const legacy = (cid) => page.locator('#general .cmt[data-cid="' + cid + '"]');
  ok("a legacy proposal reads as resolved", ((await legacy("legacy1").getAttribute("class")) || "").includes("st-resolved"));
  ok("a legacy decline reads as reopened", ((await legacy("legacy2").getAttribute("class")) || "").includes("st-reopened"));
  ok("a legacy resolved comment can be reopened", (await legacy("legacy1").getByRole("button", { name: "Reopen" }).count()) === 1);
  ok("a legacy reopened comment can be resolved", (await legacy("legacy2").getByRole("button", { name: "Mark resolved" }).count()) === 1);

  // A row from before the section field, holding only an upper-case ticket, lands in the section with that key.
  const firstKey = await page.locator("section.ticket").first().getAttribute("id");
  await page.evaluate((key) => {
    const s = JSON.parse(sessionStorage.getItem("mockstore") || "{}");
    s.legacyU = { kind: "comment", ticket: key.toUpperCase(), figure: null, parent: null, body: "Legacy row with only a ticket",
      author: "u_viewer", createdAt: "2026-11-01T06:00:00.000Z", resolved: false };
    sessionStorage.setItem("mockstore", JSON.stringify(s));
  }, firstKey);
  await go("u_owner");
  ok("a legacy upper-case ticket finds its section", (await page.locator("#" + firstKey + ' .cmt[data-cid="legacyU"]').count()) === 1);

  // A save whose answer is lost is retried on the same id, so it is stored once and no error shows.
  await go("u_reviewer", { mocklostack: "1" });
  await page.locator("#general .btn.ghost-note").click();
  await post("Test note: saved once although its answer was lost.");
  await page.waitForTimeout(1500);
  const copies = await page.evaluate(() => Object.values(JSON.parse(sessionStorage.getItem("mockstore") || "{}"))
    .filter((row) => row.body === "Test note: saved once although its answer was lost.").length);
  ok("a retried save is stored once", copies === 1 && !(await page.locator(".composer .err").isVisible().catch(() => false)));

  // A full store: the save fails and the message says so, without asking anyone to delete feedback.
  await go("u_reviewer", { mockfull: "1" });
  await page.locator("#general .btn.ghost-note").click();
  await post("Test note: the store is full.");
  const fullText = (await page.locator(".composer .err").textContent().catch(() => "")) || "";
  ok("a full store says the comment couldn't be saved", fullText.includes("store is full") && !/clear out|delete/i.test(fullText));
  await page.keyboard.press("Escape");

  // A full window: with 1000 older rows, a new comment still shows, and the notice says older ones are hidden.
  await page.evaluate(() => {
    const s = {};
    for (let i = 0; i < 1000; i++) {
      s["old" + i] = { kind: "comment", ticket: null, section: "general", figure: null, x: null, y: null, parent: null,
        body: "Old note " + i, author: "u_viewer", createdAt: new Date(Date.UTC(2026, 9, 1) + i * 1000).toISOString(), resolved: false };
    }
    sessionStorage.setItem("mockstore", JSON.stringify(s));
  });
  await go("u_reviewer");
  await page.locator("#general .btn.ghost-note").click();
  await post("Test note: newer than the 1000 before it.");
  ok("a new comment shows past 1000 rows", (await page.locator("#general .cmt", { hasText: "Test note: newer than the 1000 before it." }).count()) === 1);
  ok("a full window says older ones are hidden", ((await page.locator("#notice").textContent()) || "").includes("Only the newest 1000"));
  await page.evaluate(() => sessionStorage.setItem("mockstore", "{}"));

  // A store that never answers: "Loading comments" stays, then after 10 seconds the page says so.
  await go("u_reviewer", { mockhang: "1" });
  ok("loading stays until comments arrive", (await page.locator("#notice").isVisible()) && ((await page.locator("#notice").textContent()) || "").startsWith("Loading comments"));
  await page.waitForTimeout(10300);
  ok("a store that never answers says so", ((await page.locator("#notice").textContent()) || "").includes("can't be reached yet"));

  r.errors = errors;
  ok("no page errors", errors.length === 0);
  r.pass = Object.values(r.checks).every(Boolean);
  await page.evaluate(() => sessionStorage.clear());
  return r;
}
