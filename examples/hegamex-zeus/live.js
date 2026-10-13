const D = __DATA__;
const hopperInside = __INSIDE__;
const P = D.P;
const root = __ROOT__;
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const itemsGroup = svg.querySelector(".hg-items");
const readout = root.querySelector("[data-readout]");
const clockEl = root.querySelector("[data-clock]");
const playButton = root.querySelector("[data-play]");
const playLabel = root.querySelector("[data-play-label]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const fmt = (v) => Math.round(v).toLocaleString("es-MX");
const fmt1 = (v) => v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const screen = (p) => iso(p, P);

const nodes = [...itemsGroup.querySelectorAll(":scope > .it")].map((el) => {
  const m = el.dataset.m.split(",").map(Number);
  return { el, piece: el.dataset.piece, ride: el.dataset.ride, key: Number(el.dataset.k), m, lift: m[0] * D.V[0] + m[1] * D.V[1] + m[2] * D.V[2], shown: "" };
});
let order = nodes.map((_, i) => i);
const moving = nodes.filter((node) => node.m.some((v) => v !== 0));
const insides = [...svg.querySelectorAll("[data-inside]")];
const jaws = [...svg.querySelectorAll("[data-jaw]")];
const loads = { flat: svg.querySelector('[data-load="flat"]'), incline: svg.querySelector('[data-load="incline"]') };
const waterCol = svg.querySelector("[data-water]");
const drum = svg.querySelector("[data-drum]");
const dustLayer = svg.querySelector(".hg-dust");
const puffs = [];
let dustClock = 0;
const rows = Object.fromEntries([...root.querySelectorAll("[data-row]")].map((row) => [row.dataset.row, { got: row.querySelector("[data-got]"), bar: row.querySelector("[data-bar]"), unit: row.querySelector("[data-got]").textContent.split(" ").pop() }]));

const CELL = 1.5;
const TOTAL = D.belt.flatLen + D.belt.incLen;
const COUNT = Math.ceil(TOTAL / CELL);
const KINDS = D.hoppers.map((h) => h.grain);

const state = {
  phase: "arrive",
  phaseAt: 0,
  clock: 0,
  t: 0,
  truck: 1,
  volume: D.hoppers.map((h) => h.start),
  shown: D.hoppers.map(() => -1),
  gate: D.hoppers.map(() => 0),
  dispensed: D.gates.map(() => 0),
  cement: 0,
  water: 0,
  thor: D.thorStart,
  tank: D.tank * 0.95,
  cells: Array.from({ length: COUNT }, () => null),
  shift: 0,
  delivered: 0,
  drumPhase: 0,
  running: true,
};

function levelOf(h, volume) {
  const table = h.table;
  for (let i = 1; i < table.length; i++) {
    if (table[i][1] >= volume) {
      const [z0, v0] = table[i - 1];
      const [z1, v1] = table[i];
      return z0 + ((volume - v0) / (v1 - v0 || 1)) * (z1 - z0);
    }
  }
  return table[table.length - 1][0];
}

function beltPoint(s) {
  const b = D.belt;
  if (s <= b.flatLen) return [b.x0 + s, 0, b.z];
  const t = (s - b.flatLen) / b.incLen;
  return [b.xBend + (b.head[0] - b.xBend) * t, 0, b.z + (b.head[2] - b.z) * t];
}

function drawLoads() {
  const parts = { flat: {}, incline: {} };
  let run = null;
  const flush = () => {
    if (!run) return;
    const where = run.from < D.belt.flatLen ? "flat" : "incline";
    const pts = [];
    for (let s = run.from; s <= run.to + 1e-6; s += CELL) pts.push(screen(beltPoint(Math.min(s, run.to))));
    if (pts.length < 2) pts.push(screen(beltPoint(run.to + 0.4)));
    const d = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L");
    parts[where][run.kind] = (parts[where][run.kind] || "") + d;
    run = null;
  };
  for (let i = 0; i < COUNT; i++) {
    const cell = state.cells[i];
    const s = i * CELL;
    const boundary = s < D.belt.flatLen && s + CELL >= D.belt.flatLen;
    if (!cell) {
      flush();
      continue;
    }
    if (run && run.kind !== cell.kind) flush();
    if (!run) run = { kind: cell.kind, from: s, to: s + CELL };
    else run.to = s + CELL;
    if (boundary) {
      run.to = D.belt.flatLen;
      flush();
      run = { kind: cell.kind, from: D.belt.flatLen, to: s + CELL };
    }
  }
  flush();
  for (const where of ["flat", "incline"]) {
    const html = Object.entries(parts[where]).map(([kind, d]) => `<path class="hg-load" data-grain="${kind}" d="${d}"/>`).join("");
    if (loads[where].innerHTML !== html) loads[where].innerHTML = html;
  }
}

function drawHoppers() {
  D.hoppers.forEach((h, i) => {
    const level = levelOf(h, state.volume[i]);
    if (Math.abs(level - state.shown[i]) < 0.02) return;
    state.shown[i] = level;
    insides[i].innerHTML = hopperInside(P, h.geo, level, h.grain);
  });
}

function drawJaws() {
  for (const jaw of jaws) {
    const i = Number(jaw.dataset.jaw);
    const dir = Number(jaw.dataset.dir);
    const open = state.gate[i] * 1.6 * dir;
    const text = open ? `translate(${(D.EX[0] * open).toFixed(2)} ${(D.EX[1] * open).toFixed(2)})` : "";
    if (jaw.getAttribute("transform") !== text) text ? jaw.setAttribute("transform", text) : jaw.removeAttribute("transform");
  }
}

function drawWater() {
  const share = clamp(state.tank / D.tank, 0, 1);
  const z = D.sight.z0 + 0.4 + (D.sight.z1 - D.sight.z0 - 0.8) * share;
  const a = screen([D.sight.x, D.sight.y, D.sight.z0 + 0.4]);
  const b = screen([D.sight.x, D.sight.y, z]);
  waterCol.setAttribute("d", share > 0.01 ? `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}` : "");
}

const shares = { olla: 1, apart: 0, jacks: 0 };
const springs = { apart: { x: 0, v: 0, target: 0 }, jacks: { x: 0, v: 0, target: 0 } };
const shareOf = (node) => shares[node.ride] ?? 0;
function stepSprings(dt) {
  let busy = false;
  for (const [id, sp] of Object.entries(springs)) {
    if (still.matches) {
      sp.x = sp.target;
      sp.v = 0;
    } else {
      for (let n = 0; n < 4; n++) {
        sp.v += ((sp.target - sp.x) * 60 - sp.v * 14) * (dt / 4);
        sp.x += sp.v * (dt / 4);
      }
      if (Math.abs(sp.target - sp.x) < 1e-3 && Math.abs(sp.v) < 1e-3) {
        sp.x = sp.target;
        sp.v = 0;
      } else busy = true;
    }
    shares[id] = clamp(sp.x, -0.05, 1.05);
  }
  return busy;
}

function place() {
  shares.olla = state.truck;
  for (const node of moving) {
    const share = shareOf(node);
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = Math.abs(share) < 1e-4 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      text ? node.el.setAttribute("transform", text) : node.el.removeAttribute("transform");
      if (node.ride === "olla") node.el.style.opacity = share > 0.8 ? String(clamp((1 - share) / 0.2, 0, 1)) : "";
    }
  }
  const keyOf = (node) => node.key + node.lift * shareOf(node);
  const next = nodes.map((_, i) => i).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    itemsGroup.appendChild(fragment);
    order = next;
  }
}

function setRow(id, value, goal) {
  const row = rows[id];
  if (!row) return;
  const text = `${fmt(value)} ${row.unit}`;
  if (row.got.textContent !== text) row.got.textContent = text;
  row.bar.style.transform = `scaleX(${clamp(value / goal, 0, 1).toFixed(3)})`;
}

function describe() {
  let text;
  const m3 = (state.delivered / D.totalKg) * D.load;
  if (mode === "transporte") text = springs.jacks.x > 0.98 ? "Modo transporte · gatos arriba, listo para el tractocamión" : "Subiendo gatos para transporte";
  else if (springs.apart.target === 1) text = "Despiece · tolvas, compuertas, banda, agua, aire y silo";
  else if (state.phase === "arrive") text = "Olla llegando en reversa";
  else if (state.phase === "dose") text = `Dosificando · ${fmt1(m3)} de ${D.load} m³ en la olla`;
  else if (state.phase === "mix") text = `Olla cargada · ${D.load} m³ en ${mmss(D.end)}`;
  else if (state.phase === "leave") text = "Olla cargada, sale a obra";
  else text = "Cargador llena las tolvas";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
  const clock = mmss(state.t);
  if (clockEl.textContent !== clock) clockEl.textContent = clock;
  D.gates.forEach((g, i) => setRow(g.id, state.dispensed[i], g.kg));
  setRow("cemento", state.cement, D.cemento.kg);
  setRow("agua", state.water, D.agua.litres);
  root.toggleAttribute("data-cement", state.phase === "dose" && state.t > D.cemento.from && state.t < D.cemento.to);
  root.toggleAttribute("data-belt", state.phase === "dose" && state.t > D.beltOn[0] && state.t < D.beltOn[1]);
  root.setAttribute("data-light", state.phase === "refill" || state.phase === "arrive" ? "green" : "red");
}

function resetBatch() {
  state.t = 0;
  state.dispensed = D.gates.map(() => 0);
  state.cement = 0;
  state.water = 0;
  state.delivered = 0;
  state.cells = Array.from({ length: COUNT }, () => null);
}

function go(phase) {
  state.phase = phase;
  state.phaseAt = state.clock;
}

function stepDose(dts) {
  const t0 = state.t;
  const t1 = Math.min(D.end, t0 + dts);
  const span = t1 - t0;
  state.t = t1;
  const belt = t1 > D.beltOn[0] && t0 < D.beltOn[1];
  if (belt) state.shift += (D.beltSpeed * span) / CELL;
  const steps = belt ? Math.floor(state.shift) : 0;
  state.shift -= steps;
  const takes = D.gates.map((g, i) => {
    const open = t1 > g.from && t0 < g.to;
    const h = g.hopper;
    state.gate[h] += ((open ? 1 : 0) - state.gate[h]) * (1 - Math.exp(-dts / 4));
    if (!open) return 0;
    const take = Math.max(0, Math.min(g.kg - state.dispensed[i], (g.kg / (g.to - g.from)) * span));
    state.dispensed[i] += take;
    state.volume[h] -= take / D.hoppers[h].density;
    return take;
  });
  const drop = (share) => {
    D.gates.forEach((g, i) => {
      if (!takes[i]) return;
      const h = g.hopper;
      const index = Math.floor((D.hoppers[h].outlet - D.belt.x0) / CELL);
      const cell = state.cells[index] ?? { kind: KINDS[h], kg: 0 };
      cell.kg += takes[i] * share;
      cell.kind = KINDS[h];
      state.cells[index] = cell;
    });
  };
  if (!steps) drop(1);
  for (let n = 0; n < steps; n++) {
    const out = state.cells.pop();
    if (out) state.delivered += out.kg;
    state.cells.unshift(null);
    drop(1 / steps);
  }
  if (t1 > D.cemento.from && t0 < D.cemento.to) {
    const take = Math.max(0, Math.min(D.cemento.kg - state.cement, (D.cemento.kg / (D.cemento.to - D.cemento.from)) * span));
    state.cement += take;
    state.thor -= take;
    state.delivered += take;
  }
  if (t1 > D.agua.from && t0 < D.agua.to) {
    const take = Math.max(0, Math.min(D.agua.litres - state.water, (D.agua.litres / (D.agua.to - D.agua.from)) * span));
    state.water += take;
    state.tank -= take;
    state.delivered += take;
  }
}

let mode = "operacion";
function tick(dt) {
  state.clock += dt;
  const springsBusy = stepSprings(dt);
  if (mode === "transporte" || springs.jacks.x > 0.02 || springs.apart.target === 1 || springs.apart.x > 0.02) {
    state.truck = Math.min(1, state.truck + dt / 2.5);
    return springsBusy || true;
  }
  const since = state.clock - state.phaseAt;
  state.drumPhase = (state.drumPhase + dt * (state.phase === "mix" ? 2.6 : 1.4)) % 1;
  if (state.phase === "arrive") {
    state.truck = 1 - ease(since / 3.2);
    if (since > 3.6) go("dose");
  } else if (state.phase === "dose") {
    stepDose(dt * D.speedup);
    if (state.t >= D.end) go("mix");
  } else if (state.phase === "mix") {
    if (since > 2.2) go("leave");
  } else if (state.phase === "leave") {
    state.truck = ease(since / 3);
    if (since > 3.2) {
      go("refill");
      state.from = state.volume.slice();
      state.tankFrom = state.tank;
    }
  } else if (state.phase === "refill") {
    const share = ease(since / 3);
    state.volume = state.volume.map((_, i) => state.from[i] + (D.hoppers[i].start - state.from[i]) * share);
    state.tank = state.tankFrom + (D.tank * 0.95 - state.tankFrom) * share;
    state.gate = state.gate.map((g) => g * (1 - share));
    if (since > 3.4) {
      resetBatch();
      go("arrive");
    }
  }
}

function stepDust(dt) {
  const flowing = state.phase === "dose" && state.t > D.cemento.from && state.t < D.cemento.to && !still.matches;
  if (flowing) {
    dustClock += dt;
    while (dustClock > 0.11) {
      dustClock -= 0.11;
      const seed = Math.random();
      puffs.push({ age: 0, life: 1.6 + seed * 0.8, dx: (Math.random() - 0.5) * 5, dy: (Math.random() - 0.5) * 5, rise: 3 + seed * 4, r0: 0.5 + seed * 0.5 });
    }
  }
  for (const puff of puffs) puff.age += dt;
  while (puffs.length && puffs[0].age > puffs[0].life) puffs.shift();
}

function drawDust() {
  const html = puffs
    .map((p) => {
      const t = p.age / p.life;
      const env = Math.sin(Math.PI * Math.min(1, t)) * (1 - t * 0.4);
      const at = screen([D.dust[0] + p.dx * t, D.dust[1] + p.dy * t, D.dust[2] + p.rise * t]);
      const r = (p.r0 + 2.2 * t) * D.ks;
      return `<circle cx="${at[0].toFixed(1)}" cy="${at[1].toFixed(1)}" r="${r.toFixed(2)}" opacity="${(0.32 * env).toFixed(3)}"/>`;
    })
    .join("");
  dustLayer.innerHTML = html;
}

function render() {
  drawDust();
  drawHoppers();
  drawJaws();
  drawLoads();
  drawWater();
  place();
  const index = Math.floor(state.drumPhase * D.ribs.length) % D.ribs.length;
  if (drum.dataset.at !== String(index)) {
    drum.dataset.at = String(index);
    drum.innerHTML = D.ribs[index];
  }
  describe();
}

let frame = 0;
let last = 0;
let visible = false;
function loop(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  if (state.running) {
    tick(dt);
    stepDust(dt);
  }
  render();
  frame = visible && state.running ? requestAnimationFrame(loop) : 0;
}
function run() {
  if (!frame && visible && state.running) {
    last = 0;
    frame = requestAnimationFrame(loop);
  }
}
function setRunning(on) {
  state.running = on;
  playButton.setAttribute("aria-pressed", String(on));
  playLabel.textContent = on ? "Pausa" : "Continuar";
  if (on) run();
}
playButton.addEventListener("click", () => setRunning(!state.running));
const suspButtons = [...root.querySelectorAll("[data-susp-set]")];
const modeButtons = [...root.querySelectorAll("[data-mode-set]")];
const apartButton = root.querySelector("[data-apart]");
const mark = (list, attr, value) => list.forEach((b) => (b.dataset[attr] === value ? b.setAttribute("data-on", "") : b.removeAttribute("data-on")));
root.setAttribute("data-susp", "aire");
suspButtons.forEach((b) => b.addEventListener("click", () => {
  root.setAttribute("data-susp", b.dataset.suspSet);
  mark(suspButtons, "suspSet", b.dataset.suspSet);
}));
modeButtons.forEach((b) => b.addEventListener("click", () => {
  mode = b.dataset.modeSet;
  mark(modeButtons, "modeSet", mode);
  springs.jacks.target = mode === "transporte" ? 1 : 0;
  if (mode === "transporte") {
    springs.apart.target = 0;
    apartButton.removeAttribute("data-on");
    apartButton.setAttribute("aria-pressed", "false");
    resetBatch();
  } else go("arrive");
  setRunning(true);
}));
apartButton.addEventListener("click", () => {
  const on = springs.apart.target !== 1;
  springs.apart.target = on ? 1 : 0;
  apartButton.toggleAttribute("data-on", on);
  apartButton.setAttribute("aria-pressed", String(on));
  if (on) resetBatch();
  else go("arrive");
  setRunning(true);
});
stage.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    setRunning(!state.running);
  }
});
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  run();
}, { rootMargin: "120px 0px" }).observe(stage);

if (still.matches) {
  state.truck = 0;
  state.phase = "dose";
  stepDose(D.end * 0.55);
  setRunning(false);
}
render();
window.__zeus = { state, D };
