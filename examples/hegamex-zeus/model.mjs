export const LOAD_M3 = 7;
export const RECIPE = { cemento: 350, arena: 800, grava: 950, agua: 190 };
export const DENSITY = { arena: 1550, grava: 1500, gravilla: 1450 };
export const PLANT_M3_H = 65;
export const SPEEDUP = 8;
export const BELT_MS = 1.8;
export const THOR_START_KG = 42000;
export const WATER_TANK_L = 2100;

export function materials(hoppers) {
  const total = (kg) => kg * LOAD_M3;
  const aggregates =
    hoppers === 3
      ? [
          { id: "arena", name: "Arena", hopper: 0, kg: total(RECIPE.arena) },
          { id: "grava", name: "Grava 3/4\"", hopper: 1, kg: total(RECIPE.grava * 0.6) },
          { id: "gravilla", name: "Gravilla 3/8\"", hopper: 2, kg: total(RECIPE.grava * 0.4) },
        ]
      : [
          { id: "arena", name: "Arena", hopper: 0, kg: total(RECIPE.arena) },
          { id: "grava", name: "Grava 3/4\"", hopper: 1, kg: total(RECIPE.grava) },
        ];
  return { aggregates, cemento: total(RECIPE.cemento), agua: total(RECIPE.agua) };
}

export function timeline(hoppers) {
  const batch = (LOAD_M3 / PLANT_M3_H) * 3600;
  const m = materials(hoppers);
  const start = 6;
  const span = batch - 40;
  const each = span / m.aggregates.length;
  const gates = m.aggregates.map((a, i) => ({ ...a, from: start + i * each, to: start + (i + 1) * each - 4 }));
  return {
    batch,
    belt: [2, start + span + 26],
    gates,
    cemento: { kg: m.cemento, from: start + 14, to: start + span - 8 },
    agua: { litres: m.agua, from: start + 20, to: start + span - 14 },
    end: start + span + 30,
  };
}

export function hopperTable(geo, steps = 60) {
  const lerp = (a, b, t) => a + (b - a) * t;
  const area = (z) => {
    if (z >= geo.z1) return (geo.xb - geo.xa) * (geo.yb - geo.ya);
    const t = Math.max(0, (z - geo.z0) / (geo.z1 - geo.z0));
    return (lerp(geo.ox1, geo.xb, t) - lerp(geo.ox0, geo.xa, t)) * (lerp(geo.oy1, geo.yb, t) - lerp(geo.oy0, geo.ya, t));
  };
  const out = [[geo.z0, 0]];
  let volume = 0;
  const dz = (geo.top - geo.z0) / steps;
  for (let i = 1; i <= steps; i++) {
    const z = geo.z0 + i * dz;
    volume += ((area(z - dz) + area(z)) / 2) * dz * 0.001;
    out.push([+z.toFixed(3), +volume.toFixed(4)]);
  }
  return out;
}
