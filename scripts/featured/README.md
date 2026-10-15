# Profile README page

The top of the profile README is generated: the nav bar, the astronaut hero, the Featured
Work cards, Other Projects, the Tech Stack consoles and the footer. `build.mjs` draws them as
one sci-fi page, cuts it into the animated SVG tiles in `assets/featured/`, and rewrites the
README between the `featured-work` markers. Don't edit that part of the README by hand. The
"More about me" section below the markers is ordinary Markdown, so edit it directly.

## Add a project

1. Open [`projects.json`](projects.json) and click the pencil icon to edit it on GitHub.
2. Copy an entry in `featured` (a big card) or `others` (a small module) and change it.
3. Commit. The **Featured work** Action rebuilds the page and commits it in about a minute.

To build on your own machine instead: `node scripts/featured/build.mjs` (Node 18 or newer,
nothing to install).

Cards fill four per row and modules four per row, so extra projects start a new row. The
"Projects" and "Technologies" counts in the hero update themselves.

## Featured project fields

| Field | Required | What it does |
| --- | --- | --- |
| `name` | yes | Card title. |
| `subtitle` | | Colored line under the title. |
| `category` | | Small label above the description, e.g. `"IoT / AgriTech"`. |
| `badge` | | Pill in the top-right corner, e.g. `"Featured"`. Without it the card shows its number. |
| `team` | | Number: shows "Team of N" next to the buttons. |
| `icon` | yes | Icon in the colored tile (see the list below). |
| `accent` | yes | `blue`, `cyan`, `teal`, `green`, `indigo`, `violet`, `magenta`, `rose`, `orange` or `amber`. |
| `description` | yes | About 120–170 characters fits the card best. |
| `tech` | | Plain names, e.g. `["Next.js", "Prisma"]`. Known ones get a logo, others a dot; the rest after two rows become "+N". |
| `thumbnail` | | Screenshot file in `thumbs/` (about 480×320 JPG). Leave it out for a drawn placeholder in the accent color. |
| `mobile` | | Phone screenshot in `thumbs/` (about 140×280 JPG), shown floating in front. |
| `links` | yes | Any of `live`, `source`, `case`, `api`, `docs`, each a button on the card. The first one is also where the card links. |

Small modules in `others` take `name`, `subtitle`, `icon`, `accent` and `link`. Tech Stack
consoles in `techStack` take `title`, `icon`, `accent` and `tech`.

`nav` holds the links in the top bar, `hero` the intro text, buttons and floating notes, and
`footer.links` the round icons at the bottom (`github`, `linkedin`, `email`, `resume`).

Keep screenshots small (under ~150 KB): they are embedded in the SVGs.

## How it fits together

The page is 1200 units wide; each tile's README width is its share of that. Every link sits on a
tile of its own, and rows are at least 100 units tall so phones don't show gaps between them.
Tiles animate independently, so anything that moves has to stay inside one tile. The build
stops with a message if a change breaks one of these rules.

## Icons

`shield`, `leaf`, `wrench`, `calendar`, `gavel`, `users`, `activity`, `network`, `monitor`,
`server`, `database`, `bot`, `box`, `cpu`, `code`, `mail`, `globe`, `rocket`, `cart`, `chat`,
`phone`, `dashboard`, `school`, `music`, `camera`, `map`, `health`, `brain`, `lock`, `chart`,
`gamepad`, `cloud`, `sparkles`, `terminal`, `bug`, `wifi`, `layers`, `zap`, `search`, `file`,
`truck`, `wallet`, `home`, `image`, `video`, `heart`, `graph`, `book`, `star`, `badge`.

Tech logos come from the patterns in `TECH_PATTERNS` in `build.mjs` (about 100 tools,
from Next.js to PyTorch). Icons are from [Lucide](https://lucide.dev) and
[Simple Icons](https://simpleicons.org).
