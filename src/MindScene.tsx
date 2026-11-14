import { voicePalette } from "./voicePalette";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  districtInfo,
  districts,
  type Config,
  type District,
  type Election,
  type Round,
  type State,
} from "./simulation";
import { memoriesFor, type Memory } from "./memories";
import { locations, type Location } from "./MindUniverse";
import { planAccent, type Cue } from "./journey";
import VoiceIcon from "./VoiceIcon";
import LandingBrain, { glowMap, landingView } from "./LandingBrain";
import { rng } from "./brainShape";

type Point = [number, number, number];
const places: Record<Location, Point> = {
  hub: [0, 0, -48],
  headquarters: [0, 0, -82],
  memory: [-25, 1, -82],
  decision: [25, 0, -82],
  parallel: [-30, 0, -110],
  observatory: [29, 1, -110],
  A: [-10, 0, -47],
  C: [10, 0.4, -47],
  D: [-8, 1, -59],
  R: [9, 0.4, -59],
};
const gateways = {
  headquarters: [0, 0, -66],
  memory: [-16, -3, -66],
  decision: [16, -3, -66],
  parallel: [-23, -5, -80],
  observatory: [23, -5, -80],
} satisfies Partial<Record<Location, Point>>;
const colors = districts.map((d) => districtInfo[d].color);

function Glow({ color = "#b3a1ff", size = 5, position = [0, 0, 0] as Point }) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "#ffffffaa");
    gradient.addColorStop(0.2, "#ffffff44");
    gradient.addColorStop(1, "#ffffff00");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial
        map={map}
        color={color}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

function CameraJourney({
  entered,
  room,
  reduced,
  onArrive,
  framing = 0,
}: {
  entered: boolean;
  room: Location;
  reduced: boolean;
  onArrive: () => void;
  framing?: number;
}) {
  const { camera, size, invalidate } = useThree();
  const target = useRef(new THREE.Vector3());
  const viewOffset = useRef([0, 0, 0]);
  const journey = useRef(0);
  const arrived = useRef(false);
  const wasEntered = useRef(false);
  const lastRoom = useRef(room);
  const flight = useRef<{
    from: THREE.Vector3;
    look: THREE.Vector3;
    elapsed: number;
    duration: number;
  } | null>(null);
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = entered && size.width < 700 ? 84 : 42;
    perspective.updateProjectionMatrix();
    invalidate();
  }, [camera, entered, size.width, invalidate]);
  useEffect(() => {
    arrived.current = false;
    invalidate();
  }, [room, entered, invalidate]);
  useFrame((_, dt) => {
    if (entered && !wasEntered.current) {
      journey.current = 0;
      lastRoom.current = room;
      flight.current = null;
    }
    if (entered && room !== lastRoom.current) {
      lastRoom.current = room;
      flight.current = reduced ? null : {
        from: camera.position.clone(),
        look: target.current.clone(),
        elapsed: 0,
        duration: THREE.MathUtils.clamp(camera.position.distanceTo(
          new THREE.Vector3(...places[room]),
        ) / 39, 0.86, 1.55),
      };
    }
    wasEntered.current = entered;
    journey.current += Math.min(dt, 0.05);
    const p = places[room];
    const narrow = size.width < 700;
    let dest: Point = !entered
      ? [0, 0.6, (narrow ? 13.5 : 9.6) + landingView.zoom]
      : room === "hub"
        ? [0, 16, narrow ? -14 : -23]
        : room === "parallel"
          ? [p[0], 6, p[2] + (narrow ? 31 : 20)]
          : [p[0] + (narrow ? 0 : 3), p[1] + 7, p[2] + (narrow ? 26 : 18)];
    let look: Point = entered
      ? room === "hub"
        ? [0, 0, -53]
        : [
            p[0] + (narrow || room === "parallel" ? 0 : 2),
            p[1] + (room === "parallel" ? -2.8 : narrow ? -2 : 1.2),
            p[2],
          ]
      : [narrow ? 0 : 0.9, narrow ? 0.3 : 0.25, 0];
    // Guided scenes keep the 3D action centred in the space beside the opaque story panel.
    let offsetX = 0,
      offsetY = 0;
    if (entered && framing) {
      if (narrow) {
        offsetY = Math.max(0, Math.min(size.height * 0.52, size.height - 260) / 2 - 80);
      } else {
        const panel = (framing > 1 ? Math.min(900, size.width * 0.62) : Math.min(540, size.width * 0.44)) + 24;
        offsetX = panel / 2;
        const k = Math.min(2.4, size.width / Math.max(320, size.width - panel));
        const lookAt = new THREE.Vector3(...look);
        const away = new THREE.Vector3(...dest).sub(lookAt);
        const wide = room === "hub" || room === "parallel";
        if (!wide) away.set(0, 5.2, 11);
        away.multiplyScalar(wide ? Math.min(k, 1.5) : k * 0.85);
        dest = lookAt.clone().add(away).toArray() as Point;
        if (!wide) look = [p[0], p[1] + 1, p[2]];
      }
    }
    if (offsetX !== viewOffset.current[0] || offsetY !== viewOffset.current[1] || size.width !== viewOffset.current[2]) {
      viewOffset.current = [offsetX, offsetY, size.width];
      const perspective = camera as THREE.PerspectiveCamera;
      if (offsetX || offsetY)
        perspective.setViewOffset(size.width, size.height, offsetX, offsetY, size.width, size.height);
      else perspective.clearViewOffset();
    }
    // A brief approach crosses the actual neural shell before emerging at the hub.
    if (entered && !reduced && journey.current < 1.15) {
      dest = [0, 0.2, -2];
      look = [0, 0, -12];
    }
    const position = new THREE.Vector3(...dest);
    const damping = !entered ? 3 : journey.current < 1.15 ? 2 : 2.1;
    const transit = flight.current;
    if (transit && !reduced && journey.current >= 1.15) {
      transit.elapsed += Math.min(dt, 0.05);
      const fraction = Math.min(1, transit.elapsed / transit.duration);
      const ease = fraction * fraction * (3 - 2 * fraction);
      camera.position.lerpVectors(transit.from, position, ease);
      const arc = Math.sin(Math.PI * ease);
      camera.position.y += arc * 3.2;
      camera.position.x += arc * Math.sign(position.z - transit.from.z) * 1.6;
      target.current.lerpVectors(transit.look, new THREE.Vector3(...look), ease);
      if (fraction === 1) flight.current = null;
    } else {
      if (reduced) flight.current = null;
      const blend = reduced ? 1 : 1 - Math.exp(-damping * Math.min(dt, 0.05));
      camera.position.lerp(position, blend);
      target.current.lerp(new THREE.Vector3(...look), blend);
    }
    camera.lookAt(target.current);
    if (
      entered &&
      !arrived.current &&
      (reduced ||
        (!flight.current && camera.position.distanceTo(position) < 0.35 && journey.current > 1.2))
    ) {
      arrived.current = true;
      onArrive();
    }
  });
  return null;
}

/** Holographic platform in the point-cloud brain's style: glass disc, light rings, a cone of glowing dust. */
function Platform({ color, radius = 3.4 }: { color: string; radius?: number }) {
  const dust = useMemo(() => {
    const random = rng(Math.round(radius * 100));
    const p: number[] = [];
    for (let i = 0; i < Math.round(radius * 260); i++) {
      const depth = random();
      const r = radius * (1 - depth) * Math.sqrt(random());
      const a = random() * Math.PI * 2;
      p.push(Math.cos(a) * r, -depth * radius * 0.7, Math.sin(a) * r);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    return g;
  }, [radius]);
  useEffect(() => () => dust.dispose(), [dust]);
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[radius, radius * 0.97, 0.12, 64]} />
        <meshPhysicalMaterial color="#141838" metalness={0.3} roughness={0.25} transparent opacity={0.88} clearcoat={1} />
      </mesh>
      {[1, 0.72, 0.42].map((k, i) => (
        <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.19, 0]}>
          <ringGeometry args={[radius * k - (i ? 0.02 : 0.06), radius * k, 96]} />
          <meshBasicMaterial color={i ? "#9db4ff" : color} transparent opacity={i ? 0.35 : 0.95} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <points geometry={dust}>
        <pointsMaterial size={0.09} map={glowMap()} color={color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      <Glow color={color} size={radius * 2.6} position={[0, -0.4, 0]} />
    </group>
  );
}

const shapes = (() => {
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.27 : 0.6,
      a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.5);
  heart.bezierCurveTo(-0.25, -0.32, -0.6, -0.12, -0.6, 0.16);
  heart.bezierCurveTo(-0.6, 0.42, -0.36, 0.55, -0.2, 0.5);
  heart.bezierCurveTo(-0.08, 0.47, 0, 0.36, 0, 0.3);
  heart.bezierCurveTo(0, 0.36, 0.08, 0.47, 0.2, 0.5);
  heart.bezierCurveTo(0.36, 0.55, 0.6, 0.42, 0.6, 0.16);
  heart.bezierCurveTo(0.6, -0.12, 0.25, -0.32, 0, -0.5);
  const extrude = (shape: THREE.Shape, depth: number, bevel: number) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel * 0.8,
      bevelSegments: 8,
      curveSegments: 24,
    });
    g.center();
    return g;
  };
  const drop = new THREE.LatheGeometry(
    Array.from({ length: 24 }, (_, i) => {
      const t = i / 23;
      return new THREE.Vector2(
        Math.sin(Math.PI * t) ** 1.3 * 0.5 * (1 - t * 0.35),
        -0.5 + t * 1.15,
      );
    }),
    32,
  );
  return {
    A: extrude(star, 0.14, 0.12),
    C: extrude(heart, 0.24, 0.16),
    D: drop,
  };
})();

function Eyes({ sleepy, gap = 0.17 }: { sleepy?: boolean; gap?: number }) {
  return (
    <group>
      {[-1, 1].map((side) =>
        sleepy ? (
          <mesh key={side} position={[side * gap, 0, 0.02]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.07, 0.022, 6, 16, Math.PI]} />
            <meshBasicMaterial color="#1d1b3a" />
          </mesh>
        ) : (
          <group key={side} position={[side * gap, 0, 0]}>
            <mesh scale={[1, 1.15, 0.55]}>
              <sphereGeometry args={[0.13, 20, 16]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, -0.01, 0.06]} scale={[1, 1.1, 0.5]}>
              <sphereGeometry args={[0.075, 16, 12]} />
              <meshBasicMaterial color="#1d1b3a" />
            </mesh>
            <mesh position={[0.03, 0.035, 0.1]}>
              <sphereGeometry args={[0.025, 8, 6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

export interface Reaction {
  d: District;
  kind: "cheer" | "sigh";
  key: number;
}
const face: Record<District, { eyes: [number, number, number]; gap: number; mouth: [number, number, number]; arms: [number, number, number, number] }> = {
  // eye y/z, mouth y/z/width, arm [idle angle, speaking angle, y, x]
  A: { eyes: [0.02, 0.16, 0], gap: 0.14, mouth: [-0.16, 0.2, 0.06], arms: [-0.9, -2.3, -0.1, 0.42] },
  C: { eyes: [0.08, 0.27, 0], gap: 0.17, mouth: [-0.12, 0.3, 0.09], arms: [-1.2, -1.9, -0.05, 0.62] },
  D: { eyes: [-0.05, 0.36, 0], gap: 0.15, mouth: [-0.27, 0.38, 0.05], arms: [-0.6, -1.6, -0.15, 0.42] },
  R: { eyes: [0.02, 0.34, 0], gap: 0.15, mouth: [-0.14, 0.34, 0.05], arms: [-0.5, -1.2, -0.12, 0.62] },
};

/** Cute original voice characters: a spark-star, a heart blob, a teardrop wisp, a sleepy cloud. */
function Persona({
  d,
  energy,
  favored,
  reduced,
  speaking = false,
  listening = false,
  yaw = 0,
  reaction,
}: {
  d: District;
  energy: number;
  favored: boolean;
  reduced: boolean;
  speaking?: boolean;
  listening?: boolean;
  yaw?: number;
  reaction?: Reaction | null;
}) {
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const smile = useRef<THREE.Mesh>(null);
  const arms = useRef<(THREE.Mesh | null)[]>([]);
  const sparkle = useRef<THREE.Mesh>(null);
  const react = useRef<{ kind: Reaction["kind"]; start: number | null } | null>(null);
  const index = districts.indexOf(d);
  const color = colors[index];
  const tired = energy < 0.25;
  const f = face[d];
  const blinkSeed = useMemo(() => 2.6 + index * 0.9, [index]);
  useEffect(() => {
    if (reaction && reaction.d === d) react.current = { kind: reaction.kind, start: null };
  }, [reaction, d]);
  useFrame(({ clock }, dt) => {
    if (!ref.current || !body.current) return;
    const t = clock.elapsedTime;
    const still = reduced;
    const k = still ? 1 : Math.min(1, dt * 5);
    ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, 0.8 + (speaking ? 0.35 : 0), k);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, yaw, k);
    // Breathing, a talking sway, and listener nods: gentle, never a constant bounce.
    const breath = still ? 1 : 1 + Math.sin(t * 1.6 + index) * 0.015;
    let sx = breath,
      sy = (tired ? 0.88 : 1) * breath,
      rx = 0,
      ry = 0,
      rz = 0,
      hop = 0;
    if (!still && speaking) rz = Math.sin(t * 2.6) * 0.05;
    if (!still && listening) rx = Math.max(0, Math.sin(t * 2.2 + index * 1.3)) ** 2 * 0.12;
    // Brief personality reactions to plan edits and results.
    const r = react.current;
    if (r && !still) {
      if (r.start === null) r.start = t;
      const p = (t - r.start) / 1.4;
      if (p >= 1) react.current = null;
      else {
        const bump = Math.sin(Math.PI * p);
        if (r.kind === "cheer") {
          if (d === "A") {
            ry = p * Math.PI * 2;
            hop = bump * 0.45;
          } else if (d === "C") {
            sx *= 1 + Math.sin(p * Math.PI * 3) * 0.18 * (1 - p);
            sy *= 1 - Math.sin(p * Math.PI * 3) * 0.15 * (1 - p);
            hop = bump * 0.2;
          } else if (d === "D") {
            rz = Math.sin(p * Math.PI * 2) * 0.35;
            hop = bump * 0.25;
          } else {
            sy *= 1 + bump * 0.22;
            hop = bump * 0.15;
          }
        } else {
          rx = bump * (d === "R" ? -0.25 : 0.35);
          sy *= 1 - bump * 0.1;
          rz = d === "D" ? bump * 0.3 : rz;
        }
      }
    }
    body.current.scale.set(sx, sy, sx);
    body.current.rotation.set(rx, ry, rz);
    body.current.position.y = hop;
    // Blinks every few seconds, desynchronised per voice.
    if (eyes.current) {
      const cycle = (t + index * 1.7) % blinkSeed;
      eyes.current.scale.y = !still && cycle < 0.13 ? 0.12 : 1;
    }
    // Simple mouth movement while this voice's text is active (not audio lip-sync).
    if (mouth.current && smile.current) {
      mouth.current.visible = speaking || (r?.kind === "sigh" && d === "R");
      smile.current.visible = !mouth.current.visible;
      const talk = still ? 0.6 : 0.35 + Math.abs(Math.sin(t * 9 + Math.sin(t * 3.7) * 2)) * 0.75;
      mouth.current.scale.set(1, talk, 0.35);
    }
    arms.current.forEach((arm, i) => {
      if (!arm) return;
      const side = i ? 1 : -1;
      const wave = speaking && !still ? Math.sin(t * 3 + i * 1.4) * 0.35 : 0;
      const cheer = r?.kind === "cheer" && !still ? -0.8 : 0;
      const target = side * ((speaking ? f.arms[1] : f.arms[0]) + wave + cheer);
      arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, target, k);
    });
    if (sparkle.current) {
      sparkle.current.rotation.y = still ? 0 : t * 2;
      sparkle.current.scale.setScalar(r?.kind === "cheer" && d === "D" && !still ? 2.2 : 1);
    }
  });
  const glow = speaking ? 0.17 : favored ? 0.09 : 0.04;
  const material = (
    <meshPhysicalMaterial
      color={voicePalette[d].clay}
      emissive={color}
      emissiveIntensity={glow}
      roughness={0.88}
    />
  );
  return (
    <group ref={ref} position={[0, 0.8, 1.25]}>
      <group ref={body}>
        {d === "A" && (
          <>
            <mesh geometry={shapes.A}>{material}</mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.15, 0.2, 0.2]} rotation={[0, 0, side * -0.4]}>
                <boxGeometry args={[0.16, 0.035, 0.02]} />
                <meshBasicMaterial color="#1d1b3a" />
              </mesh>
            ))}
          </>
        )}
        {d === "C" && (
          <>
            <mesh geometry={shapes.C}>{material}</mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.32, -0.08, 0.26]} scale={[1, 0.6, 0.3]}>
                <sphereGeometry args={[0.08, 12, 8]} />
                <meshBasicMaterial color="#ff3d6e" transparent opacity={0.55} />
              </mesh>
            ))}
          </>
        )}
        {d === "D" && (
          <>
            <mesh geometry={shapes.D} rotation={[0, 0, 0.08]}>{material}</mesh>
            <mesh position={[-0.15, 0.13, 0.4]} rotation={[0, 0, 0.35]}>
              <boxGeometry args={[0.14, 0.03, 0.02]} />
              <meshBasicMaterial color="#1d1b3a" />
            </mesh>
            <mesh ref={sparkle} position={[0.32, 0.78, 0]}>
              <octahedronGeometry args={[0.09, 0]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <Glow color="#ffffff" size={0.6} position={[0.32, 0.78, 0]} />
          </>
        )}
        {d === "R" && (
          <>
            {(
              [
                [0, 0, 0, 0.42],
                [-0.36, -0.1, 0, 0.3],
                [0.36, -0.1, 0, 0.3],
                [-0.16, 0.26, -0.05, 0.28],
                [0.2, 0.22, -0.05, 0.3],
              ] as const
            ).map(([x, y, z, r], i) => (
              <mesh key={i} position={[x, y, z]} scale={[1, 0.9, 0.8]}>
                <sphereGeometry args={[r, 24, 18]} />
                {material}
              </mesh>
            ))}
            <mesh position={[0.5, 0.55, 0]} rotation={[0, 0, 0.6]}>
              <torusGeometry args={[0.12, 0.05, 8, 20, Math.PI * 1.2]} />
              <meshStandardMaterial color="#fff6c2" emissive="#fff6c2" emissiveIntensity={0.8} />
            </mesh>
          </>
        )}
        <group ref={eyes} position={[0, f.eyes[0], f.eyes[1]]}>
          <Eyes sleepy={d === "R" && !speaking} gap={f.gap} />
        </group>
        <mesh ref={smile} position={[0, f.mouth[0], f.mouth[1]]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[f.mouth[2], 0.02, 6, 14, Math.PI]} />
          <meshBasicMaterial color="#1d1b3a" />
        </mesh>
        <mesh ref={mouth} visible={false} position={[0, f.mouth[0], f.mouth[1]]}>
          <sphereGeometry args={[f.mouth[2] * 0.9, 14, 10]} />
          <meshBasicMaterial color="#3a1430" />
        </mesh>
        {[-1, 1].map((side, i) => (
          <mesh
            key={side}
            ref={(m) => (arms.current[i] = m)}
            position={[side * f.arms[3], f.arms[2], 0.05]}
            rotation={[0, 0, side * f.arms[0]]}
          >
            <capsuleGeometry args={[0.06, 0.24, 4, 8]} />
            {material}
          </mesh>
        ))}
      </group>
      <Glow color={color} size={speaking ? 1.7 : 1.1} position={[0, 0.1, -0.4]} />
    </group>
  );
}

function DistrictIsland({
  d,
  state,
  rules,
  last,
  reduced,
  onVisit,
  labels = true,
}: {
  d: District;
  state: State;
  rules: Config;
  last?: Round;
  reduced: boolean;
  onVisit: (place: Location) => void;
  labels?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const index = districts.indexOf(d),
    color = colors[index];
  const value =
    d === "A"
      ? state.taskProgress / rules.taskGoal
      : d === "C"
        ? state.connectionProgress / rules.connectionGoal
        : d === "D"
          ? (state.method - 1) / (rules.methodCap - 1)
          : state.energy / rules.energyCap;
  const emphasis = last ? last.policy.allocation[d] > 0 : false;
  useFrame(({ clock }) => {
    if (group.current)
      group.current.position.y = reduced
        ? 0
        : Math.sin(clock.elapsedTime * 0.5 + index) * 0.13;
  });
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        onVisit(d);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Platform color={color} />
      {[0, 1, 2].map((i) => (
        <group key={i} position={[(i - 1) * 1.5, 0.25, -0.8 - (i % 2) * 0.8]}>
          {d === "R" ? (
            <>
              <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.08, 0.13, 1, 8]} />
                <meshStandardMaterial color="#9c8e93" />
              </mesh>
              <mesh position={[0, 1 + value * 0.5, 0]} scale={[1, 1.35, 1]}>
                <icosahedronGeometry args={[0.6, 1]} />
                <meshStandardMaterial
                  color={i % 2 ? "#a5ecc0" : "#75b9a3"}
                  flatShading
                />
              </mesh>
            </>
          ) : (
            <mesh
              position={[0, 0.55 + value * 0.7, 0]}
              scale={[1, 0.8 + Math.min(2, value) * 1.1, 1]}
            >
              {d === "D" ? (
                <octahedronGeometry args={[0.65, 0]} />
              ) : d === "C" ? (
                <capsuleGeometry args={[0.42, 0.8, 6, 12]} />
              ) : (
                <cylinderGeometry args={[0.35, 0.5, 1.5 + i * 0.3, 6]} />
              )}
              <meshStandardMaterial
                color={color}
                metalness={0.35}
                roughness={0.22}
                emissive={color}
                emissiveIntensity={hovered ? 0.55 : 0.2}
              />
            </mesh>
          )}
          <Glow color={color} size={2} position={[0, 1.8 + value * 0.7, 0]} />
        </group>
      ))}
      <Persona
        d={d}
        energy={state.energy / rules.energyCap}
        favored={emphasis}
        reduced={reduced}
      />
      {labels && (
        <Html
          position={[0, 3.5, 0]}
          center
          distanceFactor={25}
          zIndexRange={[30, 0]}
        >
          <button
            className={`island-label ${hovered ? "hovered" : ""}`}
            style={{ "--island": color } as React.CSSProperties}
            onClick={() => onVisit(d)}
          >
            <VoiceIcon d={d} size={26} />
            {locations[d].title}
            <small>EXPLORE DISTRICT ↗</small>
          </button>
        </Html>
      )}
    </group>
  );
}

function NeuralBridge({
  from,
  to,
  color,
  reduced,
  active = false,
}: {
  from: Point;
  to: Point;
  color: string;
  reduced: boolean;
  active?: boolean;
}) {
  const spark = useRef<THREE.Mesh>(null);
  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(...from),
        new THREE.Vector3((from[0] + to[0]) / 2, -2, (from[2] + to[2]) / 2),
        new THREE.Vector3(...to),
      ),
    [from, to],
  );
  useFrame(({ clock }) => {
    if (spark.current)
      spark.current.position.copy(
        curve.getPoint(reduced ? 0.5 : (clock.elapsedTime * (active ? 0.32 : 0.14)) % 1),
      );
  });
  return (
    <group>
      <Line
        points={curve.getPoints(40)}
        color={color}
        lineWidth={active ? 2.6 : 1}
        transparent
        opacity={active ? 0.9 : 0.4}
      />
      <mesh ref={spark}>
        <sphereGeometry args={[active ? 0.115 : 0.07, 8, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function MemoryOrb({
  memory,
  reduced,
  onSelect,
}: {
  memory: Memory;
  reduced: boolean;
  onSelect: () => void;
}) {
  const orb = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = districtInfo[memory.district].color;
  useFrame((_, dt) => {
    if (!orb.current) return;
    const scale = THREE.MathUtils.damp(
      orb.current.scale.x,
      hovered ? 1.25 : 1,
      8,
      reduced ? 1 : dt,
    );
    orb.current.scale.setScalar(scale);
  });
  return (
    <group>
      <mesh
        ref={orb}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <sphereGeometry args={[0.35, 20, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 1 : 0.7}
          roughness={0.1}
          metalness={0.4}
        />
      </mesh>
      <Glow color={color} size={1.8} />
      <Html
        position={[0.5, 0.3, 0]}
        distanceFactor={18}
        zIndexRange={[20, 0]}
      >
        <button
          className={`orb-label ${hovered ? "orb-label-open" : ""}`}
          aria-label={`Day ${memory.day}: ${memory.title}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          onClick={onSelect}
        >
          {hovered ? memory.title : ""}
        </button>
      </Html>
    </group>
  );
}

function Chamber({
  room,
  state,
  history,
  rules,
  election,
  phase,
  voteProgress,
  reduced,
  sounding,
  solo,
  onMemory,
  cue,
}: {
  room: Location;
  state: State;
  history: Round[];
  rules: Config;
  election: Election;
  phase: string;
  voteProgress: number;
  reduced: boolean;
  sounding: boolean;
  solo: District | null;
  onMemory: (id: string) => void;
  cue: Cue | null;
}) {
  if (room === "decision" && cue)
    return (
      <group position={places.decision}>
        <GuidedChamber cue={cue} state={state} rules={rules} reduced={reduced} />
      </group>
    );
  return <ChamberRoom {...{ room, state, history, rules, election, phase, voteProgress, reduced, sounding, solo, onMemory, cue }} />;
}

function ChamberRoom({
  room,
  state,
  history,
  rules,
  election,
  phase,
  voteProgress,
  reduced,
  sounding,
  solo,
  onMemory,
  cue,
}: {
  room: Location;
  state: State;
  history: Round[];
  rules: Config;
  election: Election;
  phase: string;
  voteProgress: number;
  reduced: boolean;
  sounding: boolean;
  solo: District | null;
  onMemory: (id: string) => void;
  cue: Cue | null;
}) {
  const rotating = useRef<THREE.Group>(null);
  const pulseStarted = useRef(0);
  const memories = memoriesFor(history, rules).slice(-16);
  const color = locations[room].color;
  useEffect(() => {
    pulseStarted.current = performance.now();
  }, [state]);
  useFrame(({ clock }) => {
    if (rotating.current) {
      rotating.current.rotation.y = reduced ? 0 : clock.elapsedTime * 0.08;
      const progress = Math.min(
        1,
        (performance.now() - pulseStarted.current) / 1500,
      );
      rotating.current.scale.setScalar(
        reduced ? 1 : 1 + Math.sin(progress * Math.PI) * 0.2,
      );
    }
  });
  return (
    <group position={places[room]}>
      <Platform color={color} radius={5} />
      {room === "memory" ? (
        <group>
          {(() => {
            const days = [...new Set(memories.map((m) => m.day))];
            const span = Math.max(1, days.length - 1);
            return days.map((day, col) => {
              const t = days.length === 1 ? 0.5 : col / span;
              const a = Math.PI * (0.8 - 0.6 * t);
              const x = Math.cos(a) * 3.6,
                z = -Math.sin(a) * 2.2 + 0.4;
              return (
                <group key={day} position={[x, 0, z]}>
                  <mesh position={[0, 1.6, 0]}>
                    <cylinderGeometry args={[0.015, 0.015, 2.8, 6]} />
                    <meshBasicMaterial color="#9db4ff" transparent opacity={0.35} />
                  </mesh>
                  {memories
                    .filter((m) => m.day === day)
                    .map((memory, k) => (
                      <group key={memory.id} position={[0, 0.8 + k * 0.85, 0]}>
                        <MemoryOrb memory={memory} reduced={reduced} onSelect={() => onMemory(memory.id)} />
                      </group>
                    ))}
                  <Html center position={[0, 0.35, 0]} distanceFactor={18} zIndexRange={[20, 0]}>
                    <span className="memory-day-label">Day {day}</span>
                  </Html>
                </group>
              );
            });
          })()}
          {!memories.length && (
            <mesh position={[0, 2, 0]}>
              <torusGeometry args={[1.5, 0.025, 8, 64]} />
              <meshBasicMaterial color={color} />
            </mesh>
          )}
        </group>
      ) : (
        <group>
          {room === "headquarters" ? <ThoughtLenses focus={cue?.focus ?? null} /> :
            room === "decision" ? election.ballots.map((ballot, i) => {
              const a = i * Math.PI * 2 / election.ballots.length;
              const counted = phase === "Resolution" || (phase === "Voting" && i < voteProgress * election.ballots.length);
              return <mesh key={ballot.resident.id} position={[Math.cos(a) * 3.8, 0.5, Math.sin(a) * 3.8]}>
                <sphereGeometry args={[0.14, 10, 8]} />
                <meshStandardMaterial color={counted ? "#e8c49e" : "#554352"}
                  emissive="#e8c49e" emissiveIntensity={counted ? 0.24 : 0} />
              </mesh>;
            }) : null}
          {room !== "headquarters" && <group ref={rotating} position={[0, 2, 0]}>
            <mesh>
              <octahedronGeometry args={[1.1, 0]} />
              <meshStandardMaterial
                color={color}
                metalness={0.6}
                roughness={0.15}
                emissive={color}
                emissiveIntensity={0.5}
                transparent
                opacity={0.7}
              />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} rotation={[Math.PI / 2 + i * 0.5, i * 0.7, 0]}>
                <torusGeometry args={[1.6 + i * 0.25, 0.025, 8, 64]} />
                <meshBasicMaterial color={color} />
              </mesh>
            ))}
            <Glow color={color} size={7} />
          </group>}
          {(room === "headquarters" || room === "decision") &&
            districts.map((d, i) => (
              <group key={d} position={[(i - 1.5) * 1.7, 0, 2]}>
                <Persona
                  d={d}
                  speaking={cue?.speaker === d}
                  listening={!!cue?.speaker && cue.speaker !== d}
                  reaction={cue?.reactions.find((r) => r.d === d)}
                  energy={state.energy / rules.energyCap}
                  favored={
                    d === "R"
                      ? state.energy < rules.energyCap / 2
                      : d === "A"
                        ? state.taskProgress > 0
                        : d === "C"
                          ? state.connectionProgress > 0
                          : state.method > 1
                  }
                  reduced={reduced}
                />
              </group>
            ))}
          {room === "headquarters" && <ThoughtOrb reduced={reduced} />}
          {room === "observatory" && (
            <gridHelper
              args={[9, 12, "#82c4ff", "#47709a"]}
              position={[0, 0.27, 0]}
            />
          )}
        </group>
      )}
      <Sparkles
        count={30}
        scale={[10, 5, 10]}
        size={2}
        speed={reduced ? 0 : 0.2}
        color={color}
      />
    </group>
  );
}

function ContextWatch({ onUnavailable }: { onUnavailable: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onUnavailable]);
  return null;
}

export default function MindScene({
  entered,
  room,
  state,
  rules,
  history,
  election,
  phase,
  voteProgress,
  reduced,
  sounding,
  solo,
  pair,
  onVisit,
  onMemory,
  onArrive,
  onUnavailable,
  voice,
  lit,
  onVoice,
  onToggle,
  cue,
}: {
  entered: boolean;
  room: Location;
  state: State;
  rules: Config;
  history: Round[];
  election: Election;
  phase: string;
  voteProgress: number;
  reduced: boolean;
  sounding: boolean;
  solo: District | null;
  pair: { a: Round; b: Round } | null;
  onVisit: (room: Location) => void;
  onMemory: (id: string) => void;
  onArrive: () => void;
  onUnavailable: () => void;
  voice: District | null;
  lit: District[];
  onVoice: (d: District | null) => void;
  onToggle: (d: District) => void;
  cue: Cue | null;
}) {
  const [hidden, setHidden] = useState(document.hidden);
  const [portalPreview, setPortalPreview] = useState<Location | null>(null);
  useEffect(() => setPortalPreview(null), [room]);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.8, 12.5], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      frameloop={hidden ? "never" : reduced ? "demand" : "always"}
    >
      <ContextWatch onUnavailable={onUnavailable} />
      {entered ? (
        <>
          <color attach="background" args={["#0a0b1e"]} />
          <fog attach="fog" args={["#0a0b1e", 40, 100]} />
        </>
      ) : (
        <>
          <color attach="background" args={["#070918"]} />
          <fogExp2 attach="fog" args={["#070918", 0.035]} />
        </>
      )}
      <ambientLight intensity={1.5} color="#b5b0e8" />
      <directionalLight position={[5, 12, 8]} intensity={3} color="#fff1df" />
      <directionalLight position={[-8, 4, -4]} intensity={3} color="#bb9bff" />
      <CameraJourney
        framing={cue ? (cue.scene === "voting" ? 2 : 1) : 0}
        entered={entered}
        room={room}
        reduced={reduced}
        onArrive={onArrive}
      />
      <Suspense fallback={null}>
        <LandingBrain
          entered={entered}
          reduced={reduced}
          voice={voice}
          lit={lit}
          onVoice={onVoice}
          onToggle={onToggle}
        />
        {entered && (
          <>
            <Sparkles
              count={160}
              scale={[85, 30, 95]}
              position={[0, 6, -55]}
              size={2}
              speed={reduced ? 0 : 0.15}
              color="#c8bbef"
            />
            {districts.map((d) => (
              <group key={d} position={places[d]}>
                <DistrictIsland
                  d={d}
                  state={state}
                  rules={rules}
                  last={history.at(-1)}
                  reduced={reduced}
                  onVisit={onVisit}
                  labels={room === "hub" || room === d}
                />
              </group>
            ))}
            {districts.map((d, i) => (
              <NeuralBridge
                key={d}
                from={places.hub}
                to={places[d]}
                color={colors[i]}
                reduced={reduced}
              />
            ))}
            {(
              [
                "headquarters",
                "memory",
                "decision",
                "parallel",
                "observatory",
              ] as const
            ).map((place) => (
              <group key={place}>
                <NeuralBridge
                  from={places.hub}
                  to={gateways[place]}
                  active={portalPreview === place || room === place}
                  color={locations[place].color}
                  reduced={reduced}
                />
                {room === "hub" && !cue && (
                  <group position={gateways[place]}>
                    <mesh
                      scale={portalPreview === place ? 1.14 : 1}
                      onPointerOver={event => {
                        if (place === "parallel" && !history.length) return;
                        event.stopPropagation();
                        setPortalPreview(place);
                      }}
                      onPointerOut={() => setPortalPreview(null)}
                      onClick={() => onVisit(place)}
                    >
                      {place === "memory" ? (
                        <sphereGeometry args={[0.8, 20, 16]} />
                      ) : (
                        <octahedronGeometry
                          args={[place === "headquarters" ? 1.7 : 0.9, 0]}
                        />
                      )}
                      <meshStandardMaterial
                        color={locations[place].color}
                        emissive={locations[place].color}
                        emissiveIntensity={0.5}
                      />
                    </mesh>
                    <Glow color={locations[place].color} size={5} />
                    <Html
                      center
                      position={[0, 2, 0]}
                      distanceFactor={30}
                      zIndexRange={[20, 0]}
                    >
                      <button
                        className="place-label"
                        onPointerEnter={() => setPortalPreview(place)}
                        onPointerLeave={() => setPortalPreview(null)}
                        onFocus={() => setPortalPreview(place)}
                        onBlur={() => setPortalPreview(null)}
                        disabled={place === "parallel" && !history.length}
                        title={
                          place === "parallel" && !history.length
                            ? "Resolve a day to open Parallel Worlds"
                            : locations[place].title
                        }
                        onClick={() => onVisit(place)}
                      >
                        {locations[place].symbol} {locations[place].title}
                      </button>
                    </Html>
                  </group>
                )}
              </group>
            ))}
            <group position={places.hub}>
              <Platform color="#bca9f6" radius={3} />
              <mesh
                position={[0, 1.4, 0]}
                rotation={[0, 0, Math.PI / 4]}
                onClick={() => onVisit("headquarters")}
              >
                <octahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                  color="#e8ceff"
                  emissive="#b589ff"
                  emissiveIntensity={0.4}
                  metalness={0.5}
                  roughness={0.2}
                />
              </mesh>
              <Glow color="#c0a1ff" size={6} position={[0, 1, 0]} />
            </group>
            {room !== "hub" &&
              !districts.includes(room as District) &&
              room !== "parallel" && (
                <Chamber
                  room={room}
                  state={state}
                  history={history}
                  rules={rules}
                  election={election}
                  phase={phase}
                  voteProgress={voteProgress}
                  reduced={reduced}
                  sounding={sounding}
                  solo={solo}
                  onMemory={onMemory}
                  cue={cue}
                />
              )}
            {cue?.flights && (
              <Flights
                key={cue.flights.key}
                allocation={cue.flights.allocation}
                reduced={reduced}
              />
            )}
            {cue?.focus && (
              <group position={places[cue.focus]}>
                <Glow color={districtInfo[cue.focus].color} size={14} position={[0, 2, 0]} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
                  <ringGeometry args={[3.6, 3.9, 64]} />
                  <meshBasicMaterial color={districtInfo[cue.focus].color} toneMapped={false} side={THREE.DoubleSide} />
                </mesh>
              </group>
            )}
            {room === "parallel" && (
              <group position={places.parallel}>
                {(["a", "b"] as const).map((branch, i) => (
                  <group key={branch} position={[(i ? 1 : -1) * 4.2, 0, 0]}>
                    <group scale={0.4}>
                      {districts.map((d, index) => (
                        <group
                          key={d}
                          position={[
                            (index % 2 ? 1 : -1) * 3.8,
                            0,
                            (index < 2 ? 1 : -1) * 3.8,
                          ]}
                        >
                          <DistrictIsland
                            d={d}
                            state={pair?.[branch].after ?? state}
                            rules={rules}
                            last={pair?.[branch]}
                            reduced={reduced}
                            onVisit={() => {}}
                            labels={false}
                          />
                        </group>
                      ))}
                    </group>
                    <Html position={[0, 2.4, 0]} center zIndexRange={[10, 0]}>
                      <span className="branch-label">
                        {i ? "B / WHAT IF" : "A / THE ELECTED PATH"}
                      </span>
                    </Html>
                  </group>
                ))}
                <mesh position={[0, 1, -2]}>
                  <torusGeometry args={[1.3, 0.025, 8, 64]} />
                  <meshBasicMaterial color="#cf9bff" />
                </mesh>
              </group>
            )}
          </>
        )}
      </Suspense>
    </Canvas>
  );
}

const personaSeats = districts.map((_, i) => {
  const a = -0.95 + (i * 1.9) / 3;
  return [Math.sin(a) * 3.3, -2.2 + (1 - Math.cos(a)) * 1.6] as const;
});

/** Guided Decision Chamber: voices around a holographic plan table, live vote columns and resident orbs. */
function GuidedChamber({
  cue,
  state,
  rules,
  reduced,
}: {
  cue: Cue;
  state: State;
  rules: Config;
  reduced: boolean;
}) {
  const ring = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ring.current && !reduced) ring.current.rotation.y = clock.elapsedTime * 0.05;
  });
  const speakerSeat = cue.speaker ? personaSeats[districts.indexOf(cue.speaker)] : null;
  const total = cue.votes.length || rules.residentCount;
  return (
    <group>
      <Platform color="#ffc531" radius={5.6} />
      <mesh position={[0, 0.45, 0.2]}>
        <cylinderGeometry args={[1.9, 1.6, 0.35, 48]} />
        <meshStandardMaterial color="#2b2a52" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.64, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.85, 48]} />
        <meshBasicMaterial color="#7f8cff" transparent opacity={0.25} toneMapped={false} />
      </mesh>
      {cue.plans.map((p, i) => {
        const accent = districtInfo[planAccent(p, cue.plans)].color;
        const count = cue.counts?.[i] ?? 0;
        const height = 0.05 + (count / total) * 2.6;
        const won = cue.winner === i;
        return (
          <group key={p.id} position={[(i - 1) * 1.1, 0.66, 0.2]}>
            <mesh position={[0, height / 2, 0]}>
              <cylinderGeometry args={[0.28, 0.28, height, 24]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={won ? 1.2 : 0.45}
                transparent
                opacity={0.75}
              />
            </mesh>
            {cue.counts && (
              <Html center position={[0, height + 0.36, 0]} distanceFactor={15} zIndexRange={[14, 0]}>
                <span className="vote-pill" style={{ "--vote-color": accent } as React.CSSProperties}>
                  {count} {count === 1 ? "vote" : "votes"}
                </span>
              </Html>
            )}
            {won && <Glow color={accent} size={3} position={[0, height, 0]} />}
          </group>
        );
      })}
      <group ref={ring}>
        {Array.from({ length: total }, (_, i) => {
          const a = (i / total) * Math.PI * 2;
          const choice = cue.votes[i];
          const c = choice === null || choice === undefined ? "#3a3f6e" : districtInfo[planAccent(cue.plans[choice], cue.plans)].color;
          return (
            <mesh key={i} position={[Math.cos(a) * 4.9, 0.55, Math.sin(a) * 4.9]}>
              <sphereGeometry args={[0.17, 14, 10]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={choice === null || choice === undefined ? 0.05 : 0.9} />
            </mesh>
          );
        })}
      </group>
      {districts.map((d, i) => {
        const [x, z] = personaSeats[i];
        const speaking = cue.speaker === d;
        const target = speakerSeat && !speaking ? speakerSeat : [0, 0.2];
        // Listeners glance toward the speaker but keep their faces readable.
        const yaw = speaking ? 0 : THREE.MathUtils.clamp(Math.atan2(target[0] - x, target[1] - z), -0.75, 0.75);
        return (
          <group key={d} position={[x, 0, z - 1.25]}>
            <Persona
              d={d}
              energy={state.energy / rules.energyCap}
              favored={false}
              reduced={reduced}
              speaking={speaking}
              listening={!!cue.speaker && !speaking}
              yaw={yaw}
              reaction={cue.reactions.find((r) => r.d === d)}
            />
          </group>
        );
      })}
    </group>
  );
}

function ThoughtLenses({ focus }: { focus: District | null }) {
  return <group position={[0, 1, -0.1]}>
    {districts.map((district, i) => {
      const angle = Math.PI * (1.07 + i * 0.29);
      const x = Math.cos(angle) * 3.4;
      const z = Math.sin(angle) * 2;
      const color = districtInfo[district].color;
      const active = focus === district;
      return <group key={district}>
        <Line points={[[0, 1.45, 0], [x * 0.55, 1.7, z * 0.65], [x, 0.75, z]]} color={color}
          lineWidth={active ? 2 : 1} transparent opacity={active ? 0.75 : 0.26}/>
        <group position={[x, 0.75, z]}>
          <mesh>
            <icosahedronGeometry args={[0.32, 1]} />
            <meshStandardMaterial color={voicePalette[district].clay} roughness={0.85}
              emissive={color} emissiveIntensity={active ? 0.22 : 0.06} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.54, 0.018, 8, 40]} />
            <meshBasicMaterial color={color} transparent opacity={active ? 0.7 : 0.35} />
          </mesh>
        </group>
      </group>;
    })}
  </group>;
}

function ThoughtOrb({ reduced }: { reduced: boolean }) {
  const orb = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (orb.current) orb.current.scale.setScalar(1 + (reduced ? 0 : Math.sin(clock.elapsedTime * 2) * 0.05));
  });
  return (
    <group>
      <group ref={orb} position={[0, 3.6, 0.5]}>
        <mesh>
          <icosahedronGeometry args={[0.55, 2]} />
          <meshStandardMaterial color="#f1e6ff" emissive="#c9a9ff" emissiveIntensity={1.1} />
        </mesh>
        <Glow color="#d9c2ff" size={4} />
      </group>
      {districts.map((d, i) => (
        <Line
          key={d}
          points={[
            [0, 3.6, 0.5],
            [(i - 1.5) * 1.1, 2.6, 1.6],
            [(i - 1.5) * 1.7, 1.2, 3.25],
          ]}
          color={districtInfo[d].color}
          lineWidth={2.5}
          transparent
          opacity={0.85}
        />
      ))}
    </group>
  );
}

/** Today's six time blocks fly from the hub to the districts that received them. */
function Flights({ allocation, reduced }: { allocation: Record<District, number>; reduced: boolean }) {
  const blocks = useMemo(
    () =>
      districts.flatMap((d) =>
        Array.from({ length: allocation[d] }, (_, k) => ({ d, k })),
      ).map((b, i) => {
        const to = places[b.d];
        return {
          ...b,
          i,
          curve: new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(places.hub[0], 2.5, places.hub[2]),
            new THREE.Vector3((places.hub[0] + to[0]) / 2, 8, (places.hub[2] + to[2]) / 2),
            new THREE.Vector3(to[0] + (b.k - 1) * 0.7, 3.4, to[2] + 1.5),
          ),
        };
      }),
    [allocation],
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    blocks.forEach((b) => {
      const m = refs.current[b.i];
      if (!m) return;
      const p = reduced ? 1 : Math.min(1, Math.max(0, (t - b.i * 0.35) / 1.6));
      const eased = 1 - (1 - p) ** 3;
      m.position.copy(b.curve.getPoint(eased));
      m.rotation.set(eased * 4, eased * 6, 0);
      m.visible = reduced || t > b.i * 0.35;
    });
  });
  return (
    <group>
      {blocks.map((b) => (
        <mesh key={`${b.d}${b.k}`} ref={(m) => (refs.current[b.i] = m)}>
          <boxGeometry args={[0.55, 0.55, 0.55]} />
          <meshStandardMaterial color={districtInfo[b.d].color} emissive={districtInfo[b.d].color} emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  );
}
