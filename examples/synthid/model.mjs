export const N = 8;
export const DELTA = 0.6;
export const SURE = 0.6;
export const MAYBE = 0.3;

export const IMAGE = Array.from({ length: N }, (_, i) =>
  Array.from({ length: N }, (_, j) => 7 + 9 * Math.exp(-((i - 4.6) ** 2 + (j - 2.4) ** 2) / 7) + 0.5 * j),
);

const hash = (i, j) => {
  let h = (i * 374761393 + j * 668265263 + 1442695040) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const order = Array.from({ length: N * N }, (_, n) => n).sort((a, b) => hash(a >> 3, a & 7) - hash(b >> 3, b & 7));
export const KEY = Array.from({ length: N }, () => Array(N).fill(-1));
order.slice(0, (N * N) / 2).forEach((n) => (KEY[n >> 3][n & 7] = 1));

const map = (grid, fn) => grid.map((row, i) => row.map((h, j) => fn(h, i, j)));
const all = map(IMAGE, () => true);
const marked = map(IMAGE, (h, i, j) => h + DELTA * KEY[i][j]);
const neighbours = (grid, live, i, j) => {
  const out = [];
  for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) if (a >= 0 && a < N && b >= 0 && b < N && live[a][b]) out.push(grid[a][b]);
  return out;
};
const mean = (list) => list.reduce((s, v) => s + v, 0) / list.length;
const residual = (grid, live) => map(grid, (h, i, j) => (live[i][j] ? h - mean(neighbours(grid, live, i, j)) : 0));

export const SCENES = [
  { id: "original", name: "Original con marca", heights: marked, live: all },
  { id: "jpeg", name: "Compresión JPEG", heights: map(marked, (h, i, j) => Math.round(0.8 * h + 0.2 * mean(neighbours(marked, all, i, j)))), live: all },
  { id: "brillo", name: "Más brillo", heights: map(marked, (h) => h + 3), live: all },
  { id: "recorte", name: "Recorte", heights: marked, live: map(IMAGE, (_, i) => i >= 3) },
  { id: "blur", name: "Desenfoque fuerte", heights: map(marked, (h, i, j) => 0.5 * h + 0.5 * mean(neighbours(marked, all, i, j))), live: all },
  { id: "sin", name: "Sin marca", heights: IMAGE, live: all },
];

export function columnsOf(scene) {
  const r = residual(scene.heights, scene.live);
  const ref = residual(map(IMAGE, (_, i, j) => DELTA * KEY[i][j]), scene.live);
  let total = 0;
  const cols = [];
  for (let i = 0; i < N; i++) {
    let c = 0;
    for (let j = 0; j < N; j++) if (scene.live[i][j]) { c += KEY[i][j] * r[i][j]; total += KEY[i][j] * ref[i][j]; }
    cols.push(c);
  }
  return cols.map((c) => c / total);
}

export const verdictOf = (score) => (score >= SURE ? "detectada" : score >= MAYBE ? "posible" : "no detectada");
