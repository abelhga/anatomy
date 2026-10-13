import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { hopperInside } from "./inside.mjs";
import { materials, timeline, hopperTable, DENSITY, SPEEDUP, BELT_MS, THOR_START_KG, WATER_TANK_L, LOAD_M3, RECIPE } from "./model.mjs";
import { scene, boxVerts, BOX_FACES, frustum, plate, PLATE_FACES, frameBetween } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const HOPPERS = process.argv.includes("--two") ? 2 : 3;

const W = 1180;
const H = 390;
const AZIMUTH = 60;
const ELEVATION = 28;

const HALF = 12.5;
const RAIL_Z = [11, 13];
const TOP_Z = [28, 29.6];
const BAY = 42;
const X_FIRST = 45;
const POSTS = Array.from({ length: HOPPERS + 1 }, (_, i) => X_FIRST + BAY * i);
const X_LAST = POSTS[HOPPERS];
const RAIL_END = X_LAST + 21;
const NOSE = 6;
const CELL_Z = [29.6, 31];
const HOP_Z = [31, 37];
const OUT_Z = 20.2;
const BELT_Z = 13.2;
const BELT_HALF = 3.3;
const BEND_X = X_LAST - 3;
const HEAD = [X_LAST + 77, 0, 45];
const AXLE_X = X_LAST + 11;
const TIRE_R = 5.1;

const SCENE_MAX_X = HEAD[0] + 150;
const P = k.fitProjection(
  [[0, -HALF, 0], [0, HALF, 0], [0, 0, 32], [SCENE_MAX_X, -85, 0], [SCENE_MAX_X, -85, 48], [HEAD[0] + 60, -20, 48], [HEAD[0] - 10, -95, 36], [HEAD[0] + 6, 0, 62], [X_FIRST, -HALF, 46], [X_FIRST, HALF + 6, 0]],
  W,
  H,
  { pad: 18, azimuth: AZIMUTH, elevation: ELEVATION },
);

const R = A.recorder(P, {});
const TRUCK_GONE = 80;
const APART = {
  "zeus.hoppers": [0, 0, 26],
  "zeus.gates": [0, 0, 14],
  "zeus.water": [0, 0, 24],
  "zeus.air": [0, 0, 16],
  "thor.silo": [0, 0, 24],
};
const JACK_LIFT = 4.4;
const { put, poly, box, member, turned, disc, tube, at, S, L, D } = scene(P, R, {
  moves: { olla: [0, -TRUCK_GONE, 0], ...APART, "zeus.jacklegs": [0, 0, JACK_LIFT], "thor.jacklegs": [0, 0, JACK_LIFT] },
  rides: { ...Object.fromEntries(Object.keys(APART).map((id) => [id, "apart"])), "zeus.jacklegs": "jacks", "thor.jacklegs": "jacks" },
});

const sides = [-1, 1];
const HOPPER_GEO = [];
const SIGHT = [38.6, 51.4];
const WATER_GLASS = [];
const GRAINS = HOPPERS === 3 ? ["arena", "grava", "gravilla"] : ["arena", "grava"];
const START_LEVEL = [35.2, 34.4, 33.6];
const lerp = (a, b, t) => a + (b - a) * t;

function jackLeg(piece, top, owner) {
  const foot = [top[0], top[1], 0.6];
  const Fb = frameBetween(top, foot);
  const square = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  const F = G.frameOf(top, [0, 0, -1], [1, 0, 0], [0, -1, 0]);
  const id = R.nameFor(`${piece.split(".")[0]}.jack.leg`);
  put(piece, G.mul3(G.add3(top, foot), 0.5), S(G.prismOf(Fb, square, 0, top[2] - 0.6, P), { tone: "mid" }), { name: id, shapes: [R.solid(A.slide(F, 0, top[2] - 0.6, 0.5, { name: id, owner }))] });
}

function zeusFrame() {
  for (const s of sides) {
    const y = s * (HALF - 0.6);
    member("zeus.frame", [NOSE, y, (RAIL_Z[0] + RAIL_Z[1]) / 2], [RAIL_END, y, (RAIL_Z[0] + RAIL_Z[1]) / 2], 1.2, RAIL_Z[1] - RAIL_Z[0], { tone: "mid" }, { name: "zeus.rail" });
    member("zeus.frame", [X_FIRST, y, (TOP_Z[0] + TOP_Z[1]) / 2], [X_LAST + 4, y, (TOP_Z[0] + TOP_Z[1]) / 2], 1.2, TOP_Z[1] - TOP_Z[0], { tone: "mid" }, { name: "zeus.chord" });
    member("zeus.frame", [NOSE + 0.6, y, RAIL_Z[1] + 0.6], [X_FIRST, y, TOP_Z[0] + 0.8], 1, 1.2, { tone: "mid" }, { name: "zeus.nose" });
    const mid = (NOSE + X_FIRST) / 2;
    member("zeus.frame", [mid, y, RAIL_Z[1]], [mid, y, lerp(RAIL_Z[1], TOP_Z[0] + 0.8, (mid - NOSE) / (X_FIRST - NOSE)) - 0.4], 0.9, 0.9, { tone: "mid" }, { name: "zeus.nose-post" });
    for (const x of POSTS) member("zeus.frame", [x, y, RAIL_Z[1]], [x, y, TOP_Z[0]], 1.1, 1.1, { tone: "mid" }, { name: "zeus.post" });
    for (let i = 0; i < HOPPERS; i++) {
      const xa = POSTS[i];
      const xb = POSTS[i + 1];
      const xm = (xa + xb) / 2;
      member("zeus.frame", [xa + 0.6, y, TOP_Z[0]], [xm, y, RAIL_Z[1]], 0.9, 0.9, { tone: "mid" }, { name: "zeus.diagonal" });
      member("zeus.frame", [xm, y, RAIL_Z[1]], [xb - 0.6, y, TOP_Z[0]], 0.9, 0.9, { tone: "mid" }, { name: "zeus.diagonal" });
      box("zeus.frame", xm - 2.2, y + s * 0.6, RAIL_Z[0] - 0.3, xm + 2.2, y + s * 0.9, RAIL_Z[1] + 1.6, { tone: "mid" }, { cls: "hg-blue", name: "zeus.gusset" });
    }
    for (const x of POSTS) box("zeus.frame", x - 2.2, y + s * 0.6, TOP_Z[0] - 1.6, x + 2.2, y + s * 0.9, TOP_Z[1] + 0.3, { tone: "mid" }, { cls: "hg-blue", name: "zeus.gusset" });
  }
  for (const x of [NOSE, ...POSTS, RAIL_END]) member("zeus.frame", [x, -HALF + 0.2, RAIL_Z[0] - 0.7], [x, HALF - 0.2, RAIL_Z[0] - 0.7], 0.9, 1.4, { tone: "lo" }, { name: "zeus.cross" });
  for (const x of POSTS) member("zeus.frame", [x, -HALF + 1.2, (TOP_Z[0] + TOP_Z[1]) / 2], [x, HALF - 1.2, (TOP_Z[0] + TOP_Z[1]) / 2], 0.9, 1.2, { tone: "mid" }, { name: "zeus.cross-top" });
  box("zeus.frame", NOSE - 1, -HALF + 0.6, RAIL_Z[1], NOSE + 26, HALF - 0.6, RAIL_Z[1] + 0.6, { tone: "mid" }, { name: "zeus.deck" });
  box("zeus.frame", NOSE + 2, -HALF + 0.6, RAIL_Z[0] - 0.6, NOSE + 16, HALF - 0.6, RAIL_Z[0], { tone: "lo" }, { name: "zeus.kingpin.plate" });
  disc("zeus.frame", G.frameOf([NOSE + 9, 0, RAIL_Z[0] - 0.6], [0, 0, -1], [1, 0, 0], [0, -1, 0]), 0, 2.2, 0.8, { tone: "mid" }, { name: "zeus.kingpin" });
}

function hopper(i) {
  const xa = POSTS[i] + 0.9;
  const xb = POSTS[i + 1] - 0.9;
  const xm = (xa + xb) / 2;
  const half = HALF + 0.3;
  const piece = "zeus.hoppers";
  for (const x of [xa + 4, xb - 4]) for (const s of sides) box(piece, x - 1.4, s * (HALF - 0.6) - 1.1, CELL_Z[0], x + 1.4, s * (HALF - 0.6) + 1.1, CELL_Z[1], { tone: "mid" }, { cls: "hg-blue", name: "zeus.loadcell" });
  const cone = { x0: xa + 2, x1: xb - 2, y: half - 2.2 };
  const v = frustum([xm - 3.5, -3.5, OUT_Z, xm + 3.5, 3.5], [cone.x0, -cone.y, HOP_Z[0], cone.x1, cone.y]);
  poly(piece, v, BOX_FACES, { tone: "hi" }, { name: `zeus.hopper${i + 1}.cone` });
  const rim = (ax, ay, bx, by) => k.segment([ax, ay, HOP_Z[1]], [bx, by, HOP_Z[1]], P);
  const geo = { id: `hop${i + 1}`, xa, xb, ya: -half, yb: half, z1: HOP_Z[0], top: HOP_Z[1], z0: OUT_Z, ox0: xm - 3.5, ox1: xm + 3.5, oy0: -3.5, oy1: 3.5, cx0: cone.x0, cx1: cone.x1, cy0: -cone.y, cy1: cone.y };
  HOPPER_GEO.push(geo);
  box(piece, xa, -half, HOP_Z[0], xb, half, HOP_Z[1], { tone: "hi" }, { name: `zeus.hopper${i + 1}.box`, r: 0.4, bevel: 0.6, inner: (plan, z) => L(k.sideSeam(plan, z + 1.2, P, 2), { tone: "faint" }), extra: `<g data-inside="${i}">${hopperInside(P, geo, START_LEVEL[i], GRAINS[i])}</g>` });
  const wing = (a, b, outward, height, flare) => plate(a, b, G.add3(G.add3(b, G.mul3(outward, flare)), [0, 0, height]), G.add3(G.add3(a, G.mul3(outward, flare)), [0, 0, height]), 0.35);
  poly(piece, wing([xa, -half, HOP_Z[1]], [xb, -half, HOP_Z[1]], [0, -1, 0], 4.4, 3.2), PLATE_FACES, { tone: "hi" }, { name: `zeus.hopper${i + 1}.wing` });
  poly(piece, wing([xb, half, HOP_Z[1]], [xa, half, HOP_Z[1]], [0, 1, 0], 2.2, 0.8), PLATE_FACES, { tone: "hi" }, { name: `zeus.hopper${i + 1}.lip` });
  if (i === 0) poly(piece, wing([xa, half, HOP_Z[1]], [xa, -half, HOP_Z[1]], [-1, 0, 0], 9, 3.4), PLATE_FACES, { tone: "hi" }, { name: `zeus.hopper1.splash` });
  box("zeus.gates", xm - 4.2, -4.2, OUT_Z - 2.2, xm + 4.2, 4.2, OUT_Z, { tone: "mid" }, { name: `zeus.gate${i + 1}.frame` });
  disc("zeus.gates", G.frameOf([xm - 3, -4.2, OUT_Z - 3.8], [0, 1, 0], [1, 0, 0], [0, 0, 1]), 0, 8.4, 1.6, { tone: "hi" }, { name: `zeus.gate${i + 1}.jaw` });
  disc("zeus.gates", G.frameOf([xm + 3, -4.2, OUT_Z - 3.8], [0, 1, 0], [1, 0, 0], [0, 0, 1]), 0, 8.4, 1.6, { tone: "hi" }, { name: `zeus.gate${i + 1}.jaw` });
  box(piece, xm + 8, half, HOP_Z[0] + 1.4, xm + 10.6, half + 1.8, HOP_Z[0] + 4, { tone: "mid" }, { cls: "hg-blue", name: `zeus.vibrator${i + 1}` });
}

function belt() {
  const piece = "zeus.belt";
  const trough = [[-BELT_HALF, 0.9], [-2, 0], [2, 0], [BELT_HALF, 0.9], [BELT_HALF, 1.25], [2, 0.35], [-2, 0.35], [-BELT_HALF, 1.25]];
  const flatF = G.frameOf([X_FIRST - 6, 0, BELT_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const run = BEND_X - (X_FIRST - 6);
  const id = R.nameFor("zeus.belt.flat");
  put(piece, [(X_FIRST - 6 + BEND_X) / 2, 0, BELT_Z], S(G.prismOf(flatF, trough, 0, run, P), { tone: "lo" }), { name: id, shapes: [R.solid(A.prism(flatF, trough, 0, run, { name: id }))] });
  for (const s of sides) member(piece, [X_FIRST - 7, s * 4.4, BELT_Z - 1], [BEND_X, s * 4.4, BELT_Z - 1], 0.8, 2.4, { tone: "mid" }, { name: "zeus.belt.stringer" });
  disc(piece, G.frameOf([X_FIRST - 7, -4, BELT_Z], [0, 1, 0], [1, 0, 0], [0, 0, 1]), 0, 8, 1.8, { tone: "mid" }, { name: "zeus.belt.tail", owner: id });
  const rise = [HEAD[0] - BEND_X, 0, HEAD[2] - BELT_Z];
  const len = G.len3(rise);
  const dir = G.unit3(rise);
  const up = G.unit3(G.cross3([0, 1, 0], dir));
  const incF = { o: [BEND_X, 0, BELT_Z], a: dir, u: [0, 1, 0], v: G.cross3(dir, [0, 1, 0]) };
  const inc = R.nameFor("zeus.belt.incline");
  put(piece, G.add3(incF.o, G.mul3(dir, len / 2)), S(G.prismOf(incF, trough, 0, len - 2, P), { tone: "lo" }), { name: inc, shapes: [R.solid(A.prism(incF, trough, 0, len - 2, { name: inc, owner: "zeus.head" }))] });
  for (const s of sides) member(piece, G.add3([BEND_X, s * 4.4, BELT_Z], G.mul3(up, -1)), G.add3([HEAD[0] - 1, s * 4.4, HEAD[2]], G.mul3(up, -1)), 0.8, 2.4, { tone: "mid" }, { name: "zeus.belt.stringer", owner: "zeus.head" });
  for (const t of [0.22, 0.48, 0.74]) {
    const p = G.add3([BEND_X, 0, BELT_Z], G.mul3(rise, t));
    const q = G.add3(p, G.mul3(up, -1.7));
    disc(piece, G.frameOf([q[0], -4, q[2]], [0, 1, 0], [1, 0, 0], [0, 0, 1]), 0, 8, 0.8, { tone: "mid" }, { name: "zeus.belt.idler" });
  }
  const load = [[-0.7, 1.3], [0.7, 1.3], [0.7, 2.1], [-0.7, 2.1]];
  put(piece, [(X_FIRST - 6 + BEND_X) / 2, 0, BELT_Z + 0.9], `<g data-load="flat"></g>`, { name: "zeus.belt.load-flat", shapes: [A.prism(flatF, load, 0, run, { name: "zeus.belt.load-flat", owner: id })] });
  put(piece, G.add3(incF.o, G.mul3(dir, len / 2 + 0.2)), `<g data-load="incline"></g>`, { name: "zeus.belt.load-incline", shapes: [A.prism(incF, load, 0, len - 2, { name: "zeus.belt.load-incline", owner: inc })] });
  const strutTop = G.add3([BEND_X, 0, BELT_Z], G.mul3(rise, 0.55));
  for (const s of sides) member(piece, [RAIL_END - 1, s * (HALF - 0.6), RAIL_Z[1]], [strutTop[0], s * 4.4, strutTop[2] - 2.6], 1, 1, { tone: "mid" }, { name: "zeus.belt.strut" });
  member(piece, [strutTop[0], -4.4, strutTop[2] - 2.6], [strutTop[0], 4.4, strutTop[2] - 2.6], 0.9, 0.9, { tone: "mid" }, { name: "zeus.belt.strut-cross" });
  const hood = frustum([HEAD[0] + 1, -2.8, HEAD[2] - 7, HEAD[0] + 7, 2.8], [HEAD[0] - 4, -5.4, HEAD[2] - 1, HEAD[0] + 9, 5.4]);
  poly(piece, hood, BOX_FACES, { tone: "hi" }, { name: "zeus.hood.funnel", owner: "zeus.head" });
  poly(piece, boxVerts(HEAD[0] - 4, -5.4, HEAD[2] - 1, HEAD[0] + 9, 5.4, HEAD[2] + 6), BOX_FACES, { tone: "hi" }, { name: "zeus.hood.box", owner: "zeus.head" });
  disc(piece, G.frameOf([HEAD[0] + 3, 0, HEAD[2] + 6], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 1.6, 2.8, { tone: "mid" }, { name: "zeus.hood.inlet" });
  box(piece, HEAD[0] - 3, 5.4, HEAD[2] - 3, HEAD[0] + 3, 9.8, HEAD[2] + 2.4, { tone: "mid" }, { cls: "hg-blue", name: "zeus.belt.motor" });
  turned(piece, G.frameOf([HEAD[0] + 4, 0, HEAD[2] - 7], [0, 0, -1], [1, 0, 0], [0, -1, 0]), [[0, 3.1], [7, 3.1]], { tone: "mid" }, { cls: "hg-sleeve", name: "zeus.sleeve", owner: "descarga" });
}

function water() {
  const piece = "zeus.water";
  const x0 = X_LAST + 6;
  const x1 = x0 + 12;
  const py = HALF - 0.6;
  for (const x of [x0, x1]) for (const s of sides) member(piece, [x, s * py, RAIL_Z[1]], [x, s * py, 54], 1, 1, { tone: "mid" }, { name: "zeus.water.post" });
  for (const s of sides) member(piece, [x0 - 0.5, s * py, 54.5], [x1 + 0.5, s * py, 54.5], 1, 1, { tone: "mid" }, { name: "zeus.water.beam" });
  member(piece, [(x0 + x1) / 2, -py - 0.5, 55.5], [(x0 + x1) / 2, py + 0.5, 55.5], 1, 1, { tone: "mid" }, { name: "zeus.water.cross" });
  box(piece, (x0 + x1) / 2 - 0.8, -0.8, 52.6, (x0 + x1) / 2 + 0.8, 0.8, 55, { tone: "mid" }, { cls: "hg-blue", name: "zeus.water.loadcell" });
  const gx = (x0 + x1) / 2;
  const glass = k.pathOf([[gx - 0.7, 6.55, SIGHT[0]], [gx + 0.7, 6.55, SIGHT[0]], [gx + 0.7, 6.55, SIGHT[1]], [gx - 0.7, 6.55, SIGHT[1]]].map(at), true);
  box(piece, x0 + 1, -6.5, 37.5, x1 - 1, 6.5, 52.6, { tone: "hi" }, { name: "zeus.water.tank", r: 0.6, bevel: 0.6, extra: L(glass, { tone: "lo" }) + `<path class="hg-water-col" data-water data-free="end" d=""/>` });
  WATER_GLASS.push(gx, 6.55);
  const pump = [x0 + 5, 11.4, RAIL_Z[1]];
  box(piece, pump[0] - 2.2, pump[1] - 1.4, pump[2], pump[0] + 2.2, pump[1] + 1.6, pump[2] + 3.2, { tone: "mid" }, { cls: "hg-blue", name: "zeus.water.pump" });
}

function compressor() {
  const piece = "zeus.air";
  const F = G.frameOf([NOSE + 13, -7, RAIL_Z[1] + 5], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  turned(piece, F, [[0, 0], [0, 2.6, 1], [0.8, 3.4, 1], [13.2, 3.4, 1], [14, 2.6, 1], [14, 0]], { tone: "lo" }, { cls: "hg-black", name: "zeus.air.tank" });
  for (const y of [-4, 4]) box(piece, NOSE + 10.5, y - 0.6, RAIL_Z[1] + 0.6, NOSE + 15.5, y + 0.6, RAIL_Z[1] + 1.6, { tone: "mid" }, { name: "zeus.air.saddle" });
  box(piece, NOSE + 10, -3, RAIL_Z[1] + 8.4, NOSE + 16, 3, RAIL_Z[1] + 12.2, { tone: "mid" }, { cls: "hg-black", name: "zeus.air.head" });
  box(piece, NOSE + 18, -9.5, RAIL_Z[1] + 0.6, NOSE + 23, -4.5, RAIL_Z[1] + 11, { tone: "mid" }, { name: "zeus.cabinet" });
  box(piece, NOSE + 18, 4.5, RAIL_Z[1] + 0.6, NOSE + 23, 9.5, RAIL_Z[1] + 9, { tone: "mid" }, { name: "zeus.cabinet" });
}

function running() {
  const piece = "zeus.axle";
  const tire = (y, flip) => {
    const F = G.frameOf([AXLE_X, y, TIRE_R], [0, flip, 0], [1, 0, 0], [0, 0, 1]);
    turned(piece, F, [[-1.3, 0], [-1.3, 4.2], [-1.1, 4.9, 1], [-0.6, TIRE_R, 1], [0.6, TIRE_R, 1], [1.1, 4.9, 1], [1.3, 4.2], [1.3, 0]], { tone: "lo" }, { cls: "hg-black", name: "zeus.tire", meta: { ground: true } });
  };
  for (const s of sides) {
    tire(s * 9, s);
    tire(s * 11.9, s);
    disc(piece, G.frameOf([AXLE_X, s * 13.2, TIRE_R], [0, s, 0], [1, 0, 0], [0, 0, 1]), 0, 0.3, 2.6, { tone: "mid" }, { name: "zeus.hub" });
  }
  member(piece, [AXLE_X, -7.7, TIRE_R], [AXLE_X, 7.7, TIRE_R], 1.4, 1.4, { tone: "lo" }, { name: "zeus.axle" });
  for (const s of sides) {
    member(piece, [AXLE_X - 9, s * 5.4, RAIL_Z[0]], [AXLE_X + 6, s * 5.4, TIRE_R + 0.7], 1, 1.2, { tone: "lo" }, { name: "zeus.arm", owner: "zeus.susp" });
    turned(piece, G.frameOf([AXLE_X + 6, s * 5.4, TIRE_R + 1.3], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[0, 0], [0, 1.6], [0.6, 1.9, 1], [2.2, 2.0, 1], [3.7, 1.9, 1], [4.4, 1.6], [4.4, 0]], { tone: "lo" }, { cls: "hg-black", name: "zeus.airbag", owner: "zeus.susp" });
  }
  for (const s of sides) {
    const y = s * 5.6;
    [[18, 0], [14, 0.7], [9, 1.4]].forEach(([half, dz], n) => box(piece, AXLE_X - half, y - 1.1, TIRE_R + 0.7 + dz, AXLE_X + half, y + 1.1, TIRE_R + 1.4 + dz, { tone: n ? "mid" : "lo" }, { name: `zeus.leaf${n}`, owner: "zeus.susp", r: 0.2, bevel: 0 }));
    for (const x of [AXLE_X - 17.5, AXLE_X + 17.5]) member(piece, [x, y, RAIL_Z[0]], [x, y, TIRE_R + 1.4], 0.9, 1.4, { tone: "lo" }, { name: "zeus.leaf.hanger", owner: "zeus.susp" });
    box(piece, AXLE_X - 1.4, y - 1.3, TIRE_R + 2.8, AXLE_X + 1.4, y + 1.3, TIRE_R + 3.6, { tone: "mid" }, { name: "zeus.leaf.clamp", owner: "zeus.susp" });
  }
  const jack = (x, y) => {
    const own = `zeus.jack@${x},${y}`;
    member("zeus.jacks", [x, y, RAIL_Z[1] + 1], [x, y, 5], 1.4, 1.4, { tone: "lo" }, { cls: "hg-black", name: "zeus.jack", owner: own });
    jackLeg("zeus.jacklegs", [x, y, 5], own);
    box("zeus.jacklegs", x - 1.6, y - 1.6, 0, x + 1.6, y + 1.6, 0.6, { tone: "lo" }, { name: "zeus.jack.foot", meta: { ground: true } });
  };
  for (const x of [NOSE + 4, X_FIRST + 2, POSTS[HOPPERS - 1] + 2]) for (const s of sides) jack(x, s * (HALF + 0.7));
  const sx = X_FIRST - 5;
  const sy = HALF + 6;
  box("zeus.light", sx - 1.6, sy - 1.6, 0, sx + 1.6, sy + 1.6, 0.6, { tone: "lo" }, { name: "zeus.light.base", meta: { ground: true } });
  member("zeus.light", [sx, sy, 0.6], [sx, sy, 32], 0.8, 0.8, { tone: "mid" }, { name: "zeus.light.pole" });
  const lamp = (z, colour) => `<path class="hg-lamp" data-lamp="${colour}" d="${k.sideRing([sx, sy + 1.25, z], 0.85, "y", P)}"/>`;
  box("zeus.light", sx - 1.3, sy - 1.2, 32, sx + 1.3, sy + 1.2, 38, { tone: "lo" }, { cls: "hg-black", name: "zeus.light.head", extra: lamp(36.4, "red") + lamp(33.6, "green") });
}


const THOR_U = G.unit3([Math.cos((-30 * Math.PI) / 180), Math.sin((-30 * Math.PI) / 180), 0]);
const THOR_W = [-THOR_U[1], THOR_U[0], 0];
const BAZUCA_ANGLE = (35 * Math.PI) / 180;
const SCREW_TOP = [HEAD[0] + 3, -1.4, HEAD[2] + 14.5];
const BOOT_Z = 15.6;
const BOOT = G.add3([SCREW_TOP[0], SCREW_TOP[1], BOOT_Z], G.mul3(THOR_U, (SCREW_TOP[2] - BOOT_Z) / Math.tan(BAZUCA_ANGLE)));
const THOR_O = G.add3(BOOT, G.mul3(THOR_U, 4));
const T2 = (u, w, z) => [THOR_O[0] + THOR_U[0] * u + THOR_W[0] * w, THOR_O[1] + THOR_U[1] * u + THOR_W[1] * w, z];
const TH = { len: 100, half: 12.5, rail: [11, 13], chord: [26, 27.6], boxTop: 43, boxBottom: 30, cones: [28, 62], coneZ: 19.6, axle: 8 };

function thorFrame() {
  const piece = "thor.frame";
  const rbox = (u0, w0, z0, u1, w1, z1, style, options) => poly(piece, boxVerts(u0, w0, z0, u1, w1, z1).map(([u, w, z]) => T2(u, w, z)), BOX_FACES, style, options);
  const posts = [2, 18, 45, 72, 88];
  for (const s of sides) {
    const w = s * (TH.half - 0.6);
    member(piece, T2(-2, w, 12), T2(TH.len, w, 12), 1.2, 2, { tone: "mid" }, { name: "thor.rail" });
    member(piece, T2(posts[0], w, (TH.chord[0] + TH.chord[1]) / 2), T2(posts[4], w, (TH.chord[0] + TH.chord[1]) / 2), 1.2, 1.6, { tone: "mid" }, { name: "thor.chord" });
    member(piece, T2(posts[4], w, TH.chord[0] + 0.4), T2(TH.len - 1, w, 13), 1, 1.1, { tone: "mid" }, { name: "thor.nose" });
    for (const u of posts) member(piece, T2(u, w, 13), T2(u, w, TH.chord[0]), 1, 1, { tone: "mid" }, { name: "thor.post" });
    for (let i = 1; i < posts.length - 1; i++) {
      const um = (posts[i] + posts[i + 1]) / 2;
      member(piece, T2(posts[i] + 0.5, w, TH.chord[0]), T2(um, w, 13), 0.8, 0.8, { tone: "mid" }, { name: "thor.diagonal" });
      member(piece, T2(um, w, 13), T2(posts[i + 1] - 0.5, w, TH.chord[0]), 0.8, 0.8, { tone: "mid" }, { name: "thor.diagonal" });
    }
    rbox(posts[2] - 2, w + s * 0.6 - 0.15, TH.chord[0] - 1.4, posts[2] + 2, w + s * 0.6 + 0.15, TH.chord[1] + 0.3, { tone: "mid" }, { cls: "hg-blue", name: "thor.gusset" });
  }
  for (const u of [-2, ...posts, TH.len]) member(piece, T2(u, -TH.half + 1.2, 11.6), T2(u, TH.half - 1.2, 11.6), 0.8, 1.2, { tone: "lo" }, { name: "thor.cross" });
  poly(piece, boxVerts(TH.len - 13, -TH.half + 0.6, 10.4, TH.len - 1, TH.half - 0.6, 11).map(([u, w, z]) => T2(u, w, z)), BOX_FACES, { tone: "lo" }, { name: "thor.kingpin.plate" });
  disc(piece, G.frameOf(T2(TH.len - 6, 0, 10.4), [0, 0, -1], THOR_U, G.mul3(THOR_W, -1)), 0, 2.2, 0.8, { tone: "mid" }, { name: "thor.kingpin" });
  for (const s of sides) {
    const w = s * (TH.half + 1.6);
    turned("thor.axle", G.frameOf(T2(TH.axle, w, TIRE_R), G.mul3(THOR_W, s), THOR_U, [0, 0, 1]), [[-1.3, 0], [-1.3, 4.2], [-1.1, 4.9, 1], [-0.6, TIRE_R, 1], [0.6, TIRE_R, 1], [1.1, 4.9, 1], [1.3, 4.2], [1.3, 0]], { tone: "lo" }, { cls: "hg-black", name: "thor.tire", meta: { ground: true } });
    disc("thor.axle", G.frameOf(T2(TH.axle, w + s * 1.3, TIRE_R), G.mul3(THOR_W, s), THOR_U, [0, 0, 1]), 0, 0.3, 2.6, { tone: "mid" }, { name: "thor.hub" });
    [[14, 0], [10, 0.7], [6, 1.4]].forEach(([half, dz], n) => poly("thor.axle", boxVerts(TH.axle - half, s * 7 - 1.1, TIRE_R + 0.7 + dz, TH.axle + half, s * 7 + 1.1, TIRE_R + 1.4 + dz).map(([u, w, z]) => T2(u, w, z)), BOX_FACES, { tone: n ? "mid" : "lo" }, { name: `thor.leaf${n}`, owner: "thor.susp" }));
    for (const u of [TH.axle - 13.5, TH.axle + 13.5]) member("thor.axle", T2(u, s * 7, 11), T2(u, s * 7, TIRE_R + 1.4), 0.9, 1.4, { tone: "lo" }, { name: "thor.leaf.hanger", owner: "thor.susp" });
    member("thor.axle", T2(TH.axle - 8, s * 7, 11), T2(TH.axle + 6, s * 7, TIRE_R + 0.7), 1, 1.2, { tone: "lo" }, { name: "thor.arm", owner: "thor.susp" });
    turned("thor.axle", G.frameOf(T2(TH.axle + 6, s * 7, TIRE_R + 1.3), [0, 0, 1], THOR_U, THOR_W), [[0, 0], [0, 1.6], [0.6, 1.9, 1], [2.2, 2.0, 1], [3.7, 1.9, 1], [4.4, 1.6], [4.4, 0]], { tone: "lo" }, { cls: "hg-black", name: "thor.airbag", owner: "thor.susp" });
    const jw = s * (TH.half + 0.7);
    member("thor.jacks", T2(70, jw, 13.6), T2(70, jw, 5), 1.4, 1.4, { tone: "lo" }, { cls: "hg-black", name: "thor.jack", owner: `thor.jack${s}` });
    jackLeg("thor.jacklegs", T2(70, jw, 5), `thor.jack${s}`);
    poly("thor.jacklegs", boxVerts(68.4, jw - 1.6, 0, 71.6, jw + 1.6, 0.6).map(([u, w, z]) => T2(u, w, z)), BOX_FACES, { tone: "lo" }, { name: "thor.jack.foot", meta: { ground: true } });
  }
  member("thor.axle", T2(TH.axle, -TH.half - 0.3, TIRE_R), T2(TH.axle, TH.half + 0.3, TIRE_R), 1.4, 1.4, { tone: "lo" }, { name: "thor.axle" });
}

function thorSilo() {
  const piece = "thor.silo";
  const map = (list) => list.map(([u, w, z]) => T2(u, w, z));
  for (const u of [14, 76]) for (const s of sides) poly(piece, map(boxVerts(u - 1.4, s * 12.1 - 1.1, TH.chord[1], u + 1.4, s * 12.1 + 1.1, TH.boxBottom)), BOX_FACES, { tone: "mid" }, { cls: "hg-blue", name: "thor.loadcell" });
  TH.cones.forEach((u, i) => {
    const half = (TH.cones[1] - TH.cones[0]) / 2;
    poly(piece, map(frustum([u - 2.6, -2.6, TH.coneZ, u + 2.6, 2.6], [u - half + 1.5, -TH.half + 1.6, TH.boxBottom, u + half - 1.5, TH.half - 1.6])), BOX_FACES, { tone: "hi" }, { name: `thor.cone${i + 1}` });
    poly(piece, map(boxVerts(u - 2, -2, 17.2, u + 2, 2, TH.coneZ)), BOX_FACES, { tone: "mid" }, { name: `thor.cone${i + 1}.valve` });
  });
  const boxV = map([[TH.cones[0] - 17, -TH.half, TH.boxBottom], [TH.cones[1] + 17, -TH.half, TH.boxBottom], [TH.cones[1] + 17, TH.half, TH.boxBottom], [TH.cones[0] - 17, TH.half, TH.boxBottom], [0, -TH.half, TH.boxTop], [90, -TH.half, TH.boxTop], [90, TH.half, TH.boxTop], [0, TH.half, TH.boxTop]]);
  const seam = L(k.pathOf([T2(TH.cones[0] - 17 - 0.7 * 3.3, TH.half + 0.02, TH.boxBottom + 3), T2(TH.cones[1] + 17 + 0.7 * 3.3, TH.half + 0.02, TH.boxBottom + 3)].map(at)), { tone: "faint" });
  poly(piece, boxV, BOX_FACES, { tone: "hi" }, { name: "thor.box", inner: seam });
  for (const u of [24, 52]) disc(piece, G.frameOf(T2(u, 0, TH.boxTop), [0, 0, 1], THOR_U, THOR_W), 0, 0.8, 3.2, { tone: "mid" }, { name: "thor.hatch" });
  disc(piece, G.frameOf(T2(70, 5, TH.boxTop), [0, 0, 1], THOR_U, THOR_W), 0, 2.2, 0.9, { tone: "mid" }, { name: "thor.relief" });
  const dust = T2(95, 0, 34);
  poly(piece, map(boxVerts(88.2, -2.4, 38, 90.6, 2.4, 41)), BOX_FACES, { tone: "mid" }, { name: "thor.dust.bracket" });
  turned(piece, G.frameOf(dust, [0, 0, 1], THOR_U, THOR_W), [[0, 0], [0, 1.4], [3, 4.4], [9, 4.4], [9.6, 4.6], [10.4, 4.6], [10.4, 0]], { tone: "hi" }, { name: "thor.dust" });
}

function screws() {
  const piece = "thor.screws";
  const housings = TH.cones.map((u) => [u - 2.6, u + 2.6]);
  housings.forEach(([u0, u1], n) => poly(piece, boxVerts(u0, -2.2, 13.8, u1, 2.2, 17.2).map(([u, w, z]) => T2(u, w, z)), BOX_FACES, { tone: "mid" }, { name: `thor.screw.inlet${n + 1}`, owner: n ? "thor.inlet2" : "thor.screw" }));
  tube(piece, [T2(-1.4, 0, 15.5), T2(housings[1][0], 0, 15.5)], 1.05, { name: "thor.screw", tone: "hi", maxLength: 14, gaps: [[housings[0][0] + 1.4, housings[0][1] + 1.4]] });
  poly(piece, boxVerts(-6.2, -3.4, 12.2, -1.4, 3.4, 19).map(([u, w, z]) => T2(u, w, z)), BOX_FACES, { tone: "mid" }, { name: "thor.boot", owner: "thor.boot" });
  const start = BOOT;
  const end = SCREW_TOP;
  const axis = G.unit3(G.sub3(end, start));
  const len = G.len3(G.sub3(end, start));
  const AF = G.frameAlong(start, axis);
  const out = 2.6 / Math.cos(BAZUCA_ANGLE) + 0.6;
  disc(piece, AF, 0, out, 1.6, { tone: "mid" }, { name: "thor.bazuca.collar", owner: "thor.boot" });
  const head = len - 2.2;
  const bands = [0.3, 0.55, 0.8].map((t) => out + (head - out) * t);
  tube(piece, [G.add3(start, G.mul3(axis, out)), G.add3(start, G.mul3(axis, head))], 1.05, { name: "thor.bazuca", tone: "hi", maxLength: 12, gaps: bands.map((s) => [s - out - 0.4, s - out + 0.4]) });
  for (const s of bands) disc(piece, G.frameAlong(G.add3(start, G.mul3(axis, s)), axis), -0.4, 0.4, 1.45, { tone: "mid" }, { name: "thor.bazuca.band", owner: "thor.bazuca" });
  disc(piece, AF, head, len + 1, 1.7, { tone: "mid" }, { name: "thor.bazuca.head", owner: "thor.head" });
  const side = G.unit3(G.cross3(axis, [0, 0, 1]));
  const lift = G.unit3(G.cross3(side, axis));
  const a0 = G.add3(G.add3(start, G.mul3(axis, out + 2)), G.mul3(lift, 2.6));
  const a1 = G.add3(G.add3(start, G.mul3(axis, head - 1.2)), G.mul3(lift, 2.6));
  for (const p of [a0, a1]) disc(piece, G.frameAlong(G.add3(p, G.mul3(side, -0.25)), side), 0, 0.5, 0.9, { tone: "lo" }, { name: "thor.bazuca.sprocket", owner: "thor.bazuca" });
  for (const p of [a0, a1]) member(piece, G.add3(p, G.mul3(lift, -0.9)), G.add3(p, G.mul3(lift, -1.55)), 0.5, 0.5, { tone: "lo" }, { name: "thor.bazuca.bracket", owner: "thor.bazuca" });
  const chainLine = (offset) => k.segment(G.add3(a0, G.mul3(lift, offset)), G.add3(a1, G.mul3(lift, offset)), P);
  put(piece, G.mul3(G.add3(a0, a1), 0.5), L(chainLine(0.85) + chainLine(-0.85), { tone: "lo", className: "hg-chain" }), { bias: 0.4, name: "thor.chain", shapes: [A.tube([G.add3(a0, G.mul3(lift, 0.85)), G.add3(a1, G.mul3(lift, 0.85))], 0.1, { name: "thor.chain", owner: "thor.bazuca" }), A.tube([G.add3(a0, G.mul3(lift, -0.85)), G.add3(a1, G.mul3(lift, -0.85))], 0.1, { name: "thor.chain", owner: "thor.bazuca" })] });
  const top = G.add3(start, G.mul3(axis, len + 0.2));
  box(piece, top[0] - 1.8, top[1] - 1.6, top[2] + 1.9, top[0] + 1.8, top[1] + 1.6, top[2] + 5.3, { tone: "lo" }, { cls: "hg-black", name: "thor.bazuca.motor", owner: "thor.head" });
  const spoutTop = top[2] - 1.9;
  turned(piece, G.frameOf([top[0], top[1], spoutTop], [0, 0, -1], [1, 0, 0], [0, -1, 0]), [[0, 1.25], [spoutTop - (HEAD[2] + 7.6), 1.25]], { tone: "hi" }, { name: "thor.bazuca.spout", owner: "thor.head" });
  const mid = G.add3(start, G.mul3(axis, len * 0.42));
  const under = G.add3(mid, G.mul3(lift, -1.05));
  member(piece, T2(2, 0, TH.chord[1]), under, 0.8, 0.8, { tone: "mid" }, { name: "thor.bazuca.strut", owner: "thor.bazuca" });
}

const TRUCK_ANGLE = (-90 * Math.PI) / 180;
const TD = [Math.cos(TRUCK_ANGLE), Math.sin(TRUCK_ANGLE), 0];
const TN = [-Math.sin(TRUCK_ANGLE), Math.cos(TRUCK_ANGLE), 0];
const TO = G.add3([HEAD[0] + 4, 0, 0], G.mul3(TD, -4));
const T = (u, w, z) => [TO[0] + TD[0] * u + TN[0] * w, TO[1] + TD[1] * u + TN[1] * w, z];
const DRUM_AXIS = G.unit3(G.add3(TD, [0, 0, -0.21]));
const DRUM_F = G.frameOf(T(7, 0, 31), DRUM_AXIS, TN, G.cross3(DRUM_AXIS, TN));
const DRUM = [[0, 0], [0, 3.6], [1.6, 4.4, 1], [8, 10.2, 1], [14, 11.6, 1], [32, 11.6, 1], [42, 9.2, 1], [48, 5, 1], [50, 2.6], [50, 0]];
const CAB_U = 66;

function truck() {
  const piece = "olla";
  const rbox = (u0, w0, z0, u1, w1, z1, style, options) => poly(piece, boxVerts(u0, w0, z0, u1, w1, z1).map(([u, w, z]) => T(u, w, z)), BOX_FACES, style, options);
  for (const s of sides) member(piece, T(1.5, s * 4.6, 6.9), T(CAB_U + 18, s * 4.6, 6.9), 1, 2.4, { tone: "lo" }, { cls: "hg-black", name: "olla.rail" });
  const wheel = (u, w, s) => turned(piece, G.frameOf(T(u, w, TIRE_R), G.mul3(TN, s), TD, [0, 0, 1]), [[-1.3, 0], [-1.3, 4.2], [-1.1, 4.9, 1], [-0.6, TIRE_R, 1], [0.6, TIRE_R, 1], [1.1, 4.9, 1], [1.3, 4.2], [1.3, 0]], { tone: "lo" }, { cls: "hg-black", name: "olla.tire", meta: { ground: true } });
  for (const u of [18, 31]) for (const s of sides) { wheel(u, s * 7.2, s); wheel(u, s * 10.1, s); }
  for (const s of sides) wheel(CAB_U + 8, s * 9.6, s);
  for (const u of [18, 31, CAB_U + 8]) member(piece, T(u, -5.9, TIRE_R), T(u, 5.9, TIRE_R), 1.2, 1.2, { tone: "lo" }, { name: "olla.axle" });
  for (const s of sides) rbox(12, s * 8.65 - 2.8, TIRE_R * 2, 37, s * 8.65 + 2.8, TIRE_R * 2 + 0.7, { tone: "mid" }, { name: "olla.fender" });
  rbox(-0.5, -10, 5.4, 1.5, 10, 8, { tone: "mid" }, { name: "olla.bumper" });
  const roller = G.pointOf(DRUM_F, 9, 0, 0);
  const rollerU = 9;
  for (const s of sides) member(piece, T(rollerU, s * 4.6, 8.1), T(rollerU, s * 6.4, roller[2] - 9.6), 1.2, 1.2, { tone: "mid" }, { name: "olla.stand", owner: "olla.rollers" });
  for (const s of sides) disc(piece, G.frameOf(T(rollerU - 1.2, s * 6.6, roller[2] - 9.6), TD, TN, [0, 0, 1]), 0, 2.4, 1.3, { tone: "mid" }, { name: "olla.roller", owner: "olla.rollers" });
  const front = G.pointOf(DRUM_F, 49, 0, 0);
  const gear = G.frameAlong(G.pointOf(DRUM_F, 50, 0, 0), DRUM_AXIS);
  disc(piece, gear, 0, 3, 2.4, { tone: "mid" }, { name: "olla.gearbox" });
  const gc = G.pointOf(DRUM_F, 51.5, 0, 0);
  const gu = G.dot3(G.sub3(gc, TO), TD);
  rbox(gu - 2, -2.4, 8.1, gu + 2, 2.4, gc[2] - 2.4 * Math.sqrt(1 - DRUM_AXIS[2] ** 2), { tone: "mid" }, { name: "olla.pedestal" });
  turned(piece, DRUM_F, DRUM, { tone: "hi" }, { name: "olla.drum", owner: "olla.drum", extra: `<g data-drum>${drumRibs(0)}</g>` });
  const mouth = G.pointOf(DRUM_F, -0.4, 0, 0);
  const fz = mouth[2];
  poly(piece, frustum([-2.2, -2.6, fz + 0.5, 2.6, 2.6], [-6.4, -6.4, fz + 6, 4.4, 6.4]).map(([u, w, z]) => T(u + 3, w, z)), BOX_FACES, { tone: "hi" }, { name: "olla.funnel", owner: "descarga" });
  const cab = CAB_U;
  const cabV = [[cab, -11, 10.4], [cab + 18, -11, 10.4], [cab + 18, 11, 10.4], [cab, 11, 10.4], [cab, -11, 29], [cab + 12, -11, 29], [cab + 12, 11, 29], [cab, 11, 29], [cab + 18, -11, 20], [cab + 18, 11, 20]].map(([u, w, z]) => T(u, w, z));
  for (const u of [cab + 2, cab + 13]) for (const s of sides) rbox(u, s * 4.6 - 1.2, 8.1, u + 3, s * 4.6 + 1.2, 10.4, { tone: "lo" }, { name: "olla.cab.mount" });
  const win = [[cab + 2, 20.5], [cab + 11, 27.5], [cab + 2, 27.5], [cab + 2, 20.5]];
  const side = (u, z) => T(u, 11.05, z);
  poly(piece, cabV, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 8, 5, 4], [1, 2, 9, 8], [8, 9, 6, 5], [2, 3, 7, 6, 9], [3, 0, 4, 7]], { tone: "hi" }, { name: "olla.cab", extra: L(k.pathOf([side(cab + 2, 20.5), side(cab + 10.5, 20.5), side(cab + 10.5, 27.6), side(cab + 2, 27.6)].map(at), true), { tone: "lo" }) });
  turned(piece, G.frameOf(T(cab - 3, -7, 10.7), TN, TD, [0, 0, 1]), [[0, 0], [0, 2.6], [14, 2.6], [14, 0]], { tone: "mid" }, { name: "olla.water" });
}

function drumRibs(phase) {
  return k.fadedSvg(G.ribsOf(DRUM_F, 14, 32, 11.6, 14, P, { phase, twist: 0.9, fade: [0.08, 0.5], seams: true }), { tone: "lo" });
}

zeusFrame();
for (let i = 0; i < HOPPERS; i++) hopper(i);
belt();
water();
compressor();
running();
thorFrame();
thorSilo();
screws();
truck();

const STATES = [
  { label: "rest", shares: {} },
  { label: "olla away", shares: { olla: 1 } },
  { label: "olla half", shares: { olla: 0.5 } },
  { label: "transport", shares: { olla: 1, jacks: 1 } },
  ...[0.25, 0.5, 0.75, 1].map((a) => ({ label: `apart ${a}`, shares: { apart: a, olla: 1 } })),
];
A.settle(R, P, { states: STATES });
R.items.sort((a, b) => a.key - b.key);
const attrsOf = (item) => {
  const jaw = item.name.match(/^zeus\.gate(\d)\.jaw(#2)?/);
  let out = ` data-ride="${item.ride}"`;
  if (jaw) out += ` data-jaw="${Number(jaw[1]) - 1}" data-dir="${jaw[2] ? 1 : -1}"`;
  if (/^(zeus|thor)\.(airbag|arm)/.test(item.name)) out += ` data-susp="aire"`;
  if (/^(zeus|thor)\.leaf/.test(item.name)) out += ` data-susp="muelle"`;
  return out;
};
const body = R.items.map((item, index) => `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${item.move.map((v) => v.toFixed(1)).join(",")}"${attrsOf(item)}>${item.svg}</g>`).join("");
const ground = [
  `<path class="iso-halo" d="${k.haloOf({ x: NOSE - 2, y: -HALF - 1, w: RAIL_END - NOSE + 4, d: 2 * HALF + 2, r: 6 }, 0, 0.1, P)}" style="filter:blur(6px)"/>`,
].join("");
const DUST_AT = T(2, 0, G.pointOf(DRUM_F, -0.4, 0, 0)[2] + 6.2);
const svg = k.figureSvg({ width: W, height: H, label: "Planta dosificadora móvil Hegamex Zeus 30 de " + HOPPERS + " tolvas trabajando con el silo móvil para cemento Thor 36. Las tolvas de agregados descargan por compuertas de almeja sobre una banda que sube al matacaídas; la bazuca del Thor mete el cemento por arriba del matacaídas, el tanque de agua sobre celda de carga dosifica el agua, y todo cae por la manga a la olla revolvedora que espera debajo.", body: [ground, `<g class="hg-items">${body}</g>`, `<g class="hg-dust" aria-hidden="true"></g>`] });

const M = materials(HOPPERS);
const TL = timeline(HOPPERS);
const unit = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const flatLen = BEND_X - (X_FIRST - 6);
const incLen = G.len3([HEAD[0] - BEND_X, 0, HEAD[2] - BELT_Z]) - 2;
const RIB_PHASES = 12;
const DATA = {
  P,
  V: G.viewOf(P),
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  speedup: SPEEDUP,
  beltSpeed: BELT_MS * 10,
  belt: { x0: X_FIRST - 6, xBend: BEND_X, z: BELT_Z + 1.2, head: [HEAD[0] - 2 * Math.cos(Math.atan2(HEAD[2] - BELT_Z, HEAD[0] - BEND_X)), 0, HEAD[2] - 2 * Math.sin(Math.atan2(HEAD[2] - BELT_Z, HEAD[0] - BEND_X)) + 1.2], flatLen, incLen },
  hoppers: HOPPER_GEO.map((geo, i) => {
    const a = M.aggregates[i];
    const table = hopperTable(geo);
    const full = table[table.length - 1][1];
    return { geo, table, start: full * 0.72, grain: a.id, name: a.name, density: DENSITY[a.id], outlet: (geo.xa + geo.xb) / 2 };
  }),
  gates: TL.gates.map(({ id, name, hopper, kg, from, to }) => ({ id, name, hopper, kg, from, to })),
  cemento: TL.cemento,
  agua: TL.agua,
  beltOn: TL.belt,
  end: TL.end,
  thorStart: THOR_START_KG,
  tank: WATER_TANK_L,
  sight: { x: WATER_GLASS[0], y: WATER_GLASS[1], z0: SIGHT[0], z1: SIGHT[1] },
  ribs: Array.from({ length: RIB_PHASES }, (_, i) => drumRibs(((2 * Math.PI) / 14) * (i / RIB_PHASES))),
  dust: DUST_AT,
  ks: G.scaleOf(P),
  load: LOAD_M3,
  totalKg: M.aggregates.reduce((s, a) => s + a.kg, 0) + M.cemento + M.agua,
};

const rows = [...M.aggregates.map((a) => ({ id: a.id, name: a.name, unit: "kg", goal: a.kg })), { id: "cemento", name: "Cemento", unit: "kg", goal: M.cemento }, { id: "agua", name: "Agua", unit: "L", goal: M.agua }];
const fmt = (v) => Math.round(v).toLocaleString("es-MX");
const table = `<div class="hg-panel"><div class="hg-controls"><button type="button" class="hg-btn" data-play aria-pressed="true"><span class="hg-dot" aria-hidden="true"></span><span data-play-label>Pausa</span></button><span class="hg-seg" role="group" aria-label="Tolvas"><a class="hg-chip"${HOPPERS === 2 ? " data-on" : ""} href="${THEME === "light" ? "zeus2-light.html" : "zeus2.html"}">2 tolvas</a><a class="hg-chip"${HOPPERS === 3 ? " data-on" : ""} href="${THEME === "light" ? "zeus-light.html" : "zeus.html"}">3 tolvas</a></span><span class="hg-seg" role="group" aria-label="Suspensión"><button type="button" class="hg-chip" data-susp-set="aire" data-on>Suspensión neumática</button><button type="button" class="hg-chip" data-susp-set="muelle">Muelles</button></span><span class="hg-seg" role="group" aria-label="Modo"><button type="button" class="hg-chip" data-mode-set="operacion" data-on>Operación</button><button type="button" class="hg-chip" data-mode-set="transporte">Transporte</button></span><button type="button" class="hg-chip" data-apart aria-pressed="false">Despiece</button><span class="hg-clock" data-clock>0:00</span></div><table class="hg-table"><caption>Bachada de ${LOAD_M3} m³ · concreto f'c 250 · receta por m³: cemento ${RECIPE.cemento} kg, arena ${RECIPE.arena} kg, grava ${RECIPE.grava} kg, agua ${RECIPE.agua} L</caption><thead><tr><th scope="col">Material</th><th scope="col">Objetivo</th><th scope="col">Pesado</th><th scope="col" class="hg-bar-h"><span class="hg-sr">Avance</span></th></tr></thead><tbody>${rows.map((row) => `<tr data-row="${row.id}"><th scope="row"><span class="hg-key" data-grain="${row.id}"></span>${row.name}</th><td>${fmt(row.goal)} ${row.unit}</td><td data-got>0 ${row.unit}</td><td class="hg-bar"><span data-bar></span></td></tr>`).join("")}</tbody></table></div>`;
const css = `
.iso{--hg-blue:#2f7fd1;--hg-blue-top:#5aa0e6;--hg-black:#2a2a2a}
.hg-blue .iso-fill,.hg-blue .iso-top{fill:var(--hg-blue-top)}.hg-blue .iso-shade{fill:var(--hg-blue)}
.hg-black .iso-fill,.hg-black .iso-top,.hg-black .iso-shade{fill:var(--hg-black)}
.hg-cavity{fill:var(--anatomy-shade-0)}.hg-ledge{fill:var(--anatomy-top)}.hg-wall[data-w="0"]{fill:var(--anatomy-shade-0)}.hg-wall[data-w="1"]{fill:var(--anatomy-shade-1)}.hg-wall[data-w="2"]{fill:var(--anatomy-shade-2)}
.hg-grain{fill:var(--hg-grain)}.hg-heap[data-face="x"]{fill:var(--hg-grain-x)}.hg-heap[data-face="y"]{fill:var(--hg-grain-y)}
[data-grain="arena"]{--hg-grain:#e3d3b4;--hg-grain-x:#d8c6a3;--hg-grain-y:#cdb994;--hg-dot:#a8916a}
[data-grain="grava"]{--hg-grain:#c9c6c0;--hg-grain-x:#bcb9b2;--hg-grain-y:#b0ada6;--hg-dot:#7d7a74}
[data-grain="gravilla"]{--hg-grain:#d6d2ca;--hg-grain-x:#cac6be;--hg-grain-y:#bfbab2;--hg-dot:#8f8a82}
.hg-stipple{fill:none;stroke:var(--hg-dot);stroke-width:1.1;stroke-linecap:round}
.hg-blue-tube .tb-body{fill:var(--hg-blue)}
.hg-sleeve .iso-fill,.hg-sleeve .iso-shade,.hg-sleeve .iso-top{fill:#c9a86a}
`;
const plateBody = k
  .plateHtml({
    fig: "Fig 1",
    title: `Zeus 30 · ${HOPPERS} tolvas + Thor 36`,
    hint: "Ciclo de carga de una olla",
    readout: "Olla en posición",
    keys: [
      { mark: "raised", label: "Tolvas sobre 4 celdas de carga cada una: pesan lo que sale" },
      { mark: "lit", label: "Banda de 26\": lleva los agregados al matacaídas" },
      { mark: "flat", label: "Bazuca de 8\" del Thor: mete el cemento por arriba" },
    ],
    caption: `La Zeus 30 dosifica hasta 65 m³/h. Cada tolva de 9 m³ descansa en celdas de carga y su compuerta de almeja abre hasta que la tolva pierde exactamente el peso de la receta; la banda lo sube al matacaídas. Al mismo tiempo el Thor 36 (50 t de cemento, pesado con 4 celdas de 30 t) entrega el cemento con su bazuca y el tanque de 2,100 L pesa el agua por masa, no por volumen. Todo cae por la manga de 60 cm a la olla. Tiempos reales de una olla de ${LOAD_M3} m³ a 65 m³/h, mostrados ${SPEEDUP} veces más rápido.`,
    body: `<div class="iso-stage" tabindex="0">${svg}</div>`,
  })
  .replace("</div><figcaption", `</div>${table}<figcaption`);
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("__INSIDE__", hopperInside.toString().replace(/\bk\./g, ""));
const page = k.pageHtml({ title: "Zeus 30 + Thor 36", theme: THEME, body: plateBody, script: kitScript() + LIVE, width: 1240 }).replace("</style>", `${css}${readFileSync(join(HERE, "zeus.css"), "utf8")}</style>`).replace('<html lang="en">', '<html lang="es">');
const name = (HOPPERS === 2 ? "zeus2" : "zeus") + (THEME === "light" ? "-light" : "") + ".html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${Math.round(page.length / 1024)} KB`, `${R.items.length} items`);

const CROWD = [["thor.screw", "thor.post*"], ["thor.screw", "thor.arm*"]];
const ALLOW = [["zeus.arm*", "zeus.leaf*"], ["zeus.airbag*", "zeus.leaf*"], ["thor.arm*", "thor.leaf*"], ["thor.airbag*", "thor.leaf*"], ["zeus.sleeve*", "olla.funnel*"], ["zeus.belt.*", "zeus.hood.*"], ["zeus.belt.tail*", "zeus.belt.*"], ["zeus.belt.idler*", "zeus.belt.load*"]];
A.auditOrExit(R, P, { frames: STATES.slice(1), apart: true, allow: ALLOW, crowd: CROWD });
