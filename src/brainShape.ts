import type { District } from "./simulation";

// Side-view brain outlines in reference-image pixels (front faces left).
export const cerebrumPx: [number, number][] = [[150,360],[158,332],[170,305],[192,288],[212,262],[232,232],[258,208],[285,192],[308,160],[338,137],[372,126],[420,118],[475,118],[530,124],[580,129],[622,146],[662,166],[702,196],[738,226],[766,256],[783,288],[788,322],[780,352],[764,376],[738,395],[700,408],[660,420],[622,424],[585,432],[548,442],[505,456],[470,470],[440,481],[412,484],[385,478],[358,484],[336,493],[310,493],[280,486],[248,474],[218,462],[188,448],[165,428],[151,400]];
export const cerebellumPx: [number, number][] = [[470,468],[505,446],[550,433],[600,428],[648,428],[675,436],[682,452],[672,482],[650,506],[615,522],[575,532],[535,536],[503,528],[484,510],[474,488]];
export const stemPx: [number, number][] = [[474,480],[500,495],[522,518],[506,548],[484,580],[458,607],[440,600],[448,562],[460,522],[468,498]];
/** Region centres: Achievement front, Discovery top, Recovery back, Connection lower. */
export const zonePx: Record<District, [number, number]> = {
  A: [243, 334],
  D: [472, 190],
  R: [688, 295],
  C: [522, 418],
};

export type P2 = [number, number];
const S = 1 / 210;
export const toWorld = ([x, y]: P2): P2 => [(x - 468) * S, -(y - 330) * S];

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Closed uniform Catmull-Rom curve, resampled at roughly even spacing. */
export function outline(px: P2[], spacing: number): P2[] {
  const p = px.map(toWorld);
  const dense: P2[] = [];
  for (let i = 0; i < p.length; i++) {
    const [a, b, c, d] = [-1, 0, 1, 2].map(
      (k) => p[(i + k + p.length) % p.length],
    );
    for (let s = 0; s < 8; s++) {
      const t = s / 8,
        t2 = t * t,
        t3 = t2 * t;
      const f = (j: 0 | 1) =>
        0.5 *
        (2 * b[j] +
          (-a[j] + c[j]) * t +
          (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 +
          (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3);
      dense.push([f(0), f(1)]);
    }
  }
  const out: P2[] = [dense[0]];
  let run = 0;
  for (let i = 1; i < dense.length; i++) {
    run += Math.hypot(
      dense[i][0] - dense[i - 1][0],
      dense[i][1] - dense[i - 1][1],
    );
    if (run >= spacing) {
      out.push(dense[i]);
      run = 0;
    }
  }
  return out;
}
export function inside(poly: P2[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i],
      [bx, by] = poly[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      c = !c;
  }
  return c;
}
export function edgeDistance(poly: P2[], x: number, y: number) {
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i],
      [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)),
    );
    m = Math.min(m, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return m;
}
/** Bowyer-Watson Delaunay triangulation; small inputs only. */
export function delaunay(pts: P2[]): [number, number, number][] {
  const n = pts.length;
  const all: P2[] = [...pts, [-50, -50], [50, -50], [0, 60]];
  type T = { v: [number, number, number]; x: number; y: number; r: number };
  const circ = (v: [number, number, number]): T => {
    const [a, b, c] = v.map((i) => all[i]);
    const d =
      2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const sa = a[0] ** 2 + a[1] ** 2,
      sb = b[0] ** 2 + b[1] ** 2,
      sc = c[0] ** 2 + c[1] ** 2;
    const x = (sa * (b[1] - c[1]) + sb * (c[1] - a[1]) + sc * (a[1] - b[1])) / d;
    const y = (sa * (c[0] - b[0]) + sb * (a[0] - c[0]) + sc * (b[0] - a[0])) / d;
    return { v, x, y, r: (a[0] - x) ** 2 + (a[1] - y) ** 2 };
  };
  let tris: T[] = [circ([n, n + 1, n + 2])];
  for (let i = 0; i < n; i++) {
    const [px, py] = all[i];
    const bad: T[] = [],
      keep: T[] = [];
    for (const t of tris)
      ((px - t.x) ** 2 + (py - t.y) ** 2 < t.r ? bad : keep).push(t);
    const edges = new Map<string, [number, number]>();
    for (const t of bad)
      for (let e = 0; e < 3; e++) {
        const a = t.v[e],
          b = t.v[(e + 1) % 3];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [a, b]);
      }
    tris = keep;
    for (const [a, b] of edges.values()) tris.push(circ([a, b, i]));
  }
  return tris.filter((t) => t.v.every((i) => i < n)).map((t) => t.v);
}

export interface Lobe {
  boundary: P2[];
  points: P2[];
  triangles: [number, number, number][];
  height: (x: number, y: number) => number;
}
/** Jittered grid plus outline points, Delaunay-triangulated and clipped to the outline. */
export function lobe(
  px: P2[],
  spacing: number,
  thickness: number,
  depth: number,
  seed: number,
): Lobe {
  const random = rng(seed);
  const boundary = outline(px, spacing * 0.75);
  const xs = boundary.map((p) => p[0]),
    ys = boundary.map((p) => p[1]);
  const points: P2[] = [...boundary];
  for (let y = Math.min(...ys); y < Math.max(...ys); y += spacing * 0.87)
    for (let x = Math.min(...xs); x < Math.max(...xs); x += spacing) {
      const jx = x + (random() - 0.5) * spacing * 0.8,
        jy = y + (random() - 0.5) * spacing * 0.8;
      if (inside(boundary, jx, jy) && edgeDistance(boundary, jx, jy) > spacing * 0.4)
        points.push([jx, jy]);
    }
  const triangles = delaunay(points).filter((t) => {
    const cx = (points[t[0]][0] + points[t[1]][0] + points[t[2]][0]) / 3,
      cy = (points[t[0]][1] + points[t[1]][1] + points[t[2]][1]) / 3;
    return inside(boundary, cx, cy);
  });
  const height = (x: number, y: number) => {
    const s = Math.min(1, edgeDistance(boundary, x, y) / depth);
    return thickness * (1 - (1 - s) * (1 - s));
  };
  return { boundary, points, triangles, height };
}
export const zoneWorld = Object.fromEntries(
  Object.entries(zonePx).map(([d, p]) => [d, toWorld(p)]),
) as Record<District, P2>;
export function zoneOf(x: number, y: number): District {
  let best: District = "A",
    dist = Infinity;
  for (const [d, [zx, zy]] of Object.entries(zoneWorld) as [District, P2][]) {
    const q = Math.hypot(x - zx, (y - zy) * 1.25) + 0.04 * Math.sin(5 * x + 4 * y);
    if (q < dist) {
      dist = q;
      best = d;
    }
  }
  return best;
}
/** SVG path (reference-pixel space) for the 2D fallback. */
export const svgPath = (px: P2[]) =>
  px
    .map((p, i) => {
      const n = px[(i + 1) % px.length];
      const mid = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2];
      return `${i ? "" : `M${mid[0]} ${mid[1]}`}Q${n[0]} ${n[1]} ${(n[0] + px[(i + 2) % px.length][0]) / 2} ${(n[1] + px[(i + 2) % px.length][1]) / 2}`;
    })
    .join("") + "Z";
