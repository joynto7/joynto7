#!/usr/bin/env node
/**
 * Builds the "Featured Work" part of the profile README.
 *
 * GitHub strips CSS from READMEs, so every block here is an SVG image in assets/featured/
 * (a light and a dark variant, switched with <picture>), laid out with percentage widths:
 * 1200 SVG units span the full README width, so a 588-unit card is 49%. Project buttons
 * are separate images so each one can carry its own link.
 *
 * Edit the content below, then run:  node scripts/featured/build.mjs
 * It rewrites assets/featured/ and the README between the featured-work markers.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT_DIR = join(ROOT, "assets", "featured");
const ASSET_URL = "assets/featured";
const ICONS = JSON.parse(readFileSync(join(HERE, "icons.json"), "utf8"));
const PORTFOLIO = "https://joyntoghosh.vercel.app";

// ---------------------------------------------------------------- content

const HEADING = {
  eyebrow: "MY PORTFOLIO",
  description:
    "A collection of projects I've built, showcasing my skills in modern web technologies, real-time systems and problem solving.",
};

/** `thumb` is a file in thumbs/ or the name of a drawn thumbnail in THUMBS. The first link is also the card's link. */
const PROJECTS = [
  {
    slug: "sentra",
    name: "Sentra",
    subtitle: "AI Security Testing Platform",
    icon: "shield",
    accent: "blue",
    badges: ["Team of 3", "Featured"],
    description:
      "Tests LLM apps such as chatbots, RAG systems and tool-using agents: maps the attack surface, runs security tests, records evidence, scores risk, and re-tests after fixes.",
    tech: [["Next.js", "nextjs"], ["TypeScript", "typescript"], ["FastAPI", "fastapi"], ["PostgreSQL", "postgresql"], ["Celery + Redis", "celery"], ["LiteLLM", "bot"], ["Docker", "docker"]],
    thumb: "sentra",
    links: [["source", "https://github.com/joynto7/Sentra"]],
  },
  {
    slug: "agrosync",
    name: "AgroSync",
    subtitle: "Smart Irrigation Dashboard",
    icon: "leaf",
    accent: "green",
    description:
      "Streams soil moisture and temperature from ESP32 sensors, lets users start watering remotely, and stores history in PostgreSQL for trend charts.",
    tech: [["ESP32", "espressif"], ["MQTT", "mqtt"], ["Socket.IO", "socketio"], ["Next.js", "nextjs"], ["Express", "express"], ["Prisma", "prisma"], ["PostgreSQL", "postgresql"]],
    thumb: "agrosync",
    links: [["live", "https://agro-sync-seven.vercel.app/"], ["case", `${PORTFOLIO}/case-studies/agrosync`]],
  },
  {
    slug: "fixitnow",
    name: "FixItNow",
    subtitle: "Home Services Marketplace",
    icon: "wrench",
    accent: "indigo",
    description:
      "Customers book a technician for a time slot and pay with Stripe or SSLCommerz. Technicians manage their availability and jobs, and admins moderate the platform.",
    tech: [["Next.js", "nextjs"], ["TanStack Query", "reactquery"], ["Express", "express"], ["TypeScript", "typescript"], ["Prisma", "prisma"], ["PostgreSQL", "postgresql"], ["Stripe", "stripe"]],
    thumb: "fixitnow.jpg",
    links: [["live", "https://fixitnow-frontend-peach.vercel.app"], ["source", "https://github.com/joynto7/fixitnow-frontend"], ["api", "https://github.com/joynto7/fixitnow-backend"]],
  },
  {
    slug: "occasio",
    name: "Occasio",
    subtitle: "Event Discovery & Booking",
    icon: "calendar",
    accent: "violet",
    description:
      "People find, book and review events. Organizers and admins manage everything from role-based dashboards with analytics.",
    tech: [["Next.js 16", "nextjs"], ["Tailwind CSS v4", "tailwind"], ["Express", "express"], ["Prisma", "prisma"], ["PostgreSQL", "postgresql"], ["JWT", "jwt"]],
    thumb: "occasio.jpg",
    links: [["live", "https://client-eight-rho-92.vercel.app"], ["source", "https://github.com/joynto7/Novi"]],
  },
];

const OTHERS = [
  { slug: "surplusbid", name: "SurplusBid", subtitle: "Auction backend (Stripe)", icon: "gavel", accent: "blue", href: "https://github.com/joynto7/surplusbid-backend" },
  { slug: "club-connect", name: "Club Connect", subtitle: "University clubs platform", icon: "users", accent: "green", href: "https://club-connect-rust.vercel.app" },
  { slug: "devpulse", name: "DevPulse", subtitle: "Bug-tracker API", icon: "activity", accent: "teal", href: "https://github.com/joynto7/devpulse" },
  { slug: "network-analysis", name: "Network Traffic Analyzer", subtitle: "Python packet sniffer", icon: "network", accent: "violet", href: "https://github.com/joynto7/network-analysis" },
];

const TECH_GROUPS = [
  { title: "Frontend", subtitle: "Modern, responsive and interactive UIs", icon: "monitor", accent: "blue", tech: [["TypeScript", "typescript"], ["React", "react"], ["Next.js", "nextjs"], ["Tailwind CSS", "tailwind"]] },
  { title: "Backend", subtitle: "Scalable APIs and real-time systems", icon: "server", accent: "green", tech: [["Python", "python"], ["Node.js", "nodejs"], ["Express", "express"], ["FastAPI", "fastapi"]] },
  { title: "Data & Infrastructure", subtitle: "Databases, cloud and deployment", icon: "database", accent: "violet", tech: [["PostgreSQL", "postgresql"], ["Prisma", "prisma"], ["Docker", "docker"]] },
];

const BUTTONS = {
  live: { label: "Live demo", icon: "external", primary: true },
  source: { label: "Source", icon: "github" },
  case: { label: "Case study", icon: "book" },
  api: { label: "API", icon: "github" },
};

// ---------------------------------------------------------------- design tokens

/** deep/base paint the icon tiles and glows; `dark`/`light` are text colors for that theme. */
const ACCENTS = {
  blue: { deep: "#1e40af", base: "#3b82f6", dark: "#60a5fa", light: "#2563eb" },
  green: { deep: "#065f46", base: "#10b981", dark: "#34d399", light: "#059669" },
  indigo: { deep: "#3730a3", base: "#6366f1", dark: "#818cf8", light: "#4f46e5" },
  violet: { deep: "#5b21b6", base: "#8b5cf6", dark: "#a78bfa", light: "#7c3aed" },
  teal: { deep: "#115e59", base: "#14b8a6", dark: "#2dd4bf", light: "#0d9488" },
};

// The dark card fill matches the banner (assets/header-dark.svg) so the README reads as one piece.
const THEMES = {
  dark: {
    name: "dark",
    card: "#0b0f19", cardStroke: ["#ffffff", 0.09], glow: 0.24,
    title: "#f8fafc", text: "#a3b1c6", muted: "#8592a8", eyebrow: "#60a5fa", gradient: ["#60a5fa", "#a78bfa"],
    chipFill: ["#ffffff", 0.04], chipStroke: ["#ffffff", 0.1], chipText: "#d4dce8", chipIcon: "#b8c4d6",
    thumbStroke: ["#ffffff", 0.12],
    primary: ["#3b82f6", "#7c3aed"], outlineFill: ["#ffffff", 0.03], outlineStroke: ["#ffffff", 0.18], outlineText: "#e2e8f0",
  },
  light: {
    name: "light",
    card: "#ffffff", cardStroke: ["#0f172a", 0.12], glow: 0.1,
    title: "#0f172a", text: "#475569", muted: "#64748b", eyebrow: "#2563eb", gradient: ["#2563eb", "#7c3aed"],
    chipFill: ["#f1f5f9", 1], chipStroke: ["#0f172a", 0.1], chipText: "#334155", chipIcon: "#475569",
    thumbStroke: ["#0f172a", 0.1],
    primary: ["#2563eb", "#7c3aed"], outlineFill: ["#ffffff", 1], outlineStroke: ["#0f172a", 0.18], outlineText: "#0f172a",
  },
};

const SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`;

const PAGE_W = 1200;
const CARD_W = 588;
const CARD_GAP = 24;
const TILE_W = 286;
const TILE_GAP = 18;
const BTN_GAP = 10;

const CARD = { pad: 26, tile: 58, thumbW: 176, thumbH: 117, radius: 18, descSize: 15, descLine: 22 };
const CHIP = { h: 30, gap: 8, size: 13, icon: 14 };
const BTN = { top: 12, h: 40, size: 15 };
const TILE = { h: 84, tile: 42, pad: 16 };

// ---------------------------------------------------------------- text measurement

// Helvetica advance widths (1/1000 em) for ASCII 32–126. The SVGs render in the viewer's
// system font, so measurements carry a safety margin and anything tight logs a warning.
const REGULAR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const OTHER_GLYPHS = { "·": 278, "—": 1000, "→": 1000, "°": 400 };
const SAFETY = 1.07;

function textWidth(text, size, weight = 400, spacing = 0) {
  const boldness = Math.min(Math.max((weight - 400) / 300, 0), 1);
  let em = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const ascii = code >= 32 && code <= 126;
    const regular = ascii ? REGULAR[code - 32] : OTHER_GLYPHS[ch] ?? 600;
    const bold = ascii ? BOLD[code - 32] : regular;
    em += regular + (bold - regular) * boldness;
  }
  return (em / 1000) * size * SAFETY + spacing * [...text].length;
}

function wrap(text, size, maxWidth, weight = 400) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, weight) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---------------------------------------------------------------- svg helpers

const n = (value) => Number(value.toFixed(2));
const esc = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (value) => esc(value).replace(/"/g, "&quot;");
const paint = (kind, [color, opacity]) => `${kind}="${color}"${opacity < 1 ? ` ${kind}-opacity="${opacity}"` : ""}`;

function svgDoc(width, height, label, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${attr(label)}">
  <title>${esc(label)}</title>
  <defs>
${defs}
  </defs>
  <style>.sans { font-family: ${SANS}; }</style>
${body}
</svg>
`;
}

function text(x, y, content, { size, weight = 400, fill, anchor, spacing, max }) {
  if (max && textWidth(content, size, weight, spacing) > max) {
    console.warn(`warning: "${content}" may not fit in ${n(max)} units`);
  }
  return `<text x="${n(x)}" y="${n(y)}" class="sans" font-size="${size}"${weight === 400 ? "" : ` font-weight="${weight}"`}${anchor ? ` text-anchor="${anchor}"` : ""}${spacing ? ` letter-spacing="${spacing}"` : ""} fill="${fill}"${max ? ` data-max="${n(max)}"` : ""}>${esc(content)}</text>`;
}

const iconSymbols = (names) =>
  [...new Set(names)].map((name) => `<symbol id="i-${name}" viewBox="0 0 24 24">${ICONS[name].body}</symbol>`).join("\n");

function useIcon(name, x, y, size, color, { filled = false } = {}) {
  const icon = ICONS[name];
  if (!icon) throw new Error(`Unknown icon: ${name}`);
  const colors = icon.kind === "stroke"
    ? `fill="${filled ? color : "none"}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="${color}"`;
  return `<use href="#i-${name}" x="${n(x)}" y="${n(y)}" width="${size}" height="${size}" ${colors}/>`;
}

const linear = (id, [from, to], { x2 = 1, y2 = 1 } = {}) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;

const radial = (id, color, opacity, cx, cy, r) =>
  `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

/** Card background: fill + accent glow clipped to the rounded rect, then a hairline border. */
function frame(width, height, radius, t, clipId = "clip", glowId = "glow") {
  return `<g clip-path="url(#${clipId})"><rect width="${width}" height="${height}" fill="${t.card}"/><rect width="${width}" height="${height}" fill="url(#${glowId})"/></g>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius - 0.5}" fill="none" ${paint("stroke", t.cardStroke)}/>`;
}

function iconTile(icon, x, y, size, iconSize, gradientId = "tile") {
  const radius = n(size * 0.26);
  const inset = (size - iconSize) / 2;
  return `<rect x="${x}" y="${n(y)}" width="${size}" height="${size}" rx="${radius}" fill="url(#${gradientId})"/>
<rect x="${x + 0.5}" y="${n(y + 0.5)}" width="${size - 1}" height="${size - 1}" rx="${radius - 0.5}" fill="none" stroke="#ffffff" stroke-opacity="0.2"/>
${useIcon(icon, x + inset, y + inset, iconSize, "#ffffff")}`;
}

function layoutChips(items, maxWidth) {
  let x = 0;
  let y = 0;
  const placed = items.map(([label, icon]) => {
    const width = Math.ceil(10 + CHIP.icon + 7 + textWidth(label, CHIP.size, 500) + 12);
    if (x > 0 && x + width > maxWidth) {
      x = 0;
      y += CHIP.h + CHIP.gap;
    }
    const chip = { label, icon, x, y, width };
    x += width + CHIP.gap;
    return chip;
  });
  return { placed, height: y + CHIP.h };
}

function chips({ placed }, ox, oy, t) {
  return placed
    .map(({ label, icon, x, y, width }) =>
      `<g transform="translate(${n(ox + x)} ${n(oy + y)})"><rect x="0.5" y="0.5" width="${width - 1}" height="${CHIP.h - 1}" rx="8" ${paint("fill", t.chipFill)} ${paint("stroke", t.chipStroke)}/>${useIcon(icon, 10, 8, CHIP.icon, t.chipIcon)}${text(31, 19.6, label, { size: CHIP.size, weight: 500, fill: t.chipText, max: width - 31 - 5 })}</g>`)
    .join("\n");
}

// ---------------------------------------------------------------- thumbnails

/** Drawn stand-ins for apps without a public screen to capture (Sentra is unreleased, AgroSync sits behind a login). */
const THUMBS = {
  sentra() {
    const bars = [[22, "#f43f5e"], [30, "#fb7185"], [17, "#f59e0b"], [25, "#3b82f6"], [12, "#22c55e"], [19, "#8b5cf6"]];
    const findings = [[84, "#f43f5e", 70], [95, "#f59e0b", 56], [106, "#22c55e", 82]];
    return [
      `<rect width="176" height="117" fill="#0a0f1c"/>`,
      `<rect width="34" height="117" fill="#0f172a"/>`,
      `<rect x="9" y="8" width="16" height="16" rx="4" fill="#2563eb"/>`,
      useIcon("shield", 12, 11, 10, "#ffffff"),
      ...[0, 1, 2, 3, 4].map((i) => `<rect x="9" y="${34 + i * 11}" width="16" height="5" rx="2.5" fill="${i === 0 ? "#3b82f6" : "#1e293b"}"/>`),
      `<text x="42" y="15" class="sans" font-size="7" font-weight="700" fill="#e2e8f0">Security Overview</text>`,
      `<rect x="142" y="8" width="26" height="9" rx="4.5" fill="#1d4ed8"/>`,
      `<text x="155" y="14.2" class="sans" font-size="4.6" font-weight="600" text-anchor="middle" fill="#ffffff">Re-test</text>`,
      `<rect x="42.5" y="22.5" width="55" height="53" rx="5" fill="#111a2e" stroke="#1e293b"/>`,
      `<circle cx="70" cy="45" r="14" fill="none" stroke="#1e293b" stroke-width="4"/>`,
      `<circle cx="70" cy="45" r="14" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round" stroke-dasharray="68.6 100" transform="rotate(-90 70 45)"/>`,
      `<text x="70" y="48.6" class="sans" font-size="10" font-weight="800" text-anchor="middle" fill="#f8fafc">78</text>`,
      `<text x="70" y="70" class="sans" font-size="5" text-anchor="middle" fill="#94a3b8">Risk score</text>`,
      `<rect x="104.5" y="22.5" width="63" height="53" rx="5" fill="#111a2e" stroke="#1e293b"/>`,
      `<text x="110" y="31" class="sans" font-size="5.2" font-weight="600" fill="#cbd5e1">Findings</text>`,
      ...bars.map(([h, color], i) => `<rect x="${111 + i * 9}" y="${70 - h}" width="5.5" height="${h}" rx="1.5" fill="${color}"/>`),
      ...findings.map(([y, color, width]) =>
        `<rect x="42" y="${y}" width="126" height="8" rx="2" fill="#0f172a"/><circle cx="47" cy="${y + 4}" r="2" fill="${color}"/><rect x="53" y="${y + 2.5}" width="${width}" height="3" rx="1.5" fill="#334155"/><rect x="148" y="${y + 1.5}" width="16" height="5" rx="2.5" fill="${color}" fill-opacity="0.3"/>`),
    ].join("\n");
  },

  agrosync() {
    const stats = [["Soil moisture", "42%", "#22c55e", 0.42], ["Temperature", "27°C", "#f59e0b", 0.6], ["Tank level", "68%", "#3b82f6", 0.68]];
    const trend = [28, 25, 27, 21, 23, 16, 18, 12, 14, 9, 11];
    const points = trend.map((v, i) => `${n(48 + i * 11.4)},${56 + v}`);
    return [
      `<rect width="176" height="117" fill="#08110e"/>`,
      `<rect width="34" height="117" fill="#0c1a15"/>`,
      `<rect x="9" y="8" width="16" height="16" rx="4" fill="#059669"/>`,
      useIcon("leaf", 12, 11, 10, "#ffffff"),
      ...[0, 1, 2, 3, 4].map((i) => `<rect x="9" y="${34 + i * 11}" width="16" height="5" rx="2.5" fill="${i === 0 ? "#10b981" : "#173328"}"/>`),
      `<text x="42" y="15" class="sans" font-size="7" font-weight="700" fill="#ecfdf5">Farm Overview</text>`,
      `<rect x="144" y="8" width="24" height="9" rx="4.5" fill="#064e3b"/><circle cx="150" cy="12.5" r="1.6" fill="#34d399"/>`,
      `<text x="153.5" y="14.2" class="sans" font-size="4.6" font-weight="600" fill="#a7f3d0">Live</text>`,
      ...stats.map(([label, value, color, level], i) => {
        const x = 42 + i * 43;
        return `<rect x="${x + 0.5}" y="22.5" width="38" height="27" rx="4" fill="#0f1f19" stroke="#173328"/><text x="${x + 4}" y="30.5" class="sans" font-size="4.4" fill="#8aa39a">${label}</text><text x="${x + 4}" y="41" class="sans" font-size="9" font-weight="800" fill="#ecfdf5">${esc(value)}</text><rect x="${x + 4}" y="44" width="31" height="2.4" rx="1.2" fill="#173328"/><rect x="${x + 4}" y="44" width="${n(31 * level)}" height="2.4" rx="1.2" fill="${color}"/>`;
      }),
      `<rect x="42.5" y="55.5" width="125" height="35" rx="4" fill="#0f1f19" stroke="#173328"/>`,
      `<path d="M43 68H167M43 80H167" stroke="#173328"/>`,
      `<path d="M${points.join(" L")} L162,90 L48,90 Z" fill="#34d399" fill-opacity="0.16"/>`,
      `<polyline points="${points.join(" ")}" fill="none" stroke="#34d399" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`,
      `<rect x="42.5" y="97.5" width="125" height="13" rx="4" fill="#0f1f19" stroke="#173328"/>`,
      `<text x="48" y="106" class="sans" font-size="5.4" font-weight="600" fill="#d1fae5">Pump</text>`,
      `<text x="66" y="106" class="sans" font-size="4.6" fill="#8aa39a">Watering · 4 min left</text>`,
      `<rect x="148" y="100.5" width="15" height="7" rx="3.5" fill="#10b981"/><circle cx="159.5" cy="104" r="2.6" fill="#ffffff"/>`,
    ].join("\n");
  },
};

function thumbnail(p) {
  if (THUMBS[p.thumb]) return THUMBS[p.thumb]();
  const data = readFileSync(join(HERE, "thumbs", p.thumb)).toString("base64");
  return `<image href="data:image/jpeg;base64,${data}" width="${CARD.thumbW}" height="${CARD.thumbH}" preserveAspectRatio="xMidYMin slice"/>`;
}

// ---------------------------------------------------------------- blocks

function headingSvg(t) {
  const height = 190;
  const eyebrowWidth = textWidth(HEADING.eyebrow, 14, 700, 3.2);
  const first = "Featured ";
  const firstWidth = textWidth(first, 54, 800, -1.4);
  const wordWidth = textWidth("Work", 54, 800, -1.4);
  const label = "View All Projects";
  const buttonWidth = Math.ceil(20 + textWidth(label, 16, 600) + 10 + 16 + 20);
  const bx = PAGE_W - 2 - buttonWidth;
  const lines = wrap(HEADING.description, 18.5, bx - 80);
  const defs = [
    `<linearGradient id="word" gradientUnits="userSpaceOnUse" x1="${n(firstWidth)}" y1="0" x2="${n(firstWidth + wordWidth)}" y2="0"><stop offset="0" stop-color="${t.gradient[0]}"/><stop offset="1" stop-color="${t.gradient[1]}"/></linearGradient>`,
    iconSymbols(["arrow"]),
  ].join("\n");
  const body = [
    text(2, 30, HEADING.eyebrow, { size: 14, weight: 700, spacing: 3.2, fill: t.eyebrow }),
    `<rect x="${n(2 + eyebrowWidth + 12)}" y="23.5" width="32" height="3" rx="1.5" fill="${t.eyebrow}"/>`,
    `<text x="0" y="96" class="sans" font-size="54" font-weight="800" letter-spacing="-1.4" fill="${t.title}">${first}<tspan fill="url(#word)">Work</tspan></text>`,
    ...lines.map((line, i) => text(2, 142 + i * 27, line, { size: 18.5, fill: t.text, max: bx - 40 })),
    `<rect x="${bx + 0.5}" y="50.5" width="${buttonWidth - 1}" height="45" rx="12" fill="${t.eyebrow}" fill-opacity="0.07" stroke="${t.eyebrow}" stroke-opacity="0.6"/>`,
    text(bx + 20, 78.6, label, { size: 16, weight: 600, fill: t.title }),
    useIcon("arrow", bx + buttonWidth - 20 - 16, 65, 16, t.eyebrow),
  ].join("\n");
  return svgDoc(PAGE_W, height, "Featured Work", defs, body);
}

function badgeRow(labels, right, y, accent, t) {
  const parts = [];
  let x = right;
  for (const label of [...labels].reverse()) {
    const featured = label === "Featured";
    const width = Math.ceil((featured ? 29 : 12) + textWidth(label, 12.5, 600) + 12);
    x -= width;
    const color = featured ? accent[t.name] : t.text;
    parts.push(featured
      ? `<rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="25" rx="12.5" fill="${accent.base}" fill-opacity="0.12" stroke="${accent.base}" stroke-opacity="0.55"/>${useIcon("star", x + 11, y + 6.5, 13, color, { filled: true })}${text(x + 29, y + 17.5, label, { size: 12.5, weight: 600, fill: color })}`
      : `<rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="25" rx="12.5" ${paint("fill", t.chipFill)} ${paint("stroke", t.chipStroke)}/>${text(x + 12, y + 17.5, label, { size: 12.5, weight: 600, fill: color })}`);
    x -= 8;
  }
  return { svg: parts.join("\n"), left: x + 8 };
}

function cardLayout(p) {
  const { pad, tile, thumbW, thumbH } = CARD;
  const thumbX = CARD_W - pad - thumbW;
  const thumbY = p.badges ? pad + 36 : pad;
  const descMax = thumbX - 22 - pad;
  const lines = wrap(p.description, CARD.descSize, descMax);
  const descY = pad + tile + 34;
  const textBottom = descY + (lines.length - 1) * CARD.descLine + 6;
  const chipRows = layoutChips(p.tech, CARD_W - 2 * pad);
  const minHeight = Math.max(textBottom, thumbY + thumbH) + 22 + chipRows.height + pad;
  return { thumbX, thumbY, descMax, lines, descY, chipRows, minHeight };
}

function cardSvg(p, t, height) {
  const accent = ACCENTS[p.accent];
  const { pad, tile, thumbW, thumbH, radius } = CARD;
  const layout = cardLayout(p);
  const textX = pad + tile + 18;
  const badges = p.badges ? badgeRow(p.badges, CARD_W - pad, pad - 2, accent, t) : null;
  const titleMax = (badges ? badges.left : layout.thumbX) - 14 - textX;
  const defs = [
    linear("tile", [accent.deep, accent.base]),
    radial("glow", accent.base, t.glow, 40, 0, 340),
    `<clipPath id="clip"><rect width="${CARD_W}" height="${height}" rx="${radius}"/></clipPath>`,
    `<clipPath id="thumb"><rect x="${layout.thumbX}" y="${layout.thumbY}" width="${thumbW}" height="${thumbH}" rx="10"/></clipPath>`,
    iconSymbols([p.icon, ...p.tech.map(([, icon]) => icon), ...(badges ? ["star"] : [])]),
  ].join("\n");
  const body = [
    frame(CARD_W, height, radius, t),
    iconTile(p.icon, pad, pad, tile, 28),
    text(textX, pad + 29, p.name, { size: 25, weight: 700, spacing: -0.3, fill: t.title, max: titleMax }),
    text(textX, pad + 53, p.subtitle, { size: 15.5, weight: 500, fill: accent[t.name], max: layout.thumbX - 14 - textX }),
    badges ? badges.svg : "",
    `<g clip-path="url(#thumb)"><g transform="translate(${layout.thumbX} ${layout.thumbY})">${thumbnail(p)}</g></g>`,
    `<rect x="${layout.thumbX + 0.5}" y="${layout.thumbY + 0.5}" width="${thumbW - 1}" height="${thumbH - 1}" rx="9.5" fill="none" ${paint("stroke", t.thumbStroke)}/>`,
    ...layout.lines.map((line, i) => text(pad, layout.descY + i * CARD.descLine, line, { size: CARD.descSize, fill: t.text, max: layout.descMax })),
    chips(layout.chipRows, pad, height - pad - layout.chipRows.height, t),
  ].join("\n");
  return svgDoc(CARD_W, height, `${p.name} — ${p.subtitle}`, defs, body);
}

const buttonWidth = (kind) => Math.ceil(16 + 16 + 8 + textWidth(BUTTONS[kind].label, BTN.size, 600) + 18);

/** The transparent band above the pill (BTN.top) is the gap between a card and its buttons. */
function buttonSvg(kind, t) {
  const button = BUTTONS[kind];
  const width = buttonWidth(kind);
  const color = button.primary ? "#ffffff" : t.outlineText;
  const defs = [button.primary ? linear("fill", t.primary) : "", iconSymbols([button.icon])].join("\n");
  const pill = button.primary
    ? `<rect y="${BTN.top}" width="${width}" height="${BTN.h}" rx="11" fill="url(#fill)"/>
<rect x="0.5" y="${BTN.top + 0.5}" width="${width - 1}" height="${BTN.h - 1}" rx="10.5" fill="none" stroke="#ffffff" stroke-opacity="0.18"/>`
    : `<rect x="0.5" y="${BTN.top + 0.5}" width="${width - 1}" height="${BTN.h - 1}" rx="10.5" ${paint("fill", t.outlineFill)} ${paint("stroke", t.outlineStroke)}/>`;
  const body = [
    pill,
    useIcon(button.icon, 16, BTN.top + 12, 16, color),
    text(40, BTN.top + 25.4, button.label, { size: BTN.size, weight: 600, fill: color }),
  ].join("\n");
  return svgDoc(width, BTN.top + BTN.h, button.label, defs, body);
}

function otherHeadingSvg(t) {
  const height = 92;
  const defs = [linear("bar", t.gradient, { x2: 0 }), iconSymbols(["arrow"])].join("\n");
  const body = [
    `<rect x="0" y="22" width="4" height="52" rx="2" fill="url(#bar)"/>`,
    text(20, 46, "Other Projects", { size: 25, weight: 700, spacing: -0.3, fill: t.title }),
    text(20, 72, "More projects I've worked on", { size: 16, fill: t.text }),
    text(PAGE_W - 2 - 24, 54, "View all", { size: 15.5, weight: 600, fill: t.eyebrow, anchor: "end" }),
    useIcon("arrow", PAGE_W - 2 - 16, 42, 16, t.eyebrow),
  ].join("\n");
  return svgDoc(PAGE_W, height, "Other Projects", defs, body);
}

function tileSvg(o, t) {
  const accent = ACCENTS[o.accent];
  const textX = TILE.pad + TILE.tile + 11;
  const arrowX = TILE_W - 26;
  const max = arrowX - 12 - 6 - textX;
  const defs = [
    linear("tile", [accent.deep, accent.base]),
    radial("glow", accent.base, t.glow * 0.8, 20, 0, 170),
    `<clipPath id="clip"><rect width="${TILE_W}" height="${TILE.h}" rx="14"/></clipPath>`,
    iconSymbols([o.icon, "arrow"]),
  ].join("\n");
  const body = [
    frame(TILE_W, TILE.h, 14, t),
    iconTile(o.icon, TILE.pad, (TILE.h - TILE.tile) / 2, TILE.tile, 21),
    text(textX, 38, o.name, { size: 13, weight: 700, fill: t.title, max }),
    text(textX, 57, o.subtitle, { size: 12, fill: t.text, max }),
    `<circle cx="${arrowX}" cy="42" r="12" fill="none" ${paint("stroke", t.outlineStroke)}/>`,
    useIcon("arrow", arrowX - 6.5, 35.5, 13, t.muted),
  ].join("\n");
  return svgDoc(TILE_W, TILE.h, `${o.name} — ${o.subtitle}`, defs, body);
}

function techStackSvg(t) {
  const top = 92;
  const cardW = (PAGE_W - 2 * CARD_GAP) / 3;
  const layouts = TECH_GROUPS.map((group) => {
    const lines = wrap(group.subtitle, 13.5, cardW - 88 - 20);
    const chipsY = Math.max(22 + 50, 66 + (lines.length - 1) * 18 + 6) + 18;
    const chipRows = layoutChips(group.tech, cardW - 44);
    return { group, lines, chipsY, chipRows, minHeight: chipsY + chipRows.height + 22 };
  });
  const cardH = Math.max(...layouts.map((layout) => layout.minHeight));
  const height = top + cardH + 2;
  const defs = [
    `<clipPath id="clip"><rect width="${cardW}" height="${cardH}" rx="16"/></clipPath>`,
    ...TECH_GROUPS.flatMap((group, i) => [
      linear(`tile-${i}`, [ACCENTS[group.accent].deep, ACCENTS[group.accent].base]),
      radial(`glow-${i}`, ACCENTS[group.accent].base, t.glow * 1.2, cardW * 0.8, cardH + 30, 260),
    ]),
    iconSymbols(TECH_GROUPS.flatMap((group) => [group.icon, ...group.tech.map(([, icon]) => icon)])),
  ].join("\n");
  const cards = layouts.map(({ group, lines, chipsY, chipRows }, i) => [
    `<g transform="translate(${n(i * (cardW + CARD_GAP))} ${top})">`,
    frame(cardW, cardH, 16, t, "clip", `glow-${i}`),
    iconTile(group.icon, 22, 22, 50, 24, `tile-${i}`),
    text(88, 44, group.title, { size: 19, weight: 700, fill: t.title, max: cardW - 88 - 20 }),
    ...lines.map((line, j) => text(88, 66 + j * 18, line, { size: 13.5, fill: t.text, max: cardW - 88 - 20 })),
    chips(chipRows, 22, chipsY, t),
    `</g>`,
  ].join("\n"));
  const body = [
    `<rect x="0" y="27" width="34" height="3" rx="1.5" fill="${t.eyebrow}"/>`,
    text(48, 37, "Tech Stack", { size: 25, weight: 700, spacing: -0.3, fill: t.title }),
    text(48, 63, "Technologies I work with", { size: 16, fill: t.text }),
    ...cards,
  ].join("\n");
  return svgDoc(PAGE_W, height, "Tech Stack", defs, body);
}

// ---------------------------------------------------------------- README markup

const pct = (units) => `${Number(((units / PAGE_W) * 100).toFixed(4))}%`;
const anchor = (href, inner) => `<a href="${attr(href)}">${inner}</a>`;
const block = (html) => `<p>\n${html}\n</p>`;
const spacer = (units) => `<img src="${ASSET_URL}/spacer.svg" width="${pct(units)}" alt="">`;

function picture(name, units, alt) {
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${ASSET_URL}/${name}-dark.svg"><img src="${ASSET_URL}/${name}-light.svg" width="${pct(units)}" alt="${attr(alt)}"></picture>`;
}

const buttonsWidth = (p) => p.links.reduce((sum, [kind], i) => sum + buttonWidth(kind) + (i ? BTN_GAP : 0), 0);

function buttons(p) {
  return p.links
    .map(([kind, href], i) => (i ? spacer(BTN_GAP) : "") + anchor(href, picture(`btn-${kind}`, buttonWidth(kind), `${p.name}: ${BUTTONS[kind].label}`)))
    .join("");
}

const cardAlt = (p) => `${p.name} — ${p.subtitle}. ${p.description} Built with ${p.tech.map(([label]) => label).join(", ")}.`;

// No whitespace between images: a space would push the second card or its buttons out of line.
function cardRow(a, b) {
  const card = (p) => anchor(p.links[0][1], picture(`card-${p.slug}`, CARD_W, cardAlt(p)));
  if (!b) return block(`${card(a)}<br>\n${buttons(a)}`);
  return block(`${card(a)}${spacer(CARD_GAP)}${card(b)}<br>\n${buttons(a)}${spacer(CARD_W + CARD_GAP - buttonsWidth(a))}${buttons(b)}`);
}

function readmeSection() {
  const techAlt = `Tech stack — ${TECH_GROUPS.map((group) => `${group.title}: ${group.tech.map(([label]) => label).join(", ")}`).join(". ")}.`;
  const rows = [];
  for (let i = 0; i < PROJECTS.length; i += 2) rows.push(cardRow(PROJECTS[i], PROJECTS[i + 1]));
  return [
    block(anchor(`${PORTFOLIO}/#projects`, picture("heading", PAGE_W, `Featured Work — ${HEADING.description}`))),
    ...rows,
    block(anchor("https://github.com/joynto7?tab=repositories", picture("other-heading", PAGE_W, "Other Projects — more projects I've worked on"))),
    block(OTHERS.map((o, i) => (i ? spacer(TILE_GAP) : "") + anchor(o.href, picture(`other-${o.slug}`, TILE_W, `${o.name} — ${o.subtitle}`))).join("")),
    block(anchor(`${PORTFOLIO}/#skills`, picture("tech-stack", PAGE_W, techAlt))),
  ].join("\n\n");
}

// ---------------------------------------------------------------- write

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const write = (name, svg) => writeFileSync(join(OUT_DIR, name), svg);

const cardHeight = Math.max(...PROJECTS.map((p) => cardLayout(p).minHeight));
for (const t of Object.values(THEMES)) {
  write(`heading-${t.name}.svg`, headingSvg(t));
  for (const p of PROJECTS) write(`card-${p.slug}-${t.name}.svg`, cardSvg(p, t, cardHeight));
  for (const kind of new Set(PROJECTS.flatMap((p) => p.links.map(([k]) => k)))) write(`btn-${kind}-${t.name}.svg`, buttonSvg(kind, t));
  write(`other-heading-${t.name}.svg`, otherHeadingSvg(t));
  for (const o of OTHERS) write(`other-${o.slug}-${t.name}.svg`, tileSvg(o, t));
  write(`tech-stack-${t.name}.svg`, techStackSvg(t));
}
write("spacer.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="1" viewBox="0 0 100 1"/>\n`);

const START = "<!-- featured-work:start -->";
const END = "<!-- featured-work:end -->";
const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1) throw new Error(`README.md needs ${START} and ${END} markers`);
const note = "<!-- Generated by scripts/featured/build.mjs — edit the content there and re-run it. -->";
writeFileSync(readmePath, `${readme.slice(0, start + START.length)}\n${note}\n\n${readmeSection()}\n\n${readme.slice(end)}`);
console.log(`Wrote ${OUT_DIR} and updated README.md (cards ${CARD_W}×${cardHeight}).`);
