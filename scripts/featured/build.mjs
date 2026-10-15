#!/usr/bin/env node
/**
 * Builds the profile README from projects.json: a sci-fi page with a nav bar, an astronaut
 * coding on a floating island, holographic project cards on light pedestals, an "Other
 * Projects" panel, tech-stack consoles over a glowing platform, and a footer.
 *
 * GitHub strips CSS and scripts from READMEs, so the page is drawn as one tall SVG canvas,
 * 1200 units wide, and cut into tiles in assets/featured/. The README lays the tiles out row
 * by row in a single <p> (align="top" images with no whitespace between them), so they join
 * back into one picture. Everything clickable (nav items, cards, buttons, social icons) is a
 * tile of its own, so each carries its own link.
 *
 * Each tile animates itself with CSS, which survives because GitHub serves SVGs as images.
 * Tiles run on separate clocks, so anything that moves has to stay inside one tile: moving
 * across a seam would tear. The build stops if something animated crosses one.
 *
 * Add or edit projects in projects.json (see README.md next to this file), then run:
 *   node scripts/featured/build.mjs
 * The "Featured work" GitHub Action runs it for you when anything in scripts/featured changes.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT_DIR = join(ROOT, "assets", "featured");
const ASSET_URL = "assets/featured";
const ICONS = JSON.parse(readFileSync(join(HERE, "icons.json"), "utf8"));
const DATA = JSON.parse(readFileSync(join(HERE, "projects.json"), "utf8"));

// ---------------------------------------------------------------- design tokens

/** deep/base paint tiles, frames and glows; light is the accent's text color on the dark page. */
const ACCENTS = {
  blue: { deep: "#1d4ed8", base: "#3b82f6", light: "#60a5fa" },
  cyan: { deep: "#0e7490", base: "#06b6d4", light: "#22d3ee" },
  teal: { deep: "#0f766e", base: "#14b8a6", light: "#2dd4bf" },
  green: { deep: "#047857", base: "#10b981", light: "#34d399" },
  indigo: { deep: "#4338ca", base: "#6366f1", light: "#818cf8" },
  violet: { deep: "#6d28d9", base: "#8b5cf6", light: "#a78bfa" },
  magenta: { deep: "#a21caf", base: "#d946ef", light: "#e879f9" },
  rose: { deep: "#be123c", base: "#f43f5e", light: "#fb7185" },
  orange: { deep: "#c2410c", base: "#f97316", light: "#fb923c" },
  amber: { deep: "#b45309", base: "#f59e0b", light: "#fbbf24" },
};

const INK = { title: "#f8fafc", body: "#b6c0dc", muted: "#8a94b8", faint: "#5d6790", cyan: "#22d3ee", sky: "#67e8f9", violet: "#a78bfa" };

/** Logo colors for tech badges, lightened where the brand color is too dark on navy. */
const BRAND = {
  nextdotjs: "#f8fafc", typescript: "#4f9cf9", javascript: "#f7df1e", react: "#61dafb", tailwindcss: "#38bdf8",
  nodedotjs: "#6cc24a", express: "#e2e8f0", prisma: "#c7d2fe", postgresql: "#7aa2ff", mongodb: "#4ade80",
  redis: "#ff6b5b", celery: "#a6e22e", docker: "#4cb3f4", socketdotio: "#e2e8f0", mqtt: "#c4b5fd", espressif: "#f87171",
  stripe: "#8b8cff", fastapi: "#2dd4bf", python: "#ffd43b", jsonwebtokens: "#f472b6", reactquery: "#ff7a7a",
  firebase: "#fbbf24", vercel: "#f8fafc", github: "#f8fafc",
};

const SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;
const W = 1200;

// ---------------------------------------------------------------- content

const BUTTONS = {
  live: { label: "Live demo", icon: "external", solid: true },
  source: { label: "Source", icon: "github" },
  case: { label: "Case study", icon: "book" },
  api: { label: "API", icon: "server" },
  docs: { label: "Docs", icon: "book" },
};
const LINK_ORDER = Object.keys(BUTTONS);

const SOCIALS = {
  github: { label: "GitHub", icon: "github" },
  linkedin: { label: "LinkedIn" },
  email: { label: "Email", icon: "mail" },
  resume: { label: "Résumé (CV)", icon: "file" },
};

/** Drawn stand-ins for apps without a public screen to capture. */
const DRAWN = { sentra: sentraScreen, agrosync: agrosyncScreen };

const PROJECT_ICONS = Object.keys(ICONS).filter((key) => ICONS[key].kind === "stroke");
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function check(condition, message) {
  if (condition) return;
  console.error(`projects.json: ${message}`);
  process.exit(1);
}

function checkLook(item, label = item.name ?? item.title) {
  check(ACCENTS[item.accent], `${label}: accent "${item.accent}" is not one of ${Object.keys(ACCENTS).join(", ")}`);
  check(PROJECT_ICONS.includes(item.icon), `${label}: icon "${item.icon}" is not one of ${PROJECT_ICONS.join(", ")}`);
}

const FEATURED = DATA.featured.map((p) => {
  check(p.name && p.description, "every featured project needs a name and a description");
  checkLook(p);
  const unknown = Object.keys(p.links ?? {}).filter((kind) => !LINK_ORDER.includes(kind));
  check(unknown.length === 0, `${p.name}: link types must be ${LINK_ORDER.join(", ")} (got ${unknown.join(", ")})`);
  const links = LINK_ORDER.filter((kind) => p.links?.[kind]).map((kind) => [kind, p.links[kind]]);
  check(links.length > 0, `${p.name}: add at least one link (${LINK_ORDER.join(", ")})`);
  return { ...p, slug: slugify(p.name), links, tech: p.tech ?? [] };
});

const OTHERS = DATA.others.map((o) => {
  check(o.name && o.link, "every other project needs a name and a link");
  checkLook(o);
  return { ...o, slug: slugify(o.name) };
});

const TECH_GROUPS = DATA.techStack.map((group) => {
  checkLook(group);
  return group;
});

for (const kind of Object.keys(DATA.footer.links)) check(SOCIALS[kind], `footer link "${kind}" must be one of ${Object.keys(SOCIALS).join(", ")}`);

const PORTFOLIO = DATA.portfolio.replace(/\/$/, "");
const PROJECT_COUNT = FEATURED.length + OTHERS.length;
const TECH_COUNT = new Set(TECH_GROUPS.flatMap((group) => group.tech.map((tech) => tech.toLowerCase()))).size;
const BRAND_NAME = DATA.hero.name.join("");

/**
 * Tech names are free text ("Next.js 16", "Celery + Redis"), so they are matched on their
 * leading words. First match wins; anything unmatched gets a plain dot instead of a logo.
 */
const TECH_PATTERNS = [
  [/^next(\.?js)?\b/, "nextdotjs"], [/^react[- ]?hook[- ]?form/, "reacthookform"], [/^(tanstack|react)[- ]query/, "reactquery"],
  [/^react\b/, "react"], [/^typescript\b|^ts$/, "typescript"], [/^javascript\b|^js$/, "javascript"], [/^tailwind/, "tailwindcss"],
  [/^node(\.?js)?\b/, "nodedotjs"], [/^express/, "express"], [/^prisma/, "prisma"], [/^postgres/, "postgresql"], [/^mongo/, "mongodb"],
  [/^mysql/, "mysql"], [/^sqlite/, "sqlite"], [/^redis/, "redis"], [/^celery/, "celery"], [/^docker/, "docker"],
  [/^kubernetes|^k8s/, "kubernetes"], [/^socket\.?io/, "socketdotio"], [/^mqtt/, "mqtt"], [/^esp32|^espressif/, "espressif"],
  [/^arduino/, "arduino"], [/^raspberry/, "raspberrypi"], [/^stripe/, "stripe"], [/^paypal/, "paypal"], [/^jwt\b/, "jsonwebtokens"],
  [/^zod\b/, "zod"], [/^redux/, "redux"], [/^vite\b/, "vite"], [/^vue/, "vuedotjs"], [/^angular/, "angular"], [/^svelte/, "svelte"],
  [/^python/, "python"], [/^fastapi/, "fastapi"], [/^django/, "django"], [/^flask/, "flask"], [/^firebase/, "firebase"],
  [/^supabase/, "supabase"], [/^graphql/, "graphql"], [/^trpc/, "trpc"], [/^drizzle/, "drizzle"], [/^neon\b/, "neon"],
  [/^c\+\+|^cpp\b/, "cplusplus"], [/^c$/, "c"], [/^go(lang)?$/, "go"], [/^rust/, "rust"], [/^kotlin/, "kotlin"],
  [/^flutter/, "flutter"], [/^dart/, "dart"], [/^swift/, "swift"], [/^java\b/, "openjdk"], [/^php/, "php"], [/^laravel/, "laravel"],
  [/^spring/, "spring"], [/^\.net\b|^dotnet/, "dotnet"], [/^vercel/, "vercel"], [/^netlify/, "netlify"], [/^render\b/, "render"],
  [/^cloudflare/, "cloudflare"], [/^git(hub)? ?actions/, "githubactions"], [/^github/, "github"], [/^git\b/, "git"],
  [/^kali/, "kalilinux"], [/^linux/, "linux"], [/^nginx/, "nginx"], [/^pytorch/, "pytorch"], [/^tensorflow/, "tensorflow"],
  [/^scikit|^sklearn/, "scikitlearn"], [/^pandas/, "pandas"], [/^numpy/, "numpy"], [/^opencv/, "opencv"], [/^jupyter/, "jupyter"],
  [/^langchain/, "langchain"], [/^hugging ?face/, "huggingface"], [/^claude|^anthropic/, "anthropic"], [/^ollama/, "ollama"],
  [/^(lite)?llm|^openai|^gpt/, "bot"], [/^wireshark/, "wireshark"], [/^burp/, "burpsuite"], [/^scapy/, "network"],
  [/^html/, "html5"], [/^css/, "css"], [/^s[ac]ss/, "sass"], [/^figma/, "figma"], [/^postman/, "postman"], [/^jest/, "jest"],
  [/^vitest/, "vitest"], [/^cypress/, "cypress"], [/^shadcn/, "shadcnui"], [/^resend/, "resend"], [/^clerk/, "clerk"],
  [/^auth0/, "auth0"], [/^bun\b/, "bun"], [/^deno/, "deno"], [/^rabbitmq/, "rabbitmq"], [/^(apache )?kafka/, "apachekafka"],
  [/^elastic/, "elasticsearch"], [/^grafana/, "grafana"], [/^prometheus/, "prometheus"], [/^terraform/, "terraform"],
  [/^electron/, "electron"], [/^expo\b/, "expo"], [/^three(\.?js)?/, "threedotjs"], [/^framer/, "framer"],
  [/^chart\.?js/, "chartdotjs"], [/^leaflet/, "leaflet"], [/^google cloud|^gcp/, "googlecloud"], [/^sslcommerz|^bkash/, "wallet"],
];

function techIcon(tech) {
  const label = tech.trim().toLowerCase();
  const key = TECH_PATTERNS.find(([pattern]) => pattern.test(label))?.[1];
  return key && ICONS[key] ? key : undefined;
}

// ---------------------------------------------------------------- text measurement

// Helvetica advance widths (1/1000 em) for ASCII 32–126. The SVGs render in the viewer's
// system font, so measurements carry a safety margin and anything tight logs a warning.
const REGULAR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const OTHER_GLYPHS = { "·": 278, "•": 350, "—": 1000, "→": 1000, "°": 400, "é": 556 };
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

const monoWidth = (text, size, spacing = 0) => [...text].length * (size * 0.6 + spacing);

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

/** Deterministic pseudo-random numbers, so rebuilding without changes produces identical files. */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- svg helpers

const n = (value) => Number(value.toFixed(2));
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (value) => esc(value).replace(/"/g, "&quot;");
const pts = (points) => points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");

const DEFS = new Map();

/** Registers a <defs> entry once and returns url(#id); each tile only carries the entries it uses. */
function def(id, markup) {
  if (!DEFS.has(id)) DEFS.set(id, markup);
  return `url(#${id})`;
}

function usedDefs(markup) {
  const seen = new Set();
  const out = [];
  const visit = (source) => {
    for (const [, id] of source.matchAll(/(?:url\(#|href="#)([\w-]+)/g)) {
      if (seen.has(id) || !DEFS.has(id)) continue;
      seen.add(id);
      visit(DEFS.get(id));
      out.push(DEFS.get(id));
    }
  };
  visit(markup);
  return out.join("\n");
}

const stops = (colors, opacities = []) =>
  colors
    .map((color, i) => {
      const opacity = opacities[i] ?? 1;
      return `<stop offset="${n(colors.length > 1 ? i / (colors.length - 1) : 0)}" stop-color="${color}"${opacity === 1 ? "" : ` stop-opacity="${opacity}"`}/>`;
    })
    .join("");

/** Linear gradient: across its shape by default, in page units with user: true. */
function linear(id, colors, { x1 = 0, y1 = 0, x2 = 1, y2 = 1, opacities, user = false } = {}) {
  return def(id, `<linearGradient id="${id}"${user ? ` gradientUnits="userSpaceOnUse"` : ""} x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${stops(colors, opacities)}</linearGradient>`);
}

/** Soft radial falloff that fills whatever shape uses it (an ellipse gives an elliptical glow). */
function glow(id, color, opacity, { cx = 0.5, cy = 0.5 } = {}) {
  return def(id, `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="0.5"><stop offset="0" stop-color="${color}" stop-opacity="${n(opacity)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`);
}

function text(x, y, content, { size, weight = 400, fill, anchor, spacing, max, mono = false, extra = "" }) {
  const width = mono ? monoWidth(content, size, spacing ?? 0) : textWidth(content, size, weight, spacing ?? 0);
  if (max && width > max) console.warn(`warning: "${content}" may not fit in ${n(max)} units`);
  return `<text x="${n(x)}" y="${n(y)}" class="${mono ? "mono" : "sans"}" font-size="${size}"${weight === 400 ? "" : ` font-weight="${weight}"`}${anchor ? ` text-anchor="${anchor}"` : ""}${spacing ? ` letter-spacing="${spacing}"` : ""} fill="${fill}"${extra}>${esc(content)}</text>`;
}

function useIcon(name, x, y, size, color, { width = 2, filled = false } = {}) {
  const icon = ICONS[name];
  if (!icon) throw new Error(`Unknown icon: ${name}`);
  def(`i-${name}`, `<symbol id="i-${name}" viewBox="0 0 24 24">${icon.body}</symbol>`);
  const look = icon.kind === "stroke"
    ? `fill="${filled ? color : "none"}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="${color}"`;
  return `<use href="#i-${name}" x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" ${look}/>`;
}

/** Rectangle with all four corners cut off, the HUD panel shape. */
const chamfer = (x, y, w, h, c) =>
  `M${n(x + c)} ${n(y)} H${n(x + w - c)} L${n(x + w)} ${n(y + c)} V${n(y + h - c)} L${n(x + w - c)} ${n(y + h)} H${n(x + c)} L${n(x)} ${n(y + h - c)} V${n(y + c)} Z`;

/** Soft neon halo from stacked strokes, far cheaper than a blur filter. */
const halo = (d, stroke, strength = 1) =>
  [[16, 0.05], [9, 0.09], [3.5, 0.2]]
    .map(([width, opacity]) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${n(opacity * strength)}" stroke-linejoin="round"/>`)
    .join("");

const roundRect = (x, y, w, h, r) =>
  `M${n(x + r)} ${n(y)} H${n(x + w - r)} A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)} V${n(y + h - r)} A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)} H${n(x + r)} A${r} ${r} 0 0 1 ${n(x)} ${n(y + h - r)} V${n(y + r)} A${r} ${r} 0 0 1 ${n(x + r)} ${n(y)} Z`;

function iconTile(icon, x, y, size, iconSize, fill) {
  const radius = n(size * 0.26);
  const inset = (size - iconSize) / 2;
  return `<rect x="${n(x)}" y="${n(y)}" width="${size}" height="${size}" rx="${radius}" fill="${fill}"/>
<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="${size - 1}" height="${size - 1}" rx="${n(radius - 0.5)}" fill="none" stroke="#ffffff" stroke-opacity="0.25"/>
<path d="M${n(x + radius)} ${n(y + 1.5)} H${n(x + size - radius)}" stroke="#ffffff" stroke-opacity="0.4" stroke-linecap="round"/>
${useIcon(icon, x + inset, y + inset, iconSize, "#ffffff")}`;
}

const accentTile = (accent) => linear(`tile-${accent}`, [ACCENTS[accent].deep, ACCENTS[accent].base]);

/** Thin horizontal lines over a panel, like a hologram. */
const SCANLINES = def("scanlines", `<pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" fill-opacity="0.025"/></pattern>`);

const CSS = `.sans { font-family: ${SANS}; }
.mono { font-family: ${MONO}; }
.bob { animation: bob 6s ease-in-out infinite; }
.bob-s { animation: bob-s 5s ease-in-out infinite; }
.tw { animation: tw 3s ease-in-out infinite; }
.pulse { animation: pulse 3.2s ease-in-out infinite; }
.lava { animation: lava 2.6s ease-in-out infinite; }
.spin { transform-box: fill-box; transform-origin: center; animation: spin 18s linear infinite; }
.dash { animation: dash 3s linear infinite; }
.rise { animation: rise 5s ease-in infinite; }
.rise-s { animation: rise-s 3.4s ease-in infinite; }
.type { transform-box: fill-box; transform-origin: left center; animation: type 3.6s steps(12) infinite; }
.sweep { animation: sweep 8s ease-in-out infinite; }
.sheen { animation: sheen 4.5s ease-in-out infinite; }
.flicker { animation: flicker 4s ease-in-out infinite; }
.blink { animation: blink 1.8s steps(2, jump-none) infinite; }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes bob-s { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes tw { 0%, 100% { opacity: 0.15; } 50% { opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
@keyframes lava { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes dash { to { stroke-dashoffset: -64; } }
@keyframes rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-80px); opacity: 0; } }
@keyframes rise-s { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-24px); opacity: 0; } }
@keyframes type { 0% { transform: scaleX(0.05); } 70%, 100% { transform: scaleX(1); } }
@keyframes sweep { 0% { transform: translateX(0); } 55%, 100% { transform: translateX(600px); } }
@keyframes sheen { 0% { transform: translateX(0); } 50%, 100% { transform: translateX(260px); } }
@keyframes flicker { 0%, 100% { opacity: 0.8; } 45% { opacity: 1; } 50% { opacity: 0.85; } 55% { opacity: 1; } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

// ---------------------------------------------------------------- page model

/** Everything drawn on the page, with the box it covers (moving parts include their travel). */
const layers = [];
/** Horizontal bands of the page, each cut into tiles that become the README's images. */
const rows = [];

function add(box, svg, { z = 3, animated = false } = {}) {
  layers.push({ box, svg, z, animated, order: layers.length });
}

function addRow(name, y0, y1, tiles) {
  rows.push({ name, y0, y1, tiles: tiles.map((tile, i) => ({ ...tile, file: `${name}-${tile.key ?? i + 1}.svg` })) });
}

const intersects = ([ax0, ay0, ax1, ay1], [bx0, by0, bx1, by1]) => ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
const tileBox = (row, tile) => [tile.x0, row.y0, tile.x1, row.y1];

// ---------------------------------------------------------------- shared pieces

function hudPanel(id, x, y, w, h, { cut = 20, colors = ["#22d3ee", "#6366f1", "#a855f7"], strength = 1, opacity = 0.88 } = {}) {
  const d = chamfer(x, y, w, h, cut);
  const edge = linear(`edge-${id}`, colors, { x1: x, y1: y, x2: x + w, y2: y + h, user: true });
  const fill = linear("panelFill", ["#0f1637", "#090d25"], { x2: 0 });
  const tick = (points) => `<path d="M${points.map(([px, py]) => `${n(px)} ${n(py)}`).join(" L")}" fill="none" stroke="${colors[0]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  add([x - 12, y - 12, x + w + 12, y + h + 12], [
    halo(d, edge, strength),
    `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`,
    `<path d="${d}" fill="${SCANLINES}"/>`,
    `<path d="${d}" fill="none" stroke="${edge}" stroke-width="1.3" stroke-opacity="0.9" stroke-linejoin="round"/>`,
    tick([[x, y + cut + 20], [x, y + cut], [x + cut, y], [x + cut + 20, y]]),
    tick([[x + w, y + h - cut - 20], [x + w, y + h - cut], [x + w - cut, y + h], [x + w - cut - 20, y + h]]),
  ].join("\n"), { z: 2 });
}

/** Round "01" badge with a dashed ring turning around it. */
function badge(cx, cy, label) {
  add([cx - 32, cy - 32, cx + 32, cy + 32], `<circle cx="${cx}" cy="${cy}" r="25" fill="#0a1130" stroke="${INK.cyan}" stroke-opacity="0.75" stroke-width="1.4"/>
<circle cx="${cx}" cy="${cy}" r="25" fill="none" stroke="${INK.cyan}" stroke-opacity="0.16" stroke-width="7"/>
${text(cx, cy + 6, label, { size: 17, weight: 700, fill: "#e0f2fe", anchor: "middle", mono: true })}`, { z: 4 });
  add([cx - 33, cy - 33, cx + 33, cy + 33], `<g class="spin"><circle cx="${cx}" cy="${cy}" r="31" fill="none" stroke="${INK.cyan}" stroke-opacity="0.6" stroke-width="1.3" stroke-dasharray="2 5.5"/></g>`, { z: 4, animated: true });
}

function sectionTitle(x, y, title, subtitle, size = 30) {
  add([x, y - size, x + 600, y + 30], `${text(x, y, title, { size, weight: 700, spacing: -0.4, fill: INK.title })}
${text(x, y + 26, subtitle, { size: 14.5, fill: INK.body })}`, { z: 4 });
}

/** Small floating rock with lit and shaded facets. */
function rock(cx, cy, r, seed, tone = 1) {
  const random = seeded(seed);
  const count = 7 + Math.floor(random() * 3);
  const outline = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + random() * 0.35;
    const radius = r * (0.7 + random() * 0.38);
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.85];
  });
  const core = [cx - r * 0.2, cy - r * 0.22];
  const shades = ["#3a4270", "#2b3259", "#1d2343", "#141831", "#0d1024"];
  const facets = outline.map((p, i) => {
    const q = outline[(i + 1) % count];
    const mid = Math.atan2((p[1] + q[1]) / 2 - cy, (p[0] + q[0]) / 2 - cx);
    const light = (Math.cos(mid - Math.PI * 1.25) + 1) / 2;
    const shade = shades[Math.min(shades.length - 1, Math.floor((1 - light) * shades.length * tone))];
    return `<polygon points="${pts([core, p, q])}" fill="${shade}"/>`;
  });
  return `${facets.join("")}<polygon points="${pts(outline)}" fill="none" stroke="#818cf8" stroke-opacity="0.28" stroke-width="1" stroke-linejoin="round"/>`;
}

// ---------------------------------------------------------------- nav

function nav(y0) {
  const H = 100;
  const bar = { x: 20, y: y0 + 14, w: W - 40, h: 60 };
  const cut = 24;
  const d = `M${bar.x} ${bar.y + bar.h / 2} L${bar.x + cut} ${bar.y} H${bar.x + bar.w - cut} L${bar.x + bar.w} ${bar.y + bar.h / 2} L${bar.x + bar.w - cut} ${bar.y + bar.h} H${bar.x + cut} Z`;
  const edge = linear("navEdge", ["#22d3ee", "#6366f1", "#a855f7"], { x1: bar.x, x2: bar.x + bar.w, y2: 0, user: true });
  const fill = linear("navFill", ["#111a3d", "#0a0f28"], { x2: 0 });
  const logo = linear("logo", ["#22d3ee", "#a78bfa"], { x2: 1, y2: 0.4 });
  add([bar.x - 12, bar.y - 12, bar.x + bar.w + 12, bar.y + bar.h + 12], [
    halo(d, edge),
    `<path d="${d}" fill="${fill}" fill-opacity="0.94"/>`,
    `<path d="${d}" fill="${SCANLINES}"/>`,
    `<path d="${d}" fill="none" stroke="${edge}" stroke-width="1.4" stroke-opacity="0.9" stroke-linejoin="round"/>`,
    `<path d="M${bar.x + cut + 10} ${bar.y + 1.5} H${bar.x + bar.w - cut - 10}" stroke="#ffffff" stroke-opacity="0.1"/>`,
  ].join("\n"), { z: 2 });

  add([40, bar.y, 330, bar.y + bar.h], `${useIcon("code", 50, bar.y + 13, 34, logo, { width: 5.5 }).replace("<use", `<use stroke-opacity="0.2"`)}
${useIcon("code", 50, bar.y + 13, 34, logo, { width: 2.4 })}
${text(98, bar.y + 37, BRAND_NAME, { size: 20, weight: 700, spacing: 0.2, fill: INK.title })}`);

  const pad = 21;
  const items = DATA.nav.map((item) => ({ ...item, w: Math.ceil(textWidth(item.label, 15, 600) + 2 * pad) }));
  let x = 1110 - items.reduce((sum, item) => sum + item.w, 0);
  const tiles = [{ key: "brand", x0: 0, x1: x, href: PORTFOLIO, alt: `${BRAND_NAME} — portfolio` }];
  for (const item of items) {
    const cx = x + item.w / 2;
    const tw = textWidth(item.label, 15, 600) / SAFETY;
    add([x, bar.y, x + item.w, bar.y + bar.h], `${text(cx, bar.y + 36, item.label, { size: 15, weight: item.active ? 600 : 500, fill: item.active ? INK.cyan : "#cbd5e1", anchor: "middle" })}
${item.active ? `<rect x="${n(cx - tw / 2 - 2)}" y="${bar.y + 45}" width="${n(tw + 4)}" height="6" rx="3" fill="${INK.cyan}" fill-opacity="0.18"/><rect x="${n(cx - tw / 2)}" y="${bar.y + 47}" width="${n(tw)}" height="2" rx="1" fill="${INK.cyan}"/>` : ""}`);
    tiles.push({ key: slugify(item.label), x0: x, x1: x + item.w, href: item.link, alt: item.label });
    x += item.w;
  }
  const lx = 1142;
  add([lx - 14, bar.y + 16, lx + 14, bar.y + 44], `<path d="M${lx - 9} ${bar.y + 30} L${lx - 4.5} ${bar.y + 22} H${lx + 4.5} L${lx + 9} ${bar.y + 30} L${lx + 4.5} ${bar.y + 38} H${lx - 4.5} Z" fill="none" stroke="#34d399" stroke-opacity="0.5"/>
<circle class="pulse" cx="${lx}" cy="${bar.y + 30}" r="3.4" fill="#34d399"/>`, { z: 4, animated: true });
  tiles.push({ key: "end", x0: x, x1: W, href: PORTFOLIO, alt: "" });
  addRow("nav", y0, y0 + H, tiles);
  return y0 + H;
}

// ---------------------------------------------------------------- hero

const CTA = { h: 48, size: 15.5 };
const ctaWidth = (kind) => Math.ceil(24 + (kind === "contact" ? 18 + 10 : 0) + textWidth(DATA.hero.buttons[kind].label, CTA.size, 600) + (kind === "projects" ? 12 + 17 : 0) + 24);

function heroPanel(y0, panel, ctaY, statsY) {
  const hero = DATA.hero;
  const x0 = 78;
  const [first, second] = hero.name;
  const firstWidth = textWidth(first, 68, 800, -2);
  const secondWidth = textWidth(second ?? "", 68, 800, -2);
  const name = linear("name", ["#22d3ee", "#818cf8", "#c084fc"], { x1: x0 + firstWidth, x2: x0 + firstWidth + secondWidth, y2: 0, user: true });
  const roles = hero.roles.map((role, i) => `${i ? `<tspan fill="${INK.cyan}">  •  </tspan>` : ""}${esc(role)}`).join("");
  if (textWidth(hero.roles.join("  •  "), 16) > panel.w - 80) console.warn("warning: hero roles may not fit");
  const desc = wrap(hero.description, 16.5, panel.w - 84);
  check(desc.length <= 4, "hero.description is too long for the panel (keep it under about 200 characters)");

  add([x0, panel.y, panel.x + panel.w, ctaY - 10], [
    text(x0, y0 + 84, hero.greeting, { size: 22, fill: "#c7d2fe" }),
    `<text x="${x0 - 3}" y="${y0 + 156}" class="sans" font-size="68" font-weight="800" letter-spacing="-2" fill="${INK.title}">${esc(first)}<tspan fill="${name}">${esc(second ?? "")}</tspan></text>`,
    `<text x="${x0}" y="${y0 + 198}" class="sans" font-size="16" fill="#d6def0">${roles}</text>`,
    ...desc.map((line, i) => text(x0, y0 + 240 + i * 26, line, { size: 16.5, fill: INK.body })),
  ].join("\n"), { z: 4 });

  // Call-to-action buttons; each sits in a tile of its own so it can link somewhere different.
  const { projects, contact } = hero.buttons;
  const w1 = ctaWidth("projects");
  const w2 = ctaWidth("contact");
  const x1 = x0;
  const x2 = x0 + w1 + 14;
  const fill = linear("cta", ["#06b6d4", "#3b82f6", "#8b5cf6"], { x2: 1, y2: 0 });
  const sheen = linear("ctaSheen", ["#ffffff", "#ffffff", "#ffffff"], { x2: 1, y2: 0, opacities: [0, 0.35, 0] });
  const ctaClip = def("ctaClip", `<clipPath id="ctaClip"><rect x="${x1}" y="${ctaY}" width="${w1}" height="${CTA.h}" rx="${CTA.h / 2}"/></clipPath>`);
  add([x1 - 8, ctaY - 8, x1 + w1 + 8, ctaY + CTA.h + 8], `${halo(roundRect(x1, ctaY, w1, CTA.h, CTA.h / 2), "#38bdf8", 1.4)}
<rect x="${x1}" y="${ctaY}" width="${w1}" height="${CTA.h}" rx="${CTA.h / 2}" fill="${fill}"/>
<path d="M${x1 + 20} ${ctaY + 1.5} H${x1 + w1 - 20}" stroke="#ffffff" stroke-opacity="0.45" stroke-linecap="round"/>
${text(x1 + 24, ctaY + CTA.h / 2 + 5.5, projects.label, { size: CTA.size, weight: 600, fill: "#ffffff" })}
${useIcon("arrow", x1 + w1 - 24 - 17, ctaY + (CTA.h - 17) / 2, 17, "#ffffff", { width: 2.4 })}`, { z: 4 });
  add([x1, ctaY, x1 + w1, ctaY + CTA.h], `<g clip-path="${ctaClip}"><g class="sheen"><rect x="${x1 - 70}" y="${ctaY - 10}" width="46" height="${CTA.h + 20}" fill="${sheen}" transform="rotate(18 ${x1 - 47} ${ctaY + CTA.h / 2})"/></g></g>`, { z: 4, animated: true });
  add([x2 - 6, ctaY - 6, x2 + w2 + 6, ctaY + CTA.h + 6], `<rect x="${x2 + 0.75}" y="${ctaY + 0.75}" width="${w2 - 1.5}" height="${CTA.h - 1.5}" rx="${CTA.h / 2}" fill="#22d3ee" fill-opacity="0.06" stroke="#22d3ee" stroke-opacity="0.55" stroke-width="1.5"/>
${useIcon("mail", x2 + 24, ctaY + (CTA.h - 18) / 2, 18, "#e0f2fe")}
${text(x2 + 24 + 18 + 10, ctaY + CTA.h / 2 + 5.5, contact.label, { size: CTA.size, weight: 600, fill: "#e0f2fe" })}`, { z: 4 });

  // Stats strip.
  const sy = statsY;
  const sw = panel.w - 84;
  const stats = [["box", `${PROJECT_COUNT}+`, "Projects"], ["cpu", `${TECH_COUNT}+`, "Technologies"], ["badge", "100%", "Passion"]];
  const col = sw / stats.length;
  add([x0, sy, x0 + sw, sy + 76], [
    `<rect x="${x0 + 0.5}" y="${sy + 0.5}" width="${sw - 1}" height="75" rx="14" fill="#ffffff" fill-opacity="0.03" stroke="#38bdf8" stroke-opacity="0.28"/>`,
    ...stats.map(([icon, value, label], i) => {
      const cx = x0 + i * col + 16;
      return `${i ? `<path d="M${n(x0 + i * col)} ${sy + 16} V${sy + 60}" stroke="#38bdf8" stroke-opacity="0.2"/>` : ""}
<rect x="${n(cx + 0.5)}" y="${sy + 17.5}" width="41" height="41" rx="11" fill="#22d3ee" fill-opacity="0.1" stroke="#22d3ee" stroke-opacity="0.5"/>
${useIcon(icon, cx + 10.5, sy + 28, 20, INK.cyan)}
${text(cx + 54, sy + 36, value, { size: 20, weight: 700, fill: INK.title })}
${text(cx + 54, sy + 56, label, { size: 12.5, fill: INK.muted, max: col - 70 })}`;
    }),
  ].join("\n"), { z: 4 });

  return { x1, w1, x2, w2 };
}

function planet(cx, cy, r) {
  const body = def("planetBody", `<radialGradient id="planetBody" cx="0.32" cy="0.28" r="0.85"><stop offset="0" stop-color="#d8ccff"/><stop offset="0.3" stop-color="#8b5cf6"/><stop offset="0.68" stop-color="#3b2a9e"/><stop offset="1" stop-color="#120c3a"/></radialGradient>`);
  const shade = def("planetShade", `<radialGradient id="planetShade" cx="0.78" cy="0.82" r="0.75"><stop offset="0" stop-color="#05030f" stop-opacity="0.75"/><stop offset="1" stop-color="#05030f" stop-opacity="0"/></radialGradient>`);
  const clip = def("planetClip", `<clipPath id="planetClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
  const ring = linear("ring", ["#67e8f9", "#a78bfa", "#f0abfc"], { x2: 1, y2: 0 });
  const bands = [[-0.55, 0.1, 0.12], [-0.25, 0.07, 0.1], [0.05, 0.12, 0.14], [0.38, 0.06, 0.1], [0.62, 0.09, 0.08]]
    .map(([dy, h, o]) => `<ellipse cx="${cx}" cy="${n(cy + dy * r)}" rx="${n(r * 1.3)}" ry="${n(h * r)}" fill="#e9d5ff" fill-opacity="${o}" transform="rotate(-14 ${cx} ${cy})"/>`);
  const rx = r * 1.85;
  const ry = r * 0.34;
  const arc = (sweep) => `<path d="M${n(cx - rx)} ${cy} A${n(rx)} ${n(ry)} 0 0 ${sweep} ${n(cx + rx)} ${cy}" fill="none" stroke="${ring}" stroke-width="3.5" stroke-opacity="0.75" transform="rotate(-16 ${cx} ${cy})"/>`;
  const glowRing = (sweep) => `<path d="M${n(cx - rx)} ${cy} A${n(rx)} ${n(ry)} 0 0 ${sweep} ${n(cx + rx)} ${cy}" fill="none" stroke="#a78bfa" stroke-width="12" stroke-opacity="0.1" transform="rotate(-16 ${cx} ${cy})"/>`;
  add([cx - rx - 12, cy - r - 30, cx + rx + 12, cy + r + 30], [
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.6}" fill="${glow("planetAura", "#8b5cf6", 0.35)}"/>`,
    glowRing(1), arc(1),
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${body}"/>`,
    `<g clip-path="${clip}">${bands.join("")}</g>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="#c4b5fd" stroke-opacity="0.45" stroke-width="3"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="none" stroke="#a78bfa" stroke-opacity="0.12" stroke-width="10"/>`,
    glowRing(0), arc(0),
  ].join("\n"), { z: 1 });
}

/** Floating holographic window: code, an icon or a chart. */
function holoWindow(x, y, w, h, skew, content, { delay = 0, cls = "bob" } = {}) {
  const box = [x - 8, y - 14 + Math.min(0, Math.tan((skew * Math.PI) / 180) * w), x + w + 8, y + h + 8 + Math.max(0, Math.tan((skew * Math.PI) / 180) * w)];
  add(box, `<g class="${cls}" style="animation-delay: ${delay}s"><g transform="translate(${x} ${y}) skewY(${skew})">
<rect x="-3" y="-3" width="${w + 6}" height="${h + 6}" rx="11" fill="none" stroke="#38bdf8" stroke-opacity="0.12" stroke-width="6"/>
<rect width="${w}" height="${h}" rx="8" fill="#0c1a44" fill-opacity="0.62" stroke="#38bdf8" stroke-opacity="0.75" stroke-width="1.2"/>
<path d="M8 0.6 H${w - 8}" stroke="#ffffff" stroke-opacity="0.3"/>
<rect x="1" y="1" width="${w - 2}" height="13" rx="7" fill="#38bdf8" fill-opacity="0.14"/>
<circle cx="9" cy="7.5" r="2" fill="#f87171"/><circle cx="16" cy="7.5" r="2" fill="#fbbf24"/><circle cx="23" cy="7.5" r="2" fill="#34d399"/>
${content(w, h)}</g></g>`, { z: 3, animated: true });
}

function codeLines(rows, typing = -1) {
  return (w) => rows.map((row, i) => {
    let cx = 9;
    return row.map(([width, color], j) => {
      const bar = `<rect${i === typing && j === row.length - 1 ? ` class="type"` : ""} x="${cx}" y="${21 + i * 9}" width="${Math.min(width, w - cx - 8)}" height="4" rx="2" fill="${color}" fill-opacity="0.9"/>`;
      cx += width + 5;
      return cx < w - 10 ? bar : "";
    }).join("");
  }).join("");
}

function glassNote(x, y, w, h, rotate, lines, size, delay) {
  add([x - 16, y - 24, x + w + 24, y + h + 16], `<g class="bob" style="animation-delay: ${delay}s"><g transform="translate(${x} ${y}) rotate(${rotate})">
<rect x="-3" y="-3" width="${w + 6}" height="${h + 6}" rx="15" fill="none" stroke="#38bdf8" stroke-opacity="0.12" stroke-width="6"/>
<rect width="${w}" height="${h}" rx="13" fill="#0d1a45" fill-opacity="0.66" stroke="#38bdf8" stroke-opacity="0.65" stroke-width="1.3"/>
<path d="M12 0.7 H${w - 12}" stroke="#ffffff" stroke-opacity="0.3"/>
${lines.map((line, i) => text(16, 28 + i * (size + 6), line, { size, weight: 500, fill: "#e0f2fe" })).join("")}
<circle cx="${w - 2}" cy="${h - 22}" r="15" fill="#070d24" stroke="#22d3ee" stroke-opacity="0.85" stroke-width="1.4"/>
<circle cx="${w - 2}" cy="${h - 22}" r="15" fill="none" stroke="#22d3ee" stroke-opacity="0.2" stroke-width="6"/>
${useIcon("arrow", w - 10, h - 30, 16, "#67e8f9", { width: 2.2 })}</g></g>`, { z: 4, animated: true });
}

/** Astronaut sitting cross-legged with a laptop, seen from behind. Origin is the seat. */
function astronaut() {
  const suit = linear("suit", ["#f4f7fd", "#c7cfe2", "#8f9bbb"], { x1: 0.2, y1: 0, x2: 0.8, y2: 1 });
  const pack = linear("pack", ["#dfe5f2", "#a3aecb", "#6f7b9e"], { x1: 0.1, y1: 0, x2: 0.9, y2: 1 });
  const visor = linear("visor", ["#0b1430", "#1e3a8a", "#0b1430"], { x1: 0, y1: 0, x2: 1, y2: 1 });
  const screen = glow("screenLight", "#22d3ee", 0.6);
  return `<ellipse class="flicker" cx="-8" cy="-34" rx="92" ry="70" fill="${screen}"/>
<ellipse cx="0" cy="3" rx="54" ry="9" fill="#000000" fill-opacity="0.5"/>
<path d="M-10 -8 C-30 -14 -50 -14 -58 -5 C-63 2 -54 9 -38 8 C-25 7 -13 4 -6 2 Z" fill="${suit}"/>
<path d="M10 -8 C30 -14 50 -14 58 -5 C63 2 54 9 38 8 C25 7 13 4 6 2 Z" fill="${suit}"/>
<ellipse cx="-56" cy="1" rx="9" ry="6.5" fill="#76829f"/><ellipse cx="56" cy="1" rx="9" ry="6.5" fill="#76829f"/>
<path d="M-28 -9 C-31 -34 -29 -58 -19 -69 C-9 -76 9 -76 19 -69 C29 -58 31 -34 28 -9 C18 -3 -18 -3 -28 -9 Z" fill="${suit}"/>
<path d="M-23 -62 C-37 -54 -42 -37 -35 -22" fill="none" stroke="${suit}" stroke-width="16" stroke-linecap="round"/>
<path d="M23 -62 C37 -54 42 -37 35 -22" fill="none" stroke="${suit}" stroke-width="16" stroke-linecap="round"/>
<path d="M-30 -56 C-40 -47 -43 -34 -39 -24" fill="none" stroke="#67e8f9" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round"/>
<rect x="-22" y="-72" width="44" height="52" rx="10" fill="${pack}"/>
<rect x="-22" y="-72" width="44" height="52" rx="10" fill="none" stroke="#ffffff" stroke-opacity="0.35"/>
<rect x="-15" y="-64" width="30" height="10" rx="3.5" fill="#56618a"/>
<rect x="-15" y="-48" width="30" height="3" rx="1.5" fill="#56618a" fill-opacity="0.75"/>
<rect x="-15" y="-41" width="21" height="3" rx="1.5" fill="#56618a" fill-opacity="0.75"/>
<circle class="blink" cx="11" cy="-33" r="2.8" fill="#22d3ee"/>
<ellipse cx="0" cy="-76" rx="18" ry="6" fill="#76829f"/>
<circle cx="-2" cy="-99" r="24" fill="${suit}"/>
<path d="M-25 -104 C-27 -91 -21 -80 -12 -77 C-19 -86 -21 -97 -16 -109 Z" fill="${visor}"/>
<path d="M-23 -101 C-23 -94 -20 -88 -15 -84" fill="none" stroke="#67e8f9" stroke-width="1.6" stroke-opacity="0.85" stroke-linecap="round"/>
<path d="M-25 -108 C-23 -118 -14 -123 -3 -124" fill="none" stroke="#67e8f9" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"/>
<ellipse cx="6" cy="-112" rx="8" ry="4" fill="#ffffff" fill-opacity="0.6" transform="rotate(-20 6 -112)"/>
<path d="M19 -70 L24 -96" stroke="#c3cbe0" stroke-width="2.2" stroke-linecap="round"/>
<circle class="blink" style="animation-delay: -0.9s" cx="24.5" cy="-98" r="2.8" fill="#f472b6"/>`;
}

/** Floating rock platform with glowing lava seams and a hover ring. Origin is the middle of the top. */
function island() {
  const top = linear("rockTop", ["#3a4166", "#1b2140"], { x2: 0, y2: 1 });
  const side = linear("rockSide", ["#262d50", "#11152c", "#06070f"], { x2: 0, y2: 1 });
  const ring = linear("hoverRing", ["#22d3ee", "#6366f1", "#c084fc"], { x2: 1, y2: 0 });
  const under = [[148, 14], [132, 32], [114, 40], [98, 56], [74, 62], [58, 76], [34, 80], [14, 90], [0, 98], [-14, 88], [-36, 82], [-56, 72], [-78, 62], [-100, 52], [-116, 38], [-134, 30], [-148, 14]];
  const sideD = `M-150 0 A150 26 0 0 0 150 0 L${under.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
  const facets = [
    [[-150, 0], [-148, 14], [-116, 38], [-96, 24]],
    [[-96, 24], [-116, 38], [-78, 62], [-52, 40]],
    [[-52, 40], [-56, 72], [-14, 88], [-8, 44]],
    [[-8, 44], [0, 98], [34, 80], [36, 42]],
    [[36, 42], [58, 76], [98, 56], [82, 30]],
    [[82, 30], [114, 40], [148, 14], [150, 0]],
  ].map((poly, i) => `<polygon points="${pts(poly)}" fill="${i % 2 ? "#363f6e" : "#1f2546"}" fill-opacity="${i % 2 ? 0.7 : 0.55}" stroke="#8b93d6" stroke-opacity="0.18" stroke-linejoin="round"/>`);
  const cracks = [
    [[-122, 30], [-106, 36], [-98, 48], [-86, 52], [-80, 60]],
    [[-106, 36], [-112, 46]],
    [[-62, 36], [-50, 44], [-52, 56], [-42, 64], [-38, 76]],
    [[-50, 44], [-32, 50]],
    [[-8, 46], [-2, 58], [-8, 70], [-2, 82], [0, 92]],
    [[28, 40], [40, 50], [36, 62], [50, 70]],
    [[40, 50], [58, 52]],
    [[86, 30], [94, 40], [90, 48], [104, 52]],
  ];
  const seam = (points, color, width, opacity) => `<polyline points="${pts(points)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const lava = cracks.map((points) => seam(points, "#f97316", 10, 0.14) + seam(points, "#fb923c", 3.4, 0.55) + seam(points, "#fff1dc", 1.1, 1));
  const pebbles = [[-96, 6, 7], [-60, -8, 5], [70, -6, 6], [104, 8, 5], [-20, 12, 4], [36, 14, 5]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n(r * 0.55)}" fill="#11152b" fill-opacity="0.7"/>`);
  return `<ellipse cx="0" cy="24" rx="190" ry="38" fill="none" stroke="${ring}" stroke-opacity="0.22" stroke-width="2"/>
<path d="M-190 24 A190 38 0 0 1 190 24" fill="none" stroke="${ring}" stroke-width="2" stroke-dasharray="14 18" class="dash"/>
<path d="${sideD}" fill="${side}"/>
${facets.join("")}
<path d="${sideD}" fill="${def("lavaGlow", `<radialGradient id="lavaGlow" cx="0.5" cy="0.95" r="0.7"><stop offset="0" stop-color="#f97316" stop-opacity="0.38"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></radialGradient>`)}"/>
<path d="M-150 0 A150 26 0 0 0 150 0" fill="none" stroke="#a5b4fc" stroke-opacity="0.3" stroke-width="5"/>
<g class="lava">${lava.join("")}</g>
<ellipse cx="0" cy="0" rx="150" ry="26" fill="${top}"/>
${pebbles.join("")}
<path d="M-150 0 A150 26 0 0 1 150 0" fill="none" stroke="#67e8f9" stroke-opacity="0.75" stroke-width="1.6"/>
<path d="M-150 0 A150 26 0 0 0 150 0" fill="none" stroke="#818cf8" stroke-opacity="0.35" stroke-width="1.2"/>
<path d="M-190 24 A190 38 0 0 0 190 24" fill="none" stroke="${ring}" stroke-width="2.2" stroke-dasharray="14 18" class="dash"/>`;
}

function heroScene(y0, end) {
  const hero = DATA.hero;
  const ix = 852;
  const iy = y0 + 240;

  planet(1094, y0 + 58, 88);

  // A light shaft under the island, static so it can run down through the button row.
  const shaft = linear("shaft", ["#38bdf8", "#6366f1"], { x2: 0, y2: 1, opacities: [0.32, 0] });
  add([ix - 120, iy + 70, ix + 120, end], `<path d="M${ix - 34} ${iy + 86} L${ix - 96} ${end - 12} H${ix + 96} L${ix + 34} ${iy + 86} Z" fill="${shaft}"/>
<ellipse cx="${ix}" cy="${iy + 104}" rx="130" ry="34" fill="${glow("underGlow", "#8b5cf6", 0.55)}"/>
<ellipse cx="${ix}" cy="${end - 18}" rx="120" ry="12" fill="${glow("shaftFloor", "#38bdf8", 0.3)}"/>`, { z: 1 });
  add([ix - 280, iy + 112, ix - 230, iy + 152], rock(ix - 254, iy + 132, 15, 41), { z: 1 });
  add([ix + 232, iy + 150, ix + 272, iy + 184], rock(ix + 252, iy + 166, 12, 43), { z: 1 });

  const code = (seedRows, typing) => codeLines(seedRows, typing);
  holoWindow(618, y0 + 116, 112, 82, 10, code([[[16, "#c084fc"], [40, "#60a5fa"], [22, "#34d399"]], [[30, "#60a5fa"], [50, "#94a3b8"]], [[12, "#f472b6"], [34, "#fbbf24"], [24, "#60a5fa"]], [[48, "#34d399"], [22, "#c084fc"]], [[24, "#60a5fa"], [46, "#94a3b8"]], [[36, "#fbbf24"], [20, "#f472b6"]]], 3), { delay: -1.4 });
  holoWindow(716, y0 + 34, 130, 100, 5, code([[[18, "#22d3ee"], [44, "#a78bfa"], [26, "#60a5fa"]], [[34, "#94a3b8"], [52, "#60a5fa"]], [[14, "#f472b6"], [40, "#34d399"]], [[56, "#c084fc"], [24, "#fbbf24"]], [[28, "#60a5fa"], [44, "#94a3b8"]], [[40, "#34d399"], [30, "#22d3ee"]], [[22, "#a78bfa"], [48, "#60a5fa"]], [[34, "#fbbf24"]]], 6), { delay: -3.1, cls: "bob" });
  holoWindow(864, y0 + 44, 82, 64, 0, (w, h) => `<g class="pulse">${useIcon("code", w / 2 - 17, 19, 34, "#67e8f9", { width: 2.6 })}</g>`, { delay: -0.6 });
  holoWindow(960, y0 + 98, 84, 108, -7, code([[[14, "#a78bfa"], [40, "#60a5fa"]], [[30, "#22d3ee"], [26, "#94a3b8"]], [[44, "#34d399"]], [[18, "#fbbf24"], [36, "#60a5fa"]], [[34, "#c084fc"], [20, "#f472b6"]], [[26, "#60a5fa"], [30, "#94a3b8"]], [[40, "#22d3ee"]], [[20, "#34d399"], [28, "#a78bfa"]], [[32, "#60a5fa"]]], 4), { delay: -2.2 });
  holoWindow(610, y0 + 222, 74, 54, 12, (w, h) => [[10, 16], [24, 26], [38, 12], [52, 22]].map(([x, bh], i) => `<rect x="${x}" y="${h - 8 - bh}" width="8" height="${bh}" rx="2" fill="${i % 2 ? "#a78bfa" : "#22d3ee"}" fill-opacity="0.85"/>`).join("") + `<polyline points="12,${h - 30} 28,${h - 36} 42,${h - 26} 58,${h - 40}" fill="none" stroke="#f0abfc" stroke-width="1.6"/>`, { delay: -4 });

  // Island, astronaut and laptop bob together; everything stays above the button row.
  const debris = [[-196, -40, 9, 31], [178, -64, 7, 33], [-170, 52, 8, 35], [204, 30, 10, 37], [-86, 82, 6, 39], [112, 78, 7, 45]]
    .map(([dx, dy, r, seed], i) => `<g class="bob-s" style="animation-delay: -${n(i * 0.8)}s">${rock(dx, dy, r, seed)}</g>`);
  const particles = Array.from({ length: 12 }, (_, i) => {
    const random = seeded(90 + i);
    const px = -130 + random() * 260;
    const py = 30 + random() * 50;
    return `<circle class="rise" style="animation-delay: -${n(random() * 5)}s" cx="${n(px)}" cy="${n(py)}" r="${n(1.2 + random() * 1.4)}" fill="${i % 2 ? "#22d3ee" : "#c084fc"}"/>`;
  });
  add([ix - 215, iy - 160, ix + 220, iy + 99], `<g class="bob" style="animation-duration: 7s"><g transform="translate(${ix} ${iy})">
${island()}
<g transform="translate(-6 2) scale(1.12)">${astronaut()}</g>
${debris.join("")}
${particles.join("")}</g></g>`, { z: 3, animated: true });

  glassNote(1044, y0 + 24, 116, 100, 9, hero.note.map((word, i) => (i < hero.note.length - 1 ? `${word} •` : word)), 15, -2.4);
  glassNote(1036, y0 + 196, 146, 112, 0, wrap(hero.callout, 15.5, 112, 500), 15.5, -0.8);
}

function hero(y0) {
  const panel = { x: 36, y: y0 + 16, w: 540, h: 540 };
  const topEnd = y0 + 340;
  const ctaEnd = y0 + 440;
  const end = y0 + 572;
  hudPanel("hero", panel.x, panel.y, panel.w, panel.h, { cut: 24 });
  const { x1, w1, x2, w2 } = heroPanel(y0, panel, y0 + 366, y0 + 452);
  heroScene(y0, end);

  const hero = DATA.hero;
  const { projects, contact } = hero.buttons;
  addRow("hero-top", y0, topEnd, [{ key: "intro", x0: 0, x1: W, href: PORTFOLIO, alt: `${hero.greeting} ${BRAND_NAME}. ${hero.roles.join(", ")}. ${hero.description}` }]);
  addRow("hero-cta", topEnd, ctaEnd, [
    { key: "left", x0: 0, x1: x1 - 7, href: PORTFOLIO, alt: "" },
    { key: "projects", x0: x1 - 7, x1: x2 - 7, href: projects.link, alt: projects.label },
    { key: "contact", x0: x2 - 7, x1: x2 + w2 + 7, href: contact.link, alt: contact.label },
    { key: "right", x0: x2 + w2 + 7, x1: W, href: PORTFOLIO, alt: "" },
  ]);
  addRow("hero-stats", ctaEnd, end, [{ key: "stats", x0: 0, x1: W, href: projects.link, alt: `${PROJECT_COUNT}+ projects, ${TECH_COUNT}+ technologies, 100% passion` }]);
  check(x1 + w1 < x2 - 7, "hero buttons overlap");
  return end;
}

// ---------------------------------------------------------------- featured cards

const CARD = { w: 278, gap: 16, margin: 20, pad: 16, top: 16, radius: 18, tile: 46, desc: 13, line: 18.5, previewH: 150, btnRowH: 54 };
const INNER = CARD.w - 2 * CARD.pad;
const CHIP = { h: 24, gap: 6, size: 11, icon: 12 };
const BTN = { h: 34, gap: 6, size: 12, icon: 14 };
const PHONE = { w: 54, h: 104 };

function chipWidth(label) {
  if (label.startsWith("+")) return Math.ceil(textWidth(label, CHIP.size, 600) + 18);
  return Math.ceil(8 + CHIP.icon + 5 + textWidth(label, CHIP.size, 500) + 9);
}

function layoutChips(labels, maxWidth) {
  let x = 0;
  let y = 0;
  let count = labels.length ? 1 : 0;
  const placed = labels.map((label) => {
    const width = chipWidth(label);
    if (x > 0 && x + width > maxWidth) {
      x = 0;
      y += CHIP.h + CHIP.gap;
      count++;
    }
    const chip = { label, more: label.startsWith("+"), icon: techIcon(label), x, y, width };
    x += width + CHIP.gap;
    return chip;
  });
  return { placed, rows: count, height: count ? y + CHIP.h : 0 };
}

/** As many badges as fit in maxRows rows, then a "+N" for the rest. */
function fitChips(tech, maxWidth, maxRows) {
  for (let shown = tech.length; shown >= 0; shown--) {
    const extra = tech.length - shown;
    const layout = layoutChips(extra ? [...tech.slice(0, shown), `+${extra}`] : tech, maxWidth);
    if (layout.rows <= maxRows) return layout;
  }
  return layoutChips([], maxWidth);
}

function chips(layout, ox, oy, a) {
  return layout.placed.map(({ label, more, icon, x, y, width }) => {
    const gx = ox + x;
    const gy = oy + y;
    if (more) {
      return `<rect x="${n(gx + 0.5)}" y="${n(gy + 0.5)}" width="${width - 1}" height="${CHIP.h - 1}" rx="7" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-dasharray="3 3"/>${text(gx + width / 2, gy + 16, label, { size: CHIP.size, weight: 600, fill: INK.muted, anchor: "middle" })}`;
    }
    const mark = icon
      ? useIcon(icon, gx + 8, gy + (CHIP.h - CHIP.icon) / 2, CHIP.icon, BRAND[icon] ?? a.light, { width: 2.2 })
      : `<circle cx="${n(gx + 8 + CHIP.icon / 2)}" cy="${n(gy + CHIP.h / 2)}" r="2.4" fill="${a.light}"/>`;
    return `<rect x="${n(gx + 0.5)}" y="${n(gy + 0.5)}" width="${width - 1}" height="${CHIP.h - 1}" rx="7" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.15"/>${mark}${text(gx + 8 + CHIP.icon + 5, gy + 16, label, { size: CHIP.size, weight: 500, fill: "#d9e1f2" })}`;
  }).join("\n");
}

function buttonWidth(kind, compact) {
  if (compact) return BTN.h;
  const spec = BUTTONS[kind];
  return Math.ceil(10 + BTN.icon + 6 + textWidth(spec.label, BTN.size, 600) + 11 + (spec.solid ? 10 : 0));
}

/** Lays out a card's link buttons, shrinking the last ones to icons if they don't fit. */
function fitButtons(p) {
  const compact = p.links.map(() => false);
  const total = () => p.links.reduce((sum, [kind], i) => sum + buttonWidth(kind, compact[i]), 0) + (p.links.length - 1) * BTN.gap;
  for (let i = p.links.length - 1; i > 0 && total() > INNER; i--) if (!BUTTONS[p.links[i][0]].solid) compact[i] = true;
  check(total() <= INNER, `${p.name}: too many links to fit on the card`);
  let x = 0;
  return p.links.map(([kind, href], i) => {
    const w = buttonWidth(kind, compact[i]);
    const button = { kind, href, compact: compact[i], x, w };
    x += w + BTN.gap;
    return button;
  });
}

function drawButton(b, x, y, a, accent) {
  const spec = BUTTONS[b.kind];
  const h = BTN.h;
  const iconX = b.compact ? x + (b.w - BTN.icon) / 2 : x + 10;
  if (spec.solid) {
    const fill = linear(`btn-${accent}`, [a.deep, a.base, a.light], { x2: 1, y2: 0 });
    const chevron = `<path d="M${x + b.w - 15} ${y + h / 2 - 4} L${x + b.w - 11} ${y + h / 2} L${x + b.w - 15} ${y + h / 2 + 4}" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `${halo(roundRect(x, y, b.w, h, 10), a.base, 1.3)}
<rect x="${x}" y="${y}" width="${b.w}" height="${h}" rx="10" fill="${fill}"/>
<path d="M${x + 10} ${y + 1.2} H${x + b.w - 10}" stroke="#ffffff" stroke-opacity="0.45" stroke-linecap="round"/>
${useIcon(spec.icon, iconX, y + (h - BTN.icon) / 2, BTN.icon, "#ffffff", { width: 2.3 })}
${text(x + 10 + BTN.icon + 6, y + h / 2 + 4.3, spec.label, { size: BTN.size, weight: 600, fill: "#ffffff" })}
${chevron}`;
  }
  return `<rect x="${n(x + 0.6)}" y="${n(y + 0.6)}" width="${n(b.w - 1.2)}" height="${n(h - 1.2)}" rx="10" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.26" stroke-width="1.2"/>
${useIcon(spec.icon, iconX, y + (h - BTN.icon) / 2, BTN.icon, "#e2e8f0", { width: 2.1 })}
${b.compact ? "" : text(x + 10 + BTN.icon + 6, y + h / 2 + 4.3, spec.label, { size: BTN.size, weight: 600, fill: "#e2e8f0" })}`;
}

function imageData(file) {
  const path = join(HERE, "thumbs", file);
  check(existsSync(path), `thumbnail "${file}" is not in scripts/featured/thumbs/`);
  const bytes = statSync(path).size;
  if (bytes > 150_000) console.warn(`warning: thumbs/${file} is ${Math.round(bytes / 1024)} KB — a ~480×320 JPEG keeps the cards light`);
  const type = { ".png": "image/png", ".webp": "image/webp" }[extname(file).toLowerCase()] ?? "image/jpeg";
  return `data:${type};base64,${readFileSync(path).toString("base64")}`;
}

/** Security dashboard for Sentra (unreleased, so there is no public screen to capture). Drawn at 176×117. */
function sentraScreen() {
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
}

/** Farm dashboard for AgroSync (its live demo sits behind a login). Drawn at 176×117. */
function agrosyncScreen() {
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
}

/** Placeholder app window for projects without a thumbnail, tinted with the project's accent. Drawn at 200×126. */
function genericScreen(p, a) {
  const points = [30, 26, 28, 20, 23, 15, 18, 11, 14].map((v, i) => `${n(54 + i * 16.8)},${60 + v}`);
  return [
    `<rect width="200" height="126" fill="#0a0f1d"/>`,
    `<rect width="38" height="126" fill="${a.deep}" fill-opacity="0.25"/>`,
    `<rect x="10" y="9" width="18" height="18" rx="5" fill="${a.base}"/>`,
    useIcon(p.icon, 13, 12, 12, "#ffffff"),
    ...[0, 1, 2, 3, 4].map((i) => `<rect x="10" y="${38 + i * 12}" width="18" height="5" rx="2.5" fill="${i === 0 ? a.base : "#1e293b"}"/>`),
    text(48, 18, p.name, { size: 8, weight: 700, fill: "#e2e8f0" }),
    ...[0, 1, 2].map((i) => `<rect x="${n(48.5 + i * 48)}" y="26.5" width="42" height="24" rx="4" fill="#ffffff" fill-opacity="0.04" stroke="${a.base}" stroke-opacity="0.35"/><rect x="${n(54 + i * 48)}" y="33" width="18" height="3" rx="1.5" fill="#64748b"/><rect x="${n(54 + i * 48)}" y="40" width="${24 - i * 4}" height="5" rx="2.5" fill="${a.light}"/>`),
    `<rect x="48.5" y="58.5" width="143" height="40" rx="4" fill="#ffffff" fill-opacity="0.03" stroke="#1e293b"/>`,
    `<path d="M${points.join(" L")} L188,98 L54,98 Z" fill="${a.base}" fill-opacity="0.18"/>`,
    `<polyline points="${points.join(" ")}" fill="none" stroke="${a.light}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...[0, 1].map((i) => `<rect x="48.5" y="${105.5 + i * 9}" width="143" height="6" rx="3" fill="#ffffff" fill-opacity="0.04"/>`),
  ].join("\n");
}

/** Browser window showing the app, with the phone version floating in front when there is one. */
function previewWindow(p, a, x, y, index) {
  const w = INNER;
  const h = CARD.previewH;
  const bar = 15;
  const clip = def(`shot-${p.slug}`, `<clipPath id="shot-${p.slug}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/></clipPath>`);
  let screen;
  if (DRAWN[p.thumbnail]) screen = `<g transform="translate(${x} ${y + bar}) scale(${n(w / 176)})">${DRAWN[p.thumbnail]()}</g>`;
  else if (p.thumbnail) screen = `<image href="${imageData(p.thumbnail)}" x="${x}" y="${y + bar}" width="${w}" height="${h - bar}" preserveAspectRatio="xMidYMin slice"/>`;
  else screen = `<g transform="translate(${x} ${y + bar}) scale(${n(w / 200)})">${genericScreen(p, a)}</g>`;
  add([x - 20, y - 20, x + w + 20, y + h + 20], `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${n(w * 0.62)}" ry="${n(h * 0.68)}" fill="${glow(`shotGlow-${p.accent}`, a.base, 0.4)}"/>`, { z: 3 });
  add([x - 2, y - 6, x + w + 2, y + h + 2], `<g class="bob-s" style="animation-delay: -${n(index * 1.3)}s">
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#070b18"/>
<g clip-path="${clip}">${screen}</g>
<path d="M${x} ${y + 9} a9 9 0 0 1 9 -9 H${x + w - 9} a9 9 0 0 1 9 9 V${y + bar} H${x} Z" fill="#121a35"/>
<circle cx="${x + 9}" cy="${y + 7.5}" r="2.2" fill="#f87171"/><circle cx="${x + 16.5}" cy="${y + 7.5}" r="2.2" fill="#fbbf24"/><circle cx="${x + 24}" cy="${y + 7.5}" r="2.2" fill="#34d399"/>
<rect x="${x + 38}" y="${y + 4.5}" width="${w - 76}" height="6" rx="3" fill="#ffffff" fill-opacity="0.08"/>
<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="8.5" fill="none" stroke="${a.light}" stroke-opacity="0.55"/>
</g>`, { z: 3, animated: true });
  if (!p.mobile) return;
  const fx = x + w - PHONE.w + 8;
  const fy = y + h - PHONE.h + 14;
  const phoneClip = def(`phone-${p.slug}`, `<clipPath id="phone-${p.slug}"><rect x="${fx + 3}" y="${fy + 3}" width="${PHONE.w - 6}" height="${PHONE.h - 6}" rx="8"/></clipPath>`);
  add([fx - 4, fy - 12, fx + PHONE.w + 4, fy + PHONE.h + 4], `<g class="bob" style="animation-delay: -${n(index * 0.9 + 0.6)}s">
<rect x="${fx - 3}" y="${fy - 3}" width="${PHONE.w + 6}" height="${PHONE.h + 6}" rx="13" fill="none" stroke="${a.base}" stroke-opacity="0.25" stroke-width="5"/>
<rect x="${fx}" y="${fy}" width="${PHONE.w}" height="${PHONE.h}" rx="11" fill="#05070d" stroke="${a.light}" stroke-opacity="0.8" stroke-width="1.4"/>
<g clip-path="${phoneClip}"><image href="${imageData(p.mobile)}" x="${fx + 3}" y="${fy + 3}" width="${PHONE.w - 6}" height="${PHONE.h - 6}" preserveAspectRatio="xMidYMin slice"/></g>
<rect x="${fx + PHONE.w / 2 - 9}" y="${fy + 5.5}" width="18" height="4" rx="2" fill="#05070d"/>
</g>`, { z: 4, animated: true });
}

/** Holo-projector the card stands on, glowing in the card's color. (cx, y) is the middle of its top. */
function pedestal(cx, y, a, accent, index) {
  const rx = 104;
  const beam = linear(`beam-${accent}`, [a.light, a.base], { x2: 0, y2: 1, opacities: [0, 0.4] });
  const side = linear("pedestalSide", ["#1d2547", "#090c1d"], { x2: 0, y2: 1 });
  const topFill = def(`pedTop-${accent}`, `<radialGradient id="pedTop-${accent}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${a.light}" stop-opacity="0.9"/><stop offset="0.55" stop-color="${a.base}" stop-opacity="0.45"/><stop offset="1" stop-color="${a.deep}" stop-opacity="0.35"/></radialGradient>`);
  const random = seeded(200 + index);
  const motes = Array.from({ length: 6 }, (_, i) => `<circle class="rise-s" style="animation-delay: -${n(random() * 3.4)}s" cx="${n(cx - 70 + random() * 140)}" cy="${n(y - 2 - random() * 4)}" r="${n(1 + random() * 1.2)}" fill="${i % 2 ? a.light : "#ffffff"}"/>`);
  // The wide floor glow spills into the neighbouring columns, so it stays still.
  add([cx - rx * 1.5, y - 2, cx + rx * 1.5, y + 46], `<ellipse cx="${cx}" cy="${y + 26}" rx="${n(rx * 1.45)}" ry="18" fill="${glow(`floor-${accent}`, a.base, 0.4)}"/>
<path d="M${cx - rx} ${y} V${y + 16} A${rx} 14 0 0 0 ${cx + rx} ${y + 16} V${y} Z" fill="${side}"/>
<path d="M${cx - rx} ${y + 16} A${rx} 14 0 0 0 ${cx + rx} ${y + 16}" fill="none" stroke="${a.base}" stroke-opacity="0.85" stroke-width="1.6"/>
<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="14" fill="${topFill}" stroke="${a.light}" stroke-width="1.6"/>`, { z: 3 });
  add([cx - rx * 1.08, y - 34, cx + rx * 1.08, y + 12], `<path class="pulse" style="animation-delay: -${index}s" d="M${n(cx - rx * 0.86)} ${y} L${n(cx - rx * 1.06)} ${y - 24} H${n(cx + rx * 1.06)} L${n(cx + rx * 0.86)} ${y} Z" fill="${beam}"/>
<ellipse class="dash" cx="${cx}" cy="${y}" rx="${n(rx * 0.84)}" ry="10.5" fill="none" stroke="#ffffff" stroke-opacity="0.65" stroke-width="1.1" stroke-dasharray="10 6"/>
<ellipse class="pulse" cx="${cx}" cy="${y}" rx="${n(rx * 0.5)}" ry="6" fill="#ffffff" fill-opacity="0.55"/>
${motes.join("")}`, { z: 3, animated: true });
}

function drawCard(p, index, x, y, L) {
  const a = ACCENTS[p.accent];
  const w = CARD.w;
  const h = L.frameH;
  const rect = `x="${x}" y="${y}" width="${w}" height="${h}" rx="${CARD.radius}"`;
  const wash = linear(`wash-${p.accent}`, [a.base, a.base], { x2: 0, y2: 1, opacities: [0.28, 0] });
  const edge = linear(`cardEdge-${p.accent}`, [a.light, a.base, a.deep], { x1: 0, y1: 0, x2: 0.35, y2: 1 });
  const tick = (d) => `<path d="${d}" fill="none" stroke="${a.light}" stroke-width="2.6" stroke-linecap="round"/>`;
  add([x - 14, y - 14, x + w + 14, y + h + 14], [
    [[16, 0.05], [9, 0.1], [3.5, 0.24]].map(([sw, o]) => `<rect ${rect} fill="none" stroke="${a.base}" stroke-width="${sw}" stroke-opacity="${o}"/>`).join(""),
    `<rect ${rect} fill="#0a1029" fill-opacity="0.95"/>`,
    `<rect ${rect} fill="${wash}"/>`,
    `<rect ${rect} fill="${SCANLINES}"/>`,
    `<rect ${rect} fill="none" stroke="${edge}" stroke-width="1.5"/>`,
    `<path d="M${x + 24} ${y + 1.2} H${x + w - 24}" stroke="#ffffff" stroke-opacity="0.22"/>`,
    tick(`M${x + 1} ${y + 40} V${y + CARD.radius} A${CARD.radius - 1} ${CARD.radius - 1} 0 0 1 ${x + CARD.radius} ${y + 1} H${x + 40}`),
    tick(`M${x + w - 1} ${y + h - 40} V${y + h - CARD.radius} A${CARD.radius - 1} ${CARD.radius - 1} 0 0 1 ${x + w - CARD.radius} ${y + h - 1} H${x + w - 40}`),
  ].join("\n"), { z: 2 });

  // Glare sweeping over the top part of the card; it stops above the seam where the chips and buttons row begins.
  const glareClip = def(`glare-${p.slug}`, `<clipPath id="glare-${p.slug}"><rect x="${x}" y="${y}" width="${w}" height="${L.chipsY - 6}" rx="${CARD.radius}"/></clipPath>`);
  const band = linear("glareBand", ["#ffffff", "#ffffff", "#ffffff"], { x2: 1, y2: 0, opacities: [0, 0.1, 0] });
  add([x, y, x + w, y + L.chipsY - 6], `<g clip-path="${glareClip}"><g class="sweep" style="animation-delay: -${n(index * 2.1)}s"><rect x="${x - 170}" y="${y - 60}" width="110" height="${L.chipsY + 114}" fill="${band}" transform="rotate(16 ${x - 115} ${y + (L.chipsY - 6) / 2})"/></g></g>`, { z: 5, animated: true });

  // Header: icon, name, subtitle and a badge or number.
  const tx = x + CARD.pad;
  const ty = y + 18;
  add([tx - 20, ty - 20, tx + CARD.tile + 20, ty + CARD.tile + 20], `<circle class="pulse" style="animation-delay: -${index}s" cx="${tx + CARD.tile / 2}" cy="${ty + CARD.tile / 2}" r="36" fill="${glow(`tileGlow-${p.accent}`, a.base, 0.6)}"/>`, { z: 3, animated: true });
  const number = String(index + 1).padStart(2, "0");
  const tag = p.badge
    ? { w: Math.ceil(textWidth(p.badge, 10.5, 700) + 20), label: p.badge }
    : { w: 32, label: number, mono: true };
  const tagX = x + w - CARD.pad - tag.w;
  const nameX = tx + CARD.tile + 12;
  add([x, y, x + w, y + 100], [
    iconTile(p.icon, tx, ty, CARD.tile, 24, accentTile(p.accent)),
    text(nameX, y + 41, p.name, { size: 19, weight: 700, spacing: -0.2, fill: INK.title, max: tagX - 8 - nameX }),
    p.subtitle ? text(nameX, y + 60, p.subtitle, { size: 11.5, fill: a.light, max: x + w - CARD.pad - nameX }) : "",
    `<rect x="${tagX}" y="${y + 18}" width="${tag.w}" height="20" rx="${tag.mono ? 6 : 10}" fill="${a.base}" fill-opacity="${tag.mono ? 0.12 : 0.22}" stroke="${a.light}" stroke-opacity="0.7"/>`,
    text(tagX + tag.w / 2, y + 32, tag.label, { size: tag.mono ? 11 : 10.5, weight: 700, fill: a.light, anchor: "middle", mono: tag.mono }),
    p.category ? `<rect x="${tx + 1}" y="${y + 82}" width="6" height="6" rx="1" fill="${a.light}" transform="rotate(45 ${tx + 4} ${y + 85})"/>${text(tx + 14, y + 89, p.category.toUpperCase(), { size: 10, weight: 600, spacing: 1.2, fill: a.light, mono: true })}` : "",
  ].join("\n"));

  add([x, y + 90, x + w, y + L.previewY], L.descriptions[index].map((line, i) => text(tx, y + L.descY + i * CARD.line, line, { size: CARD.desc, fill: INK.body, max: INNER })).join("\n"));
  previewWindow(p, a, tx, y + L.previewY, index);
  const chipRows = fitChips(p.tech, INNER, 2);
  add([tx, y + L.chipsY, x + w, y + L.chipsY + chipRows.height], chips(chipRows, tx, y + L.chipsY, a));
  pedestal(x + w / 2, y + h + 26, a, p.accent, index);
}

function featuredCards(y0) {
  const descriptions = FEATURED.map((p) => wrap(p.description, CARD.desc, INNER));
  const lines = Math.max(...descriptions.map((d) => d.length));
  const descY = 112;
  const previewY = descY + (lines - 1) * CARD.line + 16;
  const phone = FEATURED.some((p) => p.mobile) ? 14 : 0;
  const chipsY = previewY + CARD.previewH + 14 + phone;
  const btnRowY = chipsY + 2 * CHIP.h + CHIP.gap + 12;
  const frameH = btnRowY + CARD.btnRowH + 10;
  const L = { descriptions, descY, previewY, chipsY, btnRowY, frameH };
  const blockH = CARD.top + frameH + 92;
  const projectsLink = `${PORTFOLIO}/#projects`;

  let y = y0;
  for (let start = 0; start < FEATURED.length; start += 4) {
    const frameTop = y + CARD.top;
    const btnTop = frameTop + btnRowY;
    const btnBottom = btnTop + CARD.btnRowH;
    const tops = [];
    const buttons = [];
    const bottoms = [];
    for (let i = 0; i < 4; i++) {
      const x = CARD.margin + i * (CARD.w + CARD.gap);
      const colStart = i === 0 ? 0 : x - CARD.gap / 2;
      const colEnd = i === 3 ? W : x + CARD.w + CARD.gap / 2;
      const p = FEATURED[start + i];
      const key = p ? p.slug : `empty-${i}`;
      if (!p) {
        for (const list of [tops, buttons, bottoms]) list.push({ key, x0: colStart, x1: colEnd, href: projectsLink, alt: "" });
        continue;
      }
      const a = ACCENTS[p.accent];
      const primary = p.links[0][1];
      drawCard(p, start + i, x, frameTop, L);
      tops.push({ key, x0: colStart, x1: colEnd, href: primary, alt: `${p.name}${p.subtitle ? ` — ${p.subtitle}` : ""}. ${p.description}${p.tech.length ? ` Built with ${p.tech.join(", ")}.` : ""}` });
      bottoms.push({ key, x0: colStart, x1: colEnd, href: primary, alt: "" });

      const by = btnTop + (CARD.btnRowH - BTN.h) / 2;
      const laid = fitButtons(p);
      let edge = colStart;
      laid.forEach((b, j) => {
        const bx = x + CARD.pad + b.x;
        const left = j === 0 ? bx - 4 : bx - BTN.gap / 2;
        if (j === 0) buttons.push({ key: `${key}-start`, x0: edge, x1: left, href: primary, alt: "" });
        const right = j === laid.length - 1 ? bx + b.w + 4 : bx + b.w + BTN.gap / 2;
        const solid = BUTTONS[b.kind].solid;
        add([bx - 10, by - 10, bx + b.w + 10, by + BTN.h + 10], drawButton(b, bx, by, a, p.accent), { z: 4 });
        if (solid) {
          const clip = def(`sheen-${p.slug}`, `<clipPath id="sheen-${p.slug}"><rect x="${bx}" y="${by}" width="${b.w}" height="${BTN.h}" rx="10"/></clipPath>`);
          const sheen = linear("btnSheen", ["#ffffff", "#ffffff", "#ffffff"], { x2: 1, y2: 0, opacities: [0, 0.32, 0] });
          add([bx, by, bx + b.w, by + BTN.h], `<g clip-path="${clip}"><g class="sheen" style="animation-delay: -${n(start + i)}s"><rect x="${bx - 60}" y="${by - 8}" width="34" height="${BTN.h + 16}" fill="${sheen}" transform="rotate(18 ${bx - 43} ${by + BTN.h / 2})"/></g></g>`, { z: 5, animated: true });
        }
        buttons.push({ key: `${key}-${b.kind}`, x0: left, x1: right, href: b.href, alt: `${p.name}: ${BUTTONS[b.kind].label}` });
        edge = right;
      });
      if (p.team) {
        const label = `Team of ${p.team}`;
        const tw = textWidth(label, 11.5, 500);
        const rx = x + CARD.w - CARD.pad;
        check(rx - tw - 22 > edge, `${p.name}: "Team of" does not fit next to the buttons`);
        add([rx - tw - 22, by, rx, by + BTN.h], `${useIcon("users", rx - tw - 20, by + 10, 14, INK.muted)}${text(rx, by + 21.5, label, { size: 11.5, weight: 500, fill: INK.muted, anchor: "end" })}`);
      }
      buttons.push({ key: `${key}-end`, x0: edge, x1: colEnd, href: primary, alt: "" });
    }
    // The buttons row also takes in the tech badges above the buttons, so it is tall enough not to leave gaps on phones.
    const split = frameTop + chipsY - 6;
    addRow(`cards${start ? `-${start / 4 + 1}` : ""}`, y, split, tops);
    addRow(`buttons${start ? `-${start / 4 + 1}` : ""}`, split, btnBottom, buttons);
    addRow(`pedestals${start ? `-${start / 4 + 1}` : ""}`, btnBottom, y + blockH, bottoms);
    y += blockH;
  }
  return y;
}

function featuredHeader(y0) {
  const s = DATA.sections.featured;
  const H = 112;
  hudPanel("featured", 20, y0 + 14, W - 40, 84, { cut: 20 });
  badge(76, y0 + 56, "01");
  sectionTitle(120, y0 + 52, s.title, s.subtitle);
  const label = `${FEATURED.length} FEATURED  ·  ${PROJECT_COUNT} PROJECTS`;
  const lw = monoWidth(label, 12, 2);
  add([1150 - lw - 24, y0 + 40, 1150, y0 + 66], `<circle class="pulse" cx="${n(1150 - lw - 14)}" cy="${y0 + 52}" r="4" fill="#34d399"/>
${text(1150, y0 + 56, label, { size: 12, weight: 600, spacing: 2, fill: INK.sky, anchor: "end", mono: true })}`, { z: 4, animated: true });
  addRow("featured", y0, y0 + H, [{ key: "header", x0: 0, x1: W, href: `${PORTFOLIO}/#projects`, alt: `01 ${s.title} — ${s.subtitle}` }]);
  return y0 + H;
}

// ---------------------------------------------------------------- other projects

const MODULE = { h: 74, gap: 16, inset: 44, rowH: 100, tile: 46 };

function drawModule(o, index, x, y, w) {
  const a = ACCENTS[o.accent];
  const h = MODULE.h;
  const rect = `x="${x}" y="${y}" width="${n(w)}" height="${h}" rx="14"`;
  const wash = linear(`moduleWash-${o.accent}`, [a.base, a.base], { x2: 1, y2: 0, opacities: [0.24, 0] });
  const textX = x + 14 + MODULE.tile + 14;
  const arrowX = x + w - 26;
  const max = arrowX - 18 - textX;
  const name = wrap(o.name, 15, max, 700);
  const sub = o.subtitle ? wrap(o.subtitle, 12, max) : [];
  const blockH = name.length * 18 + sub.length * 15;
  const top = y + (h - blockH) / 2 + 13;
  const clip = def(`module-${o.slug}`, `<clipPath id="module-${o.slug}"><rect ${rect}/></clipPath>`);
  const band = linear("glareBand", ["#ffffff", "#ffffff", "#ffffff"], { x2: 1, y2: 0, opacities: [0, 0.1, 0] });
  add([x - 12, y - 12, x + w + 12, y + h + 12], [
    [[14, 0.05], [8, 0.09], [3, 0.2]].map(([sw, op]) => `<rect ${rect} fill="none" stroke="${a.base}" stroke-width="${sw}" stroke-opacity="${op}"/>`).join(""),
    `<rect ${rect} fill="#0b1131" fill-opacity="0.95"/>`,
    `<rect ${rect} fill="${wash}"/>`,
    `<rect ${rect} fill="none" stroke="${a.base}" stroke-opacity="0.75" stroke-width="1.3"/>`,
    `<path d="M${x + 16} ${y + 1.2} H${n(x + w - 16)}" stroke="#ffffff" stroke-opacity="0.2"/>`,
    iconTile(o.icon, x + 14, y + (h - MODULE.tile) / 2, MODULE.tile, 24, accentTile(o.accent)),
    ...name.map((line, i) => text(textX, top + i * 18, line, { size: 15, weight: 700, fill: INK.title, max })),
    ...sub.map((line, i) => text(textX, top + name.length * 18 + i * 15, line, { size: 12, fill: INK.body, max })),
    `<circle cx="${n(arrowX)}" cy="${y + h / 2}" r="13" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.28"/>`,
    useIcon("arrow", arrowX - 7, y + h / 2 - 7, 14, a.light, { width: 2.2 }),
  ].join("\n"), { z: 3 });
  add([x, y, x + w, y + h], `<circle class="pulse" style="animation-delay: -${index}s" cx="${x + 14 + MODULE.tile / 2}" cy="${y + h / 2}" r="30" fill="${glow(`tileGlow-${o.accent}`, a.base, 0.6)}" clip-path="${clip}"/>
<g clip-path="${clip}"><g class="sweep" style="animation-delay: -${n(index * 1.7 + 1)}s"><rect x="${x - 170}" y="${y - 40}" width="90" height="${h + 80}" fill="${band}" transform="rotate(16 ${x - 125} ${y + h / 2})"/></g></g>`, { z: 4, animated: true });
}

function otherProjects(y0) {
  const s = DATA.sections.others;
  const headerH = 100;
  const moduleRows = Math.ceil(OTHERS.length / 4);
  const bottomH = 56;
  const end = y0 + headerH + moduleRows * MODULE.rowH + bottomH;
  hudPanel("others", 20, y0 + 12, W - 40, end - y0 - 34, { cut: 22, colors: ["#22d3ee", "#6366f1", "#a855f7"] });
  badge(76, y0 + 56, "02");
  sectionTitle(120, y0 + 52, s.title, s.subtitle, 26);

  const label = "View all projects";
  const lw = textWidth(label, 15, 600);
  const linkRight = 1146;
  const linkLeft = linkRight - 22 - 8 - lw;
  add([linkLeft, y0 + 38, linkRight, y0 + 66], `${text(linkLeft, y0 + 57, label, { size: 15, weight: 600, fill: INK.cyan })}
${useIcon("arrow", linkRight - 20, y0 + 44, 17, INK.cyan, { width: 2.2 })}`);
  addRow("others", y0, y0 + headerH, [
    { key: "title", x0: 0, x1: linkLeft - 14, href: s.link, alt: `02 ${s.title} — ${s.subtitle}` },
    { key: "all", x0: linkLeft - 14, x1: linkRight + 14, href: s.link, alt: "View all projects" },
    { key: "end", x0: linkRight + 14, x1: W, href: s.link, alt: "" },
  ]);

  const inner = W - 2 * MODULE.inset;
  const mw = (inner - 3 * MODULE.gap) / 4;
  for (let r = 0; r < moduleRows; r++) {
    const rowY = y0 + headerH + r * MODULE.rowH;
    const tiles = [];
    for (let i = 0; i < 4; i++) {
      const o = OTHERS[r * 4 + i];
      const x = MODULE.inset + i * (mw + MODULE.gap);
      const x0 = i === 0 ? 0 : x - MODULE.gap / 2;
      const x1 = i === 3 ? W : x + mw + MODULE.gap / 2;
      if (!o) {
        tiles.push({ key: `empty-${i}`, x0, x1, href: s.link, alt: "" });
        continue;
      }
      drawModule(o, r * 4 + i, x, rowY + (MODULE.rowH - MODULE.h) / 2, mw);
      tiles.push({ key: o.slug, x0, x1, href: o.link, alt: `${o.name}${o.subtitle ? ` — ${o.subtitle}` : ""}` });
    }
    addRow(`modules${r ? `-${r + 1}` : ""}`, rowY, rowY + MODULE.rowH, tiles);
  }
  // The panel's bottom edge is too short for a row of its own, so the tech-stack tile picks it up.
  return [y0 + headerH + moduleRows * MODULE.rowH, end];
}

// ---------------------------------------------------------------- tech stack

const CONSOLE = { w: 248, rowH: 34, rowGap: 6, head: 70 };

function techConsole(group, cx, top, skew, index) {
  const a = ACCENTS[group.accent];
  const w = CONSOLE.w;
  const h = CONSOLE.head + group.tech.length * (CONSOLE.rowH + CONSOLE.rowGap) + 10;
  const x = -w / 2;
  const d = chamfer(x, 0, w, h, 16);
  const fill = linear(`console-${group.accent}`, [a.base, "#0a1029", "#080c22"], { x2: 0, y2: 1, opacities: [0.32, 0.94, 0.96] });
  const rows = group.tech.map((tech, j) => {
    const ry = CONSOLE.head + j * (CONSOLE.rowH + CONSOLE.rowGap);
    const icon = techIcon(tech);
    const mark = icon ? useIcon(icon, x + 26, ry + (CONSOLE.rowH - 17) / 2, 17, BRAND[icon] ?? a.light, { width: 2 }) : `<circle cx="${x + 34}" cy="${ry + CONSOLE.rowH / 2}" r="3" fill="${a.light}"/>`;
    return `<rect x="${x + 14}" y="${ry}" width="${w - 28}" height="${CONSOLE.rowH}" rx="8" fill="#ffffff" fill-opacity="0.05" stroke="${a.base}" stroke-opacity="0.35"/>
${mark}
${text(x + 54, ry + CONSOLE.rowH / 2 + 5, tech, { size: 14, weight: 500, fill: "#e2e8f0", max: w - 80 })}`;
  });
  const tilt = Math.abs(Math.tan((skew * Math.PI) / 180) * (w / 2));
  add([cx - w / 2 - 20, top - tilt - 30, cx + w / 2 + 20, top + h + tilt + 20], `<g class="bob" style="animation-delay: -${n(index * 1.9)}s; animation-duration: 7s"><g transform="translate(${cx} ${top}) skewY(${skew})">
${halo(d, a.base, 1.1)}
<path d="${d}" fill="${fill}"/>
<path d="${d}" fill="${SCANLINES}"/>
<path d="${d}" fill="none" stroke="${a.light}" stroke-opacity="0.85" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M${x + 22} 1.2 H${-x - 22}" stroke="#ffffff" stroke-opacity="0.25"/>
${iconTile(group.icon, x + 16, 16, 40, 21, accentTile(group.accent))}
${text(x + 66, 42, group.title, { size: n(Math.min(16.5, (16.5 * (w - 82)) / textWidth(group.title, 16.5, 700))), weight: 700, fill: INK.title })}
<path d="M${x + 14} 62 H${-x - 14}" stroke="${a.light}" stroke-opacity="0.25"/>
${rows.join("\n")}
</g></g>`, { z: 4, animated: true });
  return h;
}

function techStack(y0, from = y0) {
  const s = DATA.sections.tech;
  badge(76, y0 + 52, "03");
  sectionTitle(120, y0 + 48, s.title, s.subtitle, 28);
  const count = TECH_GROUPS.length;
  const spacing = Math.min(272, (W - 160) / Math.max(count, 1));
  const heights = TECH_GROUPS.map((group) => CONSOLE.head + group.tech.length * (CONSOLE.rowH + CONSOLE.rowGap) + 10);
  const tallest = Math.max(...heights);
  const platformY = y0 + 128 + tallest + 70;
  const end = platformY + 100;
  const cx = W / 2;

  // Platform: rim, rings and light, under the consoles.
  const rim = linear("platformRim", ["#1b2350", "#070a1a"], { x2: 0, y2: 1 });
  const ringEdge = linear("platformEdge", ["#22d3ee", "#6366f1", "#a855f7"], { x2: 1, y2: 0 });
  add([cx - 560, platformY - 100, cx + 560, platformY + 100], `<ellipse cx="${cx}" cy="${platformY + 12}" rx="560" ry="96" fill="${glow("platformGlow", "#4f46e5", 0.42)}"/>
<path d="M${cx - 470} ${platformY} A470 64 0 0 0 ${cx + 470} ${platformY} V${platformY + 16} A470 64 0 0 1 ${cx - 470} ${platformY + 16} Z" fill="${rim}"/>
<path d="M${cx - 470} ${platformY + 16} A470 64 0 0 0 ${cx + 470} ${platformY + 16}" fill="none" stroke="#6366f1" stroke-opacity="0.5" stroke-width="1.4"/>
<ellipse cx="${cx}" cy="${platformY}" rx="470" ry="64" fill="#0b1234" fill-opacity="0.92" stroke="${ringEdge}" stroke-width="2"/>
<ellipse cx="${cx}" cy="${platformY}" rx="330" ry="44" fill="none" stroke="#a78bfa" stroke-opacity="0.5" stroke-width="1.2"/>
<ellipse cx="${cx}" cy="${platformY}" rx="250" ry="32" fill="${glow("platformCore", "#22d3ee", 0.38)}"/>`, { z: 2 });
  add([cx - 410, platformY - 60, cx + 410, platformY + 60], `<ellipse class="dash" cx="${cx}" cy="${platformY}" rx="400" ry="54" fill="none" stroke="#22d3ee" stroke-opacity="0.7" stroke-width="1.6" stroke-dasharray="20 12"/>
<ellipse class="pulse" cx="${cx}" cy="${platformY}" rx="130" ry="17" fill="none" stroke="#67e8f9" stroke-width="2"/>`, { z: 2, animated: true });
  const random = seeded(77);
  const motes = Array.from({ length: 16 }, (_, i) => `<circle class="rise" style="animation-delay: -${n(random() * 5)}s" cx="${n(cx - 380 + random() * 760)}" cy="${n(platformY - random() * 20)}" r="${n(1.2 + random() * 1.4)}" fill="${i % 2 ? "#22d3ee" : "#c084fc"}"/>`);
  add([cx - 400, platformY - 110, cx + 400, platformY + 10], motes.join(""), { z: 5, animated: true });

  TECH_GROUPS.forEach((group, i) => {
    const offset = i - (count - 1) / 2;
    const gx = cx + offset * spacing;
    const top = y0 + 128 + (tallest - heights[i]) + Math.abs(offset) * 14 - (offset === 0 ? 10 : 0);
    const a = ACCENTS[group.accent];
    const beam = linear(`consoleBeam-${group.accent}`, [a.base, a.light], { x2: 0, y2: 1, opacities: [0, 0.32] });
    add([gx - 100, top + heights[i], gx + 100, platformY + 10], `<path class="pulse" style="animation-delay: -${i}s" d="M${gx - 80} ${top + heights[i] - 6} L${gx - 50} ${platformY - 4} H${gx + 50} L${gx + 80} ${top + heights[i] - 6} Z" fill="${beam}"/>
<ellipse cx="${gx}" cy="${platformY - 4}" rx="62" ry="9" fill="${glow(`consoleFoot-${group.accent}`, a.light, 0.7)}"/>`, { z: 3, animated: true });
    techConsole(group, gx, top, offset * 4, i);
  });

  addRow("tech", from, end, [{ key: "stack", x0: 0, x1: W, href: `${PORTFOLIO}/#skills`, alt: `03 ${s.title} — ${TECH_GROUPS.map((group) => `${group.title}: ${group.tech.join(", ")}`).join(". ")}.` }]);
  return end;
}

// ---------------------------------------------------------------- footer

const SOCIAL = { r: 20, step: 54 };

function footer(y0) {
  const f = DATA.footer;
  const H = 140;
  const line = linear("footerLine", ["#22d3ee", "#22d3ee", "#a855f7", "#a855f7"], { x2: 1, y2: 0, opacities: [0, 0.6, 0.6, 0] });
  const logo = linear("logo", ["#22d3ee", "#a78bfa"], { x2: 1, y2: 0.4 });
  add([40, y0 + 10, W - 40, y0 + 30], `<rect x="40" y="${y0 + 18}" width="${W - 80}" height="6" fill="${line}" fill-opacity="0.25"/><rect x="40" y="${y0 + 20}" width="${W - 80}" height="1.4" fill="${line}"/>`, { z: 2 });
  add([40, y0 + 40, 420, y0 + 110], `${useIcon("code", 44, y0 + 52, 36, logo, { width: 5.5 }).replace("<use", `<use stroke-opacity="0.2"`)}
${useIcon("code", 44, y0 + 52, 36, logo, { width: 2.4 })}
${text(94, y0 + 72, f.name, { size: 21, weight: 700, fill: INK.title })}
${text(94, y0 + 96, f.tagline, { size: 13, spacing: 0.4, fill: INK.muted })}`);

  const kinds = Object.keys(f.links);
  const firstX = 800 - ((kinds.length - 1) * SOCIAL.step) / 2;
  const tiles = [{ key: "brand", x0: 0, x1: firstX - SOCIAL.step / 2, href: PORTFOLIO, alt: `${f.name} — ${f.tagline}` }];
  const cy = y0 + 76;
  kinds.forEach((kind, i) => {
    const cx = firstX + i * SOCIAL.step;
    const color = "#e2e8f0";
    const mark = kind === "linkedin"
      ? `<rect x="${cx - 9.5}" y="${cy - 9.5}" width="19" height="19" rx="4" fill="${color}"/><text x="${cx - 6.2}" y="${cy + 5.6}" class="sans" font-size="12.5" font-weight="800" fill="#0b1020">in</text>`
      : useIcon(SOCIALS[kind].icon, cx - 10, cy - 10, 20, color, { width: 2 });
    add([cx - SOCIAL.r - 8, cy - SOCIAL.r - 8, cx + SOCIAL.r + 8, cy + SOCIAL.r + 8], `<circle cx="${cx}" cy="${cy}" r="${SOCIAL.r + 4}" fill="none" stroke="#22d3ee" stroke-opacity="0.12" stroke-width="6"/>
<circle cx="${cx}" cy="${cy}" r="${SOCIAL.r}" fill="#ffffff" fill-opacity="0.05" stroke="#22d3ee" stroke-opacity="0.45" stroke-width="1.3"/>
${mark}`);
    tiles.push({ key: kind, x0: cx - SOCIAL.step / 2, x1: cx + SOCIAL.step / 2, href: f.links[kind], alt: SOCIALS[kind].label });
  });
  const mottoX = W - 50;
  add([mottoX - 200, y0 + 52, mottoX, y0 + 104], f.motto.map((lineText, i) => {
    const tw = textWidth(lineText, 13.5);
    return `<circle class="pulse" style="animation-delay: -${i * 1.2}s" cx="${n(mottoX - tw - 10)}" cy="${y0 + 68 + i * 22}" r="3" fill="${INK.cyan}"/>${text(mottoX, y0 + 73 + i * 22, lineText, { size: 13.5, fill: INK.body, anchor: "end" })}`;
  }).join("\n"), { z: 4, animated: true });
  tiles.push({ key: "motto", x0: firstX + (kinds.length - 1) * SOCIAL.step + SOCIAL.step / 2, x1: W, href: PORTFOLIO, alt: f.motto.join(" ") });
  addRow("footer", y0, y0 + H, tiles);
  return y0 + H;
}

// ---------------------------------------------------------------- backdrop

/** Space behind everything: gradient, nebulae, stars and a few drifting asteroids. */
function backdrop(height) {
  const space = linear("space", ["#050817", "#080c23", "#070a1d", "#04060f"], { x2: 0, y2: height, user: true });
  add([0, 0, W, height], `<rect width="${W}" height="${n(height)}" fill="${space}"/>`, { z: 0 });
  const nebulae = [[1000, 120, 500, "#7c3aed", 0.36], [130, 520, 440, "#1d4ed8", 0.22], [1080, 900, 480, "#6d28d9", 0.26], [120, 1300, 420, "#0e7490", 0.2], [980, 1700, 460, "#4338ca", 0.28], [220, 2100, 440, "#7c3aed", 0.22], [1000, 2500, 460, "#1d4ed8", 0.2]]
    .filter(([, cy, r]) => cy - r < height);
  nebulae.forEach(([cx, cy, r, color, opacity], i) => {
    add([cx - r, cy - r, cx + r, cy + r], `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${glow(`nebula-${i}`, color, opacity)}"/>`, { z: 0 });
  });

  const random = seeded(11);
  const count = Math.round((height * W) / 4200);
  for (let i = 0; i < count; i++) {
    const x = random() * W;
    const y = random() * height;
    const r = 0.4 + random() ** 2 * 1.3;
    const opacity = 0.25 + random() * 0.6;
    const box = [x - r, y - r, x + r, y + r];
    const tiles = rows.flatMap((row) => row.tiles.filter((tile) => intersects(box, tileBox(row, tile))));
    const twinkle = random() < 0.25 && tiles.length === 1;
    const timing = twinkle ? ` class="tw" style="animation-delay: -${n(random() * 4)}s; animation-duration: ${n(2.4 + random() * 3)}s"` : "";
    add(box, `<circle${timing} cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#ffffff" fill-opacity="${n(opacity)}"/>`, { z: 0, animated: twinkle });
  }

  const asteroids = [[-8, 300, 44, 3], [1210, 620, 50, 5], [-16, 1000, 56, 7], [1214, 1260, 42, 9], [-10, 1720, 48, 13], [1208, 2050, 54, 17]]
    .filter(([, cy]) => cy < height);
  for (const [cx, cy, r, seed] of asteroids) add([cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4], rock(cx, cy, r, seed, 0.9), { z: 1 });
}

// ---------------------------------------------------------------- build

let y = nav(0);
y = hero(y);
y = featuredHeader(y);
y = featuredCards(y);
const [othersRowsEnd, othersEnd] = otherProjects(y);
y = techStack(othersEnd, othersRowsEnd);
const HEIGHT = footer(y);
backdrop(HEIGHT);

// Rows must stack without gaps and tiles must cover each row edge to edge. GitHub sets a 24px
// line height, so a row drawn shorter than that gets padded with page colour; 100 units stays
// above 24px down to the ~290px-wide README on a 320px phone.
const MIN_ROW = 100;
rows.forEach((row, i) => {
  if (row.y1 - row.y0 < MIN_ROW) throw new Error(`row ${row.name} is ${n(row.y1 - row.y0)} units tall; keep rows at least ${MIN_ROW} so phones don't show gaps`);
  if (i && row.y0 !== rows[i - 1].y1) throw new Error(`row ${row.name} starts at ${row.y0}, not ${rows[i - 1].y1}`);
  row.tiles.forEach((tile, j) => {
    const expected = j ? row.tiles[j - 1].x1 : 0;
    if (Math.abs(tile.x0 - expected) > 1e-6 || tile.x1 <= tile.x0) throw new Error(`row ${row.name}: tile ${tile.file} spans ${tile.x0}–${tile.x1}`);
  });
  if (Math.abs(row.tiles.at(-1).x1 - W) > 1e-6) throw new Error(`row ${row.name} ends at ${row.tiles.at(-1).x1}`);
});

// Anything that moves must sit inside a single tile, or it would tear at the seam.
const torn = layers.filter((layer) => layer.animated).flatMap((layer) => {
  const hits = rows.flatMap((row) => row.tiles.filter((tile) => intersects(layer.box, tileBox(row, tile))).map((tile) => tile.file));
  return hits.length > 1 ? [`${layer.box.map(n).join(",")}: ${hits.join(" + ")}`] : [];
});
if (torn.length) {
  console.error(`Animated parts cross tile seams:\n${torn.join("\n")}`);
  process.exit(1);
}

function tileSvg(row, tile) {
  const box = tileBox(row, tile);
  const body = layers
    .filter((layer) => intersects(layer.box, box))
    .sort((a, b) => a.z - b.z || a.order - b.order)
    .map((layer) => layer.svg)
    .join("\n");
  const [x0, y0, x1, y1] = box.map(n);
  const label = tile.alt ? ` role="img" aria-label="${attr(tile.alt)}"` : ` aria-hidden="true"`;
  // Browsers round each tile to whole pixels; preserveAspectRatio="none" stretches the drawing over
  // that box instead of letterboxing it, which would let a hairline of page show between tiles.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(x1 - x0)}" height="${n(y1 - y0)}" viewBox="${x0} ${y0} ${n(x1 - x0)} ${n(y1 - y0)}" preserveAspectRatio="none"${label}>
${tile.alt ? `<title>${esc(tile.alt)}</title>\n` : ""}<defs>
${usedDefs(body)}
</defs>
<style>
${CSS}
</style>
${body}
</svg>
`;
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
let bytes = 0;
for (const row of rows) {
  for (const tile of row.tiles) {
    const svg = tileSvg(row, tile);
    bytes += svg.length;
    writeFileSync(join(OUT_DIR, tile.file), svg);
  }
}

// ---------------------------------------------------------------- README

/** Floor so a row of percentages never sums past 100% and wraps. */
const pct = (units) => `${Math.floor((units / W) * 1e6) / 1e4}%`;

function readmeSection() {
  const lines = rows.map((row) =>
    row.tiles
      .map((tile) => `<a href="${attr(tile.href)}"><img src="${ASSET_URL}/${tile.file}" width="${pct(tile.x1 - tile.x0)}" align="top" alt="${attr(tile.alt)}"></a>`)
      .join(""));
  return `<p>\n${lines.join("<br>\n")}\n</p>`;
}

const START = "<!-- featured-work:start -->";
const END = "<!-- featured-work:end -->";
const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1) throw new Error(`README.md needs ${START} and ${END} markers`);
const note = "<!-- Generated by scripts/featured/build.mjs from scripts/featured/projects.json — edit the JSON, not this block. -->";
writeFileSync(readmePath, `${readme.slice(0, start + START.length)}\n${note}\n\n${readmeSection()}\n\n${readme.slice(end)}`);
const tileCount = rows.reduce((sum, row) => sum + row.tiles.length, 0);
console.log(`Built ${FEATURED.length} featured + ${OTHERS.length} other projects: ${tileCount} tiles (${Math.round(bytes / 1024)} KB) in assets/featured and README.md.`);
