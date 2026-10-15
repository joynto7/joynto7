#!/usr/bin/env node
/**
 * Builds the animated "Featured Work" part of the profile README from projects.json.
 *
 * GitHub strips CSS and scripts from READMEs, so every block is an SVG image in
 * assets/featured/ (a light and a dark variant, switched with <picture>). Each SVG animates
 * itself with CSS — floating layers at different depths, a glare sweep, a light running
 * round the border — which survives because GitHub serves the SVG as an image.
 *
 * Layout: 1200 SVG units span the README width, so widths become percentages. All rows
 * after the hero sit in one <p> as align="top" images with no whitespace between them, so
 * they stack with no gaps and the timeline rail on the left reads as one line. Buttons are
 * separate images so each can carry its own link.
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
    title: "#f8fafc", body: "#aeb8cc", muted: "#8a94aa", faint: "#5c6780",
    chipFill: ["#ffffff", 0.04], chipStroke: ["#ffffff", 0.12], chipText: "#d6deea", chipIcon: "#c3cddc",
    outlineFill: ["#ffffff", 0.03], outlineStroke: ["#ffffff", 0.22], outlineText: "#e2e8f0",
    rail: ["#3b82f6", "#8b5cf6"], railOpacity: 0.65, circleFill: "#0b1020",
    eyebrow: "#60a5fa", gradient: ["#60a5fa", "#a78bfa"], glare: ["#ffffff", 0.1],
    panel: "#0d1530", panelStroke: 0.55, note: "#cbd5e1", mountains: ["#1e293b", "#111827"],
  },
  light: {
    name: "light", glow: 0.55, cardTop: "#ffffff", cardBottom: "#f6f8fc", borderOpacity: 0.45,
    title: "#0f172a", body: "#475569", muted: "#64748b", faint: "#94a3b8",
    chipFill: ["#f1f5f9", 1], chipStroke: ["#0f172a", 0.1], chipText: "#334155", chipIcon: "#475569",
    outlineFill: ["#ffffff", 1], outlineStroke: ["#0f172a", 0.2], outlineText: "#0f172a",
    rail: ["#2563eb", "#7c3aed"], railOpacity: 0.45, circleFill: "#ffffff",
    eyebrow: "#2563eb", gradient: ["#2563eb", "#7c3aed"], glare: ["#ffffff", 0.7],
    panel: "#ffffff", panelStroke: 0.4, note: "#475569", mountains: ["#cbd5e1", "#e2e8f0"],
  },
};

const SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`;
const HAND = `"Segoe Print", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive`;

const PAGE_W = 1200;
const RAIL_W = 72;
const COL_GAP = 20;
const CARD_W = (PAGE_W - RAIL_W - COL_GAP) / 2;
const TILE_GAP = 14;
const TILE_W = Math.floor((PAGE_W - RAIL_W - 3 * TILE_GAP) / 4);
const PANEL_W = PAGE_W - RAIL_W;
const SOCIAL_W = 56;
const SOCIAL_GAP = 14;

const CARD = { inset: 10, pad: 20, tile: 60, radius: 20, thumbW: 196, thumbH: 136, bar: 14, descSize: 14.5, descLine: 21 };
const PHONE = { w: 56, h: 108 };
const CHIP = { h: 28, gap: 8, size: 12.5, icon: 13 };
const BTN = { top: 8, h: 40, bottom: 16, size: 14.5, gap: 10 };
const TILE = { inset: 8, h: 112, icon: 44 };

// ---------------------------------------------------------------- content

const LINK_ORDER = ["live", "source", "case", "api", "docs"];
const BUTTONS = {
  live: { label: "Live demo", icon: "arrow", primary: true },
  source: { label: "Source", icon: "github" },
  case: { label: "Case study", icon: "book" },
  api: { label: "API", icon: "github" },
  docs: { label: "Docs", icon: "book" },
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

function checkLook(item) {
  check(ACCENTS[item.accent], `${item.name ?? item.title}: accent "${item.accent}" is not one of ${Object.keys(ACCENTS).join(", ")}`);
  check(PROJECT_ICONS.includes(item.icon), `${item.name ?? item.title}: icon "${item.icon}" is not one of ${PROJECT_ICONS.join(", ")}`);
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
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (value) => esc(value).replace(/"/g, "&quot;");
const paint = (kind, [color, opacity]) => `${kind}="${color}"${opacity < 1 ? ` ${kind}-opacity="${opacity}"` : ""}`;
const accentText = (a, t) => (t.name === "dark" ? a.onDark : a.onLight);

const BASE_CSS = `.sans { font-family: ${SANS}; }
.hand { font-family: ${HAND}; }
.float { animation: float 7s ease-in-out infinite; }
.lift { transform-box: fill-box; transform-origin: center; animation: lift 6s ease-in-out infinite; }
.bob { animation: bob 5s ease-in-out infinite; }
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

const linear = (id, [from, to], { x2 = 1, y2 = 1, fromOpacity = 1, toOpacity = 1 } = {}) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${from}" stop-opacity="${fromOpacity}"/><stop offset="1" stop-color="${to}" stop-opacity="${toOpacity}"/></linearGradient>`;

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

/** Placeholder app window for projects without a thumbnail, tinted with the project's accent. Drawn at 196×122. */
function genericScreen(p, a) {
  const points = [30, 26, 28, 20, 23, 15, 18, 11, 14].map((v, i) => `${n(52 + i * 16.5)},${58 + v}`);
  return [
    `<rect width="196" height="122" fill="#0a0f1d"/>`,
    `<rect width="38" height="122" fill="${a.deep}" fill-opacity="0.25"/>`,
    `<rect x="10" y="9" width="18" height="18" rx="5" fill="${a.base}"/>`,
    useIcon(p.icon, 13, 12, 12, "#ffffff"),
    ...[0, 1, 2, 3, 4].map((i) => `<rect x="10" y="${38 + i * 12}" width="18" height="5" rx="2.5" fill="${i === 0 ? a.base : "#1e293b"}"/>`),
    text(48, 18, p.name, { size: 8, weight: 700, fill: "#e2e8f0" }),
    ...[0, 1, 2].map((i) => `<rect x="${n(48.5 + i * 47)}" y="26.5" width="41" height="24" rx="4" fill="#ffffff" fill-opacity="0.04" stroke="${a.base}" stroke-opacity="0.35"/><rect x="${n(54 + i * 47)}" y="33" width="18" height="3" rx="1.5" fill="#64748b"/><rect x="${n(54 + i * 47)}" y="40" width="${24 - i * 4}" height="5" rx="2.5" fill="${a.onDark}"/>`),
    `<rect x="48.5" y="56.5" width="139" height="40" rx="4" fill="#ffffff" fill-opacity="0.03" stroke="#1e293b"/>`,
    `<path d="M${points.join(" L")} L184,96 L52,96 Z" fill="${a.base}" fill-opacity="0.18"/>`,
    `<polyline points="${points.join(" ")}" fill="none" stroke="${a.onDark}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    ...[0, 1].map((i) => `<rect x="48.5" y="${102.5 + i * 9}" width="139" height="6" rx="3" fill="#ffffff" fill-opacity="0.04"/>`),
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

function heroSvg(t) {
  const hero = DATA.hero;
  const eyebrowWidth = textWidth(hero.eyebrow, 14, 700, 4);
  const firstWidth = textWidth("Featured ", 66, 800, -1.6);
  const wordWidth = textWidth("Work", 66, 800, -1.6);
  const lines = wrap(hero.description, 20, 540);
  const descY = 178;
  const statsY = descY + (lines.length - 1) * 28 + 44;
  const height = statsY + 44 + 52;

  const stats = [["box", `${PROJECT_COUNT}+`, "Projects"], ["cpu", `${TECH_COUNT}+`, "Technologies"], ["badge", "100%", "Passion"]];
  let x = 4;
  const statParts = stats.map(([icon, value, label], i) => {
    const width = 44 + 14 + Math.max(textWidth(value, 20, 700), textWidth(label, 13.5)) + 30;
    const part = `${i ? `<path d="M${n(x - 16)} ${statsY + 4} V${statsY + 40}" stroke="${t.faint}" stroke-opacity="0.5"/>` : ""}
<rect x="${n(x + 0.5)}" y="${statsY + 0.5}" width="43" height="43" rx="11" fill="${t.eyebrow}" fill-opacity="0.1" stroke="${t.eyebrow}" stroke-opacity="0.45"/>
${useIcon(icon, x + 11, statsY + 11, 22, t.eyebrow)}
${text(x + 58, statsY + 19, value, { size: 20, weight: 700, fill: t.title })}
${text(x + 58, statsY + 39, label, { size: 13.5, fill: t.muted })}`;
    x += width;
    return part;
  });

  const panel = (px, py, w, h, content, cls, delay, stroke = "#3b82f6") =>
    `<g class="${cls}" style="animation-delay: ${delay}s"><g transform="translate(${px} ${py}) skewY(-6)">
<rect width="${w}" height="${h}" rx="12" fill="${t.panel}" fill-opacity="0.94" stroke="${stroke}" stroke-opacity="${t.panelStroke}" stroke-width="1.4"/>
${content}</g></g>`;

  const codeRows = [[[18, "#c084fc"], [46, "#60a5fa"], [24, "#34d399"]], [[30, "#60a5fa"], [60, "#94a3b8"]], [[12, "#f472b6"], [38, "#fbbf24"], [30, "#60a5fa"]],
    [[52, "#34d399"], [26, "#c084fc"]], [[20, "#60a5fa"], [70, "#94a3b8"]], [[36, "#fbbf24"], [22, "#f472b6"], [28, "#34d399"]], [[44, "#c084fc"], [40, "#60a5fa"]], [[26, "#94a3b8"], [34, "#34d399"]]];
  const code = `<circle cx="16" cy="14" r="3" fill="#f87171"/><circle cx="26" cy="14" r="3" fill="#fbbf24"/><circle cx="36" cy="14" r="3" fill="#34d399"/>
${codeRows.map((row, i) => {
  let cx = 30;
  return `<circle cx="17" cy="${36 + i * 14}" r="1.6" fill="${t.faint}"/>` + row.map(([w, color]) => {
    const bar = `<rect x="${cx}" y="${33 + i * 14}" width="${w}" height="6" rx="3" fill="${color}" fill-opacity="0.9"/>`;
    cx += w + 6;
    return bar;
  }).join("");
}).join("\n")}`;
  const chart = `${[18, 30, 22, 38, 28].map((h, i) => `<rect x="${14 + i * 13}" y="${56 - h}" width="8" height="${h}" rx="2" fill="url(#bars)"/>`).join("")}
<rect x="12" y="10" width="34" height="5" rx="2.5" fill="${t.faint}"/>`;
  const list = [0, 1, 2, 3].map((i) => `<circle cx="18" cy="${18 + i * 19}" r="5" fill="${["#60a5fa", "#a78bfa", "#34d399", "#f472b6"][i]}" fill-opacity="0.85"/><rect x="30" y="${14 + i * 19}" width="${80 - i * 9}" height="4" rx="2" fill="${t.faint}"/><rect x="30" y="${21 + i * 19}" width="${50 - i * 5}" height="3" rx="1.5" fill="${t.faint}" fill-opacity="0.6"/>`).join("");
  const front = `<rect x="12" y="12" width="60" height="6" rx="3" fill="${t.title}" fill-opacity="0.75"/>
<rect x="12" y="24" width="40" height="4" rx="2" fill="${t.faint}"/>
<path d="M12 84 L36 70 L58 76 L82 56 L104 62 L128 44 L150 50" fill="none" stroke="#34d399" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 84 L36 70 L58 76 L82 56 L104 62 L128 44 L150 50 V96 H12 Z" fill="#34d399" fill-opacity="0.14"/>
<rect x="116" y="12" width="36" height="16" rx="8" fill="#3b82f6" fill-opacity="0.85"/><circle cx="144" cy="20" r="5" fill="#ffffff"/>`;

  const note = wrap(hero.note, 18, 128);
  const defs = [
    `<linearGradient id="word" gradientUnits="userSpaceOnUse" x1="${n(firstWidth)}" y1="0" x2="${n(firstWidth + wordWidth)}" y2="0"><stop offset="0" stop-color="${t.gradient[0]}"/><stop offset="1" stop-color="${t.gradient[1]}"/></linearGradient>`,
    linear("rule", [t.eyebrow, t.eyebrow], { y2: 0, toOpacity: 0 }),
    linear("ring", ["#3b82f6", "#a855f7"], { y2: 0 }),
    linear("codeTile", ["#1d4ed8", "#6366f1"]),
    linear("bars", ["#a78bfa", "#3b82f6"], { x2: 0 }),
    linear("prismA", ["#c4b5fd", "#8b5cf6"]),
    linear("prismB", ["#7c3aed", "#4c1d95"]),
    linear("prismC", ["#a78bfa", "#6d28d9"], { x2: 0 }),
    radial("platform", "#3b82f6", 0.32 * t.glow + 0.08, 905, 282, 260),
    radial("tileGlow", "#6366f1", 0.55, 932, 78, 70),
    radial("prismGlow", "#a855f7", 0.5, 1052, 236, 70),
    iconSymbols(["box", "cpu", "badge", "code"]),
  ].join("\n");

  const body = [
    text(4, 44, hero.eyebrow, { size: 14, weight: 700, spacing: 4, fill: t.eyebrow }),
    `<rect x="${n(4 + eyebrowWidth + 12)}" y="38.5" width="60" height="2" rx="1" fill="url(#rule)"/>`,
    `<text x="0" y="126" class="sans" font-size="66" font-weight="800" letter-spacing="-1.6" fill="${t.title}">Featured <tspan fill="url(#word)">Work</tspan></text>`,
    ...lines.map((line, i) => text(4, descY + i * 28, line, { size: 20, fill: t.body, max: 560 })),
    ...statParts,
    `<rect x="4" y="${statsY + 74}" width="72" height="2" rx="1" fill="url(#rule)"/>`,
    // art: platform, orbit rings, floating panels
    `<ellipse cx="905" cy="282" rx="260" ry="60" fill="url(#platform)"/>`,
    `<ellipse class="orbit" cx="905" cy="276" rx="272" ry="66" fill="none" stroke="url(#ring)" stroke-width="2" stroke-dasharray="10 14"/>`,
    `<ellipse class="orbit slow" cx="905" cy="270" rx="206" ry="46" fill="none" stroke="${t.title}" stroke-opacity="0.14" stroke-dasharray="3 9"/>`,
    panel(612, 214, 150, 92, list, "bob", -2.4),
    panel(676, 96, 236, 150, code, "bob", 0),
    panel(978, 116, 84, 66, chart, "bob", -1.2, "#8b5cf6"),
    panel(790, 196, 166, 104, front, "bob", -3.4),
    `<circle class="pulse" cx="932" cy="78" r="66" fill="url(#tileGlow)"/>`,
    `<g class="bob" style="animation-delay: -1.8s"><g transform="translate(892 38) skewY(-6)"><rect width="80" height="80" rx="20" fill="url(#codeTile)"/><rect x="0.5" y="0.5" width="79" height="79" rx="19.5" fill="none" stroke="#ffffff" stroke-opacity="0.3"/>${useIcon("code", 18, 18, 44, "#ffffff", { width: 2.2 })}</g></g>`,
    `<circle class="pulse" cx="1052" cy="236" r="70" fill="url(#prismGlow)"/>`,
    `<g class="lift" style="animation-delay: -0.7s"><g transform="translate(1022 192)"><path d="M30 0 L60 30 L30 34 Z" fill="url(#prismA)"/><path d="M30 0 L0 30 L30 34 Z" fill="url(#prismC)"/><path d="M0 30 L30 34 L30 92 Z" fill="url(#prismB)"/><path d="M60 30 L30 34 L30 92 Z" fill="url(#prismA)" fill-opacity="0.85"/></g></g>`,
    `<g class="bob" style="animation-delay: -0.9s"><rect x="1078" y="70" width="14" height="14" rx="3" fill="#60a5fa" transform="rotate(45 1085 77)"/></g>`,
    `<g class="bob" style="animation-delay: -3.1s"><rect x="958" y="44" width="10" height="10" rx="2" fill="#a78bfa" transform="rotate(45 963 49)"/></g>`,
    `<g class="bob" style="animation-delay: -2.2s"><rect x="1146" y="300" width="12" height="12" rx="3" fill="#3b82f6" fill-opacity="0.8" transform="rotate(45 1152 306)"/></g>`,
    sparkle(640, 70, 7, "#93c5fd", 0), sparkle(1130, 44, 6, "#c4b5fd", -1.1), sparkle(760, 336, 5, "#93c5fd", -0.5), sparkle(1176, 250, 6, "#f0abfc", -1.8), sparkle(860, 20, 4, "#e0e7ff", -2.2),
    `<g transform="translate(1072 112) rotate(-10)">${note.map((line, i) => text(0, i * 22, line, { size: 18, fill: t.note, cls: "hand" })).join("")}</g>`,
    `<path class="draw" d="M1154 ${112 + note.length * 22 - 4} C 1172 ${142 + note.length * 22}, 1150 ${166 + note.length * 22}, 1108 ${170 + note.length * 22}" fill="none" stroke="${t.note}" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path d="M1117 ${163 + note.length * 22} L1107 ${170 + note.length * 22} L1118 ${176 + note.length * 22}" fill="none" stroke="${t.note}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  ].join("\n");

  const css = `.orbit { animation: orbit 14s linear infinite; }
.orbit.slow { animation-duration: 22s; animation-direction: reverse; }
@keyframes orbit { to { stroke-dashoffset: -240; } }
.draw { stroke-dasharray: 130; animation: draw 6s ease-in-out infinite; }
@keyframes draw { 0% { stroke-dashoffset: 130; } 40%, 80% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -130; } }`;
  return svgDoc(PAGE_W, height, `Featured Work — ${hero.description}`, defs, body, css);
}

// ---------------------------------------------------------------- timeline pieces

function sectionSvg(number, section, t, { first = false, linkLabel } = {}) {
  const height = 104;
  const cx = RAIL_W / 2;
  const cy = 60;
  const r = 24;
  const defs = [linear("rail", t.rail, { x2: 0 }), linear("ringStroke", t.rail), iconSymbols(linkLabel ? ["arrow"] : [])].join("\n");
  const body = [
    first ? "" : `<rect x="${cx - 1}" y="0" width="2" height="${cy - r - 4}" fill="url(#rail)" fill-opacity="${t.railOpacity}"/>`,
    `<rect x="${cx - 1}" y="${cy + r + 4}" width="2" height="${height - cy - r - 4}" fill="url(#rail)" fill-opacity="${t.railOpacity}"/>`,
    `<circle class="pulse" cx="${cx}" cy="${cy}" r="${r + 7}" fill="none" stroke="${t.rail[0]}" stroke-opacity="0.35" stroke-width="5"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.circleFill}" stroke="url(#ringStroke)" stroke-width="2"/>`,
    text(cx, cy + 5.3, number, { size: 15, weight: 700, fill: t.title, anchor: "middle" }),
    text(RAIL_W + 24, cy - 4, section.title, { size: 26, weight: 700, spacing: -0.3, fill: t.title }),
    text(RAIL_W + 24, cy + 22, section.subtitle, { size: 15.5, fill: t.body }),
    linkLabel ? text(PAGE_W - 30, cy + 6, linkLabel, { size: 15, weight: 600, fill: t.eyebrow, anchor: "end" }) : "",
    linkLabel ? useIcon("arrow", PAGE_W - 22, cy - 7, 16, t.eyebrow) : "",
  ].join("\n");
  return svgDoc(PAGE_W, height, `${number} ${section.title} — ${section.subtitle}`, defs, body);
}

/** One slice of the timeline line, as tall as the row it sits beside. */
function railSvg(height, t, { dot = false, fade = false } = {}) {
  const cx = RAIL_W / 2;
  const defs = [
    linear("rail", t.rail, { x2: 0, toOpacity: fade ? 0 : 1 }),
    dot ? radial("dotGlow", t.rail[0], 0.6, cx, height / 2, 14) : "",
  ].join("\n");
  const body = [
    `<rect x="${cx - 1}" y="0" width="2" height="${n(height)}" fill="url(#rail)" fill-opacity="${t.railOpacity}"/>`,
    dot ? `<circle class="pulse" cx="${cx}" cy="${n(height / 2)}" r="14" fill="url(#dotGlow)"/><circle cx="${cx}" cy="${n(height / 2)}" r="4" fill="${t.rail[0]}"/>` : "",
  ].join("\n");
  return svgDoc(RAIL_W, height, "", defs, body);
}

// ---------------------------------------------------------------- featured cards

function cardLayout(p) {
  const { pad, tile, thumbW, thumbH } = CARD;
  const w = CARD_W - 2 * CARD.inset;
  const thumbX = w - pad - thumbW;
  const thumbY = 54;
  const thumbBottom = thumbY + thumbH + (p.mobile ? 26 : 0);
  const textX = pad + tile + 16;
  const descMax = thumbX - 18 - pad;
  const lines = wrap(p.description, CARD.descSize, descMax);
  const descY = 146;
  const descBottom = descY + (lines.length - 1) * CARD.descLine + 6;
  const chipsY = Math.max(descBottom, thumbBottom) + 20;
  const chipRows = layoutChips(p.tech, w - 2 * pad);
  const height = chipsY + chipRows.height + 22;
  return { w, thumbX, thumbY, textX, descMax, lines, descY, chipsY, chipRows, height };
}

function badge(label, x, y, a, t) {
  const color = accentText(a, t);
  const width = Math.ceil(28 + textWidth(label, 12.5, 600) + 12);
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="25" rx="12.5" fill="${a.base}" fill-opacity="${t.name === "dark" ? 0.14 : 0.1}" stroke="${a.base}" stroke-opacity="0.55"/>
<g class="twinkle">${useIcon("star", x + 10, y + 7, 12, color, { filled: true })}</g>
${text(x + 28, y + 17.4, label, { size: 12.5, weight: 600, fill: color })}`;
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
  const phoneX = w - pad - PHONE.w + 8;
  const phoneY = L.thumbY + thumbH - PHONE.h + 26;
  const defs = [
    linear("body", [t.cardTop, t.cardBottom]),
    radial("wash", a.base, 0.22 * t.glow, 0, 0, 380),
    radial("wash2", a.base, 0.1 * t.glow, w, h, 300),
    linear("tile", [a.deep, a.base]),
    radial("tileGlow", a.base, 0.6 * t.glow, pad + tile / 2, 56 + tile / 2, 58),
    radial("thumbGlow", a.base, 0.4 * t.glow, thumbW / 2, thumbH / 2, thumbW * 0.62),
    radial("phoneGlow", a.base, 0.45 * t.glow, PHONE.w / 2, PHONE.h / 2, PHONE.h * 0.6),
    glareGradient(t),
    clipRect("card", w, h, radius),
    clipRect("thumbClip", thumbW, thumbH, 10),
    clipRect("phoneClip", PHONE.w - 6, PHONE.h - 6, 8, 3, 3),
    iconSymbols([p.icon, "star", ...drawnIcons, ...L.chipRows.placed.map((chip) => chip.icon)]),
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
${p.badge ? badge(p.badge, pad, 18, a, t) : ""}
${p.type ? text(w - pad, 35.5, p.type, { size: 12.5, fill: t.muted, anchor: "end" }) : ""}
<circle class="pulse" cx="${pad + tile / 2}" cy="${56 + tile / 2}" r="58" fill="url(#tileGlow)"/>
${iconTile(p.icon, pad, 56, tile, 30)}
${text(L.textX, 85, p.name, { size: 25, weight: 700, spacing: -0.3, fill: t.title, max: titleMax })}
${p.subtitle ? text(L.textX, 109, p.subtitle, { size: 15, fill: t.body, max: titleMax }) : ""}
${L.lines.map((line, i) => text(pad, L.descY + i * CARD.descLine, line, { size: CARD.descSize, fill: t.body, max: L.descMax })).join("\n")}
${chips(L.chipRows, pad, h - 22 - L.chipRows.height, t)}
<g class="lift" style="animation-delay: -${n(index * 1.3)}s"><g transform="translate(${L.thumbX} ${L.thumbY})">${thumb.window}</g></g>
${thumb.phone ? `<g class="bob" style="animation-delay: -${n(index * 0.9 + 0.6)}s"><g transform="translate(${phoneX} ${phoneY})">${thumb.phone}</g></g>` : ""}
</g></g>`;
  return svgDoc(CARD_W, height, `${p.name} — ${p.subtitle ?? ""}`, defs, body, `${runCss(rectPerimeter(w, h, radius))}\n${glareCss(w)}`);
}

const buttonWidth = (kind) => Math.ceil(18 + 15 + 8 + textWidth(BUTTONS[kind].label, BTN.size, 600) + 18);
const buttonHeight = BTN.top + BTN.h + BTN.bottom;
const buttonFile = (kind, accent) => (BUTTONS[kind].primary ? `btn-${kind}-${accent}` : `btn-${kind}`);

function buttonSvg(kind, accent, t) {
  const button = BUTTONS[kind];
  const width = buttonWidth(kind);
  const y = BTN.top;
  if (button.primary) {
    const a = ACCENTS[accent];
    const defs = [linear("fill", [a.deep, a.base], { y2: 0 }), iconSymbols([button.icon])].join("\n");
    const body = `<rect class="pulse" x="1.5" y="${y + 1.5}" width="${width - 3}" height="${BTN.h - 3}" rx="11" fill="none" stroke="${a.base}" stroke-width="3" stroke-opacity="${n(0.5 * t.glow + 0.2)}"/>
<rect x="3" y="${y + 3}" width="${width - 6}" height="${BTN.h - 6}" rx="9" fill="url(#fill)"/>
<path d="M12 ${y + 4} H${width - 12}" stroke="#ffffff" stroke-opacity="0.35" stroke-linecap="round"/>
${text(18, y + BTN.h / 2 + 5, button.label, { size: BTN.size, weight: 600, fill: "#ffffff" })}
${useIcon(button.icon, width - 18 - 15, y + (BTN.h - 15) / 2, 15, "#ffffff")}`;
    return svgDoc(width, buttonHeight, button.label, defs, body);
  }
  const body = `<rect x="3.5" y="${y + 3.5}" width="${width - 7}" height="${BTN.h - 7}" rx="9" ${paint("fill", t.outlineFill)} ${paint("stroke", t.outlineStroke)}/>
${useIcon(button.icon, 18, y + (BTN.h - 15) / 2, 15, t.outlineText)}
${text(18 + 15 + 8, y + BTN.h / 2 + 5, button.label, { size: BTN.size, weight: 600, fill: t.outlineText })}`;
  return svgDoc(width, buttonHeight, button.label, iconSymbols([button.icon]), body);
}

const teamLabel = (size) => `Team of ${size}`;
const teamWidth = (size) => Math.ceil(16 + 7 + textWidth(teamLabel(size), 13.5, 500) + 2);

function teamSvg(size, t) {
  const width = teamWidth(size);
  const body = `${useIcon("users", 0, BTN.top + (BTN.h - 16) / 2, 16, t.muted)}
${text(16 + 7, BTN.top + BTN.h / 2 + 4.7, teamLabel(size), { size: 13.5, weight: 500, fill: t.muted })}`;
  return svgDoc(width, buttonHeight, teamLabel(size), iconSymbols(["users"]), body);
}

// ---------------------------------------------------------------- other projects

function tileSvg(o, t, index) {
  const a = ACCENTS[o.accent];
  const color = accentText(a, t);
  const w = TILE_W - 2 * TILE.inset;
  const h = TILE.h - 2 * TILE.inset;
  const radius = 16;
  const iconY = (h - TILE.icon) / 2;
  const textX = 14 + TILE.icon + 12;
  const arrowX = w - 26;
  const max = arrowX - 13 - 9 - textX;
  const name = wrap(o.name, 14.5, max, 700);
  const sub = o.subtitle ? wrap(o.subtitle, 12.5, max) : [];
  const blockHeight = name.length * 18 + sub.length * 16;
  const top = (h - blockHeight) / 2 + 13;
  const defs = [
    linear("body", [t.cardTop, t.cardBottom]),
    radial("wash", a.base, 0.24 * t.glow, 0, 0, 200),
    linear("tile", [a.deep, a.base]),
    radial("tileGlow", a.base, 0.6 * t.glow, 14 + TILE.icon / 2, h / 2, 40),
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
<circle class="pulse" cx="${14 + TILE.icon / 2}" cy="${n(h / 2)}" r="40" fill="url(#tileGlow)"/>
${iconTile(o.icon, 14, iconY, TILE.icon, 22)}
${name.map((line, i) => text(textX, top + i * 18, line, { size: 14.5, weight: 700, fill: t.title, max })).join("\n")}
${sub.map((line, i) => text(textX, top + name.length * 18 + i * 16, line, { size: 12.5, fill: t.body, max })).join("\n")}
<circle cx="${arrowX}" cy="${n(h / 2)}" r="13" fill="none" ${paint("stroke", t.outlineStroke)}/>
${useIcon("arrow", arrowX - 7, h / 2 - 7, 14, color)}
</g></g>`;
  return svgDoc(TILE_W, TILE.h, `${o.name} — ${o.subtitle ?? ""}`, defs, body, `${runCss(rectPerimeter(w, h, radius), 6)}\n${glareCss(w, 8)}`);
}

// ---------------------------------------------------------------- tech stack

function techLayout() {
  const w = PANEL_W - 2 * CARD.inset;
  const colW = w / TECH_GROUPS.length;
  const columns = TECH_GROUPS.map((group) => {
    const lines = wrap(group.subtitle ?? "", 12.5, colW - 68 - 28);
    const chipsY = 40 + Math.max(52, 44 + lines.length * 17) + 18;
    const chipRows = layoutChips(group.tech, colW - 48);
    return { group, lines, chipsY, chipRows, bottom: chipsY + chipRows.height };
  });
  const h = Math.max(...columns.map((column) => column.bottom)) + 26;
  return { w, h, colW, columns };
}

function techSvg(t) {
  const { w, h, colW, columns } = techLayout();
  const height = h + 2 * CARD.inset;
  const shape = `M0 30 V${h - 16} a16 16 0 0 0 16 16 H${w - 16} a16 16 0 0 0 16 -16 V34 L${w - 34} 0 H230 L208 22 H16 a16 16 0 0 0 -16 16 Z`;
  const perimeter = 2 * (w + h) + 40;
  const defs = [
    linear("body", [t.cardTop, t.cardBottom]),
    ...columns.map(({ group }, i) => radial(`wash-${i}`, ACCENTS[group.accent].base, 0.2 * t.glow, colW * (i + 0.5), h + 40, 260)),
    ...columns.map(({ group }, i) => linear(`tile-${i}`, [ACCENTS[group.accent].deep, ACCENTS[group.accent].base])),
    glareGradient(t),
    `<clipPath id="panel"><path d="${shape}"/></clipPath>`,
    iconSymbols(columns.flatMap(({ group, chipRows }) => [group.icon, ...chipRows.placed.map((chip) => chip.icon)])),
  ].join("\n");
  const body = `<g transform="translate(${CARD.inset} ${CARD.inset})"><g class="float">
<path d="${shape}" fill="none" stroke="#3b82f6" stroke-width="10" stroke-opacity="${n(0.05 * t.glow)}"/>
<path d="${shape}" fill="none" stroke="#3b82f6" stroke-width="4" stroke-opacity="${n(0.12 * t.glow)}"/>
<path d="${shape}" fill="url(#body)"/>
${columns.map((_, i) => `<path d="${shape}" fill="url(#wash-${i})"/>`).join("\n")}
${glare(h, "panel")}
<path d="${shape}" fill="none" stroke="#3b82f6" stroke-opacity="${t.borderOpacity}" stroke-width="1.3"/>
<path class="run" d="${shape}" fill="none" stroke="${accentText(ACCENTS.blue, t)}" stroke-width="2" stroke-linecap="round" stroke-dasharray="140 ${n(perimeter - 140)}"/>
${columns.slice(1).map((_, i) => `<path d="M${n(colW * (i + 1))} 44 V${h - 24}" stroke="${t.title}" stroke-opacity="0.1"/>`).join("\n")}
${columns.map(({ group, lines, chipsY, chipRows }, i) => {
  const x = colW * i + 24;
  const a = ACCENTS[group.accent];
  return `<circle class="pulse" style="animation-delay: -${i}s" cx="${n(x + 26)}" cy="66" r="44" fill="${a.base}" fill-opacity="${n(0.12 * t.glow)}"/>
${iconTile(group.icon, x, 40, 52, 26, `tile-${i}`)}
${text(x + 68, 62, group.title, { size: 18, weight: 700, fill: t.title, max: colW - 68 - 28 })}
${lines.map((line, j) => text(x + 68, 84 + j * 17, line, { size: 12.5, fill: t.body, max: colW - 68 - 28 })).join("\n")}
${chips(chipRows, x, chipsY, t)}`;
}).join("\n")}
</g></g>`;
  return svgDoc(PANEL_W, height, `Tech stack — ${TECH_GROUPS.map((group) => `${group.title}: ${group.tech.join(", ")}`).join(". ")}`, defs, body, `${runCss(perimeter, 10)}\n${glareCss(w, 12)}`);
}

// ---------------------------------------------------------------- footer

const FOOTER_H = 120;
const FOOTER_ART_W = PAGE_W - 3 * SOCIAL_W - 2 * SOCIAL_GAP;

function footerSvg(t) {
  const w = FOOTER_ART_W;
  const tagline = DATA.footer.tagline;
  const taglineWidth = textWidth(tagline, 21, 400);
  const defs = [
    linear("rail", t.rail, { x2: 0, toOpacity: 0 }),
    linear("fade", [t.mountains[0], t.mountains[0]], { x2: 1, y2: 0, toOpacity: 0 }),
    linear("fade2", [t.mountains[1], t.mountains[1]], { x2: 1, y2: 0, toOpacity: 0 }),
  ].join("\n");
  const cx = RAIL_W / 2;
  const body = [
    `<path d="M0 ${FOOTER_H} L60 84 L110 100 L180 66 L250 94 L320 74 L400 102 L480 80 L560 104 L640 86 L720 ${FOOTER_H} Z" fill="url(#fade)" fill-opacity="0.6"/>`,
    `<path d="M0 ${FOOTER_H} L90 100 L170 110 L260 92 L360 112 L470 98 L600 ${FOOTER_H} Z" fill="url(#fade2)" fill-opacity="0.8"/>`,
    `<path d="M${cx} 0 V26 Q${cx} 52 ${cx + 30} 56" fill="none" stroke="${t.rail[0]}" stroke-opacity="${t.railOpacity}" stroke-width="2" stroke-linecap="round"/>`,
    text(cx + 40, 62, tagline, { size: 21, fill: t.note, cls: "hand" }),
    `<path d="M${n(cx + 52 + taglineWidth)} 56 H${n(cx + 82 + taglineWidth)} M${n(cx + 74 + taglineWidth)} 50 L${n(cx + 82 + taglineWidth)} 56 L${n(cx + 74 + taglineWidth)} 62" fill="none" stroke="${t.note}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  ].join("\n");
  return svgDoc(w, FOOTER_H, tagline, defs, body);
}

const SOCIALS = {
  github: { label: "GitHub", icon: "github" },
  linkedin: { label: "LinkedIn" },
  email: { label: "Email", icon: "mail" },
};

function socialSvg(kind, t) {
  const cx = SOCIAL_W / 2;
  const cy = FOOTER_H / 2;
  const color = t.outlineText;
  const mark = kind === "linkedin"
    ? `<rect x="${cx - 10}" y="${cy - 10}" width="20" height="20" rx="4" fill="${color}"/><text x="${cx - 6.6}" y="${cy + 6}" class="sans" font-size="13.5" font-weight="800" fill="${t.name === "dark" ? "#0b1020" : "#ffffff"}">in</text>`
    : useIcon(SOCIALS[kind].icon, cx - 10, cy - 10, 20, color);
  const body = `<circle cx="${cx}" cy="${cy}" r="22" ${paint("fill", t.outlineFill)} ${paint("stroke", t.outlineStroke)}/>
${mark}`;
  return svgDoc(SOCIAL_W, FOOTER_H, SOCIALS[kind].label, iconSymbols(SOCIALS[kind].icon ? [SOCIALS[kind].icon] : []), body);
}

// ---------------------------------------------------------------- README markup

/** Floor so a row of percentages never sums past 100% and wraps. */
const pct = (units) => `${Math.floor((units / PAGE_W) * 1e6) / 1e4}%`;
const anchor = (href, inner) => `<a href="${attr(href)}">${inner}</a>`;
const spacer = (units) => (units > 0 ? `<img src="${ASSET_URL}/spacer.svg" width="${pct(units)}" align="top" alt="">` : "");

function picture(name, units, alt) {
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${ASSET_URL}/${name}-dark.svg"><img src="${ASSET_URL}/${name}-light.svg" width="${pct(units)}" align="top" alt="${attr(alt)}"></picture>`;
}

const cardAlt = (p) =>
  `${p.name}${p.subtitle ? ` — ${p.subtitle}` : ""}. ${p.description}${p.tech.length ? ` Built with ${p.tech.join(", ")}.` : ""}`;

function buttonGroup(p) {
  const parts = [spacer(CARD.inset)];
  let used = CARD.inset;
  p.links.forEach(([kind, href], i) => {
    if (i) {
      parts.push(spacer(BTN.gap));
      used += BTN.gap;
    }
    parts.push(anchor(href, picture(buttonFile(kind, p.accent), buttonWidth(kind), `${p.name}: ${BUTTONS[kind].label}`)));
    used += buttonWidth(kind);
  });
  if (p.team) {
    const width = teamWidth(p.team);
    parts.push(spacer(CARD_W - CARD.inset - width - used), anchor(p.links[0][1], picture(`team-${p.team}`, width, teamLabel(p.team))), spacer(CARD.inset));
  } else {
    parts.push(spacer(CARD_W - used));
  }
  return parts.join("");
}

function readmeSection() {
  const portfolio = DATA.portfolio;
  const lines = [anchor(`${portfolio}/#projects`, picture("section-featured", PAGE_W, `01 ${DATA.sections.featured.title}`))];
  for (let i = 0; i < FEATURED.length; i += 2) {
    const [a, b] = [FEATURED[i], FEATURED[i + 1]];
    const card = (p) => anchor(p.links[0][1], picture(`card-${p.slug}`, CARD_W, cardAlt(p)));
    lines.push(picture("rail-card", RAIL_W, "") + card(a) + spacer(COL_GAP) + (b ? card(b) : spacer(CARD_W)));
    lines.push(picture("rail-buttons", RAIL_W, "") + buttonGroup(a) + spacer(COL_GAP) + (b ? buttonGroup(b) : ""));
  }
  lines.push(anchor(DATA.sections.others.link, picture("section-others", PAGE_W, `02 ${DATA.sections.others.title} — view all projects`)));
  lines.push(picture("rail-tiles", RAIL_W, "") + OTHERS.map((o, i) => (i ? spacer(TILE_GAP) : "") + anchor(o.link, picture(`other-${o.slug}`, TILE_W, `${o.name}${o.subtitle ? ` — ${o.subtitle}` : ""}`))).join(""));
  lines.push(anchor(`${portfolio}/#skills`, picture("section-tech", PAGE_W, `03 ${DATA.sections.tech.title}`)));
  lines.push(picture("rail-end", RAIL_W, "") + anchor(`${portfolio}/#skills`, picture("tech-stack", PANEL_W, `Tech stack — ${TECH_GROUPS.map((group) => `${group.title}: ${group.tech.join(", ")}`).join(". ")}.`)));
  lines.push(anchor(portfolio, picture("footer", FOOTER_ART_W, DATA.footer.tagline)) + Object.entries(DATA.footer.links).map(([kind, href], i) => (i ? spacer(SOCIAL_GAP) : "") + anchor(href, picture(`social-${kind}`, SOCIAL_W, SOCIALS[kind].label))).join(""));

  return [
    `<p>\n${anchor(`${portfolio}/#projects`, picture("hero", PAGE_W, `Featured Work — ${DATA.hero.description}`))}\n</p>`,
    `<p>\n${lines.join("<br>\n")}\n</p>`,
  ].join("\n\n");
}

// ---------------------------------------------------------------- write

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const write = (name, svg) => writeFileSync(join(OUT_DIR, name), svg);

const cardHeight = Math.max(...FEATURED.map((p) => cardLayout(p).height)) + 2 * CARD.inset;
const techHeight = techLayout().h + 2 * CARD.inset;
for (const t of Object.values(THEMES)) {
  write(`hero-${t.name}.svg`, heroSvg(t));
  write(`section-featured-${t.name}.svg`, sectionSvg("01", DATA.sections.featured, t, { first: true }));
  write(`section-others-${t.name}.svg`, sectionSvg("02", DATA.sections.others, t, { linkLabel: "View all projects" }));
  write(`section-tech-${t.name}.svg`, sectionSvg("03", DATA.sections.tech, t));
  write(`rail-card-${t.name}.svg`, railSvg(cardHeight, t, { dot: true }));
  write(`rail-buttons-${t.name}.svg`, railSvg(buttonHeight, t));
  write(`rail-tiles-${t.name}.svg`, railSvg(TILE.h, t, { dot: true }));
  write(`rail-end-${t.name}.svg`, railSvg(techHeight, t));
  FEATURED.forEach((p, i) => write(`card-${p.slug}-${t.name}.svg`, cardSvg(p, t, cardHeight, i)));
  for (const p of FEATURED) for (const [kind] of p.links) write(`${buttonFile(kind, p.accent)}-${t.name}.svg`, buttonSvg(kind, p.accent, t));
  for (const size of new Set(FEATURED.map((p) => p.team).filter(Boolean))) write(`team-${size}-${t.name}.svg`, teamSvg(size, t));
  OTHERS.forEach((o, i) => write(`other-${o.slug}-${t.name}.svg`, tileSvg(o, t, i)));
  write(`tech-stack-${t.name}.svg`, techSvg(t));
  write(`footer-${t.name}.svg`, footerSvg(t));
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
