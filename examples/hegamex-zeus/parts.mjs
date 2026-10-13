import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as A from "../../kit/audit.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";

export function polyPaths(verts, faces, P) {
  const V = G.viewOf(P);
  const flat = verts.map((v) => k.iso(v, P));
  const shades = [[], [], [], []];
  const top = [];
  const seen = [];
  faces.forEach((face, index) => {
    const [a, b, c] = face.map((i) => verts[i]);
    const n = G.unit3(G.cross3(G.sub3(b, a), G.sub3(c, a)));
    const facing = G.dot3(n, V) > 1e-6;
    seen[index] = facing;
    if (!facing) return;
    const d = k.pathOf(face.map((i) => flat[i]), true);
    if (n[2] > 0.82) top.push(d);
    else shades[Math.min(3, G.toneOf(n, P))].push(d);
  });
  const edges = new Map();
  faces.forEach((face, index) => {
    face.forEach((a, j) => {
      const b = face[(j + 1) % face.length];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const list = edges.get(key) ?? [];
      list.push(index);
      edges.set(key, list);
    });
  });
  const hull = G.hullOf(flat);
  const onHull = new Set();
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i];
    const q = hull[(i + 1) % hull.length];
    onHull.add(`${p[0].toFixed(3)},${p[1].toFixed(3)}|${q[0].toFixed(3)},${q[1].toFixed(3)}`);
    onHull.add(`${q[0].toFixed(3)},${q[1].toFixed(3)}|${p[0].toFixed(3)},${p[1].toFixed(3)}`);
  }
  const crease = [];
  for (const [key, list] of edges) {
    if (list.length < 2 || !seen[list[0]] || !seen[list[1]]) continue;
    const [a, b] = key.split(",").map(Number);
    const tag = `${flat[a][0].toFixed(3)},${flat[a][1].toFixed(3)}|${flat[b][0].toFixed(3)},${flat[b][1].toFixed(3)}`;
    if (onHull.has(tag)) continue;
    crease.push(k.pathOf([flat[a], flat[b]]));
  }
  return { fill: k.pathOf(hull, true), outline: k.pathOf(hull, true), crease: crease.join(""), top: top.join(""), shades: shades.map((list) => list.join("")) };
}

export function boxVerts(x0, y0, z0, x1, y1, z1) {
  return [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
}
export const BOX_FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];

export function frustum(bottom, top) {
  const [bx0, by0, bz, bx1, by1] = bottom;
  const [tx0, ty0, tz, tx1, ty1] = top;
  return [
    [bx0, by0, bz], [bx1, by0, bz], [bx1, by1, bz], [bx0, by1, bz],
    [tx0, ty0, tz], [tx1, ty0, tz], [tx1, ty1, tz], [tx0, ty1, tz],
  ];
}

export function plate(a, b, c, d, t) {
  const n = G.unit3(G.cross3(G.sub3(b, a), G.sub3(d, a)));
  const off = G.mul3(n, t);
  return [a, b, c, d, G.add3(a, off), G.add3(b, off), G.add3(c, off), G.add3(d, off)];
}
export const PLATE_FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];

export function frameBetween(a, b, up = [0, 0, 1]) {
  const axis = G.unit3(G.sub3(b, a));
  let u = G.cross3(up, axis);
  if (G.len3(u) < 1e-6) u = G.cross3([1, 0, 0], axis);
  u = G.unit3(u);
  const v = G.cross3(axis, u);
  return { o: a, a: axis, u, v };
}

export function scene(P, recorder, { moves = {}, rides = {} } = {}) {
  const R = recorder;
  const moveOf = (piece) => moves[piece] ?? [0, 0, 0];
  const rideOf = (piece) => rides[piece] ?? piece;
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);

  function put(piece, ref, svg, { bias = 0, shapes = [], name, move = moveOf(piece), ride, route, chunk } = {}) {
    const id = route ? name : R.nameFor(name ?? `${piece}.item`);
    R.put({ piece, ride: ride ?? rideOf(piece), at: ref, bias, svg, move, shapes, name: id, route, chunk });
    return id;
  }

  function poly(piece, verts, faces, style = {}, { extra = "", inner = "", bias = 0, name, owner, move, cls, meta = {} } = {}) {
    const id = R.nameFor(name ?? `${piece}.poly`);
    const paths = polyPaths(verts, faces, P);
    const centre = G.mul3(verts.reduce((s, v) => G.add3(s, v), [0, 0, 0]), 1 / verts.length);
    const body = S(paths, { tone: "hi", ...style, inner, className: cls });
    put(piece, centre, body + extra, { bias, move, name: id, shapes: [R.solid(A.hull(verts, faces, { name: id, owner, ...meta }))] });
    return id;
  }

  function box(piece, x0, y0, z0, x1, y1, z1, style = {}, { extra = "", inner = "", bias = 0, name, owner, move, r = 0.3, bevel = 0.3, steps = 2, cls, meta = {} } = {}) {
    const plan = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), d: Math.abs(y1 - y0), r };
    const z = Math.min(z0, z1);
    const h = Math.abs(z1 - z0);
    const id = R.nameFor(name ?? `${piece}.box`);
    const body = S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style, inner: typeof inner === "function" ? inner(plan, z, h) : inner, className: cls });
    put(piece, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], body + extra, { bias, move, name: id, shapes: [R.solid(A.slab(plan, z, h, { name: id, owner, ...meta }, steps))] });
    return id;
  }

  function member(piece, a, b, w, h, style = {}, { bias = 0, name, owner, move, extra = "", cls, up, meta = {} } = {}) {
    const F = frameBetween(a, b, up);
    const len = G.len3(G.sub3(b, a));
    const square = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const id = R.nameFor(name ?? `${piece}.member`);
    const body = S(G.prismOf(F, square, 0, len, P), { tone: "mid", ...style, className: cls });
    put(piece, G.mul3(G.add3(a, b), 0.5), body + extra, { bias, move, name: id, shapes: [R.solid(A.prism(F, square, 0, len, { name: id, owner, ...meta }))] });
    return id;
  }

  function turned(piece, F, profile, style = {}, { extra = "", inner = "", bias = 0, name, owner, move, steps, cls, smooth, meta = {} } = {}) {
    const id = R.nameFor(name ?? `${piece}.turned`);
    const paths = G.solidOf(profile, F, P, { ...(steps ? { steps } : {}), ...(smooth !== undefined ? { smooth } : {}) });
    const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
    put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner, className: cls }) + extra, { bias, move, name: id, shapes: [R.solid(A.solid(F, profile, { name: id, owner, ...meta }))] });
    return id;
  }

  function disc(piece, F, s0, s1, r, style = {}, options = {}) {
    return turned(piece, F, [[s0, r], [s1, r]], style, options);
  }

  function tube(piece, route, r, { name, tone = "hi", bias = 0, move, maxLength = 20, gaps = [], caps = true, owner, limp = false, touch, free, ends, cls, rings } = {}) {
    const id = R.nameFor(name ?? `${piece}.tube`);
    R.route(id, route, r, { owner: owner ?? id, gaps, limp, touch, free, ends, piece, move: move ?? moveOf(piece), ride: rideOf(piece) });
    tubePieces(route, r, P, { maxLength, gaps, caps, ...(rings ? { rings } : {}) }).forEach((part, index) => {
      const svg = tubeSvg(part, { tone });
      put(piece, part.mid, cls ? `<g class="${cls}">${svg}</g>` : svg, { bias, move, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] });
    });
    return id;
  }

  return { put, poly, box, member, turned, disc, tube, at, S, L, D };
}
