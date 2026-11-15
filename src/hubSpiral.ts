import type { District } from "./simulation";

export const spiralStops = [
  { district: "A", progress: 0.26 },
  { district: "D", progress: 0.45 },
  { district: "R", progress: 0.69 },
  { district: "C", progress: 0.87 },
] as const satisfies ReadonlyArray<{ district: District; progress: number }>;

export function spiralPoint(progress: number, radius: number, height: number): [number, number, number] {
  const angle = -5.55 * progress;
  return [Math.sin(angle) * radius, height, -48 + Math.cos(angle) * radius];
}

export function spiralDistrict(progress: number): District | null {
  if (progress < 0.12) return null;
  return spiralStops.reduce((nearest, stop) =>
    Math.abs(stop.progress - progress) < Math.abs(nearest.progress - progress) ? stop : nearest,
  ).district;
}
