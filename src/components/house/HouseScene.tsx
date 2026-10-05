"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { layoutRooms, PALETTE, roomLook, type RoomSpec } from "@/lib/houseLayout";
import type { AgentStatus } from "@/lib/agentTypes";

// Port of docs/house-prototype/scene.html. Loaded only on /house (next/dynamic, ssr:false).

export type SceneAgent = { id: string; name: string; status: AgentStatus; currentTask: string | null; pending: number };

const HOUSE = "/house/house-final.glb";
// Real lengths (m) and driveway x, from the prototype. Nose toward the house.
const CARS: [file: string, lengthM: number, x: number][] = [
  ["/house/porsche.glb", 4.56, -1.5],
  ["/house/rolls.glb", 5.55, 2.7],
  ["/house/ferrari.glb", 4.66, 6.9],
  ["/house/svj.glb", 4.94, 11.1],
  ["/house/revuelto.glb", 4.95, 15.3],
  ["/house/bugatti.glb", 4.67, 19.5],
];
// Lot layout measured from the prototype's top-down render (model units).
const LOT = { minX: -4.1, maxX: 21.6, frontZ: 3.5 };
const GATE_X = 12.4;

class Boundary extends Component<{ fallback: ReactNode; onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Box({ size, color, position }: { size: [number, number, number]; color: string; position: [number, number, number] }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function shadowAll(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
}

// Scale a car to its real length, turn its length along Z, sit it on the pad.
// Aligns on the biggest part (the body): stray helper parts stretch some exports' bounds.
function placeCar(obj: THREE.Object3D, lengthM: number, x: number, groundY: number, z: number) {
  let b = new THREE.Box3().setFromObject(obj);
  let s = b.getSize(new THREE.Vector3());
  if (s.x > s.z) obj.rotation.y = Math.PI / 2;
  b = new THREE.Box3().setFromObject(obj);
  s = b.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(lengthM / Math.max(s.x, s.z));
  obj.updateMatrixWorld(true);
  let body: THREE.Box3 | null = null;
  let bodyVol = 0;
  obj.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const bb = new THREE.Box3().setFromObject(o);
    const sz = bb.getSize(new THREE.Vector3());
    const v = sz.x * sz.y * sz.z;
    if (v > bodyVol) {
      bodyVol = v;
      body = bb;
    }
  });
  b = new THREE.Box3().setFromObject(obj);
  const bodyBox = body ?? b;
  const c = bodyBox.getCenter(new THREE.Vector3());
  obj.position.x += x - c.x;
  obj.position.z += z - bodyBox.min.z;
  obj.position.y += groundY - b.min.y;
  shadowAll(obj);
}

function Car({ file, lengthM, x, lawnY }: { file: string; lengthM: number; x: number; lawnY: number }) {
  const { scene } = useGLTF(file);
  const car = useMemo(() => {
    const c = scene.clone(true);
    placeCar(c, lengthM, x, lawnY + 0.02, LOT.frontZ + 1.2);
    return c;
  }, [scene, lengthM, x, lawnY]);
  return <primitive object={car} />;
}

function Room({ agent, room, reducedMotion, onSelect }: { agent: SceneAgent; room: RoomSpec; reducedMotion: boolean; onSelect: (id: string) => void }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const look = roomLook(agent.status, reducedMotion);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = look.pulse ? look.glow * (0.7 + 0.3 * Math.sin(clock.elapsedTime * 4)) : look.glow;
  });
  const [x, y, z] = room.position;
  const off = agent.status === "OFF";
  return (
    <group position={[x, y, z]} rotation={[0, room.facing, 0]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(agent.id);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <planeGeometry args={room.size} />
        <meshStandardMaterial ref={mat} color={look.window} emissive={look.window} emissiveIntensity={look.glow} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, room.size[1] / 2 + 0.9, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className={`whitespace-nowrap rounded-md px-2 py-1 text-center text-xs font-medium shadow ${off ? "bg-slate-700 text-slate-300" : "bg-slate-900/90 text-white"}`}>
          {agent.name}
          {agent.pending > 0 && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-slate-900">{agent.pending}</span>}
          {agent.status === "RUNNING" && agent.currentTask && <div className="mt-0.5 font-normal text-amber-200">Now: {agent.currentTask}</div>}
        </div>
      </Html>
    </group>
  );
}

function World({ agents, reducedMotion, onSelect, onLoaded }: { agents: SceneAgent[]; reducedMotion: boolean; onSelect: (id: string) => void; onLoaded: () => void }) {
  const { scene: house } = useGLTF(HOUSE);
  useEffect(onLoaded, [onLoaded]);
  const lawnY = useMemo(() => {
    shadowAll(house);
    // Lawn height: raycast down onto the back lawn.
    const hit = new THREE.Raycaster(new THREE.Vector3(0, 100, -28), new THREE.Vector3(0, -1, 0)).intersectObject(house, true)[0];
    return hit ? hit.point.y : 2;
  }, [house]);

  const padDepth = 8.5;
  const padZ = LOT.frontZ + padDepth / 2 + 0.2;
  const streetZ = LOT.frontZ + padDepth + 0.2 + 4;
  const byId = new Map(agents.map((a) => [a.id, a]));

  return (
    <>
      <primitive object={house} />
      <Box size={[200, 0.2, 200]} color={PALETTE.ground} position={[9, lawnY - 0.35, 0]} />
      <Box size={[LOT.maxX - LOT.minX, 0.12, padDepth]} color={PALETTE.pad} position={[(LOT.minX + LOT.maxX) / 2, lawnY - 0.04, padZ]} />
      <Box size={[3.2, 0.12, 4]} color={PALETTE.pad} position={[GATE_X, lawnY - 0.03, LOT.frontZ - 1.6]} />
      <Box size={[200, 0.1, 8]} color={PALETTE.street} position={[9, lawnY - 0.06, streetZ]} />
      {Array.from({ length: 24 }, (_, i) => (
        <Box key={i} size={[2.5, 0.11, 0.18]} color={PALETTE.dash} position={[-60 + i * 6, lawnY - 0.05, streetZ]} />
      ))}
      <Box size={[200, 0.25, 0.3]} color={PALETTE.curb} position={[9, lawnY - 0.02, streetZ - 4.1]} />
      {CARS.map(([file, len, x]) => (
        <Boundary key={file} fallback={null}>
          <Suspense fallback={null}>
            <Car file={file} lengthM={len} x={x} lawnY={lawnY} />
          </Suspense>
        </Boundary>
      ))}
      {layoutRooms(agents.map((a) => a.id)).map(({ id, room }) => (
        <Room key={id} agent={byId.get(id)!} room={room} reducedMotion={reducedMotion} onSelect={onSelect} />
      ))}
    </>
  );
}

export default function HouseScene({
  agents,
  reducedMotion,
  onSelect,
  onFail,
}: {
  agents: SceneAgent[];
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onFail: () => void;
}) {
  // Camera from the prototype's ?az=20 view: front three-quarter on the house + driveway.
  const center: [number, number, number] = [9, 5, -6];
  const az = (20 * Math.PI) / 180;
  const r = 52;
  const anyRunning = agents.some((a) => a.status === "RUNNING");
  const [loaded, setLoaded] = useState(false);
  const markLoaded = useMemo(() => () => setLoaded(true), []);

  return (
    <>
      <Canvas
        shadows
        flat
        dpr={[1, 2]}
        frameloop={reducedMotion && !anyRunning ? "demand" : "always"}
        camera={{ fov: 40, near: 0.1, far: 2000, position: [center[0] + r * Math.sin(az), 24, center[2] + r * Math.cos(az)] }}
        fallback={<p className="p-6 text-sm text-slate-300">3D isn&apos;t available in this browser. Use the brother list.</p>}
        onPointerMissed={() => (document.body.style.cursor = "")}
      >
        <color attach="background" args={[PALETTE.sky]} />
        <hemisphereLight args={["#cfe0ff", "#2a3040", 1.5]} />
        <directionalLight position={[40, 60, 40]} intensity={2.4} color="#fff6e8" castShadow shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-45, 45, 45, -45, 0.5, 200]} />
        </directionalLight>
        <OrbitControls target={center} enableDamping autoRotate={!reducedMotion} autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2.1} />
        <Boundary onError={onFail} fallback={null}>
          <Suspense fallback={null}>
            <World agents={agents} reducedMotion={reducedMotion} onSelect={onSelect} onLoaded={markLoaded} />
          </Suspense>
        </Boundary>
      </Canvas>
      {!loaded && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-300">Loading the house…</p>}
    </>
  );
}
