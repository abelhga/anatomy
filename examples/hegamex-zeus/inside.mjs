import * as k from "../../kit/iso-kit.mjs";

export function hopperInside(P, h, level, grain) {
  const lerp = (a, b, t) => a + (b - a) * t;
  const at = (p) => k.iso(p, P);
  const d = (points) => "M" + points.map((p) => at(p).map((v) => v.toFixed(1)).join(" ")).join("L") + "Z";
  const ring = (z) => {
    if (z >= h.z1) return [h.xa, h.ya, h.xb, h.yb];
    const t = Math.max(0, (z - h.z0) / (h.z1 - h.z0));
    return [lerp(h.ox0, h.xa, t), lerp(h.oy0, h.ya, t), lerp(h.ox1, h.xb, t), lerp(h.oy1, h.yb, t)];
  };
  const [ia, ja, ib, jb] = [h.xa + 0.35, h.ya + 0.35, h.xb - 0.35, h.yb - 0.35];
  const open = d([[ia, ja, h.top], [ib, ja, h.top], [ib, jb, h.top], [ia, jb, h.top]]);
  const out = [`<clipPath id="${h.id}-clip"><path d="${open}"/></clipPath><g clip-path="url(#${h.id}-clip)">`];
  out.push(`<path class="hg-cavity" d="${open}"/>`);
  const [b0, c0, b1, c1] = ring(h.z0);
  out.push(`<path class="hg-wall" data-w="1" d="${d([[ia, ja, h.top], [ib, ja, h.top], [ib, ja, h.z1], [b1, c0, h.z0], [b0, c0, h.z0], [ia, ja, h.z1]])}"/>`);
  out.push(`<path class="hg-wall" data-w="2" d="${d([[ia, ja, h.top], [ia, jb, h.top], [ia, jb, h.z1], [b0, c1, h.z0], [b0, c0, h.z0], [ia, ja, h.z1]])}"/>`);
  out.push(`<path class="iso-line" data-tone="faint" d="${"M" + at([ia, ja, h.z1]).map((v) => v.toFixed(1)).join(" ") + "L" + at([ib, ja, h.z1]).map((v) => v.toFixed(1)).join(" ") + "M" + at([ia, ja, h.z1]).map((v) => v.toFixed(1)).join(" ") + "L" + at([ia, jb, h.z1]).map((v) => v.toFixed(1)).join(" ")}"/>`);
  if (level > h.z0 + 0.05) {
    const z = Math.min(level, h.top);
    const [x0, y0, x1, y1] = ring(z);
    const peak = Math.min(1.6, (z - h.z0) * 0.3);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    out.push(`<path class="hg-grain" data-grain="${grain}" d="${d([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]])}"/>`);
    const apex = [cx, cy, z + peak];
    const a = [lerp(x0, cx, 0.3), lerp(y0, cy, 0.3), z];
    const b = [lerp(x1, cx, 0.3), lerp(y0, cy, 0.3), z];
    const c = [lerp(x1, cx, 0.3), lerp(y1, cy, 0.3), z];
    const e = [lerp(x0, cx, 0.3), lerp(y1, cy, 0.3), z];
    out.push(`<path class="hg-grain hg-heap" data-face="x" data-grain="${grain}" d="${d([b, c, apex])}"/>`);
    out.push(`<path class="hg-grain hg-heap" data-face="y" data-grain="${grain}" d="${d([c, e, apex])}"/>`);
    const dots = [];
    for (let i = 1; i < 12; i++) for (let j = 1; j < 6; j++) {
      const u = (i + ((j * 7) % 3) * 0.33) / 12;
      const v = (j + ((i * 5) % 4) * 0.2) / 6;
      const p = at([lerp(x0, x1, u), lerp(y0, y1, v), z]);
      dots.push(`M${p[0].toFixed(1)} ${p[1].toFixed(1)}h0`);
    }
    out.push(`<path class="hg-stipple" data-grain="${grain}" d="${dots.join("")}"/>`);
  }
  out.push(`</g>`);
  return out.join("");
}
