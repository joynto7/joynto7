# Featured work cards

The **Featured Work** section of the profile README is generated. `build.mjs` turns
`projects.json` into the animated SVG cards in `assets/featured/` and rewrites the README
between the `featured-work` markers. Don't edit that part of the README by hand.

## Add a project

1. Open [`projects.json`](projects.json) and click the pencil icon to edit it on GitHub.
2. Copy an entry in `featured` (a big card) or `others` (a small tile) and change it.
3. Commit. The **Featured work** Action rebuilds the cards and commits them in about a minute.

To build on your own machine instead: `node scripts/featured/build.mjs` (Node 18 or newer,
nothing to install).

Cards fill two per row, so an odd number of featured projects leaves the last card on its
own. The "Projects" and "Technologies" counts in the header update themselves.

## Featured project fields

| Field | Required | What it does |
| --- | --- | --- |
| `name` | yes | Card title. |
| `subtitle` | | Grey line under the title. |
| `badge` | | Pill in the top-left corner, e.g. `"Featured"`, `"IoT / AgriTech"`. |
| `type` | | Label in the top-right corner, e.g. `"Web App"`. |
| `team` | | Number — shows "Team of N" under the card. |
| `icon` | yes | Icon in the colored tile (see the list below). |
| `accent` | yes | `blue`, `green`, `indigo`, `violet`, `magenta`, `amber`, `teal`, `rose` or `cyan`. |
| `description` | yes | About 120–170 characters fits the card best. |
| `tech` | | Plain names, e.g. `["Next.js", "Prisma"]`. Known ones get a logo, others a dot. |
| `thumbnail` | | Screenshot file in `thumbs/` (about 480×320 JPG). Leave it out for a drawn placeholder in the accent color. |
| `mobile` | | Phone screenshot in `thumbs/` (about 140×280 JPG), shown floating in front. |
| `links` | yes | Any of `live`, `source`, `case`, `api`, `docs`. The first one is also where the card links. |

Small tiles in `others` take `name`, `subtitle`, `icon`, `accent` and `link`.

Keep screenshots small (under ~150 KB): they are embedded in the SVGs, in both themes.

## Icons

`shield`, `leaf`, `wrench`, `calendar`, `gavel`, `users`, `activity`, `network`, `monitor`,
`server`, `database`, `bot`, `box`, `cpu`, `code`, `mail`, `globe`, `rocket`, `cart`, `chat`,
`phone`, `dashboard`, `school`, `music`, `camera`, `map`, `health`, `brain`, `lock`, `chart`,
`gamepad`, `cloud`, `sparkles`, `terminal`, `bug`, `wifi`, `layers`, `zap`, `search`, `file`,
`truck`, `wallet`, `home`, `image`, `video`, `heart`, `graph`, `book`, `star`, `badge`.

Tech logos come from the patterns in `TECH_PATTERNS` in `build.mjs` (about 100 tools,
from Next.js to PyTorch). Icons are from [Lucide](https://lucide.dev) and
[Simple Icons](https://simpleicons.org).
