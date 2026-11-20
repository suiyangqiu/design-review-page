# review.json: the page's content

The page template is the same for every review. Everything a reader sees comes from one `review.json`, which `scripts/build-page.cjs` checks and embeds. Keep `review.json` and the screenshots in the work folder: that pair is what you edit and rebuild when the page needs updating.

Text fields may use three bits of markup, rendered safely (never as HTML): `[label](https://link)`, `` `code` `` and `**bold**`. URLs must be http or https.

## Shape

```json
{
  "title": "Storefront Search Bar",
  "heading": "Top bar search: design review",
  "owner": "Sam",
  "ticket": "SHOP-42",
  "jiraBase": "https://your-site.atlassian.net/browse/",
  "locale": "en-US",
  "eyebrow": ["Storefront", "[SHOP-42](https://your-site.atlassian.net/browse/SHOP-42)", "Merged 12 March 2026"],
  "lede": "These are screenshots of ... Pin a comment on anything you would change. Each comment is saved with your name, under the section it belongs to.",
  "steps": ["optional: replaces the three default how-to steps"],
  "facts": [
    ["Mock data", "Every product, customer and order is made up. The demo \"today\" is 1 March 2026."],
    ["Desktop", "Captured in Edge, 1440 pixels wide."],
    ["Design", "Follows the approved [prototype](https://www.figma.com/proto/your-file). Deliberate differences are listed under each section."],
    ["Code", "[storefront #123](https://github.com/your-org/storefront/pull/123), merged as 1a2b3c4."]
  ],
  "sections": [
    {
      "key": "box",
      "name": "The search box",
      "ticket": "SHOP-42",
      "state": "In Review",
      "lead": "One or two sentences on what this part of the screen does for the user.",
      "figures": [
        {
          "id": "01-home",
          "src": "shots/01-home.png",
          "title": "Search box and Ctrl K hint",
          "alt": "What is on screen, for someone who can't see the image",
          "caption": "What to look at and why it matters, in the reader's words."
        }
      ],
      "asks": [
        ["optional bold lead", "something the reviewers are asked to verify or decide, with what it is now", ["01-home"]],
        [null, "an item with no lead and no figure"]
      ],
      "note": "optional: a small line under the figures, such as a state that could not be captured",
      "diffsIntro": "optional: one line before the list",
      "diffs": [
        ["Optional bold lead", "what is built differently from the design, and why"],
        [null, "a difference with no lead"]
      ]
    }
  ],
  "general": { "name": "General feedback", "lead": "Anything that covers more than one screen." }
}
```

| Field | Notes |
|---|---|
| `title` | The artifact's name in the gallery and the browser tab. Two to four words, a name not a sentence ("Storefront Search Bar"), and the same on every republish. |
| `heading` | The page's h1. Can be longer ("Top bar search: design review"). |
| `owner` | Who the read-only notice tells people to ask for Contributor access: the person who shares the page. |
| `ticket` | Stamped on comment rows of sections that have no `ticket` of their own. |
| `jiraBase` | Where ticket keys link: the page appends the key to it (`https://your-site.atlassian.net/browse/`, or any tracker whose ticket URLs end in the key). Leave it out and keys show as plain text; the build warns when sections have tickets but no `jiraBase`. |
| `locale` | Optional locale for comment times (`en-US`, `en-AU`, `de-DE`). Without it, each viewer sees their own browser's format. |
| `diffsTitle` | Heading of each section's list of deliberate differences. Default "Built differently from the design on purpose"; a project judged against a prototype might use "Built differently from the prototype on purpose". |
| `eyebrow` | Short items above the heading: product, ticket link, the date or sprint. |
| `facts` | Label and text pairs beside the how-to steps. "Resolving" is always added first by the page. Usual ones: Mock data, Desktop, Design, Code, Checked, Follow-ups. |
| `sections[].key` | Lowercase slug, unique, never `general`. **Permanent once the page has comments**: rows point at it. |
| `sections[].ticket` | Set when sections are tickets (one section per ticket). The rail then shows the ticket number and the section header links to the ticket (with `jiraBase`). Leave it out when one ticket is split into areas; the rail then shows the figure range. |
| `sections[].state` | Optional label beside the ticket key, such as "In Review". |
| `figures[].id` | Lowercase slug, unique across the page. **Permanent once the page has comments**: pins point at it. Numbering like `01-home` keeps files in page order, but the figure number readers see is counted by the page. |
| `figures[].src` | Relative to `review.json`'s folder. PNG width and height are read automatically. |
| `sections[].asks` | Optional, and only for what the reviewers must settle (see "Asking the reviewers to verify or decide" below); leave it out otherwise, and the section shows no card. What the reviewers are asked to verify or decide in this section, shown as a numbered card at the top of the section, before its screens, so they know what to look for. Each item is `[lead or null, text, figure ids]`; the ids (optional) become "(Figures 3 and 6)" links, numbered as the page numbers them, and the build fails on an id that is not on the page. Say what it is now and what you need: "keep it, or give the wording you want". `asksTitle` (page or section) changes the heading from "Please verify or decide"; `asksIntro` (page or section) adds a line under it, such as how to answer. These are asks of the reviewers; questions for the user still go in chat. |
| `figures[].title` | Short name of the view; shown bold as "Figure N. Title." and in comment contexts ("Pin 1 on Figure 2, Results for ...") |

## Choosing sections

- **Several tickets** (a sprint review, an epic): one section per ticket, `key` the ticket in lowercase (`shop-41`), `ticket` set. Feedback then maps straight onto your tickets.
- **One ticket with several areas** (a feature): one section per area a reader would name ("The search box", "What it finds", "Where results open", "Loading, empty and failure"). Put `ticket` at the top level only.
- Never a "Questions for <person>" section. Questions go to the user in chat; the page is for the reviewers' comments.

## Writing for product owners and stakeholders

The readers did not build it, will not run it, and may not know the codebase's words. Write the way you would walk them through it at their desk.

- **Lead with what they see and why it matters to a customer**, not how it was built. "Each group shows up to four rows and how many more matched", not "ResultGroup slices rows to ROW_LIMIT".
- **Their words, not the code's.** Use the names on screen ("Orders table", "Help centre") and the business's terms. Code names, file paths and component names stay out of captions and leads; the Code fact can carry the PR link.
- **Say how a state was produced** when it was forced ("The failure was forced in the browser for this screenshot, because the mock data never fails"), so nobody files a bug about it.
- **Say what is mock data** and anything odd it causes ("every mock order has the same customer, so searching that name finds every order").
- **"Built differently from the design on purpose"** lists each deliberate difference from the approved design or prototype, with the reason and the ticket that will close it if there is one. Only differences you checked: from the PR description, the ticket, and a look at the prototype. A reviewer who spots a difference that is not listed will rightly treat it as a bug.
- **Not built yet** goes in a section's `note` or the diffs, never as a missing screenshot with no explanation.

## Asking the reviewers to verify or decide

The "Please verify or decide" card (`asks`) is optional. Use it only for something the product owner or reviewers must settle:
- a choice that is still **undecided**, and noted as undecided (the order of a list, whether a feature is needed);
- a **deviation** from the approved design or prototype that needs their sign-off (a control added, a behaviour changed);
- wording or behaviour that needs their **decision or sign-off** before it is final, above all wording the design doesn't have.

Leave out what follows the design and is settled, and what the user has already decided: those go in the section's captions or its "Built differently" list, not the card. A section with nothing to settle has no `asks`, and the page shows no card for it.

Make each item say which kind it is and stand on its own:
- **What it is now** and **what you need** from them ("Accept, or give a replacement?", "Which do you prefer?").
- **Wording we added** (a state the design never shows, such as an upload failing): say plainly that it is not in the design, why that state happens once the product is real, and why a line is needed there, then quote the wording.
- **A deviation:** what the design does, what was built instead, and why.
- **A choice between options:** name each option and its catch, so they can choose without asking.
- Link the figures that show it.
- House style: no en or em dashes (the build warns), every PR as `[repo #N](link)`, ticket keys as Jira links in facts.
