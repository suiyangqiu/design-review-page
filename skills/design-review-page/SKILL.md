---
name: design-review-page
description: "Build a design review page for a frontend change: a Claude artifact showing every new screen and state as captioned screenshots, with its own comment system (pins on screenshots, notes, mark resolved and reopen, an All feedback view), so product owners, designers and other non-technical stakeholders can see the change and leave feedback without running the app. Use whenever the user wants UI work put in front of POs, the UI/UX team or stakeholders for review, sign-off or a sprint demo, asks for a review page, a feedback page, screenshots people can comment on, or \"an artifact like the UI review page\" for a ticket, PR, epic or sprint; also to add screens to such a page or to read, summarise and resolve the feedback left on one. Trigger on /design-review-page. Not for screenshots inside a PR description or a few images on one ticket comment."
---

# Design review page: $ARGUMENTS

Turn a frontend change into one page that people who will never run the app can review: every screen and state as a screenshot with a plain-language caption, grouped into sections, with deliberate departures from the design called out, and comments that pin to a spot on a screenshot and carry their own resolve flow: anyone can mark a comment resolved with a note, and anyone who disagrees, the commenter above all, can reopen it with what is still open. The page is a Claude artifact shared with the organization; the comments live in the artifact's own database, so the owner reads them later and nobody gets an @Claude notification.

The page template, build and test tooling are bundled, so every review looks and behaves the same. Your work is choosing what to show, capturing it well, and writing it for the people reading it.

## Modes

| Invocation | Does |
|---|---|
| `/design-review-page <tickets, PR or branch>` | Build a new page (Mode 1). |
| `/design-review-page update <artifact url>` | Add or retake screens, edit text, republish (Mode 2). |
| `/design-review-page feedback <artifact url>` | Read the comments, summarise them, act on them with the user (Mode 3). |

**Needs:** Node 18 or later; the Playwright MCP, to capture screens and run the mock test; the Artifact and ArtifactData tools (claude.ai artifacts with the `db` and `user` capabilities); the Atlassian MCP (or your tracker's equivalent) only for the ticket link comment. `<skill>` below means this skill's base directory, shown when the skill loads.

## Settings

| Setting | Value |
|---|---|
| Work folder | Where the review's `review.json`, screenshots, backups and test shots live. It must be inside the workspace (the Playwright MCP only reads and writes there). Use the project's own convention when CLAUDE.md or a handover names one; otherwise `<workspace>/design-reviews/<yyyy-mm-dd>-<slug>/`. |
| Build folder | `<scratchpad>/<slug>-review/`. On Windows, use the scratchpad's **long** path (resolve it with `(New-Object -ComObject Scripting.FileSystemObject).GetFolder(<path>).Path`): the Artifact tool rejects 8.3 short paths. Never build under a `.worktrees` folder: files there fail to publish with "changed between approval and publish". |
| Template | `assets/review-page.html`. Never edit it for one page; content goes in `review.json`. |
| Scripts | `scripts/build-page.cjs`, `scripts/serve-mock.cjs`, `scripts/mock-claude.js`, `scripts/mock-flow-test.js` (Node, no dependencies). |
| Capabilities | `{db: {}, user: {scopes: ["profile"]}}` |
| Icon | `review` |
| Viewport | 1440x900 unless the change is about another size. |

## Hard rules

1. **Its own comment store, never the artifact's native comments or a Claude Doc.** Native comments tag @Claude and notify; reviewers want plain comments the owner reads in their own time.
2. **Written for people who will not run the app.** Captions say what they are looking at and why it matters, in the product's words, not the code's. See `references/review-json.md`.
3. **Mock data only.** The page is shared across the organization. If a screen shows anything that looks like a real person's details, stop and ask the user.
4. **Back up the comments before any republish or row change** (`references/comments-data.md`). Reviewers' comments exist nowhere else.
5. **Section keys and figure ids are permanent once anyone has commented.** Pins point at them; renaming or removing one loses or moves comments.
6. **Test on the mock, never on the live store.** Every new or changed page passes `scripts/mock-flow-test.js` before it is published.
7. **Sharing is the user's to do.** No tool can share an artifact. Reviewers need **Contributor** access to comment (Viewers only read). Confirm it is shared before posting the link anywhere.
8. **Anything posted to people goes out only on the user's go-ahead**: Jira or PR comments, and replies or resolutions written on the page under their name.
9. **House style** (this skill's defaults; change them to suit your team). No en or em dashes (the build warns on them). Every PR as `[repo #N](link)`. Questions for the user go in chat, numbered, never as a section on the page.

## Mode 1: build a new page

### 1. Scope

Read the tickets and the PR live (`gh pr view`, the Atlassian MCP's `getJiraIssue`), not from memory. Settle:
- **The commit**: merged `main` for shipped work, the PR head for work under review.
- **The sections**: one per ticket when there are several; one per area a reader would name when it is one ticket (`references/review-json.md`, "Choosing sections").
- **The design it is judged against** (the prototype URL or Figma) and the deliberate differences, from the PR description and the ticket. Ask the user if the design source is unknown.

Tell the user the plan in a few lines (commit, sections, roughly how many screens) and carry on unless something is unclear.

### 2. Capture

Follow `references/capturing-screens.md`. Cover, for each section:
- every new or changed screen, at rest and after the interactions that matter (menus open, a selection made, a filter applied);
- its states: loading, empty or no match, failure, read-only, forced in the browser where mock data never produces them;
- where its links and results lead, including placeholder pages;
- anything else on screen the change touched as a side effect.

Read every image after saving it. Save them in the work folder as `shots/NN-<what>.png`.

### 3. Write review.json

In the work folder, following `references/review-json.md`: title, heading, owner, eyebrow, lede, facts (Mock data, Desktop, Design, Code, Checked, Follow-ups as they apply), sections with figures, and "Built differently from the design on purpose" per section. Only differences you checked.

Add a section's "Please verify or decide" card (`asks`) only when it has something the product owner or reviewers must settle: an undecided choice, a deviation from the design that needs sign-off, or wording or behaviour awaiting their decision (above all wording the design doesn't have, with why it was added and why it is needed). Otherwise leave it out and no card shows. The rules are in `references/review-json.md`, "Asking the reviewers to verify or decide".

### 4. Build

```
node <skill>/scripts/build-page.cjs <work>/review.json --out <build folder>
```

Fix every error. Treat warnings as house-style misses and fix them too unless the user says otherwise. The output ends with the `files` list to publish.

### 5. Test on the mock

1. `node <skill>/scripts/serve-mock.cjs <build folder>` in the background (port 18765). If the port is taken (another session's server, say), pass `--port <n>` and change `BASE` in the copy of the test below to match; never stop a server you did not start.
2. Copy `scripts/mock-flow-test.js` into a folder the Playwright MCP can read, such as `<workspace>/.playwright-mcp/` (by default it only loads files from the workspace), and run it with `browser_run_code_unsafe`, `filename` set to that copy. It pins, notes, marks resolved (a note required on someone else's comment), reopens (a reason required), resolves again, reads rows from older pages (propose and decline, and a row with only an upper-case ticket), and checks the All feedback view, read-only mode, slow names and names that resolve late, using the page's first figure. It also checks that a save whose answer is lost is stored once, that a full store says a comment couldn't be saved, that a new comment still shows when 1000 older rows fill the page's window, and that a comment store that never answers keeps "Loading comments" and then says so after 10 seconds, so a run takes about 30 seconds.
3. It must return `pass: true`. Then take one screenshot of the page top and one of a figure, Read both, and fix anything that looks wrong.
4. Stop the server and `browser_close`.

### 6. Publish

A new page: call the Artifact tool's `quickstart` once (`intent: "other"`, `design_systems: false`), as the tool requires before any new artifact. The template already meets its page contract. Then:

```
Artifact publish
  file_path    <build folder>/index.html
  root         <build folder>
  files        <the list build-page printed>
  capabilities {db: {}, user: {scopes: ["profile"]}}
  icon         review
  description  one sentence: what is being reviewed, for whom
```

Then one functional pass: `ArtifactData list` of `comments` (empty), and the same with `as_level: "view"`.

### 7. Share and link

Tell the user the page is private until they share it: in the page's Share menu, give their organization (or the named reviewers) **Contributor** access. Confirm it is shared (AskUserQuestion) before any link goes out.

Then draft, show and, on their go-ahead, post a short Jira comment on each ticket holding just the link, as its own comment: what the page shows, how many screens, and that anyone with access can pin comments on it. For Jira, use the Atlassian MCP's `addCommentToJiraIssue` (markdown), and keep code out of bold text: the conversion drops bold around inline code. For another tracker, use its own tool the same way. A PR comment linking it is optional, on the same go-ahead.

### 8. Record and hand off

Keep `review.json`, the shots, the built page and backups in the work folder. If the work has a handover document, add the page's URL and how to rebuild it. Tell the user, briefly:
- the link, and the sections and number of figures;
- what was tested (the mock flow test result) and what was not;
- what they need to do (share at Contributor), and what you can do next (the Jira comment, reading feedback later).

## Mode 2: update a page

1. **Find the source.** Look for the page's `review.json` in the work folder (a handover document or the project's notes usually point to it). If it is missing, rebuild it from the live page: `Artifact read` the URL (Read every line; this is also what allows a republish from a new chat), copy the `review-data` JSON block into a new `review.json`, and fetch the shots with `Artifact read` and `paths`. A page built before this skill has no `review-data` block: rebuild its content into `review.json` by hand, keeping its section keys (older rows carry only `ticket`, which the template reads as the section key without case, so a row with `ABC-12` lands in the section `abc-12`) and figure ids.
2. **Back up the comments.**
3. **Change `review.json` and the shots** within the permanence rules (`references/comments-data.md`, "Changing a page that has comments").
4. **Build, test on the mock, republish.** In the session that published it, republish the same `file_path`; from another session, pass `url`. Pass only new or changed screenshots in `files` (files left out are kept) and leave `capabilities` out to keep them.
5. Tell the user what changed. Post a Jira note about it only if they ask.

## Mode 3: read and act on feedback

Follow `references/comments-data.md`: list the `comments` collection into the work folder, resolve the authors' names with `ArtifactData profiles`, and report to the user grouped by section. For each comment give who, which figure, what they asked and its status, reopened first, then open. Then propose what to do with each: a fix and the ticket it belongs to, a reply, or marking it resolved with a note (with screenshots of the fix where they help). Write nothing to the page or Jira until the user says go, and never reopen a comment on a reviewer's behalf.
