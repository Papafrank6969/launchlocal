"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE, type RoomSpec } from "@/lib/houseLayout";
import { Boundary, Room, shadowAll, type SceneAgent } from "./HouseScene";

// The Villa (docs/VILLA-PLAN.md). Same rooms-as-windows idea as the Frat House.
const VILLA = "/villa/villa.glb";
// Draco (meshopt left it at 28 MB). Decoder self-hosted, copied from three/examples/jsm/libs/draco/gltf.
const DRACO = "/draco/";
const SIZE = 40; // longest side after normalizing, model units → ~meters

// ponytail: windows are found by raycasting at the front wall, not hand-measured
// like houseLayout.ts. Measure real ones if a guy ends up on a railing.
function villaLayout(model: THREE.Object3D, box: THREE.Box3, count: number): { baseY: number; rooms: RoomSpec[] } {
  const s = box.getSize(new THREE.Vector3());
  const ray = new THREE.Raycaster();
  const hitZ = (x: number, y: number) => {
    ray.set(new THREE.Vector3(x, y, box.max.z + 100), new THREE.Vector3(0, 0, -1));
    return ray.intersectObject(model, true)[0]?.point.z ?? null;
  };
  // Lowest height where a wide front wall starts (4 of 5 rays hit; the posts
  // under the deck are thin, so they don't count).
  let baseY = box.min.y;
  for (let y = box.min.y + 0.5; y < box.max.y; y += 0.5) {
    const hits = [0.3, 0.4, 0.5, 0.6, 0.7].filter((f) => hitZ(box.min.x + s.x * f, y) !== null).length;
    if (hits >= 4) {
      baseY = y - 0.5;
      break;
    }
  }
  const wallY = baseY + 2.5;
  const rooms = Array.from({ length: count }, (_, i) => {
    const x = box.min.x + s.x * (0.25 + (0.5 * (i + 1)) / (count + 1));
    const z = hitZ(x, wallY) ?? box.max.z;
    return { label: `Suite ${i + 1}`, position: [x, wallY, z + 0.25] as [number, number, number], size: [2, 2.4] as [number, number], facing: 0 };
  });
  // The posts under the deck sink into the lawn, so the villa sits on the ground.
  return { baseY, rooms };
}

function World({ agents, reducedMotion, onSelect, onLoaded }: { agents: SceneAgent[]; reducedMotion: boolean; onSelect: (id: string) => void; onLoaded: () => void }) {
  const { scene } = useGLTF(VILLA, DRACO);
  useEffect(onLoaded, [onLoaded]);
  const box = useMemo(() => {
    // Stray props (cutouts below ground, far-off posts) stretch the full bounds,
    // so size, center and ground on the biggest part: the villa's shell.
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    const main = () => {
      scene.updateMatrixWorld(true);
      let best = new THREE.Box3();
      let vol = 0;
      scene.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        const bb = new THREE.Box3().setFromObject(o);
        const sz = bb.getSize(new THREE.Vector3());
        if (sz.x * sz.y * sz.z > vol) {
          vol = sz.x * sz.y * sz.z;
          best = bb;
        }
      });
      return best;
    };
    let b = main();
    const s = b.getSize(new THREE.Vector3());
    scene.scale.setScalar(SIZE / Math.max(s.x, s.z));
    b = main();
    const c = b.getCenter(new THREE.Vector3());
    scene.position.set(-c.x, -b.min.y, -c.z);
    // Loose props from the source file (flat cutouts) land far off the lot; hide them.
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      if (Math.hypot(c.x, c.z) > SIZE * 0.6) o.visible = false;
    });
    shadowAll(scene);
    return main();
  }, [scene]);
  const { baseY, rooms } = useMemo(() => villaLayout(scene, box, agents.length), [scene, box, agents.length]);

  return (
    <>
      <primitive object={scene} />
      <mesh position={[0, baseY - 0.1, 0]} receiveShadow>
        <boxGeometry args={[300, 0.2, 300]} />
        <meshStandardMaterial color="#2c3b24" roughness={0.95} />
      </mesh>
      {agents.map((a, i) => (
        <Room key={a.id} agent={a} room={rooms[i]} reducedMotion={reducedMotion} onSelect={onSelect} />
      ))}
    </>
  );
}

export default function VillaScene({
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
        camera={{ fov: 40, near: 0.1, far: 2000, position: [30, 30, 52] }}
        fallback={<p className="p-6 text-sm text-slate-300">3D isn&apos;t available in this browser. Use the list.</p>}
        onPointerMissed={() => (document.body.style.cursor = "")}
      >
        <color attach="background" args={[PALETTE.sky]} />
        <hemisphereLight args={["#ffe9c9", "#2a3040", 1.6]} />
        <directionalLight position={[40, 60, 30]} intensity={2.6} color="#ffd9a8" castShadow shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40, 0.5, 200]} />
        </directionalLight>
        <OrbitControls target={[0, 15, 0]} enableDamping autoRotate={!reducedMotion} autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2.1} />
        <Boundary onError={onFail} fallback={null}>
          <Suspense fallback={null}>
            <World agents={agents} reducedMotion={reducedMotion} onSelect={onSelect} onLoaded={markLoaded} />
          </Suspense>
        </Boundary>
      </Canvas>
      {!loaded && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-300">Loading the villa…</p>}
    </>
  );
}
