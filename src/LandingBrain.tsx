import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { districtInfo, districts, type District } from "./simulation";
import {
  cerebellumPx,
  cerebrumPx,
  edgeDistance,
  inside,
  lobe,
  rng,
  stemPx,
  zoneOf,
  zoneWorld,
  type Lobe,
  type P2,
} from "./brainShape";

/** Shared with the camera: wheel zoom on the landing page. */
export const landingView = { zoom: 0 };
const navy = new THREE.Color("#141a3a");
const neutral = new THREE.Color("#8f9cff");
const zoneColor = Object.fromEntries(
  districts.map((d) => [d, new THREE.Color(districtInfo[d].color)]),
) as Record<District, THREE.Color>;

let glowTexture: THREE.Texture | null = null;
export function glowMap() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,255,255,.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return (glowTexture = new THREE.CanvasTexture(canvas));
}
function Glow({
  color,
  size,
  opacity = 1,
  position = [0, 0, 0],
}: {
  color: THREE.ColorRepresentation;
  size: number;
  opacity?: number;
  position?: [number, number, number];
}) {
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial
        map={glowMap()}
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

// Value noise and gyri ridges, after the point-cloud study.
const fr = (v: number) => v - Math.floor(v);
const rr = (a: number, b: number, c: number) =>
  fr(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453);
function nz(x: number, y: number, z: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  let u = x - xi,
    v = y - yi,
    w = z - zi;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  w = w * w * (3 - 2 * w);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => rr(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
function gyri(x: number, y: number, z: number) {
  const wx = nz(x * 2.5 + 3, y * 2.5, z * 2.5) - 0.5,
    wy = nz(x * 2.5, y * 2.5 + 5, z * 2.5) - 0.5;
  const n =
    nz(x * 7 + wx * 4, y * 7 + wy * 4, z * 7) * 0.7 +
    nz(x * 15 - wy * 2, y * 15 + wx * 2, z * 15 + 3) * 0.3;
  return Math.pow(1 - Math.abs(2 * n - 1), 3.5);
}
function soft(x: number, y: number) {
  const c = new THREE.Color(0, 0, 0);
  let s = 0;
  districts.forEach((d, i) => {
    const [zx, zy] = zoneWorld[d];
    const q = Math.hypot(x - zx, y - zy) + 0.05 * Math.sin(5 * x + 4 * y + i * 2);
    const w = Math.exp((-q * q) / 0.07);
    s += w;
    c.r += zoneColor[d].r * w;
    c.g += zoneColor[d].g * w;
    c.b += zoneColor[d].b * w;
  });
  return c.multiplyScalar(1 / s);
}

/** Faceted surface: front and mirrored back faces, one geometry per region. */
function facets(l: Lobe, seed: number, region: (x: number, y: number) => District | null) {
  const random = rng(seed);
  const z = l.points.map(
    ([x, y]) => l.height(x, y) * (0.94 + random() * 0.12),
  );
  const buckets = new Map<District | null, { pos: number[]; col: number[]; edge: number[] }>();
  for (const t of l.triangles) {
    const cx = (l.points[t[0]][0] + l.points[t[1]][0] + l.points[t[2]][0]) / 3,
      cy = (l.points[t[0]][1] + l.points[t[1]][1] + l.points[t[2]][1]) / 3;
    const r = region(cx, cy);
    if (!buckets.has(r)) buckets.set(r, { pos: [], col: [], edge: [] });
    const b = buckets.get(r)!;
    const tint = r ? soft(cx, cy) : neutral;
    const shade = navy.clone().lerp(tint, 0.2 + random() * 0.12);
    for (const side of [1, -1]) {
      const order = side > 0 ? [0, 1, 2] : [0, 2, 1];
      for (const k of order) {
        const i = t[k];
        b.pos.push(l.points[i][0], l.points[i][1], side * z[i]);
        b.col.push(shade.r, shade.g, shade.b);
      }
      for (let e = 0; e < 3; e++) {
        const i = t[e],
          j = t[(e + 1) % 3];
        b.edge.push(
          l.points[i][0], l.points[i][1], side * (z[i] + 0.004),
          l.points[j][0], l.points[j][1], side * (z[j] + 0.004),
        );
      }
    }
  }
  return [...buckets.entries()].map(([d, b]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
    g.computeVertexNormals();
    const e = new THREE.BufferGeometry();
    e.setAttribute("position", new THREE.Float32BufferAttribute(b.edge, 3));
    return { d, faces: g, edges: e, nodes: l.points.filter(([x, y]) => region(x, y) === d) };
  });
}

function cloud(
  l: Lobe,
  count: number,
  color: (x: number, y: number) => THREE.Color,
  ridge: (x: number, y: number, z: number) => number,
  seed: number,
  top = false,
) {
  const random = rng(seed);
  const xs = l.boundary.map((p) => p[0]),
    ys = l.boundary.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pos: number[] = [],
    col: number[] = [];
  const nodes: THREE.Vector3[] = [];
  let tries = 0;
  while (pos.length < count * 3 && tries++ < count * 9) {
    const x = x0 + random() * (x1 - x0),
      y = y0 + random() * (y1 - y0);
    if (!inside(l.boundary, x, y)) continue;
    if (top && y > -0.1 && edgeDistance(l.boundary, x, y) < 0.035) continue;
    const h = l.height(x, y),
      base = color(x, y);
    for (const side of [1, -1]) {
      const r = ridge(x, y, side * h);
      if (random() > 0.05 + 0.95 * r) continue;
      const b = 0.25 + 0.6 * r;
      pos.push(x, y, side * (h + 0.04 * r));
      col.push(base.r * b, base.g * b, base.b * b);
      if (pos.length % 180 === 0) nodes.push(new THREE.Vector3(x, y, side * h));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return { geometry: g, nodes };
}

function Pulses({ nodes, reduced }: { nodes: THREE.Vector3[]; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const state = useMemo(() => {
    const random = rng(7);
    return Array.from({ length: 36 }, () => {
      const a = nodes[Math.floor(random() * nodes.length)];
      return { a, b: a, t: random(), speed: 0.5 + random() * 0.9 };
    });
  }, [nodes]);
  useFrame((_, dt) => {
    if (!group.current || reduced) return;
    state.forEach((p, i) => {
      p.t += Math.min(dt, 0.05) * p.speed;
      if (p.t >= 1) {
        p.t = 0;
        p.a = p.b;
        for (let k = 0; k < 40; k++) {
          const c = nodes[Math.floor(Math.random() * nodes.length)];
          const d = c.distanceTo(p.a);
          if (d > 0.1 && d < 0.45) {
            p.b = c;
            break;
          }
        }
      }
      const s = group.current!.children[i] as THREE.Sprite;
      s.position.lerpVectors(p.a, p.b, p.t);
      s.material.opacity = Math.sin(Math.PI * p.t);
    });
  });
  return (
    <group ref={group}>
      {state.map((_, i) => (
        <Glow key={i} color="#ffffff" size={0.18} opacity={0} />
      ))}
    </group>
  );
}

function MemoryOrb({ d, index, lit, reduced }: { d: District; index: number; lit: boolean; reduced: boolean }) {
  const pivot = useRef<THREE.Group>(null);
  const orb = useRef<THREE.Group>(null);
  const radius = 2.15 + index * 0.22;
  const color = districtInfo[d].color;
  useFrame(({ clock }, dt) => {
    if (pivot.current && !reduced) pivot.current.rotation.z += Math.min(dt, 0.05) * (0.25 + 0.07 * index);
    if (orb.current) {
      const target = (lit ? 1.9 : 1) + (reduced ? 0 : 0.12 * Math.sin(clock.elapsedTime * 3 + index));
      orb.current.scale.setScalar(THREE.MathUtils.damp(orb.current.scale.x, target, 6, dt));
    }
  });
  return (
    <group rotation={[0.35 + index * 0.37, index * 0.9, index * 0.2]}>
      <mesh>
        <torusGeometry args={[radius, lit ? 0.008 : 0.004, 6, 160]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 0.6 : 0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={pivot} rotation={[0, 0, index * 1.7]}>
        <group ref={orb} position={[radius, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.13, 24, 24]} />
            <meshPhongMaterial color={color} emissive={color} emissiveIntensity={lit ? 1.2 : 0.6} shininess={120} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Glow color={color} size={lit ? 1.4 : 0.9} opacity={0.9} />
        </group>
        {Array.from({ length: 7 }, (_, t) => (
          <Glow
            key={t}
            color={color}
            size={0.35 * (1 - (t + 1) / 9)}
            opacity={0.6 * (1 - (t + 1) / 8)}
            position={[radius * Math.cos(-(t + 1) * 0.085), radius * Math.sin(-(t + 1) * 0.085), 0]}
          />
        ))}
      </group>
    </group>
  );
}

function HoloRings() {
  const material = { color: "#9db4ff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
  return (
    <group position={[0, -1.95, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {[[1, 1.03, 0.9], [1.55, 1.57, 0.5], [2.1, 2.12, 0.3]].map(([a, b, o]) => (
          <mesh key={a}>
            <ringGeometry args={[a, b, 128]} />
            <meshBasicMaterial {...material} opacity={o} />
          </mesh>
        ))}
      </group>
      <Glow color="#6f86ff" size={3.4} opacity={0.35} position={[0, 0.02, 0]} />
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[0.45, 0.8, 0.65, 32, 1, true]} />
        <meshBasicMaterial {...material} opacity={0.1} />
      </mesh>
    </group>
  );
}

function Stars() {
  const geometry = useMemo(() => {
    const random = rng(99);
    const p: number[] = [];
    for (let i = 0; i < 900; i++) {
      const r = 14 + random() * 30,
        th = random() * Math.PI * 2,
        ph = Math.acos(2 * random() - 1);
      p.push(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    return g;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.35} map={glowMap()} color="#bfd0ff" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

export default function LandingBrain({
  entered,
  reduced,
  voice,
  lit,
  onVoice,
  onToggle,
}: {
  entered: boolean;
  reduced: boolean;
  voice: District | null;
  lit: District[];
  onVoice: (d: District | null) => void;
  onToggle: (d: District) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const brain = useRef<THREE.Group>(null);
  const pointsMaterial = useRef<THREE.PointsMaterial>(null);
  const rimA = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.Sprite>(null);
  const { gl, size } = useThree();
  const view = useRef({ dragY: 0, dragX: 0, dragging: false, moved: 0, lx: 0, ly: 0 });
  const model = useMemo(() => {
    const cerebrum = lobe(cerebrumPx as P2[], 0.17, 1.05, 1, 11);
    const cerebellum = lobe(cerebellumPx as P2[], 0.11, 0.55, 0.6, 12);
    const stem = lobe(stemPx as P2[], 0.09, 0.2, 0.25, 13);
    const lavender = () => new THREE.Color(0.55, 0.62, 1);
    const main = cloud(cerebrum, 46000, soft, gyri, 21, true);
    return {
      regions: [
        ...facets(cerebrum, 31, (x, y) => zoneOf(x, y)),
        ...facets(cerebellum, 32, () => null),
        ...facets(stem, 33, () => null),
      ],
      clouds: [
        main.geometry,
        cloud(cerebellum, 10000, lavender, (x, y, z) => Math.pow(0.5 + 0.5 * Math.sin(y * 75 + nz(x * 5, y * 5, z * 5) * 6), 2), 22).geometry,
        cloud(stem, 2600, lavender, (x, y, z) => 0.4 + 0.6 * nz(x * 9, y * 9, z * 9), 23).geometry,
      ],
      nodes: main.nodes,
      hubs: districts.map((d) => {
        const [x, y] = zoneWorld[d];
        return { d, x, y, z: cerebrum.height(x, y) + 0.06 };
      }),
    };
  }, []);
  useEffect(
    () => () => {
      model.regions.forEach((r) => {
        r.faces.dispose();
        r.edges.dispose();
      });
      model.clouds.forEach((g) => g.dispose());
    },
    [model],
  );
  // Drag to rotate and wheel to zoom, only before entering.
  useEffect(() => {
    const el = gl.domElement;
    const v = view.current;
    const down = (e: PointerEvent) => {
      if (entered) return;
      v.dragging = true;
      v.moved = 0;
      v.lx = e.clientX;
      v.ly = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!v.dragging) return;
      v.dragY += (e.clientX - v.lx) * 0.007;
      v.dragX = Math.max(-0.7, Math.min(0.7, v.dragX + (e.clientY - v.ly) * 0.005));
      v.moved += Math.abs(e.clientX - v.lx) + Math.abs(e.clientY - v.ly);
      v.lx = e.clientX;
      v.ly = e.clientY;
    };
    const up = () => (v.dragging = false);
    const wheel = (e: WheelEvent) => {
      if (entered) return;
      e.preventDefault();
      landingView.zoom = Math.max(-3, Math.min(4, landingView.zoom + e.deltaY * 0.004));
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl, entered]);
  useFrame(({ clock, pointer, camera }, dt) => {
    if (!root.current || !brain.current) return;
    root.current.visible = camera.position.z > (entered ? 3 : -8);
    const t = reduced ? 0 : clock.elapsedTime;
    const v = view.current;
    const narrow = size.width < 760;
    if (!v.dragging && !voice && !reduced) v.dragY += Math.min(dt, 0.05) * 0.13;
    const targetY = 0.32 + v.dragY + (reduced ? 0 : pointer.x * 0.1);
    const targetX = 0.12 + v.dragX - (reduced ? 0 : pointer.y * 0.05);
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, targetY, 4, dt);
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, targetX, 4, dt);
    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, entered || narrow ? 0 : 1.9, 3, dt);
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, narrow && !entered ? 1.1 : 0.35, 3, dt);
    brain.current.position.y = reduced ? 0 : Math.sin(t * 0.9) * 0.05;
    const beat = 1 + (reduced ? 0 : 0.012 * Math.sin(t * 2.2));
    brain.current.scale.setScalar(beat);
    if (rimA.current) rimA.current.position.x = -4 + Math.sin(t * 0.5) * 1.2;
    if (halo.current) halo.current.material.opacity = 0.16 + 0.05 * Math.sin(t * 1.6);
    if (pointsMaterial.current) pointsMaterial.current.size = 0.08 + (reduced ? 0 : 0.025 * Math.sin(t * 3));
  });
  const pick = (d: District | null) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (d && view.current.moved < 6) onToggle(d);
  };
  return (
    <group ref={root} scale={1.25}>
      <ambientLight intensity={0.55} color="#8d9bff" />
      <directionalLight position={[3, 4, 5]} intensity={1.1} color="#ffffff" />
      <pointLight ref={rimA} position={[-4, 1, -3]} intensity={14} distance={14} color="#ff7fb6" />
      <pointLight position={[4, -1, -3]} intensity={14} distance={14} color="#4a90ff" />
      <group ref={brain}>
        {model.regions.map((r, i) =>
          r.d ? (
            <mesh
              key={i}
              geometry={r.faces}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!view.current.dragging) onVoice(r.d);
              }}
              onPointerOut={() => onVoice(null)}
              onClick={pick(r.d)}
            >
              <meshBasicMaterial
                color={districtInfo[r.d].color}
                transparent
                opacity={r.d === voice ? 0.1 : 0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          ) : null,
        )}
        {model.clouds.map((g, i) => (
          <points key={i} geometry={g}>
            <pointsMaterial
              ref={i === 0 ? pointsMaterial : undefined}
              size={0.022}
              map={glowMap()}
              vertexColors
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </points>
        ))}
        {model.hubs.map((h) =>
          [1, -1].map((side) => (
            <group key={`${h.d}${side}`} position={[h.x, h.y, side * h.z]}>
              <Glow color={districtInfo[h.d].color} size={h.d === voice ? 0.9 : 0.5} opacity={0.85} />
              <Glow color="#ffffff" size={0.1} />
              {h.d === voice && (
                <mesh rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
                  <ringGeometry args={[0.13, 0.15, 40]} />
                  <meshBasicMaterial color={districtInfo[h.d].color} transparent opacity={0.9} side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>
          )),
        )}
        <Pulses nodes={model.nodes} reduced={reduced} />
        <sprite ref={halo} position={[0, 0.1, -0.4]} scale={[6, 6, 1]}>
          <spriteMaterial map={glowMap()} color="#4a7bff" opacity={0.2} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      <HoloRings />
      {districts.map((d, i) => (
        <MemoryOrb key={d} d={d} index={i} lit={lit.includes(d)} reduced={reduced} />
      ))}
      <Stars />
    </group>
  );
}
