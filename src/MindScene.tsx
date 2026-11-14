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
import { audio } from "./audio";

type Point = [number, number, number];
const places: Record<Location, Point> = {
  hub: [0, 0, -48],
  headquarters: [0, 0, -82],
  memory: [-25, 1, -82],
  decision: [25, 0, -82],
  parallel: [-30, 0, -110],
  observatory: [29, 1, -110],
  symphony: [0, 1, -112],
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
  symphony: [0, -4, -85],
} satisfies Partial<Record<Location, Point>>;
const colors = ["#ffd36c", "#ff8fab", "#70bfff", "#a5ecc0"];

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

function Brain({ reduced }: { reduced: boolean }) {
  const brain = useRef<THREE.Group>(null);
  const folds = useMemo(
    () =>
      [-1, 1].flatMap((side) =>
        Array.from({ length: 13 }, (_, row) => {
          const latitude = -0.95 + row * 0.15;
          return Array.from({ length: 100 }, (_, i) => {
            const a = (i / 99) * Math.PI * 2;
            const wave =
              0.08 * Math.sin(a * 8 + row * 1.4) +
              0.04 * Math.sin(a * 17 - row);
            const r = Math.sqrt(1 - latitude * latitude);
            return [
              side * 1.28 + Math.cos(a) * r * 1.65,
              latitude * 2.2 + wave,
              Math.sin(a) * r * 1.55 + wave,
            ] as Point;
          });
        }),
      ),
    [],
  );
  useFrame(({ pointer, clock, camera }, dt) => {
    if (!brain.current) return;
    brain.current.visible = camera.position.z > -8;
    const t = reduced ? 0 : clock.elapsedTime;
    brain.current.rotation.y = THREE.MathUtils.damp(
      brain.current.rotation.y,
      reduced ? -0.18 : pointer.x * 0.25 - 0.18,
      3,
      dt,
    );
    brain.current.rotation.x = THREE.MathUtils.damp(
      brain.current.rotation.x,
      reduced ? 0.12 : -0.1 * pointer.y + 0.12,
      3,
      dt,
    );
    brain.current.position.y = 0.45 + Math.sin(t * 0.55) * 0.13;
  });
  return (
    <group ref={brain} rotation={[0.12, -0.18, -0.1]} scale={0.78}>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 1.28, 0, 0]}
          scale={[1.65, 2.2, 1.55]}
        >
          <sphereGeometry args={[1, 40, 32]} />
          <meshPhysicalMaterial
            color={side < 0 ? "#a589e9" : "#f4a0b7"}
            metalness={0.3}
            roughness={0.28}
            clearcoat={1}
            transparent
            opacity={0.26}
            depthWrite={false}
            emissive="#8853ac"
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
      {folds.map((points, i) => (
        <Line
          key={i}
          points={points}
          color={colors[Math.floor(i / 7) % 4]}
          lineWidth={2.4}
          transparent
          opacity={0.66}
        />
      ))}
      {Array.from({ length: 40 }, (_, i) => {
        const a = i * 2.399,
          y = Math.sin(i * 3.17) * 1.9;
        const r = Math.sqrt(Math.max(0, 1 - (y / 2.2) ** 2));
        return (
          <group
            key={i}
            position={[
              (i % 2 ? 1 : -1) * 1.28 + Math.cos(a) * 1.65 * r,
              y,
              Math.sin(a) * 1.55 * r,
            ]}
          >
            <mesh>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshBasicMaterial color={colors[i % 4]} />
            </mesh>
            {i % 4 === 0 && <Glow color={colors[i % 4]} size={0.8} />}
          </group>
        );
      })}
      <mesh position={[0, -2.1, -0.3]} rotation={[0, 0, -0.1]}>
        <capsuleGeometry args={[0.35, 1, 5, 12]} />
        <meshStandardMaterial color="#9471b6" transparent opacity={0.5} />
      </mesh>
      <Glow color="#b590ff" size={11} position={[0, 0, -2]} />
      <Sparkles
        count={65}
        scale={[9, 6, 6]}
        size={2}
        speed={reduced ? 0 : 0.25}
        color="#ecb7ff"
      />
    </group>
  );
}

function CameraJourney({
  entered,
  room,
  reduced,
  onArrive,
}: {
  entered: boolean;
  room: Location;
  reduced: boolean;
  onArrive: () => void;
}) {
  const { camera, size, invalidate } = useThree();
  const target = useRef(new THREE.Vector3());
  const journey = useRef(0);
  const arrived = useRef(false);
  const wasEntered = useRef(false);
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = entered && size.width < 700 ? 84 : 42;
    perspective.updateProjectionMatrix();
    invalidate();
  }, [camera, entered, size.width, invalidate]);
  useEffect(() => {
    arrived.current = false;
  }, [room, entered]);
  useFrame((_, dt) => {
    if (entered && !wasEntered.current) journey.current = 0;
    wasEntered.current = entered;
    journey.current += Math.min(dt, 0.05);
    const p = places[room];
    const narrow = size.width < 700;
    let dest: Point = !entered
      ? [0, 0.8, narrow ? 16 : 12.5]
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
      : [0, 0.3, 0];
    // A brief approach crosses the actual neural shell before emerging at the hub.
    if (entered && !reduced && journey.current < 1.15) {
      dest = [0, 0.2, -2];
      look = [0, 0, -12];
    }
    const position = new THREE.Vector3(...dest);
    const damping = !entered ? 3 : journey.current < 1.15 ? 2 : 2.1;
    camera.position.lerp(
      position,
      reduced ? 1 : 1 - Math.exp(-damping * Math.min(dt, 0.05)),
    );
    target.current.lerp(
      new THREE.Vector3(...look),
      reduced ? 1 : 1 - Math.exp(-damping * Math.min(dt, 0.05)),
    );
    camera.lookAt(target.current);
    if (
      entered &&
      !arrived.current &&
      (reduced ||
        (camera.position.distanceTo(position) < 0.35 && journey.current > 1.2))
    ) {
      arrived.current = true;
      onArrive();
    }
  });
  return null;
}

function Platform({ color, radius = 3.4 }: { color: string; radius?: number }) {
  return (
    <group>
      <mesh position={[0, -0.65, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[radius, 2, 7]} />
        <meshStandardMaterial color="#333050" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[radius, radius * 0.92, 0.4, 48]} />
        <meshStandardMaterial
          color="#585370"
          roughness={0.6}
          metalness={0.25}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <ringGeometry args={[radius - 0.1, radius, 64]} />
        <meshBasicMaterial
          color={color}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Glow color={color} size={radius * 3} position={[0, -0.7, 0]} />
    </group>
  );
}

function Persona({
  d,
  energy,
  favored,
  reduced,
}: {
  d: District;
  energy: number;
  favored: boolean;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const index = districts.indexOf(d);
  const color = colors[index];
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const t = reduced ? 0 : clock.elapsedTime;
    ref.current.position.y =
      0.8 + Math.sin(t * (favored ? 3 : 1.3) + index) * (favored ? 0.16 : 0.06);
    ref.current.rotation.z =
      Math.sin(t * 1.1 + index) * (energy < 0.25 ? 0.12 : 0.04);
    ref.current.scale.lerp(
      new THREE.Vector3(1, energy < 0.25 ? 0.8 : 1, 1),
      Math.min(1, dt * 4),
    );
  });
  return (
    <group ref={ref} position={[0, 0.8, 1.25]}>
      <mesh
        scale={
          d === "C"
            ? [1.1, 0.95, 0.8]
            : d === "D"
              ? [0.9, 1.1, 0.8]
              : [1, 1, 0.8]
        }
      >
        {d === "A" ? (
          <coneGeometry args={[0.58, 1.25, 5, 1]} />
        ) : d === "D" ? (
          <octahedronGeometry args={[0.65, 0]} />
        ) : (
          <capsuleGeometry args={[0.46, d === "R" ? 0.5 : 0.25, 6, 16]} />
        )}
        <meshStandardMaterial
          color={color}
          roughness={0.25}
          metalness={0.15}
          emissive={color}
          emissiveIntensity={favored ? 0.3 : 0.08}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.19, 0.15, 0.43]}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshBasicMaterial color="#fbf8ff" />
          </mesh>
          <mesh position={[side * 0.18, 0.15 + (favored ? 0.02 : 0), 0.515]}>
            <sphereGeometry args={[0.048, 10, 8]} />
            <meshBasicMaterial color="#21162e" />
          </mesh>
          <mesh
            position={[side * 0.47, -0.08, 0.12]}
            rotation={[0, 0, side * (favored ? -0.8 : 0.45)]}
          >
            <capsuleGeometry args={[0.075, 0.3, 4, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[side * 0.2, -0.65, 0.05]} scale={[1, 0.55, 1.4]}>
            <sphereGeometry args={[0.14, 10, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {d === "C" && (
            <mesh position={[side * 0.4, 0.5, -0.05]}>
              <sphereGeometry args={[0.25, 12, 8]} />
              <meshStandardMaterial color="#ed91bf" />
            </mesh>
          )}
          {d === "D" && (
            <mesh position={[side * 0.19, 0.15, 0.5]}>
              <torusGeometry args={[0.14, 0.025, 6, 16]} />
              <meshBasicMaterial color="#293b83" />
            </mesh>
          )}
        </group>
      ))}
      <mesh
        position={[0, -0.12, 0.47]}
        rotation={[0, 0, energy < 0.25 ? 0 : Math.PI]}
      >
        <torusGeometry args={[0.12, 0.025, 6, 16, Math.PI]} />
        <meshBasicMaterial color="#35213c" />
      </mesh>
      {d === "R" && (
        <mesh
          position={[0, 0.65, 0]}
          rotation={[0, 0, -0.5]}
          scale={[1, 0.35, 0.6]}
        >
          <sphereGeometry args={[0.32, 12, 8]} />
          <meshStandardMaterial color="#d2ffba" />
        </mesh>
      )}
      {favored && <Glow color={color} size={2} position={[0, 0.3, -0.4]} />}
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
            <span>{locations[d].symbol}</span>
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
}: {
  from: Point;
  to: Point;
  color: string;
  reduced: boolean;
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
        curve.getPoint(reduced ? 0.5 : (clock.elapsedTime * 0.14) % 1),
      );
  });
  return (
    <group>
      <Line
        points={curve.getPoints(40)}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.4}
      />
      <mesh ref={spark}>
        <sphereGeometry args={[0.07, 8, 6]} />
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
        center
        position={[0, -0.6, 0]}
        distanceFactor={18}
        zIndexRange={[20, 0]}
      >
        <button
          className="orb-label"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          onClick={onSelect}
        >
          Day {memory.day} · {memory.title}
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
        <group ref={rotating}>
          {memories.map((memory, i) => {
            const a = i * 2.399;
            return (
              <group
                key={memory.id}
                position={[
                  Math.cos(a) * (2.2 + (i % 2)),
                  1.3 + (i % 3) * 1.1,
                  Math.sin(a) * (2.2 + (i % 2)),
                ]}
              >
                <MemoryOrb
                  memory={memory}
                  reduced={reduced}
                  onSelect={() => onMemory(memory.id)}
                />
              </group>
            );
          })}
          {!memories.length && (
            <mesh position={[0, 2, 0]}>
              <torusGeometry args={[1.5, 0.025, 8, 64]} />
              <meshBasicMaterial color={color} />
            </mesh>
          )}
        </group>
      ) : room === "symphony" ? (
        <group>
          {districts.map((d, i) => (
            <group key={d} position={[(i - 1.5) * 1.7, 0, 0]}>
              <MusicColumn
                color={colors[i]}
                index={i}
                active={sounding && (!solo || solo === d)}
                reduced={reduced}
              />
              <Persona
                d={d}
                energy={1}
                favored={sounding && (!solo || solo === d)}
                reduced={reduced}
              />
            </group>
          ))}
        </group>
      ) : (
        <group>
          {Array.from(
            {
              length:
                room === "decision" ? 24 : room === "headquarters" ? 4 : 8,
            },
            (_, i) => {
              const a =
                room === "headquarters"
                  ? Math.PI + 0.4 + (i * (Math.PI - 0.8)) / 3
                  : (i * Math.PI * 2) / (room === "decision" ? 24 : 8);
              return (
                <mesh
                  key={i}
                  position={[
                    Math.cos(a) * 3.8,
                    room === "headquarters"
                      ? 1.3
                      : 0.5 + (room === "observatory" ? i % 3 : 0),
                    Math.sin(a) * 3.8,
                  ]}
                  rotation={[0, -a, 0]}
                >
                  {room === "decision" ? (
                    <sphereGeometry args={[0.18, 8, 6]} />
                  ) : (
                    <boxGeometry args={[0.15, 1.5 + (i % 2), 0.7]} />
                  )}
                  <meshStandardMaterial
                    color={
                      room === "decision"
                        ? colors[election.ballots[i].choice]
                        : colors[i % 4]
                    }
                    emissive={
                      room === "decision"
                        ? colors[election.ballots[i].choice]
                        : colors[i % 4]
                    }
                    emissiveIntensity={
                      room !== "decision" ||
                      i <
                        (phase === "Campaign"
                          ? 0
                          : phase === "Voting"
                            ? voteProgress * election.ballots.length
                            : election.ballots.length)
                        ? 0.8
                        : 0.03
                    }
                    transparent
                    opacity={0.7}
                  />
                </mesh>
              );
            },
          )}
          <group ref={rotating} position={[0, 2, 0]}>
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
          </group>
          {(room === "headquarters" || room === "decision") &&
            districts.map((d, i) => (
              <group key={d} position={[(i - 1.5) * 1.7, 0, 2]}>
                <Persona
                  d={d}
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
          {room === "headquarters" && (
            <mesh position={[0, 0.65, 1.4]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.7, 0.2, 12, 64, Math.PI]} />
              <meshStandardMaterial
                color="#c691d2"
                emissive="#a44ea4"
                emissiveIntensity={0.3}
                metalness={0.4}
                roughness={0.3}
              />
            </mesh>
          )}
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

function MusicColumn({
  color,
  index,
  active,
  reduced,
}: {
  color: string;
  index: number;
  active: boolean;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current)
      ref.current.scale.y =
        active && !reduced ? 0.3 + audio.level(districts[index]) * 3 : 0.3;
  });
  return (
    <mesh ref={ref} position={[0, 1.5, -1]}>
      <cylinderGeometry args={[0.2, 0.45, 2, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={active ? 0.9 : 0.15}
        transparent
        opacity={0.6}
      />
    </mesh>
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
}) {
  const [hidden, setHidden] = useState(document.hidden);
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
      <color attach="background" args={["#100f24"]} />
      <fog attach="fog" args={["#100f24", 40, 100]} />
      <ambientLight intensity={1.5} color="#b5b0e8" />
      <directionalLight position={[5, 12, 8]} intensity={3} color="#fff1df" />
      <directionalLight position={[-8, 4, -4]} intensity={3} color="#bb9bff" />
      <CameraJourney
        entered={entered}
        room={room}
        reduced={reduced}
        onArrive={onArrive}
      />
      <Suspense fallback={null}>
        <Brain reduced={reduced} />
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
                "symphony",
              ] as const
            ).map((place) => (
              <group key={place}>
                <NeuralBridge
                  from={places.hub}
                  to={gateways[place]}
                  color={locations[place].color}
                  reduced={reduced}
                />
                {room === "hub" && (
                  <group position={gateways[place]}>
                    <mesh onClick={() => onVisit(place)}>
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
                />
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
                    <Html position={[0, 4, 0]} center zIndexRange={[10, 0]}>
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
