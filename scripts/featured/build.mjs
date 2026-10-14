#!/usr/bin/env node
/**
 * Builds the animated "Featured Work" part of the profile README from projects.json.
 *
 * GitHub strips CSS and scripts from READMEs, so every block is an SVG image in
 * assets/featured/ (a light and a dark variant, switched with <picture>). Each SVG animates
 * itself with CSS — the coder scene in the hero, floating card layers, a glare sweep, a light
 * running round each border — which survives because GitHub serves the SVG as an image.
 *
 * Layout: 1200 SVG units span the README width, so widths become percentages. Rows inside a
 * <p> are align="top" images with no whitespace between them, so they stack with no gaps (the
 * "More Projects" frame is drawn across three rows). Buttons are separate images so each can
 * carry its own link.
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

/** deep/base paint tiles, borders and glows; onDark/onLight are text colors for each theme. */
const ACCENTS = {
  blue: { deep: "#1d4ed8", base: "#3b82f6", onDark: "#60a5fa", onLight: "#2563eb" },
  green: { deep: "#047857", base: "#10b981", onDark: "#34d399", onLight: "#059669" },
  indigo: { deep: "#4338ca", base: "#6366f1", onDark: "#818cf8", onLight: "#4f46e5" },
  violet: { deep: "#6d28d9", base: "#8b5cf6", onDark: "#a78bfa", onLight: "#7c3aed" },
  magenta: { deep: "#a21caf", base: "#d946ef", onDark: "#e879f9", onLight: "#c026d3" },
  amber: { deep: "#b45309", base: "#f59e0b", onDark: "#fbbf24", onLight: "#d97706" },
  teal: { deep: "#0f766e", base: "#14b8a6", onDark: "#2dd4bf", onLight: "#0d9488" },
  rose: { deep: "#be123c", base: "#f43f5e", onDark: "#fb7185", onLight: "#e11d48" },
  cyan: { deep: "#0e7490", base: "#06b6d4", onDark: "#22d3ee", onLight: "#0891b2" },
};

const THEMES = {
  dark: {
    name: "dark", glow: 1, cardTop: "#111a35", cardBottom: "#0a0f20", borderOpacity: 0.55,
    title: "#f8fafc", body: "#aeb8cc", muted: "#8a94aa", faint: "#5c6780", greeting: "#cbd5e1",
    chipFill: ["#ffffff", 0.04], chipStroke: ["#ffffff", 0.12], chipText: "#d6deea", chipIcon: "#c3cddc",
    outlineFill: ["#ffffff", 0.04], outlineStroke: ["#ffffff", 0.24], outlineText: "#e2e8f0",
    cyan: "#22d3ee", sub: "#93c5fd", gradient: ["#22d3ee", "#a78bfa"], glare: ["#ffffff", 0.1],
    frame: ["#6366f1", 0.45], note: "#cbd5e1",
  },
  light: {
    name: "light", glow: 0.55, cardTop: "#ffffff", cardBottom: "#f6f8fc", borderOpacity: 0.45,
    title: "#0f172a", body: "#475569", muted: "#64748b", faint: "#94a3b8", greeting: "#475569",
    chipFill: ["#f1f5f9", 1], chipStroke: ["#0f172a", 0.1], chipText: "#334155", chipIcon: "#475569",
    outlineFill: ["#ffffff", 1], outlineStroke: ["#0f172a", 0.2], outlineText: "#0f172a",
    cyan: "#0891b2", sub: "#1d4ed8", gradient: ["#0891b2", "#7c3aed"], glare: ["#ffffff", 0.7],
    frame: ["#6366f1", 0.35], note: "#475569",
  },
};

/** The hero is a night scene in dark mode and a dawn scene in light mode. */
const SCENES = {
  dark: {
    sky: ["#050816", "#0b1030", "#2a1552"], glow: ["#f97316", "#a855f7"], glowOpacity: 0.42,
    back: ["#3b2f7a", "#0b1030"], front: ["#1b1846", "#050816"], rock: ["#16213f", "#030712"], rim: "#38bdf8",
    overlay: "#050816", overlayOpacity: 0.97, star: "#ffffff", starOpacity: 1, border: ["#ffffff", 0.08],
    glass: ["#0ea5e9", 0.08], glassStroke: ["#38bdf8", 0.6], glassText: "#e2e8f0", glassMuted: "#94a3b8",
    card: ["#0b1020", 0.86], figure: "#060a16", cta: ["#06b6d4", "#3b82f6", "#8b5cf6"],
  },
  light: {
    sky: ["#e0f2fe", "#ede9fe", "#fde7d6"], glow: ["#fb923c", "#c084fc"], glowOpacity: 0.38,
    back: ["#a5b4fc", "#dbe4ff"], front: ["#7c83db", "#b4bcf5"], rock: ["#3b4a63", "#1e293b"], rim: "#0ea5e9",
    overlay: "#ffffff", overlayOpacity: 0.95, star: "#6366f1", starOpacity: 0.35, border: ["#0f172a", 0.08],
    glass: ["#ffffff", 0.62], glassStroke: ["#3b82f6", 0.45], glassText: "#0f172a", glassMuted: "#64748b",
    card: ["#ffffff", 0.9], figure: "#0f172a", cta: ["#0891b2", "#2563eb", "#7c3aed"],
  },
};

const SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`;
const HAND = `"Segoe Print", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive`;

const PAGE_W = 1200;
const CARD_W = 588;
const COL_GAP = 24;
const EDGE_W = 24;
const TILE_GAP = 16;
const TILE_W = (PAGE_W - 2 * EDGE_W - 3 * TILE_GAP) / 4;
const TECH_NOTE_W = 190;
const TECH_GAP = 20;

const CARD = { inset: 10, pad: 22, tile: 62, radius: 20, thumbW: 200, thumbH: 140, bar: 14, descSize: 14.5, descLine: 21, mottoW: 104 };
const PHONE = { w: 56, h: 108 };
const CHIP = { h: 28, gap: 8, size: 12.5, icon: 13 };
const LINK = { top: 6, h: 34, bottom: 12, size: 14.5, gap: 10 };
const CTA = { top: 14, h: 46, size: 15.5 };
const TILE = { inset: 6, h: 104, icon: 50 };
const SOCIAL = { w: 56, h: 100 };

// ---------------------------------------------------------------- content

const LINK_ORDER = ["live", "source", "case", "api", "docs"];
const LINKS = {
  live: { label: "Live demo", icon: "external", trail: "arrow" },
  source: { label: "Source", icon: "github", trail: "external" },
  case: { label: "Case study", icon: "book", trail: "arrow" },
  api: { label: "API", icon: "github", trail: "external" },
  docs: { label: "Docs", icon: "book", trail: "arrow" },
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
  return { ...p, slug: slugify(p.name), links, tech: p.tech ?? [], motto: p.motto ?? [] };
});

const OTHERS = DATA.others.map((o) => {
  check(o.name && o.link, "every other project needs a name and a link");
  checkLook(o);
  return { ...o, slug: slugify(o.name) };
});

const TECH_GROUPS = DATA.techStack.map((group) => {
  checkLook(group);
  check(!group.corner || PROJECT_ICONS.includes(group.corner), `${group.title}: corner icon "${group.corner}" is not one of ${PROJECT_ICONS.join(", ")}`);
  return group;
});

checkLook(DATA.hero.workingOn, "hero.workingOn");

const PROJECT_COUNT = FEATURED.length + OTHERS.length;
const TECH_COUNT = new Set(TECH_GROUPS.flatMap((group) => group.tech.map((tech) => tech.toLowerCase()))).size;

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
  return TECH_PATTERNS.find(([pattern]) => pattern.test(label))?.[1];
}

// ---------------------------------------------------------------- text measurement

// Helvetica advance widths (1/1000 em) for ASCII 32–126. The SVGs render in the viewer's
// system font, so measurements carry a safety margin and anything tight logs a warning.
const REGULAR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const OTHER_GLYPHS = { "·": 278, "•": 350, "—": 1000, "→": 1000, "°": 400 };
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
const paint = (kind, [color, opacity]) => `${kind}="${color}"${opacity < 1 ? ` ${kind}-opacity="${opacity}"` : ""}`;
const accentText = (a, t) => (t.name === "dark" ? a.onDark : a.onLight);

const BASE_CSS = `.sans { font-family: ${SANS}; }
.hand { font-family: ${HAND}; }
.float { animation: float 7s ease-in-out infinite; }
.lift { transform-box: fill-box; transform-origin: center; animation: lift 6s ease-in-out infinite; }
.bob { animation: bob 5s ease-in-out infinite; }
.bob2 { animation: bob 7.5s ease-in-out infinite; }
.pulse { animation: pulse 3.2s ease-in-out infinite; }
.twinkle { transform-box: fill-box; transform-origin: center; animation: twinkle 2.8s ease-in-out infinite; }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes lift { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(0, -7px) rotate(-0.8deg); } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
@keyframes twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.15); } }`;
const REDUCED_MOTION = `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

function svgDoc(width, height, label, defs, body, css = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}" role="img" aria-label="${attr(label)}">
  <title>${esc(label)}</title>
  <defs>
${defs}
  </defs>
  <style>
${BASE_CSS}
${css}
${REDUCED_MOTION}
  </style>
${body}
</svg>
`;
}

function text(x, y, content, { size, weight = 400, fill, anchor, spacing, max, cls = "sans", extra = "" }) {
  if (max && textWidth(content, size, weight, spacing) > max) {
    console.warn(`warning: "${content}" may not fit in ${n(max)} units`);
  }
  return `<text x="${n(x)}" y="${n(y)}" class="${cls}" font-size="${size}"${weight === 400 ? "" : ` font-weight="${weight}"`}${anchor ? ` text-anchor="${anchor}"` : ""}${spacing ? ` letter-spacing="${spacing}"` : ""} fill="${fill}"${max ? ` data-max="${n(max)}"` : ""}${extra}>${esc(content)}</text>`;
}

const iconSymbols = (names) =>
  [...new Set(names.filter(Boolean))].map((name) => `<symbol id="i-${name}" viewBox="0 0 24 24">${ICONS[name].body}</symbol>`).join("\n");

function useIcon(name, x, y, size, color, { filled = false, width = 2 } = {}) {
  const icon = ICONS[name];
  if (!icon) throw new Error(`Unknown icon: ${name}`);
  const colors = icon.kind === "stroke"
    ? `fill="${filled ? color : "none"}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="${color}"`;
  return `<use href="#i-${name}" x="${n(x)}" y="${n(y)}" width="${size}" height="${size}" ${colors}/>`;
}

function linear(id, colors, { x2 = 1, y2 = 1, fromOpacity = 1, toOpacity = 1, units = "" } = {}) {
  const stops = colors.map((color, i) => {
    const opacity = i === 0 ? fromOpacity : i === colors.length - 1 ? toOpacity : 1;
    return `<stop offset="${n(i / (colors.length - 1))}" stop-color="${color}" stop-opacity="${opacity}"/>`;
  });
  return `<linearGradient id="${id}"${units} x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.join("")}</linearGradient>`;
}

const radial = (id, color, opacity, cx, cy, r) =>
  `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"><stop offset="0" stop-color="${color}" stop-opacity="${n(opacity)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const clipRect = (id, w, h, r, x = 0, y = 0) => `<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}"/></clipPath>`;

const rectPerimeter = (w, h, r) => 2 * (w + h) - (8 - 2 * Math.PI) * r;

/** Soft neon halo: stacked strokes are far cheaper to animate than a blur filter. */
function neon(w, h, r, color, strength) {
  return [[12, 0.05], [7, 0.08], [3, 0.16]]
    .map(([width, opacity]) => `<rect width="${n(w)}" height="${n(h)}" rx="${r}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${n(opacity * strength)}"/>`)
    .join("\n");
}

/** A short bright dash that travels round the border. */
function runner(w, h, r, color, dash = 110) {
  const perimeter = rectPerimeter(w, h, r);
  return `<rect class="run" width="${n(w)}" height="${n(h)}" rx="${r}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="${dash} ${n(perimeter - dash)}"/>`;
}
const runCss = (perimeter, seconds = 7) =>
  `.run { animation: run ${seconds}s linear infinite; }\n@keyframes run { to { stroke-dashoffset: -${n(perimeter)}; } }`;

/** A diagonal band of light that sweeps across, like glare on glass. */
function glare(h, clipId) {
  return `<g clip-path="url(#${clipId})"><g class="glare"><rect x="-260" y="${n(-h)}" width="170" height="${n(h * 3)}" fill="url(#glare)" transform="rotate(18 -175 ${n(h / 2)})"/></g></g>`;
}
const glareCss = (w, seconds = 9) =>
  `.glare { animation: glare ${seconds}s ease-in-out infinite; }\n@keyframes glare { 0% { transform: translateX(0); } 60%, 100% { transform: translateX(${n(w + 560)}px); } }`;
const glareGradient = (t) =>
  `<linearGradient id="glare" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.glare[0]}" stop-opacity="0"/><stop offset="0.5" stop-color="${t.glare[0]}" stop-opacity="${t.glare[1]}"/><stop offset="1" stop-color="${t.glare[0]}" stop-opacity="0"/></linearGradient>`;

/** Bright L-shaped ticks on two corners. */
function brackets(w, h, color) {
  return `<path d="M6 26 V12 a6 6 0 0 1 6 -6 H26 M${n(w - 26)} ${n(h - 6)} H${n(w - 12)} a6 6 0 0 0 6 -6 V${n(h - 26)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-opacity="0.9"/>`;
}

function iconTile(icon, x, y, size, iconSize, gradientId = "tile") {
  const radius = n(size * 0.26);
  const inset = (size - iconSize) / 2;
  return `<rect x="${n(x)}" y="${n(y)}" width="${size}" height="${size}" rx="${radius}" fill="url(#${gradientId})"/>
<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="${size - 1}" height="${size - 1}" rx="${n(radius - 0.5)}" fill="none" stroke="#ffffff" stroke-opacity="0.22"/>
<path d="M${n(x + radius)} ${n(y + 1.5)} H${n(x + size - radius)}" stroke="#ffffff" stroke-opacity="0.35" stroke-linecap="round"/>
${useIcon(icon, x + inset, y + inset, iconSize, "#ffffff")}`;
}

function layoutChips(items, maxWidth) {
  let x = 0;
  let y = 0;
  const placed = items.map((label) => {
    const width = Math.ceil(9 + CHIP.icon + 6 + textWidth(label, CHIP.size, 500) + 11);
    if (x > 0 && x + width > maxWidth) {
      x = 0;
      y += CHIP.h + CHIP.gap;
    }
    const chip = { label, icon: techIcon(label), x, y, width };
    x += width + CHIP.gap;
    return chip;
  });
  return { placed, height: placed.length ? y + CHIP.h : 0 };
}

function chips({ placed }, ox, oy, t) {
  return placed
    .map(({ label, icon, x, y, width }) => {
      const mark = icon
        ? useIcon(icon, 9, (CHIP.h - CHIP.icon) / 2, CHIP.icon, t.chipIcon, { width: 2.2 })
        : `<circle cx="${9 + CHIP.icon / 2}" cy="${CHIP.h / 2}" r="2.5" fill="${t.chipIcon}"/>`;
      return `<g transform="translate(${n(ox + x)} ${n(oy + y)})"><rect x="0.5" y="0.5" width="${width - 1}" height="${CHIP.h - 1}" rx="8" ${paint("fill", t.chipFill)} ${paint("stroke", t.chipStroke)}/>${mark}${text(9 + CHIP.icon + 6, CHIP.h / 2 + 4.4, label, { size: CHIP.size, weight: 500, fill: t.chipText, max: width - (9 + CHIP.icon + 6) - 4 })}</g>`;
    })
    .join("\n");
}

const sparkle = (x, y, size, color, delay) =>
  `<path class="twinkle" style="animation-delay: ${delay}s" d="M${n(x)} ${n(y - size)} Q${n(x + size * 0.18)} ${n(y - size * 0.18)} ${n(x + size)} ${n(y)} Q${n(x + size * 0.18)} ${n(y + size * 0.18)} ${n(x)} ${n(y + size)} Q${n(x - size * 0.18)} ${n(y + size * 0.18)} ${n(x - size)} ${n(y)} Q${n(x - size * 0.18)} ${n(y - size * 0.18)} ${n(x)} ${n(y - size)} Z" fill="${color}"/>`;

// ---------------------------------------------------------------- thumbnails

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
    ...[0, 1, 2].map((i) => `<rect x="${n(48.5 + i * 48)}" y="26.5" width="42" height="24" rx="4" fill="#ffffff" fill-opacity="0.04" stroke="${a.base}" stroke-opacity="0.35"/><rect x="${n(54 + i * 48)}" y="33" width="18" height="3" rx="1.5" fill="#64748b"/><rect x="${n(54 + i * 48)}" y="40" width="${24 - i * 4}" height="5" rx="2.5" fill="${a.onDark}"/>`),
    `<rect x="48.5" y="58.5" width="143" height="40" rx="4" fill="#ffffff" fill-opacity="0.03" stroke="#1e293b"/>`,
    `<path d="M${points.join(" L")} L188,98 L54,98 Z" fill="${a.base}" fill-opacity="0.18"/>`,
    `<polyline points="${points.join(" ")}" fill="none" stroke="${a.onDark}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...[0, 1].map((i) => `<rect x="48.5" y="${105.5 + i * 9}" width="143" height="6" rx="3" fill="#ffffff" fill-opacity="0.04"/>`),
  ].join("\n");
}

/** Browser window (and optional phone in front of it) for a featured card. */
function thumbnail(p, a) {
  const { thumbW: W, thumbH: H, bar } = CARD;
  let screen;
  if (DRAWN[p.thumbnail]) screen = `<g transform="translate(0 ${bar}) scale(${n(W / 176)})">${DRAWN[p.thumbnail]()}</g>`;
  else if (p.thumbnail) screen = `<image href="${imageData(p.thumbnail)}" y="${bar}" width="${W}" height="${H - bar}" preserveAspectRatio="xMidYMin slice"/>`;
  else screen = `<g transform="translate(0 ${bar})">${genericScreen(p, a)}</g>`;

  const window = `<rect x="-18" y="-18" width="${W + 36}" height="${H + 36}" rx="26" fill="url(#thumbGlow)"/>
<rect width="${W}" height="${H}" rx="10" fill="#0b1020"/>
<g clip-path="url(#thumbClip)">${screen}</g>
<path d="M0 10 a10 10 0 0 1 10 -10 H${W - 10} a10 10 0 0 1 10 10 V${bar} H0 Z" fill="#141c36"/>
<circle cx="10" cy="7" r="2.2" fill="#f87171"/><circle cx="17.5" cy="7" r="2.2" fill="#fbbf24"/><circle cx="25" cy="7" r="2.2" fill="#34d399"/>
<rect x="40" y="4" width="${W - 80}" height="6" rx="3" fill="#ffffff" fill-opacity="0.08"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="9.5" fill="none" stroke="${a.base}" stroke-opacity="0.6"/>`;

  const phone = p.mobile
    ? `<rect x="-12" y="-12" width="${PHONE.w + 24}" height="${PHONE.h + 24}" rx="22" fill="url(#phoneGlow)"/>
<rect width="${PHONE.w}" height="${PHONE.h}" rx="11" fill="#05070d" stroke="${a.base}" stroke-opacity="0.75" stroke-width="1.4"/>
<g clip-path="url(#phoneClip)"><image href="${imageData(p.mobile)}" x="3" y="3" width="${PHONE.w - 6}" height="${PHONE.h - 6}" preserveAspectRatio="xMidYMin slice"/></g>
<rect x="${PHONE.w / 2 - 9}" y="5.5" width="18" height="4" rx="2" fill="#05070d"/>`
    : "";
  return { window, phone };
}

// ---------------------------------------------------------------- hero

/** Hooded coder sitting on a rock with a laptop, lit by the screen. Drawn facing right in a 200×200 box. */
function coder(s) {
  const code = [[10, "#a5f3fc"], [24, "#e0f2fe"], [16, "#c4b5fd"], [28, "#a5f3fc"], [12, "#86efac"]];
  return `<circle cx="104" cy="110" r="118" fill="url(#halo)"/>
<g class="breathe"><path d="M40 180 C 26 150, 28 116, 46 96 C 58 86, 82 84, 98 94 C 112 104, 118 128, 114 152 C 112 166, 104 176, 96 180 Z" fill="${s.figure}"/>
<path d="M46 100 C 38 84, 40 60, 50 44 L56 26 L66 33 C 74 27, 84 25, 94 27 C 106 30, 114 42, 117 56 C 120 72, 115 86, 105 95 C 92 106, 64 108, 46 100 Z" fill="${s.figure}"/>
<path d="M98 40 C 110 47, 115 62, 112 76 C 110 86, 104 93, 98 96 C 101 86, 102 70, 98 56 C 97 50, 97 45, 98 40 Z" fill="#000000" fill-opacity="0.6"/>
<path d="M96 38 C 110 44, 117 60, 113 78 C 111 87, 106 93, 99 97" fill="none" stroke="${s.rim}" stroke-opacity="0.75" stroke-width="2.2" stroke-linecap="round"/>
<path d="M104 60 C 106 66, 106 74, 103 80" fill="none" stroke="${s.rim}" stroke-opacity="0.35" stroke-width="1.6" stroke-linecap="round"/>
<path d="M98 94 C 112 104, 118 128, 114 152" fill="none" stroke="${s.rim}" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/></g>
<path d="M60 170 C 86 166, 118 160, 150 162" fill="none" stroke="${s.figure}" stroke-width="24" stroke-linecap="round"/>
<path d="M150 162 C 160 172, 164 184, 166 196" fill="none" stroke="${s.figure}" stroke-width="18" stroke-linecap="round"/>
<ellipse cx="172" cy="199" rx="13" ry="5" fill="${s.figure}"/>
<path d="M66 154 C 92 150, 120 146, 150 150" fill="none" stroke="${s.rim}" stroke-opacity="0.3" stroke-width="2" stroke-linecap="round"/>
<path d="M100 104 C 114 118, 124 132, 142 140" fill="none" stroke="${s.figure}" stroke-width="16" stroke-linecap="round"/>
<path d="M106 100 C 120 112, 130 126, 146 133" fill="none" stroke="${s.rim}" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round"/>
<circle class="flicker" cx="150" cy="126" r="70" fill="url(#screenGlow)"/>
<polygon points="118,152 186,147 188,152 120,157" fill="#1e293b"/>
<polygon points="120,152 114,106 174,100 186,147" fill="url(#screen)"/>
<g class="flicker">${code.map(([w, color], i) => `<rect x="${124 + (i % 2) * 6}" y="${113 + i * 7}" width="${w}" height="2.6" rx="1.3" fill="${color}" fill-opacity="0.9" transform="skewY(-6)"/>`).join("")}</g>`;
}

function holoPanel(x, y, w, h, skew, rows, s, { delay = 0, cls = "bob", typing = -1 } = {}) {
  const lines = rows.map((row, i) => {
    let cx = 10;
    return row.map(([width, color], j) => {
      const bar = `<rect${i === typing && j === row.length - 1 ? ` class="type"` : ""} x="${cx}" y="${22 + i * 11}" width="${width}" height="4.5" rx="2.25" fill="${color}" fill-opacity="0.85"/>`;
      cx += width + 5;
      return bar;
    }).join("");
  }).join("");
  return `<g class="${cls}" style="animation-delay: ${delay}s"><g transform="translate(${x} ${y}) skewY(${skew})">
<rect width="${w}" height="${h}" rx="10" ${paint("fill", s.glass)} ${paint("stroke", s.glassStroke)} stroke-width="1.3"/>
<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="9" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
<circle cx="10" cy="10" r="2.2" fill="#f87171"/><circle cx="17" cy="10" r="2.2" fill="#fbbf24"/><circle cx="24" cy="10" r="2.2" fill="#34d399"/>
${lines}</g></g>`;
}

const ROLES_SEPARATOR = "  •  ";

function heroSvg(t) {
  const s = SCENES[t.name];
  const hero = DATA.hero;
  const work = hero.workingOn;
  const x0 = 56;
  const [first, second] = hero.name;
  const firstWidth = textWidth(first, 72, 800, -2);
  const secondWidth = textWidth(second ?? "", 72, 800, -2);
  const desc = wrap(hero.description, 17.5, 470);
  const descY = 250;
  const statsY = descY + (desc.length - 1) * 27 + 42;
  const H = Math.max(statsY + 42 + 46, 470);
  const W = PAGE_W;
  const random = seeded(7);

  const stars = Array.from({ length: 46 }, () => {
    const x = 600 + random() * 590;
    const y = 10 + random() * 250;
    const r = 0.6 + random() * 1.1;
    return `<circle class="twinkle" style="animation-delay: -${n(random() * 3)}s; animation-duration: ${n(2 + random() * 3)}s" cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${s.star}" fill-opacity="${s.starOpacity}"/>`;
  });
  const fireflies = Array.from({ length: 10 }, (_, i) => {
    const x = 760 + random() * 250;
    const y = 250 + random() * 110;
    return `<circle class="rise" style="animation-delay: -${n(random() * 6)}s" cx="${n(x)}" cy="${n(y)}" r="${n(1.4 + random() * 1.2)}" fill="${i % 2 ? "#22d3ee" : "#c084fc"}"/>`;
  });

  const roles = hero.roles.map((role, i) => `${i ? `<tspan fill="${t.cyan}">${ROLES_SEPARATOR}</tspan>` : ""}${esc(role)}`).join("");
  const rolesWidth = textWidth(hero.roles.join(ROLES_SEPARATOR), 17);
  if (rolesWidth > 520) console.warn("warning: hero roles may not fit");

  let sx = x0;
  const stats = [["box", `${PROJECT_COUNT}+`, "Projects"], ["cpu", `${TECH_COUNT}+`, "Technologies"], ["badge", "100%", "Passion"]].map(([icon, value, label], i) => {
    const width = 42 + 14 + Math.max(textWidth(value, 19, 700), textWidth(label, 13)) + 30;
    const part = `${i ? `<path d="M${n(sx - 16)} ${statsY + 4} V${statsY + 38}" stroke="${t.faint}" stroke-opacity="0.5"/>` : ""}
<rect x="${n(sx + 0.5)}" y="${statsY + 0.5}" width="41" height="41" rx="11" fill="${t.cyan}" fill-opacity="0.1" stroke="${t.cyan}" stroke-opacity="0.45"/>
${useIcon(icon, sx + 10.5, statsY + 10.5, 20, t.cyan)}
${text(sx + 56, statsY + 18, value, { size: 19, weight: 700, fill: t.title })}
${text(sx + 56, statsY + 37, label, { size: 13, fill: t.muted })}`;
    sx += width;
    return part;
  });

  const workAccent = ACCENTS[work.accent];
  const workLines = wrap(work.detail, 11.5, 116);
  const workH = 70 + workLines.length * 14;
  const workY = H - workH - 22;

  const panels = [
    holoPanel(588, 66, 150, 104, 6, [[[18, "#c084fc"], [44, "#60a5fa"], [22, "#34d399"]], [[30, "#60a5fa"], [56, "#94a3b8"]], [[12, "#f472b6"], [36, "#fbbf24"], [28, "#60a5fa"]], [[50, "#34d399"], [24, "#c084fc"]], [[22, "#60a5fa"], [60, "#94a3b8"]], [[36, "#fbbf24"], [20, "#f472b6"]], [[44, "#c084fc"], [34, "#60a5fa"]]], s, { delay: 0, typing: 3 }),
    holoPanel(646, 214, 112, 78, 6, [[[30, "#22d3ee"], [40, "#94a3b8"]], [[18, "#a78bfa"], [50, "#60a5fa"]], [[44, "#34d399"]], [[26, "#fbbf24"], [30, "#94a3b8"]], [[38, "#60a5fa"]]], s, { delay: -2.4, cls: "bob2" }),
    holoPanel(764, 38, 128, 90, -3, [[[24, "#60a5fa"], [48, "#94a3b8"]], [[14, "#f472b6"], [40, "#22d3ee"], [20, "#a78bfa"]], [[56, "#34d399"]], [[30, "#fbbf24"], [36, "#60a5fa"]], [[20, "#a78bfa"], [50, "#94a3b8"]], [[40, "#22d3ee"]]], s, { delay: -1.2, typing: 5 }),
    holoPanel(926, 34, 154, 106, -7, [[[16, "#c084fc"], [52, "#60a5fa"], [26, "#34d399"]], [[34, "#22d3ee"], [58, "#94a3b8"]], [[24, "#fbbf24"], [40, "#60a5fa"]], [[60, "#34d399"], [22, "#f472b6"]], [[30, "#a78bfa"], [44, "#94a3b8"]], [[46, "#60a5fa"], [28, "#fbbf24"]], [[38, "#22d3ee"]]], s, { delay: -3.3, cls: "bob2", typing: 6 }),
    holoPanel(1040, 186, 100, 70, -9, [[[26, "#a78bfa"], [40, "#94a3b8"]], [[44, "#22d3ee"]], [[18, "#fbbf24"], [34, "#60a5fa"]], [[36, "#34d399"]]], s, { delay: -0.8 }),
  ];

  const defs = [
    `<clipPath id="heroClip"><rect width="${W}" height="${H}" rx="24"/></clipPath>`,
    linear("sky", s.sky, { x2: 0 }),
    linear("overlay", [s.overlay, s.overlay, s.overlay], { y2: 0, fromOpacity: s.overlayOpacity, toOpacity: 0 }),
    `<radialGradient id="horizon" gradientUnits="userSpaceOnUse" cx="1080" cy="300" r="380"><stop offset="0" stop-color="${s.glow[0]}" stop-opacity="${s.glowOpacity}"/><stop offset="0.45" stop-color="${s.glow[1]}" stop-opacity="${n(s.glowOpacity * 0.55)}"/><stop offset="1" stop-color="${s.glow[1]}" stop-opacity="0"/></radialGradient>`,
    linear("aurora", ["#22d3ee", "#6366f1", "#a855f7"], { y2: 0 }),
    linear("back", s.back, { x2: 0 }),
    linear("front", s.front, { x2: 0 }),
    linear("rock", s.rock, { x2: 0 }),
    `<radialGradient id="planet" cx="0.35" cy="0.35" r="0.8"><stop offset="0" stop-color="#bfdbfe"/><stop offset="1" stop-color="#1d4ed8"/></radialGradient>`,
    radial("halo", "#22d3ee", t.name === "dark" ? 0.16 : 0.12, 104, 110, 118),
    radial("screenGlow", "#22d3ee", 0.55, 150, 126, 70),
    linear("screen", ["#0e7490", "#22d3ee"]),
    `<linearGradient id="name" gradientUnits="userSpaceOnUse" x1="${n(x0 + firstWidth)}" y1="0" x2="${n(x0 + firstWidth + secondWidth)}" y2="0"><stop offset="0" stop-color="${t.gradient[0]}"/><stop offset="1" stop-color="${t.gradient[1]}"/></linearGradient>`,
    linear("workTile", [workAccent.deep, workAccent.base]),
    linear("progress", ["#22d3ee", "#a855f7"], { y2: 0 }),
    `<clipPath id="track"><rect x="14" y="${workH - 18}" width="154" height="5" rx="2.5"/></clipPath>`,
    iconSymbols(["box", "cpu", "badge", work.icon]),
  ].join("\n");

  const css = `.drift { animation: drift 16s ease-in-out infinite; }
.drift.slow { animation-duration: 23s; animation-direction: reverse; }
@keyframes drift { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-40px); } }
.flicker { animation: flicker 4s ease-in-out infinite; }
@keyframes flicker { 0%, 100% { opacity: 0.75; } 45% { opacity: 1; } 50% { opacity: 0.82; } 55% { opacity: 1; } }
.rise { animation: rise 6s ease-in-out infinite; }
@keyframes rise { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-46px); opacity: 0; } }
.type { transform-box: fill-box; transform-origin: left center; animation: type 3.6s steps(12) infinite; }
@keyframes type { 0% { transform: scaleX(0.05); } 70%, 100% { transform: scaleX(1); } }
.shimmer { animation: shimmer 2.8s ease-in-out infinite; }
@keyframes shimmer { 0% { transform: translateX(-70px); } 100% { transform: translateX(170px); } }
.wheel { animation: wheel 1.8s ease-in-out infinite; }
@keyframes wheel { 0% { transform: translateY(0); opacity: 1; } 70% { transform: translateY(7px); opacity: 0; } 100% { transform: translateY(0); opacity: 0; } }
.breathe { transform-box: fill-box; transform-origin: center bottom; animation: breathe 5s ease-in-out infinite; }
@keyframes breathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.015); } }`;

  const body = [
    `<g clip-path="url(#heroClip)">`,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#horizon)"/>`,
    ...stars,
    `<circle cx="742" cy="30" r="12" fill="url(#planet)"/><circle cx="742" cy="30" r="20" fill="#60a5fa" fill-opacity="0.08"/>`,
    `<g class="drift"><path d="M560 128 C 680 64, 780 158, 900 96 S 1120 44, 1240 112" fill="none" stroke="url(#aurora)" stroke-width="38" stroke-linecap="round" stroke-opacity="${t.name === "dark" ? 0.16 : 0.12}"/></g>`,
    `<g class="drift slow"><path d="M600 188 C 720 136, 840 210, 960 160 S 1140 118, 1240 170" fill="none" stroke="url(#aurora)" stroke-width="22" stroke-linecap="round" stroke-opacity="${t.name === "dark" ? 0.12 : 0.1}"/></g>`,
    `<path d="M520 ${H} L520 330 L600 300 L660 320 L720 280 L790 310 L850 270 L920 300 L990 262 L1060 296 L1120 270 L1200 300 L1200 ${H} Z" fill="url(#back)"/>`,
    `<rect x="520" y="318" width="680" height="60" fill="#ffffff" fill-opacity="${t.name === "dark" ? 0.04 : 0.18}"/>`,
    `<path d="M560 ${H} L560 362 L640 342 L700 358 L760 332 L820 352 L880 338 L960 354 L1040 332 L1110 350 L1200 338 L1200 ${H} Z" fill="url(#front)"/>`,
    `<rect width="760" height="${H}" fill="url(#overlay)"/>`,
    ...panels,
    `<path d="M690 ${H} L718 412 L760 384 L800 377 L840 371 L900 367 L960 373 L1000 387 L1030 410 L1062 ${H} Z" fill="url(#rock)"/>`,
    `<path d="M718 412 L760 384 L800 377 L840 371 L900 367 L960 373 L1000 387 L1030 410" fill="none" stroke="${s.rim}" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round"/>`,
    `<g transform="translate(758 140) scale(1.3)">${coder(s)}</g>`,
    ...fireflies,
    `<g class="bob" style="animation-delay: -2.2s"><g transform="translate(1086 66) rotate(-12)"><rect width="104" height="84" rx="12" ${paint("fill", s.glass)} ${paint("stroke", s.glassStroke)} stroke-width="1.3"/>${hero.note.map((line, i) => text(52, 27 + i * 21, line, { size: 16, fill: s.glassText, anchor: "middle", cls: "hand" })).join("")}</g></g>`,
    `<g class="bob2" style="animation-delay: -1s"><g transform="translate(1000 ${workY})">
<rect width="182" height="${workH}" rx="14" ${paint("fill", s.card)} stroke="#6366f1" stroke-opacity="0.5"/>
<circle class="pulse" cx="17" cy="19" r="3.5" fill="#22c55e"/>
${text(27, 23, "Working On", { size: 11.5, fill: s.glassMuted })}
<rect x="14" y="34" width="30" height="30" rx="8" fill="url(#workTile)"/>
${useIcon(work.icon, 21, 41, 16, "#ffffff")}
${text(54, 47, work.title, { size: 14, weight: 700, fill: s.glassText, max: 116 })}
${workLines.map((line, i) => text(54, 62 + i * 14, line, { size: 11.5, fill: s.glassMuted, max: 120 })).join("")}
<rect x="14" y="${workH - 18}" width="154" height="5" rx="2.5" fill="${s.glassMuted}" fill-opacity="0.25"/>
<g clip-path="url(#track)"><rect class="shimmer" x="14" y="${workH - 18}" width="70" height="5" rx="2.5" fill="url(#progress)"/></g>
</g></g>`,
    text(600, H - 40, "Scroll", { size: 10.5, fill: s.glassMuted, anchor: "middle" }),
    `<rect x="593" y="${H - 32}" width="14" height="22" rx="7" fill="none" stroke="${s.glassMuted}" stroke-opacity="0.8"/>`,
    `<circle class="wheel" cx="600" cy="${H - 25}" r="1.8" fill="${s.glassMuted}"/>`,
    `</g>`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="23.5" fill="none" ${paint("stroke", s.border)}/>`,
    text(x0, 92, hero.greeting, { size: 22, fill: t.greeting }),
    `<text x="${x0 - 3}" y="164" class="sans" font-size="72" font-weight="800" letter-spacing="-2" fill="${t.title}">${esc(first)}<tspan fill="url(#name)">${esc(second ?? "")}</tspan></text>`,
    `<text x="${x0}" y="204" class="sans" font-size="17" fill="${t.muted}">${roles}</text>`,
    ...desc.map((line, i) => text(x0, descY + i * 27, line, { size: 17.5, fill: t.body, max: 500 })),
    ...stats,
  ].join("\n");
  return svgDoc(W, H, `${hero.greeting} ${hero.name.join("")} — ${hero.roles.join(", ")}`, defs, body, css);
}

const ctaWidth = (kind) => Math.ceil(22 + (kind === "contact" ? 17 + 9 : 0) + textWidth(DATA.hero.buttons[kind].label, CTA.size, 600) + (kind === "projects" ? 12 + 16 : 0) + 22);

function ctaSvg(kind, t) {
  const s = SCENES[t.name];
  const label = DATA.hero.buttons[kind].label;
  const width = ctaWidth(kind);
  const y = CTA.top;
  const H = CTA.top + CTA.h + 6;
  if (kind === "projects") {
    const defs = [linear("fill", s.cta, { y2: 0 }), iconSymbols(["arrow"])].join("\n");
    const body = `<rect class="pulse" x="1.5" y="${y + 1.5}" width="${width - 3}" height="${CTA.h - 3}" rx="13" fill="none" stroke="#22d3ee" stroke-width="3" stroke-opacity="0.5"/>
<rect x="3" y="${y + 3}" width="${width - 6}" height="${CTA.h - 6}" rx="11" fill="url(#fill)"/>
<path d="M14 ${y + 4} H${width - 14}" stroke="#ffffff" stroke-opacity="0.4" stroke-linecap="round"/>
${text(22, y + CTA.h / 2 + 5.4, label, { size: CTA.size, weight: 600, fill: "#ffffff" })}
${useIcon("arrow", width - 22 - 16, y + (CTA.h - 16) / 2, 16, "#ffffff")}`;
    return svgDoc(width, H, label, defs, body);
  }
  const body = `<rect x="3.5" y="${y + 3.5}" width="${width - 7}" height="${CTA.h - 7}" rx="11" ${paint("fill", t.outlineFill)} ${paint("stroke", t.outlineStroke)}/>
${useIcon("mail", 22, y + (CTA.h - 17) / 2, 17, t.outlineText)}
${text(22 + 17 + 9, y + CTA.h / 2 + 5.4, label, { size: CTA.size, weight: 600, fill: t.outlineText })}`;
  return svgDoc(width, H, label, iconSymbols(["mail"]), body);
}

// ---------------------------------------------------------------- section headings

function selectedHeadingSvg(t) {
  const section = DATA.sections.featured;
  const [first, second] = section.title;
  const firstWidth = textWidth(`${first} `, 46, 800, -1);
  const secondWidth = textWidth(second ?? "", 46, 800, -1);
  const lines = wrap(section.subtitle, 17, 540);
  const H = 132 + (lines.length - 1) * 24 + 28;
  const defs = [
    linear("chev", t.gradient, { y2: 0 }),
    `<linearGradient id="word" gradientUnits="userSpaceOnUse" x1="${n(firstWidth)}" y1="0" x2="${n(firstWidth + secondWidth)}" y2="0"><stop offset="0" stop-color="${t.gradient[0]}"/><stop offset="1" stop-color="${t.gradient[1]}"/></linearGradient>`,
  ].join("\n");
  const body = [
    `<path d="M14 26 L4 37 L14 48 M26 26 L36 37 L26 48" fill="none" stroke="url(#chev)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    text(48, 42, section.eyebrow, { size: 13.5, weight: 700, spacing: 3, fill: t.cyan }),
    `<text x="0" y="98" class="sans" font-size="46" font-weight="800" letter-spacing="-1" fill="${t.title}">${esc(first)} <tspan fill="url(#word)">${esc(second ?? "")}</tspan></text>`,
    ...lines.map((line, i) => text(2, 132 + i * 24, line, { size: 17, fill: t.sub, max: 580 })),
  ].join("\n");
  return svgDoc(PAGE_W, H, `${section.eyebrow}: ${section.title.join(" ")}`, defs, body);
}

function techHeadingSvg(t) {
  const section = DATA.sections.tech;
  const defs = linear("bar", t.gradient, { x2: 0 });
  const body = [
    `<rect x="2" y="22" width="4" height="54" rx="2" fill="url(#bar)"/>`,
    text(22, 50, section.title, { size: 27, weight: 700, spacing: -0.3, fill: t.title }),
    text(22, 76, section.subtitle, { size: 15.5, fill: t.body }),
  ].join("\n");
  return svgDoc(PAGE_W, 96, section.title, defs, body);
}

// ---------------------------------------------------------------- featured cards

function cardLayout(p) {
  const { pad, tile, thumbW, thumbH, mottoW } = CARD;
  const w = CARD_W - 2 * CARD.inset;
  const thumbX = w - pad - thumbW;
  const thumbY = 24;
  const thumbBottom = thumbY + thumbH + (p.mobile ? 24 : 0);
  const textX = pad + tile + 18;
  const descMax = thumbX - 20 - pad;
  const lines = wrap(p.description, CARD.descSize, descMax);
  const descY = 170;
  const descBottom = descY + (lines.length - 1) * CARD.descLine + 6;
  const chipRows = layoutChips(p.tech, w - 2 * pad - mottoW - 8);
  const mottoH = p.motto.length ? 32 + p.motto.length * 16 : 0;
  const footer = Math.max(chipRows.height, mottoH);
  const height = Math.max(descBottom, thumbBottom) + 22 + footer + pad;
  return { w, thumbX, thumbY, textX, descMax, lines, descY, chipRows, mottoH, height };
}

function categoryPill(label, x, y, a, t) {
  const upper = label.toUpperCase();
  const color = accentText(a, t);
  const width = Math.ceil(24 + textWidth(upper, 11, 700, 0.8));
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="23" rx="11.5" fill="${a.base}" fill-opacity="${t.name === "dark" ? 0.14 : 0.1}" stroke="${a.base}" stroke-opacity="0.55"/>
${text(x + 12, y + 15.8, upper, { size: 11, weight: 700, spacing: 0.8, fill: color })}`;
}

function cardSvg(p, t, height, index) {
  const a = ACCENTS[p.accent];
  const L = cardLayout(p);
  const { inset, pad, tile, radius, thumbW, thumbH } = CARD;
  const w = L.w;
  const h = height - 2 * inset;
  const color = accentText(a, t);
  const thumb = thumbnail(p, a);
  const titleMax = L.thumbX - 14 - L.textX;
  const drawnIcons = DRAWN[p.thumbnail] ? ["shield", "leaf"] : [];
  const phoneX = w - pad - PHONE.w + 10;
  const phoneY = L.thumbY + thumbH - PHONE.h + 24;
  const number = String(index + 1).padStart(2, "0");
  const numberWidth = textWidth(number, 17, 700);
  const mottoTop = h - pad - L.mottoH;
  const defs = [
    linear("body", [t.cardTop, t.cardBottom]),
    radial("wash", a.base, 0.22 * t.glow, 0, 0, 380),
    radial("wash2", a.base, 0.12 * t.glow, w, h, 300),
    linear("tile", [a.deep, a.base]),
    radial("tileGlow", a.base, 0.6 * t.glow, pad + tile / 2, 64 + tile / 2, 60),
    radial("thumbGlow", a.base, 0.4 * t.glow, thumbW / 2, thumbH / 2, thumbW * 0.62),
    radial("phoneGlow", a.base, 0.45 * t.glow, PHONE.w / 2, PHONE.h / 2, PHONE.h * 0.6),
    glareGradient(t),
    clipRect("card", w, h, radius),
    clipRect("thumbClip", thumbW, thumbH, 10),
    clipRect("phoneClip", PHONE.w - 6, PHONE.h - 6, 8, 3, 3),
    iconSymbols([p.icon, ...drawnIcons, ...L.chipRows.placed.map((chip) => chip.icon)]),
  ].join("\n");
  const body = `<g transform="translate(${inset} ${inset})"><g class="float" style="animation-delay: -${n(index * 1.75)}s">
${neon(w, h, radius, a.base, t.glow)}
<rect width="${w}" height="${h}" rx="${radius}" fill="url(#body)"/>
<rect width="${w}" height="${h}" rx="${radius}" fill="url(#wash)"/>
<rect width="${w}" height="${h}" rx="${radius}" fill="url(#wash2)"/>
${glare(h, "card")}
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${radius - 0.5}" fill="none" stroke="${a.base}" stroke-opacity="${t.borderOpacity}" stroke-width="1.3"/>
${runner(w, h, radius, color)}
${brackets(w, h, color)}
${text(pad, 40, number, { size: 17, weight: 700, fill: t.title })}
${p.category ? categoryPill(p.category, pad + numberWidth + 10, 23, a, t) : ""}
<circle class="pulse" cx="${pad + tile / 2}" cy="${64 + tile / 2}" r="60" fill="url(#tileGlow)"/>
${iconTile(p.icon, pad, 64, tile, 31)}
${text(L.textX, 94, p.name, { size: 26, weight: 700, spacing: -0.3, fill: t.title, max: titleMax })}
${p.subtitle ? text(L.textX, 119, p.subtitle, { size: 15, fill: t.body, max: titleMax }) : ""}
${L.lines.map((line, i) => text(pad, L.descY + i * CARD.descLine, line, { size: CARD.descSize, fill: t.body, max: L.descMax })).join("\n")}
${chips(L.chipRows, pad, h - pad - L.chipRows.height, t)}
${p.motto.length ? `<g class="pulse">${useIcon(p.icon, w - pad - 22, mottoTop, 22, color, { width: 1.8 })}</g>
${p.motto.map((line, i) => text(w - pad, mottoTop + 44 + i * 16, line, { size: 12.5, weight: 500, fill: color, anchor: "end", max: CARD.mottoW })).join("\n")}` : ""}
<g class="lift" style="animation-delay: -${n(index * 1.3)}s"><g transform="translate(${L.thumbX} ${L.thumbY})">${thumb.window}</g></g>
${thumb.phone ? `<g class="bob" style="animation-delay: -${n(index * 0.9 + 0.6)}s"><g transform="translate(${phoneX} ${phoneY})">${thumb.phone}</g></g>` : ""}
</g></g>`;
  return svgDoc(CARD_W, height, `${number} ${p.name} — ${p.subtitle ?? ""}`, defs, body, `${runCss(rectPerimeter(w, h, radius))}\n${glareCss(w)}`);
}

const linkWidth = (kind) => Math.ceil(14 + 15 + 8 + textWidth(LINKS[kind].label, LINK.size, 600) + 7 + 13 + 14);
const linkHeight = LINK.top + LINK.h + LINK.bottom;
const linkFile = (kind, accent) => `link-${kind}-${accent}`;

/** Text-style link under a card, in the card's accent color. */
function linkSvg(kind, accent, t) {
  const link = LINKS[kind];
  const a = ACCENTS[accent];
  const color = accentText(a, t);
  const width = linkWidth(kind);
  const y = LINK.top;
  const labelWidth = textWidth(link.label, LINK.size, 600) / SAFETY;
  const body = `<rect x="0.5" y="${y + 0.5}" width="${width - 1}" height="${LINK.h - 1}" rx="10" fill="${a.base}" fill-opacity="${t.name === "dark" ? 0.08 : 0.06}" stroke="${a.base}" stroke-opacity="0.35"/>
${useIcon(link.icon, 14, y + (LINK.h - 15) / 2, 15, color)}
${text(14 + 15 + 8, y + LINK.h / 2 + 5, link.label, { size: LINK.size, weight: 600, fill: color })}
<path d="M${14 + 15 + 8} ${y + LINK.h / 2 + 8.5} H${n(14 + 15 + 8 + labelWidth)}" stroke="${color}" stroke-opacity="0.35"/>
${useIcon(link.trail, width - 14 - 13, y + (LINK.h - 13) / 2, 13, color)}`;
  return svgDoc(width, linkHeight, link.label, iconSymbols([link.icon, link.trail]), body);
}

const teamLabel = (size) => `Team of ${size}`;
const teamWidth = (size) => Math.ceil(16 + 7 + textWidth(teamLabel(size), 13.5, 500) + 2);

function teamSvg(size, t) {
  const width = teamWidth(size);
  const body = `${useIcon("users", 0, LINK.top + (LINK.h - 16) / 2, 16, t.muted)}
${text(16 + 7, LINK.top + LINK.h / 2 + 4.7, teamLabel(size), { size: 13.5, weight: 500, fill: t.muted })}`;
  return svgDoc(width, linkHeight, teamLabel(size), iconSymbols(["users"]), body);
}

// ---------------------------------------------------------------- more projects

const FRAME_TOP_H = 118;
const FRAME_BOTTOM_H = 30;

function moreTopSvg(t) {
  const section = DATA.sections.others;
  const W = PAGE_W;
  const defs = [linear("icon", t.gradient), iconSymbols(["layers", "arrow"])].join("\n");
  const body = [
    `<path d="M0.75 ${FRAME_TOP_H} V20.75 A20 20 0 0 1 20.75 0.75 H${W - 20.75} A20 20 0 0 1 ${W - 0.75} 20.75 V${FRAME_TOP_H}" fill="none" ${paint("stroke", t.frame)} stroke-width="1.5"/>`,
    `<rect x="30" y="32" width="44" height="44" rx="12" fill="${t.gradient[1]}" fill-opacity="0.12" stroke="${t.gradient[1]}" stroke-opacity="0.4"/>`,
    useIcon("layers", 40, 42, 24, t.gradient[1]),
    text(92, 56, section.title, { size: 25, weight: 700, spacing: -0.3, fill: t.title }),
    text(92, 82, section.subtitle, { size: 15.5, fill: t.body }),
    text(W - 54, 62, "View all projects", { size: 15, weight: 600, fill: t.cyan, anchor: "end" }),
    useIcon("arrow", W - 46, 49.5, 16, t.cyan),
  ].join("\n");
  return svgDoc(W, FRAME_TOP_H, `${section.title} — ${section.subtitle}`, defs, body);
}

function moreEdgeSvg(side, t) {
  const x = side === "left" ? 0.75 : EDGE_W - 0.75;
  return svgDoc(EDGE_W, TILE.h, "", "", `<path d="M${x} 0 V${TILE.h}" ${paint("stroke", t.frame)} stroke-width="1.5"/>`);
}

function moreBottomSvg(t) {
  const W = PAGE_W;
  const body = `<path d="M0.75 0 V${FRAME_BOTTOM_H - 20.75} A20 20 0 0 0 20.75 ${FRAME_BOTTOM_H - 0.75} H${W - 20.75} A20 20 0 0 0 ${W - 0.75} ${FRAME_BOTTOM_H - 20.75} V0" fill="none" ${paint("stroke", t.frame)} stroke-width="1.5"/>`;
  return svgDoc(W, FRAME_BOTTOM_H, "", "", body);
}

function tileSvg(o, t, index) {
  const a = ACCENTS[o.accent];
  const color = accentText(a, t);
  const w = TILE_W - 2 * TILE.inset;
  const h = TILE.h - 2 * TILE.inset;
  const radius = 16;
  const iconY = (h - TILE.icon) / 2;
  const textX = 14 + TILE.icon + 12;
  const arrowX = w - 24;
  const max = arrowX - 13 - 9 - textX;
  const name = wrap(o.name, 15, max, 700);
  const sub = o.subtitle ? wrap(o.subtitle, 12.5, max) : [];
  const blockHeight = name.length * 19 + sub.length * 16;
  const top = (h - blockHeight) / 2 + 13;
  const defs = [
    linear("body", [t.cardTop, t.cardBottom]),
    radial("wash", a.base, 0.24 * t.glow, 0, 0, 200),
    linear("tile", [a.deep, a.base]),
    radial("tileGlow", a.base, 0.6 * t.glow, 14 + TILE.icon / 2, h / 2, 44),
    glareGradient(t),
    clipRect("card", w, h, radius),
    iconSymbols([o.icon, "arrow"]),
  ].join("\n");
  const body = `<g transform="translate(${TILE.inset} ${TILE.inset})"><g class="float" style="animation-delay: -${n(index * 1.6)}s">
${neon(w, h, radius, a.base, t.glow * 0.8)}
<rect width="${w}" height="${h}" rx="${radius}" fill="url(#body)"/>
<rect width="${w}" height="${h}" rx="${radius}" fill="url(#wash)"/>
${glare(h, "card")}
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${radius - 0.5}" fill="none" stroke="${a.base}" stroke-opacity="${t.borderOpacity}" stroke-width="1.2"/>
${runner(w, h, radius, color, 70)}
<circle class="pulse" cx="${14 + TILE.icon / 2}" cy="${n(h / 2)}" r="44" fill="url(#tileGlow)"/>
${iconTile(o.icon, 14, iconY, TILE.icon, 25)}
${name.map((line, i) => text(textX, top + i * 19, line, { size: 15, weight: 700, fill: t.title, max })).join("\n")}
${sub.map((line, i) => text(textX, top + name.length * 19 + i * 16, line, { size: 12.5, fill: t.body, max })).join("\n")}
<circle cx="${arrowX}" cy="${n(h / 2)}" r="13" fill="none" ${paint("stroke", t.outlineStroke)}/>
${useIcon("arrow", arrowX - 7, h / 2 - 7, 14, color)}
</g></g>`;
  return svgDoc(TILE_W, TILE.h, `${o.name} — ${o.subtitle ?? ""}`, defs, body, `${runCss(rectPerimeter(w, h, radius), 6)}\n${glareCss(w, 8)}`);
}

// ---------------------------------------------------------------- tech stack

function techLayout() {
  const cardW = (PAGE_W - TECH_NOTE_W - 2 * TECH_GAP) / TECH_GROUPS.length;
  const columns = TECH_GROUPS.map((group) => {
    const lines = wrap(group.subtitle ?? "", 12.5, cardW - 86 - 36);
    const chipsY = Math.max(20 + 54, 66 + (lines.length - 1) * 17 + 6) + 18;
    const chipRows = layoutChips(group.tech, cardW - 36);
    return { group, lines, chipsY, chipRows, bottom: chipsY + chipRows.height };
  });
  const cardH = Math.max(...columns.map((column) => column.bottom)) + 20;
  return { cardW, cardH, columns };
}

function techRowSvg(t) {
  const { cardW, cardH, columns } = techLayout();
  const top = 10;
  const H = cardH + 2 * top;
  const radius = 16;
  const noteLines = wrap(DATA.sections.tech.note, 18, 150);
  const defs = [
    linear("body", [t.cardTop, t.cardBottom]),
    clipRect("card", cardW, cardH, radius),
    glareGradient(t),
    ...columns.flatMap(({ group }, i) => [
      linear(`tile-${i}`, [ACCENTS[group.accent].deep, ACCENTS[group.accent].base]),
      radial(`wash-${i}`, ACCENTS[group.accent].base, 0.24 * t.glow, cardW * 0.75, cardH + 30, 240),
    ]),
    iconSymbols(columns.flatMap(({ group, chipRows }) => [group.icon, group.corner, ...chipRows.placed.map((chip) => chip.icon)])),
  ].join("\n");
  const note = `<g transform="translate(14 ${n(H / 2 - 30)}) rotate(-8)">${noteLines.map((line, i) => text(0, i * 24, line, { size: 18, fill: t.note, cls: "hand" })).join("")}
<path d="M40 ${noteLines.length * 24 + 2} C 70 ${noteLines.length * 24 + 18}, 110 ${noteLines.length * 24 + 14}, 138 ${noteLines.length * 24 - 6}" fill="none" stroke="${t.note}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M128 ${noteLines.length * 24 - 8} L139 ${noteLines.length * 24 - 7} L136 ${noteLines.length * 24 + 4}" fill="none" stroke="${t.note}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  const cards = columns.map(({ group, lines, chipsY, chipRows }, i) => {
    const a = ACCENTS[group.accent];
    const color = accentText(a, t);
    const x = TECH_NOTE_W + i * (cardW + TECH_GAP);
    return `<g transform="translate(${n(x)} ${top})"><g class="float" style="animation-delay: -${n(i * 2.1)}s">
${neon(cardW, cardH, radius, a.base, t.glow * 0.8)}
<rect width="${n(cardW)}" height="${cardH}" rx="${radius}" fill="url(#body)"/>
<rect width="${n(cardW)}" height="${cardH}" rx="${radius}" fill="url(#wash-${i})"/>
${glare(cardH, "card")}
<rect x="0.5" y="0.5" width="${n(cardW - 1)}" height="${cardH - 1}" rx="${radius - 0.5}" fill="none" stroke="${a.base}" stroke-opacity="${t.borderOpacity}" stroke-width="1.2"/>
${runner(cardW, cardH, radius, color, 90)}
<circle class="pulse" style="animation-delay: -${i}s" cx="${18 + 27}" cy="${20 + 27}" r="46" fill="${a.base}" fill-opacity="${n(0.12 * t.glow)}"/>
${iconTile(group.icon, 18, 20, 54, 27, `tile-${i}`)}
${group.corner ? useIcon(group.corner, cardW - 34, 16, 18, color) : ""}
${text(86, 44, group.title, { size: 18, weight: 700, fill: t.title, max: cardW - 86 - 36 })}
${lines.map((line, j) => text(86, 66 + j * 17, line, { size: 12.5, fill: t.body, max: cardW - 86 - 36 })).join("\n")}
${chips(chipRows, 18, chipsY, t)}
</g></g>`;
  });
  const perimeter = rectPerimeter(cardW, cardH, radius);
  return svgDoc(PAGE_W, H, `Tech stack — ${TECH_GROUPS.map((group) => `${group.title}: ${group.tech.join(", ")}`).join(". ")}`, defs, [note, ...cards].join("\n"), `${runCss(perimeter, 8)}\n${glareCss(cardW, 10)}`);
}

// ---------------------------------------------------------------- footer

const FOOTER_LEFT_W = 520;
const FOOTER_RIGHT_W = 300;
const SOCIAL_GAP = 14;
const FOOTER_LEAD = 128;

function footerLeftSvg(t) {
  const footer = DATA.footer;
  const defs = [linear("logo", t.gradient), iconSymbols(["code"])].join("\n");
  const body = [
    `<use href="#i-code" x="4" y="30" width="40" height="40" fill="none" stroke="url(#logo)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    text(58, 50, footer.name, { size: 22, weight: 700, fill: t.title }),
    text(58, 74, footer.tagline, { size: 14, fill: t.muted }),
  ].join("\n");
  return svgDoc(FOOTER_LEFT_W, SOCIAL.h, `${footer.name} — ${footer.tagline}`, defs, body);
}

function footerRightSvg(t) {
  const [first, second] = DATA.footer.motto;
  const secondWidth = textWidth(second ?? "", 17);
  const body = [
    text(FOOTER_RIGHT_W - 4, 46, first, { size: 17, fill: t.note, anchor: "end", cls: "hand" }),
    second ? `<circle class="pulse" cx="${n(FOOTER_RIGHT_W - 4 - secondWidth - 12)}" cy="64" r="4" fill="${t.cyan}"/>` : "",
    second ? text(FOOTER_RIGHT_W - 4, 70, second, { size: 17, fill: t.note, anchor: "end", cls: "hand" }) : "",
  ].join("\n");
  return svgDoc(FOOTER_RIGHT_W, SOCIAL.h, DATA.footer.motto.join(" "), "", body);
}

const SOCIALS = {
  github: { label: "GitHub", icon: "github" },
  linkedin: { label: "LinkedIn" },
  email: { label: "Email", icon: "mail" },
};

function socialSvg(kind, t) {
  const cx = SOCIAL.w / 2;
  const cy = SOCIAL.h / 2;
  const color = t.outlineText;
  const mark = kind === "linkedin"
    ? `<rect x="${cx - 10}" y="${cy - 10}" width="20" height="20" rx="4" fill="${color}"/><text x="${cx - 6.6}" y="${cy + 6}" class="sans" font-size="13.5" font-weight="800" fill="${t.name === "dark" ? "#0b1020" : "#ffffff"}">in</text>`
    : useIcon(SOCIALS[kind].icon, cx - 10, cy - 10, 20, color);
  const body = `<circle cx="${cx}" cy="${cy}" r="22" ${paint("fill", t.outlineFill)} ${paint("stroke", t.outlineStroke)}/>
${mark}`;
  return svgDoc(SOCIAL.w, SOCIAL.h, SOCIALS[kind].label, iconSymbols(SOCIALS[kind].icon ? [SOCIALS[kind].icon] : []), body);
}

// ---------------------------------------------------------------- README markup

/** Floor so a row of percentages never sums past 100% and wraps. */
const pct = (units) => `${Math.floor((units / PAGE_W) * 1e6) / 1e4}%`;
const anchor = (href, inner) => `<a href="${attr(href)}">${inner}</a>`;
const spacer = (units) => (units > 0 ? `<img src="${ASSET_URL}/spacer.svg" width="${pct(units)}" align="top" alt="">` : "");
const block = (lines) => `<p>\n${lines.join("<br>\n")}\n</p>`;

function picture(name, units, alt) {
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${ASSET_URL}/${name}-dark.svg"><img src="${ASSET_URL}/${name}-light.svg" width="${pct(units)}" align="top" alt="${attr(alt)}"></picture>`;
}

const cardAlt = (p) =>
  `${p.name}${p.subtitle ? ` — ${p.subtitle}` : ""}. ${p.description}${p.tech.length ? ` Built with ${p.tech.join(", ")}.` : ""}`;

/** The links under a card, starting at the card's text column and ending with the team size. */
function linkGroup(p) {
  const start = CARD.inset + CARD.pad;
  const parts = [spacer(start)];
  let used = start;
  p.links.forEach(([kind, href], i) => {
    if (i) {
      parts.push(spacer(LINK.gap));
      used += LINK.gap;
    }
    parts.push(anchor(href, picture(linkFile(kind, p.accent), linkWidth(kind), `${p.name}: ${LINKS[kind].label}`)));
    used += linkWidth(kind);
  });
  if (p.team) {
    const width = teamWidth(p.team);
    parts.push(spacer(CARD_W - start - width - used), anchor(p.links[0][1], picture(`team-${p.team}`, width, teamLabel(p.team))), spacer(start));
  } else {
    parts.push(spacer(CARD_W - used));
  }
  return parts.join("");
}

function readmeSection() {
  const portfolio = DATA.portfolio;
  const hero = DATA.hero;
  const { projects, contact } = hero.buttons;

  const featured = [anchor(`${portfolio}/#projects`, picture("selected", PAGE_W, `${DATA.sections.featured.eyebrow}: ${DATA.sections.featured.title.join(" ")}`))];
  for (let i = 0; i < FEATURED.length; i += 2) {
    const [a, b] = [FEATURED[i], FEATURED[i + 1]];
    const card = (p) => anchor(p.links[0][1], picture(`card-${p.slug}`, CARD_W, cardAlt(p)));
    featured.push(card(a) + spacer(COL_GAP) + (b ? card(b) : spacer(CARD_W)));
    featured.push(linkGroup(a) + spacer(COL_GAP) + (b ? linkGroup(b) : ""));
  }

  const tiles = OTHERS.map((o, i) => (i ? spacer(TILE_GAP) : "") + anchor(o.link, picture(`other-${o.slug}`, TILE_W, `${o.name}${o.subtitle ? ` — ${o.subtitle}` : ""}`))).join("");
  const socials = Object.entries(DATA.footer.links).map(([kind, href], i) => (i ? spacer(SOCIAL_GAP) : "") + anchor(href, picture(`social-${kind}`, SOCIAL.w, SOCIALS[kind].label))).join("");
  const socialsWidth = Object.keys(DATA.footer.links).length * (SOCIAL.w + SOCIAL_GAP) - SOCIAL_GAP;

  return [
    block([
      anchor(projects.link, picture("hero", PAGE_W, `${hero.greeting} ${hero.name.join("")}. ${hero.roles.join(", ")}. ${hero.description}`)),
      spacer(56) + anchor(projects.link, picture("cta-projects", ctaWidth("projects"), projects.label)) + spacer(14) + anchor(contact.link, picture("cta-contact", ctaWidth("contact"), contact.label)),
    ]),
    block(featured),
    block([
      anchor(DATA.sections.others.link, picture("more-top", PAGE_W, `${DATA.sections.others.title} — view all projects`)),
      picture("more-edge-left", EDGE_W, "") + tiles + picture("more-edge-right", EDGE_W, ""),
      picture("more-bottom", PAGE_W, ""),
    ]),
    block([
      anchor(`${portfolio}/#skills`, picture("tech-heading", PAGE_W, DATA.sections.tech.title)),
      anchor(`${portfolio}/#skills`, picture("tech-stack", PAGE_W, `Tech stack — ${TECH_GROUPS.map((group) => `${group.title}: ${group.tech.join(", ")}`).join(". ")}.`)),
    ]),
    block([
      anchor(portfolio, picture("footer-left", FOOTER_LEFT_W, `${DATA.footer.name} — ${DATA.footer.tagline}`)) + spacer(FOOTER_LEAD) + socials +
        spacer(PAGE_W - FOOTER_LEFT_W - FOOTER_LEAD - socialsWidth - FOOTER_RIGHT_W) + picture("footer-right", FOOTER_RIGHT_W, DATA.footer.motto.join(" ")),
    ]),
  ].join("\n\n");
}

// ---------------------------------------------------------------- write

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const write = (name, svg) => writeFileSync(join(OUT_DIR, name), svg);

const cardHeight = Math.max(...FEATURED.map((p) => cardLayout(p).height)) + 2 * CARD.inset;
for (const t of Object.values(THEMES)) {
  write(`hero-${t.name}.svg`, heroSvg(t));
  write(`cta-projects-${t.name}.svg`, ctaSvg("projects", t));
  write(`cta-contact-${t.name}.svg`, ctaSvg("contact", t));
  write(`selected-${t.name}.svg`, selectedHeadingSvg(t));
  FEATURED.forEach((p, i) => write(`card-${p.slug}-${t.name}.svg`, cardSvg(p, t, cardHeight, i)));
  for (const p of FEATURED) for (const [kind] of p.links) write(`${linkFile(kind, p.accent)}-${t.name}.svg`, linkSvg(kind, p.accent, t));
  for (const size of new Set(FEATURED.map((p) => p.team).filter(Boolean))) write(`team-${size}-${t.name}.svg`, teamSvg(size, t));
  write(`more-top-${t.name}.svg`, moreTopSvg(t));
  write(`more-edge-left-${t.name}.svg`, moreEdgeSvg("left", t));
  write(`more-edge-right-${t.name}.svg`, moreEdgeSvg("right", t));
  write(`more-bottom-${t.name}.svg`, moreBottomSvg(t));
  OTHERS.forEach((o, i) => write(`other-${o.slug}-${t.name}.svg`, tileSvg(o, t, i)));
  write(`tech-heading-${t.name}.svg`, techHeadingSvg(t));
  write(`tech-stack-${t.name}.svg`, techRowSvg(t));
  write(`footer-left-${t.name}.svg`, footerLeftSvg(t));
  write(`footer-right-${t.name}.svg`, footerRightSvg(t));
  for (const kind of Object.keys(DATA.footer.links)) write(`social-${kind}-${t.name}.svg`, socialSvg(kind, t));
}
write("spacer.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="1" viewBox="0 0 100 1"/>\n`);

const START = "<!-- featured-work:start -->";
const END = "<!-- featured-work:end -->";
const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1) throw new Error(`README.md needs ${START} and ${END} markers`);
const note = "<!-- Generated by scripts/featured/build.mjs from scripts/featured/projects.json — edit the JSON, not this block. -->";
writeFileSync(readmePath, `${readme.slice(0, start + START.length)}\n${note}\n\n${readmeSection()}\n\n${readme.slice(end)}`);
console.log(`Built ${FEATURED.length} featured + ${OTHERS.length} other projects into assets/featured and README.md.`);
