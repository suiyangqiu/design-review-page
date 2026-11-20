# Capturing the screens

Reviewers judge the change from these images alone, so each one has to show the real app, in the state the caption describes, at a size they can read. These notes come from real review rounds with product owners.

## Run the code the reviewers should see

- **Pick the commit**: the merged commit on `main` for a shipped change, the PR head for a change under review. Say which in the Code fact.
- **Use a worktree**, not the user's main checkout: they often run their own dev server from it. `git worktree add .worktrees/<name> <commit>`, then `npm ci` there. If a worktree for that branch already has `node_modules` and a dev server, reuse it, and check first with `git diff <its HEAD> <commit>` that the trees match.
- **Start the dev server on a free port** (check with `netstat -ano`), in the background. Mock data is what reviewers should see: never point the app at a real API or real customer data. If a screen shows anything that looks like a real person's details, stop and ask the user.

## The Playwright MCP

- One browser profile is shared by every Claude session on the machine. If it says "Browser is already in use", another session holds it: tell the user which (the holder is the browser process, such as `msedge.exe` or `chrome.exe`, whose command line names the profile; its parent is that session's `@playwright/mcp` node) and ask before closing anything that isn't yours. Close your own browser (`browser_close`) when you finish, so others can use it.
- It reads and writes files only under the workspace (and `<workspace>/.playwright-mcp/`). Save screenshots into the work folder inside the workspace.
- Drive it with `browser_run_code_unsafe`: one call can set the viewport, act, wait and save several shots, which is faster and steadier than many small tool calls.

## Each shot

- **Viewport 1440x900** (a common desktop design size; use the design's own if it differs) unless the change is about another size. Say the size in the Desktop fact.
- **Wait for the real content**, never a fixed sleep alone: a selector for the content, `document.fonts.ready`, then a short settle. Move the mouse to a corner (`page.mouse.move(1439, 899)`) so no hover state shows, unless the hover is the point. Blur the focused element when a focus ring would distract.
- **Whole viewport for a page; a clip for a dropdown, menu or component**, with enough around it to place it. Keep clips of the same thing the same size, so the reader's eye stays put between figures. For a scrolling panel, scroll it (`el.scrollTop = el.scrollHeight`) to show a later group.
- **Red box on the area of focus** when one area is the point; none when the whole screen is. Draw it in the page, screenshot, then remove it:

```js
const box = (b, pad = 6) => page.evaluate(({ b, pad }) => {
  const d = document.createElement("div"); d.setAttribute("data-focus", "");
  Object.assign(d.style, { position: "absolute", zIndex: "2147483647", pointerEvents: "none",
    left: (b.x + scrollX - pad) + "px", top: (b.y + scrollY - pad) + "px",
    width: (b.width + pad * 2) + "px", height: (b.height + pad * 2) + "px",
    border: "4px solid #dc2626", borderRadius: "6px", boxSizing: "border-box" });
  document.body.append(d);
}, { b, pad });
// Box text tightly, not its full-width paragraph:
const textBox = (loc) => loc.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
await box(await textBox(page.getByText("Press Ctrl K")));
await page.screenshot({ path: dir + "01-home.png" });
await page.evaluate(() => document.querySelectorAll("[data-focus]").forEach((n) => n.remove()));
```

## States: loading, empty, failure

Reviewers need these as much as the happy path. On mock data they flash by or never happen, so force them in the browser, without changing code:

- **Rewrite the service module the dev server serves**, behind window flags, before the first navigation. Vite serves each source file at its own URL, so `page.route` can change it on the way. Here the app's mock service awaits a `fakeDelay()` before answering; use whatever your mock service awaits:

```js
await page.route("**/src/api/productSearch.ts*", async (route) => {
  const res = await route.fetch();
  let body = await res.text();
  body = body.replace(/await fakeDelay\(\);?/,
    "if (window.__hold) await new Promise(() => {}); if (window.__fail) { await fakeDelay(); throw new Error('forced failure'); } await fakeDelay();");
  await route.fulfill({ response: res, body, headers: { ...res.headers(), "content-type": "application/javascript" } });
});
await page.goto(base);
// later: await page.evaluate(() => { window.__hold = true; });  // loading
//        await page.evaluate(() => { window.__hold = false; window.__fail = true; });  // failure
```

  Check the rewrite matched (compare the body before and after). Query libraries may retry a failure a few times before showing it; wait for the failure UI with a generous timeout (20 s), not a sleep.
- **Empty and no-match states**: use inputs that match nothing ("zzqx").
- **Whole-page loading**: route the module that holds the mock delay to a never-resolving promise for that page load only.
- In every forced state's caption, say it was forced.

## Before you use an image

Read every image after saving it (the Read tool shows it): the right page and state, fonts loaded, no dev overlays, the box on the right thing, nothing sensitive. Retake rather than explain away a bad shot. Never stand in an older or unrelated image for one you could not capture; say in a section `note` what is missing and why.

Name files in page order (`01-home.png`, `02-results.png`) and keep them, with `review.json`, in the work folder.
