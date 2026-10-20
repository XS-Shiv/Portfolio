"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { HEAD, T } from "../timings";
import { CABLE_ENDS, CANVAS_MARGIN, PIVOT, SRC } from "./geometry";
import type { RendererProps } from "./types";

/**
 * The procedural CRT head. Modelled from turnaround.png in units of 100 source
 * pixels. Swap this file for a GLB loader later; the props stay the same.
 */

const DEG = Math.PI / 180;
const FOV = 28;
const VIEW_H = (SRC * (1 + 2 * CANVAS_MARGIN)) / 100;
const CAM_Z = VIEW_H / 2 / Math.tan((FOV / 2) * DEG);

/** source-photo pixel -> world units on the z=0 plane (where the body plate sits) */
const src2world = (x: number, y: number, z = 0) =>
  new THREE.Vector3((x - SRC / 2) / 100, (SRC / 2 - y) / 100, z);

// monitor dimensions (world units), tuned against front.png
const M = {
  scale: 0.9,
  w: 6.0,
  h: 6.2,
  d: 5.0,
  frame: 0.15, // chrome rim width
  frameDepth: 0.34,
  screenW: 5.0,
  screenH: 4.66,
  screenY: 0.3, // screen sits a little above centre; LEDs below
  lift: 3.12, // monitor centre above the neck pivot
  zOffset: -0.1,
};

function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function ringGeometry(outer: THREE.Shape, inner: THREE.Shape, depth: number, bevel: number) {
  const shape = outer.clone();
  shape.holes.push(new THREE.Path(inner.getPoints(24)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 12,
  });
  g.translate(0, 0, -depth);
  return g;
}

/** A gently bulging screen: the CRT's curved glass. */
function curvedPlane(w: number, h: number, bulge: number) {
  const g = new THREE.PlaneGeometry(w, h, 32, 32);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    const y = p.getY(i) / (h / 2);
    p.setZ(i, bulge * (1 - 0.5 * (x * x + y * y)));
  }
  g.computeVertexNormals();
  return g;
}

/** Fine vertical streaks for the brushed-steel casing. */
function brushedTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#808080";
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = 110 + Math.random() * 60;
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1, 20 + Math.random() * 120);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function useMaterials() {
  return useMemo(() => {
    const brushed = brushedTexture();
    return {
      chrome: new THREE.MeshStandardMaterial({
        color: "#cfccc8",
        metalness: 1,
        roughness: 0.24,
        envMapIntensity: 0.85,
      }),
      bezel: new THREE.MeshStandardMaterial({
        color: "#101012",
        metalness: 0.05,
        roughness: 0.55,
        envMapIntensity: 0.35,
      }),
      casing: new THREE.MeshStandardMaterial({
        color: "#8b94a8",
        metalness: 0.8,
        roughness: 0.36,
        roughnessMap: brushed,
      }),
      accent: new THREE.MeshStandardMaterial({ color: "#3a4a7c", metalness: 0.6, roughness: 0.35 }),
      black: new THREE.MeshStandardMaterial({
        color: "#151517",
        metalness: 0.1,
        roughness: 0.6,
        envMapIntensity: 0.4,
      }),
      vent: new THREE.MeshStandardMaterial({ color: "#2a2c31", metalness: 0.4, roughness: 0.6 }),
      cupCap: new THREE.MeshStandardMaterial({ color: "#26272b", metalness: 0.7, roughness: 0.3 }),
      ring: new THREE.MeshStandardMaterial({
        color: "#2f6bff",
        emissive: "#2f6bff",
        emissiveIntensity: 1.2,
        toneMapped: false,
      }),
      ledOn: new THREE.MeshStandardMaterial({
        color: "#2f6bff",
        emissive: "#2f6bff",
        emissiveIntensity: 1.8,
        toneMapped: false,
      }),
      ledOff: new THREE.MeshStandardMaterial({ color: "#76787e", metalness: 0.5, roughness: 0.4 }),
      cable: new THREE.MeshStandardMaterial({ color: "#0d0d0f", metalness: 0.1, roughness: 0.45 }),
    };
  }, []);
}

type Mats = ReturnType<typeof useMaterials>;

function Monitor({ mats, screenMat, led }: { mats: Mats; screenMat: THREE.Material; led: number }) {
  const geo = useMemo(() => {
    const { w, h, d, frame, frameDepth, screenW, screenH, screenY } = M;
    const outer = roundedRect(w, h, 0.42);
    const innerFrame = roundedRect(w - 2 * frame, h - 2 * frame, 0.3);
    const hole = roundedRect(screenW - 0.1, screenH - 0.1, 0.32, 0, screenY);
    return {
      frame: ringGeometry(outer, innerFrame, frameDepth, 0.035),
      bezel: ringGeometry(innerFrame, hole, frameDepth - 0.08, 0.02),
      screen: curvedPlane(screenW + 0.1, screenH + 0.1, 0.08),
      casing: new RoundedBoxGeometry(w - 0.18, h - 0.22, d * 0.7, 5, 0.4),
      back: new RoundedBoxGeometry(w * 0.82, h * 0.8, d * 0.34, 5, 0.45),
      accent: new RoundedBoxGeometry(w - 0.1, h - 0.14, 0.09, 2, 0.35),
      top: new RoundedBoxGeometry(w * 0.62, 0.24, d * 0.58, 3, 0.08),
      bottom: new RoundedBoxGeometry(w * 0.6, 0.26, d * 0.62, 3, 0.08),
      vent: new THREE.BoxGeometry(0.035, 1.7, 0.07),
      ventShort: new THREE.BoxGeometry(0.035, 0.8, 0.07),
      cup: new THREE.CylinderGeometry(0.56, 0.6, 0.34, 40),
      cap: new THREE.CylinderGeometry(0.4, 0.44, 0.14, 40),
      ring: new THREE.TorusGeometry(0.5, 0.045, 12, 48),
      led: new RoundedBoxGeometry(0.17, 0.06, 0.04, 2, 0.02),
      plug: new RoundedBoxGeometry(0.2, 0.36, 0.2, 2, 0.04),
    };
  }, []);

  const { w, h, d, frameDepth, screenY } = M;
  const front = 0; // front face of the chrome frame at local z = 0
  const casingZ = -frameDepth - (d * 0.7) / 2 + 0.05;
  const backZ = casingZ - (d * 0.7) / 2 - (d * 0.34) / 2 + 0.25;
  const side = (w - 0.18) / 2;

  const vents = (sx: number) =>
    Array.from({ length: 10 }, (_, i) => (
      <mesh
        key={`v${sx}${i}`}
        geometry={i < 7 ? geo.vent : geo.ventShort}
        material={mats.vent}
        position={[sx * (side + 0.01), i < 7 ? 1.2 : -1.6, casingZ - 0.3 - (i % 7) * 0.24]}
      />
    ));

  const cup = (sx: number) => (
    <group position={[sx * (side + 0.15), -0.35, casingZ + 0.35]} rotation={[0, 0, (sx * Math.PI) / 2]}>
      <mesh geometry={geo.cup} material={mats.black} />
      {/* after the z-rotation, local -y points away from the casing on both sides */}
      <mesh geometry={geo.cap} material={mats.cupCap} position={[0, -0.2, 0]} />
      <mesh
        geometry={geo.ring}
        material={mats.ring}
        position={[0, -0.19, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  );

  return (
    <group>
      <mesh geometry={geo.frame} material={mats.chrome} position={[0, 0, front]} />
      <mesh geometry={geo.bezel} material={mats.bezel} position={[0, 0, front - 0.03]} />
      <mesh geometry={geo.screen} material={screenMat} position={[0, screenY, front - frameDepth + 0.1]} />
      <mesh geometry={geo.accent} material={mats.accent} position={[0, 0, -frameDepth - 0.02]} />
      <mesh geometry={geo.casing} material={mats.casing} position={[0, 0, casingZ]} />
      <mesh geometry={geo.back} material={mats.casing} position={[0, -0.05, backZ]} />
      <mesh geometry={geo.top} material={mats.black} position={[0, h / 2 - 0.02, casingZ - 0.2]} />
      <mesh geometry={geo.bottom} material={mats.black} position={[0.15, -h / 2 + 0.02, casingZ + 0.1]} />
      {vents(-1)}
      {vents(1)}
      {cup(-1)}
      {cup(1)}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh
          key={`led${i}`}
          geometry={geo.led}
          material={i === led ? mats.ledOn : mats.ledOff}
          position={[1.22 + i * 0.27, -h / 2 + 0.42, front + 0.01]}
        />
      ))}
      {/* plugs on the underside, where the cables leave */}
      {[-0.95, -0.62, 1.5].map((x) => (
        <mesh
          key={`p${x}`}
          geometry={geo.plug}
          material={mats.black}
          position={[x, -h / 2 - 0.12, casingZ + 0.9]}
        />
      ))}
    </group>
  );
}

/** Cables: from the plugs under the head to where the photo's cables continue on the sweater. */
const CABLE_STARTS = [
  new THREE.Vector3(-0.95, -M.h / 2 - 0.3, -1.3),
  new THREE.Vector3(-0.62, -M.h / 2 - 0.3, -1.3),
  new THREE.Vector3(-M.w / 2 - 0.25, -0.9, -1.75),
  new THREE.Vector3(-M.w / 2 - 0.25, -0.6, -1.95),
];

function Cables({
  head,
  mats,
  updater,
}: {
  head: React.RefObject<THREE.Group | null>;
  mats: Mats;
  updater: React.RefObject<(() => void) | null>;
}) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const ends = useMemo(() => CABLE_ENDS.map(([x, y]) => src2world(x, y, 0.15)), []);
  const tmp = useMemo(
    () => ({ s: new THREE.Vector3(), down: new THREE.Vector3(), out: new THREE.Vector3() }),
    [],
  );
  const lastKey = useRef("");
  const empties = useMemo(() => CABLE_STARTS.map(() => new THREE.BufferGeometry()), []);
  useEffect(() => {
    lastKey.current = ""; // (re)mounted: rebuild on the next frame
  }, []);

  const update = () => {
    const g = head.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    const e = g.matrixWorld.elements;
    const key = e.map((v) => v.toFixed(3)).join(",");
    if (key === lastKey.current) return;
    lastKey.current = key;
    CABLE_STARTS.forEach((start, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const s = tmp.s.copy(start).applyMatrix4(g.matrixWorld);
      const down = tmp.down.set(0, -1, 0).transformDirection(g.matrixWorld);
      const end = ends[i];
      const sideways = i >= 2;
      let pts: THREE.Vector3[];
      if (sideways) {
        const p1 = s.clone().addScaledVector(down, 0.7);
        p1.x -= 0.35 + i * 0.12;
        const p2 = new THREE.Vector3(end.x - 0.55 - (i - 2) * 0.25, end.y + 1.3, end.z + 0.4);
        const p3 = end.clone().add(new THREE.Vector3(-0.12, 0.35, 0.1));
        pts = [s.clone(), p1, p2, p3, end.clone()];
      } else {
        const p1 = s.clone().addScaledVector(down, 0.35);
        const mid = s.clone().lerp(end, 0.55);
        mid.y -= 0.35;
        mid.z += 0.25;
        const p3 = end.clone().add(new THREE.Vector3(0, 0.3, 0.05));
        pts = [s.clone(), p1, mid, p3, end.clone()];
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      const old = mesh.geometry;
      mesh.geometry = new THREE.TubeGeometry(curve, 40, 0.045, 6, false);
      old.dispose();
    });
  };
  useEffect(() => {
    updater.current = update;
  });

  return (
    <>
      {CABLE_STARTS.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          material={mats.cable}
          geometry={empties[i]}
        />
      ))}
    </>
  );
}

function Scene({ engine, head, led, onReady }: Omit<RendererProps, "paused">) {
  const { gl, scene } = useThree();
  const mats = useMaterials();
  const pivot = useRef<THREE.Group>(null);
  const monitorRef = useRef<THREE.Group>(null);
  const frames = useRef(0);
  const angle = useRef({ yaw: HEAD.restYawDeg, pitch: HEAD.restPitchDeg });
  const lastVersion = useRef(-1);
  const updateCables = useRef<(() => void) | null>(null);

  const screenTex = useMemo(() => {
    const t = new THREE.CanvasTexture(engine.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [engine]);
  const screenMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
    [screenTex],
  );

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.7;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  const pivotPos = useMemo(() => src2world(PIVOT.x, PIVOT.y, 0), []);

  useFrame((_, dt) => {
    const now = performance.now();
    if (engine.draw(now) || engine.version !== lastVersion.current) {
      lastVersion.current = engine.version;
      screenTex.needsUpdate = true;
    }
    const a = angle.current;
    if (head.frozen) {
      a.yaw = HEAD.restYawDeg;
      a.pitch = HEAD.restPitchDeg;
    } else {
      const k = 1 - Math.exp(-HEAD.damping * Math.min(dt, 0.1));
      a.yaw += (head.yaw - a.yaw) * k;
      a.pitch += (head.pitch - a.pitch) * k;
    }
    let nod = 0;
    const sinceNod = now - head.nodAt;
    if (!head.frozen && sinceNod >= 0 && sinceNod < T.nod) {
      nod = Math.sin((sinceNod / T.nod) * Math.PI) * HEAD.nodPitchDeg;
    }
    if (pivot.current) {
      pivot.current.rotation.set((a.pitch + nod) * DEG, a.yaw * DEG, 0, "YXZ");
    }
    updateCables.current?.();
    if (++frames.current === 3) onReady();
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[-8, 9, 11]} intensity={2.8} />
      <directionalLight position={[9, 1, 5]} intensity={0.5} color="#dfe6ff" />
      <group ref={pivot} position={pivotPos}>
        <group ref={monitorRef} position={[0, M.lift, M.zOffset + M.d / 2]} scale={M.scale}>
          <Monitor mats={mats} screenMat={screenMat} led={led} />
        </group>
      </group>
      <Cables head={monitorRef} mats={mats} updater={updateCables} />
    </>
  );
}

export default function Crt3D({ paused, ...rest }: RendererProps) {
  return (
    <Canvas
      frameloop={paused ? "never" : "always"}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 1, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0x000000, 0);
      }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Scene {...rest} />
    </Canvas>
  );
}
