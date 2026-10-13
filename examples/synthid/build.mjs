import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { N, DELTA, SURE, MAYBE, KEY, SCENES, columnsOf } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640;
const HEIGHT = 430;

const PLATE = { x: -104, y: -96, w: 208, d: 192, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const BED = { x: -51, y: -51, w: 102, d: 102, r: 3 };
const BED_TOP = 4;
const PITCH = 12;
const X0 = -42;
const PIN = 10;
const CROP_H = 0.8;
const RAIL_Y = 70;
const RAIL = [-88, 88];
const G_PARK = [-64, 64];
const HEAD_Z = 32;
const BEAM_Z = 42;
const BEAM_TOP = 50;
const TIP_R = 1.7;
const TIP_MIN = BED_TOP + 7;
const DIAL = [0, 60];
const DIAL_R = 12;
const DIAL_Z = 53;
const DIAL_TOP = 59;
const SCALE_MAX = 1.2;
const SWEEP = (Math.PI * 4) / 3;
const SCREW_Y = -84;
const SCREW_Z = 9;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [G_PARK[0], -78, BEAM_TOP + 3], [G_PARK[1], 78, BEAM_TOP + 3], [G_PARK[1], DIAL[1] + DIAL_R, DIAL_TOP], [G_PARK[0], DIAL[1] + DIAL_R, DIAL_TOP]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 38 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const cx = (index) => X0 + PITCH * index;

function pinLayer(P, H, live, g, tips) {
  const items = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const plan = { x: -47 + 12 * i, y: -47 + 12 * j, w: 10, d: 10, r: 0.8 };
      const on = live[i][j];
      const h = on ? H[i][j] : 0.8;
      items.push({ s: i + j, svg: k.solidSvg(k.slabOf(plan, 4, h, P, 2, on ? 0.35 : 0), { tone: on ? "hi" : "lo", crease: on ? "lo" : "faint" }) });
    }
  }
  const column = Math.floor((g + 42) / 12 + 0.51);
  for (let j = 0; j < 8; j++) {
    const y = -42 + 12 * j;
    const tip = tips[j];
    const svg =
      k.solidSvg(k.cylinder(g, y, 1.7, tip, 1.4, P, 18), { tone: "hi", lit: true }) +
      k.solidSvg(k.cylinder(g, y, 0.9, tip + 1.4, 32 - 2.6 - tip - 1.4, P, 14), { tone: "hi", crease: "none", lit: true }) +
      k.solidSvg(k.cylinder(g, y, 2.3, 32 - 2.6, 2.6, P, 18), { tone: "mid" });
    items.push({ s: column + j + 0.5, svg });
  }
  return items.sort((a, b) => a.s - b.s).map((item) => item.svg).join("");
}

function farLayer(P, g) {
  const out = [];
  const rod = (a, b) => {
    if (b - a < 0.5) return "";
    const threads = k.coil(a, b, [-84, 9], 2, (b - a) / 2.6, "x", P);
    const runs = threads.front.split("M").filter(Boolean).slice(1, -1).map((run) => "M" + run).join("");
    return k.solidSvg(k.slabOf({ x: a, y: -86, w: b - a, d: 4, r: 1.8 }, 7, 4, P, 3), { tone: "mid", crease: "none" }) + (runs ? k.lineSvg(runs, { tone: "lo" }) : "");
  };
  out.push(rod(-87, g - 7));
  out.push(k.solidSvg(k.slabOf({ x: g - 7, y: -90, w: 14, d: 12, r: 1.5 }, 3, 13, P, 3, 0.5), { tone: "mid" }));
  out.push(k.dotsSvg([k.iso([g - 4, -87, 16], P), k.iso([g + 4, -87, 16], P)], { size: 0.45 }));
  out.push(k.solidSvg(k.slabOf({ x: g - 9, y: -76, w: 18, d: 12, r: 2 }, 4, 6, P, 3, 0.5), { tone: "mid" }));
  out.push(k.dotsSvg([k.iso([g - 6, -73, 10], P), k.iso([g + 6, -73, 10], P), k.iso([g - 6, -67, 10], P), k.iso([g + 6, -67, 10], P)], { size: 0.4 }));
  out.push(k.solidSvg(k.slabOf({ x: g - 4, y: -74, w: 8, d: 8, r: 1 }, 10, 32, P, 3, 0.4), { tone: "mid" }));
  out.push(rod(g + 7, 89));
  return out.join("");
}

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  const strip = { x: -82, y: 79, w: 128, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(-78, 42, 3, 4, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));

  const label = { x: 54, y: 77, w: 38, d: 12, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 4, label.y + 5.2], 0.8, P, "x"), "SYNTHID", { size: 2.6, tone: "mid" }));
  out.push(L(k.lineOnTop([label.x + 4, label.y + 8.4], [label.x + 26, label.y + 8.4], 0.8, P), { tone: "lo", free: true }));
  out.push(D([at([label.x + 34, label.y + 3.5, 0.8]), at([label.x + 34, label.y + 8.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

function motor() {
  const out = [];
  const box = { x: -101, y: -93, w: 10, d: 18, r: 1.5 };
  out.push(S(k.slabOf(box, 0, 18, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(box, 14, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(box, 2), 18, P, 3), { tone: "faint" }));
  out.push(D([at([box.x + 3, box.y + 3, 18]), at([box.x + 7, box.y + 15, 18])], { size: 0.45 }));
  const bearing = { x: -91, y: -90, w: 4, d: 12, r: 1 };
  out.push(S(k.slabOf(bearing, 0, 15, P, 3, 0.4), { tone: "mid" }));
  const end = { x: 89, y: -90, w: 4, d: 12, r: 1 };
  out.push(S(k.slabOf(end, 0, 15, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([91, -87, 15]), at([91, -81, 15])], { size: 0.45 }));
  return out.join("");
}

function rail(y) {
  const out = [];
  out.push(S(k.slabOf({ x: RAIL[0], y: y - 2.5, w: RAIL[1] - RAIL[0], d: 5, r: 1 }, 0, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(D([-80, -40, 0, 40, 80].map((x) => at([x, y, 4])), { size: 0.4, tone: "lo" }));
  for (const x of [RAIL[0] - 5, RAIL[1]]) {
    out.push(S(k.slabOf({ x, y: y - 6, w: 5, d: 12, r: 1.2 }, 0, 8, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, y - 3, 8]), at([x + 2.5, y + 3, 8])], { size: 0.45 }));
  }
  return out.join("");
}

function bed() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BED, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(BED, 0, BED_TOP, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BED, 1.6), BED_TOP, P, 3), { tone: "faint" }));
  const screws = k.corners(BED, 2.2);
  out.push(D(screws.map(([x, y]) => at([x, y, BED_TOP])), { size: 0.4 }));
  return out.join("");
}

function head() {
  const out = [];
  const plan = { x: -8, y: -52, w: 16, d: 104, r: 2 };
  out.push(S(k.slabOf(plan, HEAD_Z, BEAM_Z - HEAD_Z, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, HEAD_Z + 3, P, 4), { tone: "faint" }) }));
  out.push(D([-46, -34, -22, -10, 2, 14, 26, 38].map((y) => at([6.5, y + 6, BEAM_Z])), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function upright(y) {
  const out = [];
  out.push(S(k.slabOf({ x: -9, y: y - 6, w: 18, d: 12, r: 2 }, 4, 6, P, 3, 0.5), { tone: "mid" }));
  out.push(D([[-6, y - 3], [6, y - 3], [-6, y + 3], [6, y + 3]].map(([x, yy]) => at([x, yy, 10])), { size: 0.4 }));
  const column = { x: -4, y: y - 4, w: 8, d: 8, r: 1 };
  out.push(S(k.slabOf(column, 10, BEAM_Z - 10, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(column, 22, P, 3), { tone: "faint" }) }));
  const knob = [0, y + 4];
  out.push(S(k.slabOf({ x: -1.4, y: y + 4, w: 2.8, d: 3, r: 0.8 }, 27, 3, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(knob[0], knob[1] + 4.6, 3, 25.5, 6, P, 22), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1] + 4.6, 3, 25.5, 31.5, 20, P), { tone: "lo" }));
  return out.join("");
}

const needleAt = (score) => {
  const angle = -SWEEP / 2 + (Math.min(Math.max(score, -0.05), SCALE_MAX + 0.05) / SCALE_MAX) * SWEEP;
  const [x, y] = DIAL;
  return k.lineOnTop([x - Math.sin(angle) * 3, y + Math.cos(angle) * 3], [x + Math.sin(angle) * (DIAL_R - 4), y - Math.cos(angle) * (DIAL_R - 4)], DIAL_TOP + 0.2, P);
};

function top() {
  const out = [];
  const beam = { x: -5, y: -78, w: 10, d: 156, r: 1.5 };
  out.push(S(k.slabOf(beam, BEAM_Z, BEAM_TOP - BEAM_Z, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(beam, BEAM_Z + 2.5, P, 3), { tone: "faint" }) }));
  out.push(D([-74, -64, 64, 74].map((y) => at([0, y, BEAM_TOP])), { size: 0.45 }));

  const holder = { x: -9, y: -46, w: 18, d: 42, r: 1.5 };
  out.push(S(k.slabOf(holder, BEAM_TOP, 2.4, P, 3, 0.4), { tone: "mid" }));
  const card = { x: -7.4, y: -43, w: 14.8, d: 36, r: 0.8 };
  out.push(S(k.slabOf(card, BEAM_TOP + 2.4, 0.7, P, 2), { tone: "hi", crease: "lo" }));
  const holes = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (KEY[i][j] > 0) holes.push(at([card.x + 1.4 + i * 1.71, card.y + 2.2 + j * 4.5, BEAM_TOP + 3.1]));
  out.push(D(holes, { size: 0.5, tone: "lo" }));
  out.push(D([at([holder.x + 1.6, holder.y + 40, BEAM_TOP + 2.4]), at([holder.x + 16.4, holder.y + 40, BEAM_TOP + 2.4])], { size: 0.4 }));

  const [x, y] = DIAL;
  out.push(S(k.slabOf({ x: -4, y: y - 6, w: 8, d: 12, r: 1.2 }, BEAM_TOP, DIAL_Z - BEAM_TOP, P, 3), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_TOP - DIAL_Z, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 2.6, DIAL_TOP, 64, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 2.6, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 1.8, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 2.2, 24, 6, DIAL_TOP, [1.1, 2.2], P, -SWEEP / 2, SWEEP);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const mark = (score) => {
    const angle = -SWEEP / 2 + (score / SCALE_MAX) * SWEEP;
    return k.lineOnTop([x + Math.sin(angle) * (DIAL_R - 5.4), y - Math.cos(angle) * (DIAL_R - 5.4)], [x + Math.sin(angle) * (DIAL_R - 1.8), y - Math.cos(angle) * (DIAL_R - 1.8)], DIAL_TOP, P);
  };
  out.push(L(mark(MAYBE) + mark(SURE), { tone: "hi" }));
  out.push(L(k.ring(x, y, 1.4, DIAL_TOP, P, 16), { tone: "mid" }));
  return out.join("");
}

const scenes = SCENES.map((scene) => ({ id: scene.id, name: scene.name, heights: scene.heights, live: scene.live, cols: columnsOf(scene) }));
const first = scenes[0];
const restTips = Array.from({ length: N }, () => TIP_MIN);
const startG = G_PARK[0];
const totalOf = (scene) => scene.cols.reduce((sum, value) => sum + value, 0);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Un banco de verificación. Sobre una base hay una cama de 8 por 8 pines cuadrados: la altura de cada pin es el brillo de un píxel de la imagen. Cada pin está subido o bajado 0,6 unidades según una clave secreta, demasiado poco para notarlo. Un pórtico corre sobre la cama por dos rieles; su cabezal baja ocho palpadores sobre una columna de pines a la vez, compara lo que mide con la clave perforada en una tarjeta y un reloj sobre el pórtico acumula la puntuación.",
  body: [
    plate(),
    motor(),
    rail(-RAIL_Y),
    `<g data-part="far">${farLayer(P, startG)}</g>`,
    bed(),
    `<g data-part="pins">${pinLayer(P, first.heights, first.live, startG, restTips)}</g>`,
    `<g data-part="head" transform="${k.translateAlong(P, [startG, 0, 0])}">${head()}</g>`,
    rail(RAIL_Y),
    `<g data-part="near" transform="${k.translateAlong(P, [startG, 0, 0])}">${upright(RAIL_Y)}</g>`,
    `<g data-part="top" transform="${k.translateAlong(P, [startG, 0, 0])}">${top()}<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/></g>`,
  ],
});

const fn = (f) => f.toString().replace(/\bk\./g, "");

const live = `
const P = ${JSON.stringify(P)};
const SCENES = ${JSON.stringify(scenes.map(({ id, name, heights, live, cols }) => ({ id, name, heights: heights.map((row) => row.map((v) => +v.toFixed(3))), live, cols: cols.map((v) => +v.toFixed(4)) })))};
const N = ${N}, BED_TOP = ${BED_TOP}, CROP_H = ${CROP_H}, TIP_MIN = ${TIP_MIN}, TIP_R = ${TIP_R}, SURE = ${SURE}, MAYBE = ${MAYBE};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP}, SCALE_MAX = ${SCALE_MAX}, SWEEP = ${SWEEP};
const PARK = ${JSON.stringify(G_PARK)};
const pinLayer = ${fn(pinLayer)};
const farLayer = ${fn(farLayer)};
const needleAt = ${fn(needleAt)};
const centre = (i) => -42 + 12 * i;
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const pins = part("pins"), far = part("far"), headEl = part("head"), near = part("near"), topEl = part("top"), needle = part("needle");
const readout = document.querySelector("[data-readout]");
const buttons = [...document.querySelectorAll("[data-scene]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

let scene = 0;
let H = SCENES[0].heights.map((row) => row.slice());
let crop = SCENES[0].live.map((row) => row.map((on) => (on ? 1 : 0)));
let g = PARK[0], target = PARK[0];
const tips = Array.from({ length: N }, () => ({ at: TIP_MIN, rate: 0 }));
let dial = { at: 0, rate: 0 };
let touring = true, phase = "sweep", phaseAt = 0, clock = 0;
let frame = 0, last = 0, visible = false, idleTimer = 0;

const scoreAt = (x, cols) => cols.reduce((sum, value, i) => sum + value * smooth((x - centre(i) + 3) / 6), 0);
const scanned = (x) => SCENES[0].cols.filter((_, i) => x >= centre(i)).length;
const heightOf = (i, j) => (crop[i][j] > 0.5 ? H[i][j] : CROP_H);
function tipUnder(j) {
  let top = TIP_MIN;
  for (let i = 0; i < N; i++) {
    const from = centre(i) - 5, to = centre(i) + 5;
    if (g + TIP_R > from && g - TIP_R < to) top = Math.max(top, BED_TOP + heightOf(i, j));
  }
  return top;
}
function verdict(score) { return score >= SURE ? "marca detectada" : score >= MAYBE ? "posible marca" : "no detectada"; }
const num = (v) => v.toFixed(2).replace(".", ",");
function text() {
  const s = SCENES[scene];
  const n = scanned(g);
  const score = scoreAt(g, s.cols);
  if (n < N) return s.name + " · columna " + n + "/8 · " + num(Math.max(0, score));
  return s.name + " · " + num(score) + " · " + verdict(score);
}
function draw() {
  const liveGrid = crop.map((row) => row.map((v) => v > 0.5));
  const shown = H.map((row, i) => row.map((h, j) => (crop[i][j] > 0.5 ? h : CROP_H)));
  pins.innerHTML = pinLayer(P, shown, liveGrid, g, tips.map((t) => t.at));
  far.innerHTML = farLayer(P, g);
  const move = translateAlong(P, [g, 0, 0]);
  headEl.setAttribute("transform", move);
  near.setAttribute("transform", move);
  topEl.setAttribute("transform", move);
  needle.setAttribute("d", needleAt(dial.at));
  const words = text();
  if (readout.textContent !== words) readout.textContent = words;
  stage.setAttribute("aria-valuetext", words);
}
function choose(index, fromTour) {
  scene = (index + SCENES.length) % SCENES.length;
  buttons.forEach((b, i) => b.toggleAttribute("data-on", i === scene));
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === scene)));
  if (!fromTour) pause();
  run();
}
function tour(dt) {
  clock += dt;
  if (phase === "sweep") { target = PARK[1]; if (Math.abs(g - PARK[1]) < 0.4) { phase = "hold"; phaseAt = clock; } }
  else if (phase === "hold") { if (clock - phaseAt > 2.4) { phase = "back"; choose(scene + 1, true); } }
  else if (phase === "back") { target = PARK[0]; if (Math.abs(g - PARK[0]) < 0.4) { phase = "sweep"; } }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring && !calm) tour(dt);
  const step = touring ? (phase === "back" ? 60 : 20) * dt : Infinity;
  const want = clamp(target, PARK[0], PARK[1]);
  const eased = g + (want - g) * (1 - Math.exp(-dt / (touring ? 0.12 : 0.3)));
  g = calm ? want : (Math.abs(eased - g) > step ? g + Math.sign(want - g) * step : eased);
  if (Math.abs(want - g) < 0.01) g = want;
  const s = SCENES[scene];
  let moving = g !== want;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const goalH = s.heights[i][j], goalC = s.live[i][j] ? 1 : 0;
    const f = calm ? 1 : 1 - Math.exp(-dt / 0.3);
    H[i][j] += (goalH - H[i][j]) * f;
    crop[i][j] += (goalC - crop[i][j]) * (calm ? 1 : 1 - Math.exp(-dt / 0.2));
    if (Math.abs(goalH - H[i][j]) < 0.002) H[i][j] = goalH; else moving = true;
    if (Math.abs(goalC - crop[i][j]) < 0.01) crop[i][j] = goalC; else moving = true;
  }
  tips.forEach((t, j) => {
    const goal = tipUnder(j);
    if (calm) { t.at = goal; t.rate = 0; return; }
    for (let n = 0; n < 4; n++) { t.rate += ((goal - t.at) * 600 - t.rate * 32) * dt / 4; t.at += t.rate * dt / 4; }
    if (Math.abs(goal - t.at) < 0.005 && Math.abs(t.rate) < 0.005) { t.at = goal; t.rate = 0; } else moving = true;
  });
  const goal = scoreAt(g, s.cols);
  if (calm) { dial.at = goal; dial.rate = 0; }
  else { for (let n = 0; n < 4; n++) { dial.rate += ((goal - dial.at) * 90 - dial.rate * 14) * dt / 4; dial.at += dial.rate * dt / 4; } }
  if (Math.abs(goal - dial.at) < 0.0005 && Math.abs(dial.rate) < 0.0005) { dial.at = goal; dial.rate = 0; } else moving = true;
  draw();
  frame = visible && (moving || (touring && !calm)) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function pause() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; phase = g > 0 ? "hold" : "sweep"; phaseAt = clock; run(); } }, 4200);
}
const steer = (next) => { target = clamp(next, PARK[0], PARK[1]); pause(); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) { touring = false; target = PARK[1]; }
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.18) / 0.64, 0, 1);
  steer(PARK[0] + share * (PARK[1] - PARK[0]));
});
stage.addEventListener("pointerdown", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.18) / 0.64, 0, 1);
  steer(PARK[0] + share * (PARK[1] - PARK[0]));
});
const stops = [PARK[0], ...Array.from({ length: N }, (_, i) => centre(i)), PARK[1]];
stage.addEventListener("keydown", (event) => {
  const here = stops.reduce((best, stop, i) => (Math.abs(stop - target) < Math.abs(stops[best] - target) ? i : best), 0);
  let to = null;
  if (event.key === "ArrowRight") to = Math.min(stops.length - 1, here + 1);
  if (event.key === "ArrowLeft") to = Math.max(0, here - 1);
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = stops.length - 1;
  if (event.key === "ArrowDown") { event.preventDefault(); choose(scene + 1); return; }
  if (event.key === "ArrowUp") { event.preventDefault(); choose(scene - 1); return; }
  if (/^[1-6]$/.test(event.key)) { choose(Number(event.key) - 1); return; }
  if (to === null) return;
  event.preventDefault();
  steer(stops[to]);
});
buttons.forEach((button, i) => button.addEventListener("click", () => choose(i)));
choose(0, true);
draw();
`;

const controls = `<div class="sy-scenes" role="group" aria-label="Qué le pasó a la imagen">${scenes.map((scene, i) => `<button type="button" class="sy-scene" data-scene="${scene.id}" aria-pressed="${i === 0}"${i === 0 ? " data-on" : ""}><span class="sy-num">${i + 1}</span>${scene.name}</button>`).join("")}</div>`;

const css = `
.sy-scenes{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 4px}
.sy-scene{display:inline-flex;align-items:baseline;gap:7px;padding:5px 11px;border:0;border-radius:999px;background:transparent;color:var(--anatomy-muted);font:12.5px/1.3 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;box-shadow:inset 0 0 0 1px var(--sy-ring);transition:color 160ms var(--anatomy-ease),background 160ms var(--anatomy-ease)}
.sy-scene:hover,.sy-scene:focus-visible,.sy-scene[data-on]{color:var(--anatomy-strong);background:var(--sy-hover);outline:none}
.sy-scene:focus-visible{box-shadow:inset 0 0 0 1px var(--anatomy-muted)}
.sy-num{font-family:var(--anatomy-mono);font-size:10px;color:var(--anatomy-muted)}
.iso{--sy-ring:#ffffff14;--sy-hover:#ffffff0a}
.iso[data-theme="light"]{--sy-ring:#00000017;--sy-hover:#0000000a}
.iso-stage{outline:none;touch-action:pan-y}
.iso-stage:focus-visible{box-shadow:0 0 0 1px var(--anatomy-muted)}
@media (max-width:560px){.iso-plate-corner[data-corner="readout"]{max-width:calc(100% - 8px);overflow:hidden;text-overflow:ellipsis}}
`;

const plateBody = k.plateHtml({
  fig: "Fig 1",
  title: "Marca de agua SynthID",
  hint: "Pasa el cursor para mover el lector",
  readout: `${first.name} · columna 0/8 · 0,00`,
  keys: [
    { mark: "lit", label: "Palpadores y aguja: lo que lee la marca" },
    { mark: "raised", label: "Pines: un píxel cada uno; su altura es el brillo" },
    { mark: "flat", label: "Tarjeta perforada: la clave secreta, 32 de 64 pines suben" },
  ],
  caption: `Cada pin es un píxel; su altura es el brillo. Para marcar la imagen se sube o se baja cada pin ${DELTA.toFixed(1).replace(".", ",")} unidades según la clave perforada, un 5 % de la altura media de un pin, que el ojo no ve. Al leer, el cabezal recorre la imagen columna a columna, mira cuánto sobresale cada pin respecto a sus vecinos y lo compara con la clave: si coinciden, la puntuación sube. Arriba de 0,6 la marca se da por detectada; entre 0,3 y 0,6, posible. Como la marca está repartida por todos los píxeles, sobrevive a comprimir, aclarar o recortar; solo un desenfoque fuerte la borra en parte. SynthID hace lo mismo con millones de píxeles, pero ni la marca ni el lector son una tabla fija: son dos redes neuronales entrenadas juntas, una para incrustar la señal sin que se vea y otra para encontrarla después de ediciones comunes, y su detector también responde en tres niveles. Este banco es un modelo de juguete del principio, con números calculados, no el algoritmo real.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Lector de marca: flechas izquierda y derecha mueven el cabezal; arriba, abajo o 1 a 6 cambian la edición" aria-valuemin="0" aria-valuemax="8" aria-valuenow="0">${svg}</div>`,
}).replace("</div><figcaption", `</div>${controls}<figcaption`);

const name = theme === "light" ? "synthid-light.html" : "synthid.html";
const page = k
  .pageHtml({ title: "Marca de agua SynthID", theme, body: plateBody, script: kitScript() + live, width: 700 })
  .replace('<html lang="en">', '<html lang="es">')
  .replace("</style>", `${css}</style>`);
writeFileSync(join(HERE, name), page);
console.log("wrote", name, Math.round(page.length / 1024), "KB", scenes.map((s) => `${s.id} ${totalOf(s).toFixed(2)}`).join(" · "));
