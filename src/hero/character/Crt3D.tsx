"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { HEAD, T, TORSO } from "../timings";
import { BODY_SIZE, BODY_TOP, CANVAS, NECK, PIVOT, SRC, TORSO_PIVOT } from "./geometry";
import type { RendererProps } from "./types";

/**
 * The 3D character: a procedural CRT head on a bending neck, cables, and the
 * photographed sweater as a textured plane, all turning together.
 * Units: 1 world unit = 100 source-photo pixels on the z=0 plane.
 * Swap the Monitor for a GLB later; the props stay the same.
 */

const DEG = Math.PI / 180;
const CAM_Z = 33.2;
/** The camera frames the box plus FULL_M on every side; the canvas shows a part of that. */
const FULL_M = Math.max(CANVAS.side, CANVAS.top, CANVAS.bottom);
const FULL = (SRC * (1 + 2 * FULL_M)) / 100;
const FOV = (2 * Math.atan(FULL / 2 / CAM_Z)) / DEG;

/** Where the sweater plane sits. In front of the neck, so the collar hides the neck's base. */
const BODY_Z = 1.0;

/** source-photo pixel -> world, on a plane at depth z (scaled so it still lines up with the photo) */
const at = (x: number, y: number, z = 0) => {
  const k = (CAM_Z - z) / CAM_Z;
  return new THREE.Vector3(((x - SRC / 2) / 100) * k, ((SRC / 2 - y) / 100) * k, z);
};

const TP = at(TORSO_PIVOT.x, TORSO_PIVOT.y, 0);
/** world -> torso-local (the torso group sits at TP with no rest rotation) */
const torsoLocal = (v: THREE.Vector3) => v.clone().sub(TP);

// monitor dimensions (world units), tuned against front.png
const M = {
  scale: 0.9,
  w: 6.0,
  h: 6.2,
  d: 3.3, // slim: the original casing was 5.0 deep
  frame: 0.15, // chrome rim width
  frameDepth: 0.34,
  screenW: 5.0,
  screenH: 4.66,
  screenY: 0.3, // screen sits a little above centre; LEDs below
  lift: 2.8, // monitor centre above the neck pivot (low, so only a little neck shows)
  zOffset: -0.1,
};
/** Depths were tuned for a 5.0-deep casing; scale them with the slimmer one. */
const DS = M.d / 5;
const SIDE = (M.w - 0.18) / 2;
const CASING_Z = -M.frameDepth - (M.d * 0.7) / 2 + 0.05;
const BOTTOM = -M.h / 2 - 0.12;

type Cable = {
  /** where it leaves the monitor, in monitor-local units */
  start: [number, number, number];
  dir: [number, number, number];
  /** where it ends, in source-photo pixels; dz < 0 tucks it behind the sweater */
  end: [number, number];
  dz: number;
  /** how far the middle hangs, and which way it bows (world units) */
  sag: number;
  bow: [number, number];
  r?: number;
  /** inline ferrite bead at this fraction of the length */
  ferrite?: number;
};

/** Modelled on the product shots: plugs underneath, jacks on both sides, loops over the shoulders. */
const CABLES: Cable[] = [
  // underneath, front: drape onto the chest
  {
    start: [-0.95, BOTTOM, CASING_Z + 0.9],
    dir: [0, -1, 0],
    end: [568, 940],
    dz: 0.05,
    sag: 0.25,
    bow: [0, 0.3],
  },
  {
    start: [-0.62, BOTTOM, CASING_Z + 0.9],
    dir: [0, -1, 0],
    end: [604, 1010],
    dz: 0.05,
    sag: 0.35,
    bow: [0.1, 0.3],
  },
  // underneath, right: loop out and tuck behind the right shoulder
  {
    start: [1.5, BOTTOM, CASING_Z + 0.9],
    dir: [0, -1, 0],
    end: [850, 960],
    dz: -0.6,
    sag: 0.9,
    bow: [0.6, 0.3],
  },
  {
    start: [1.85, BOTTOM, CASING_Z + 0.2],
    dir: [0, -1, 0],
    end: [890, 1000],
    dz: -0.6,
    sag: 1.2,
    bow: [0.9, 0.2],
    r: 0.04,
  },
  // left side jacks: big loops down onto the left of the chest (they meet the photo's own cables)
  {
    start: [-SIDE - 0.1, -2.2, -0.9 * DS],
    dir: [-1, -0.2, 0],
    end: [421, 858],
    dz: 0.05,
    sag: 0.6,
    bow: [-0.9, 0.5],
  },
  {
    start: [-SIDE - 0.1, 0.9, -2.4 * DS],
    dir: [-1, 0, 0],
    end: [393, 869],
    dz: 0.05,
    sag: 1.0,
    bow: [-1.4, 0.4],
    ferrite: 0.38,
  },
  // left: from the speaker cup, down behind the shoulder
  {
    start: [-SIDE - 0.3, -0.9, CASING_Z + 0.35],
    dir: [-0.4, -1, 0],
    end: [340, 1010],
    dz: -0.6,
    sag: 0.6,
    bow: [-0.6, 0],
  },
  {
    start: [-SIDE - 0.1, -1.4, -3.1 * DS],
    dir: [-1, -0.4, -0.2],
    end: [430, 1000],
    dz: -0.6,
    sag: 1.3,
    bow: [-1.6, -0.2],
    r: 0.04,
    ferrite: 0.5,
  },
  // right side jack
  { start: [SIDE + 0.1, -1.8, -2.0 * DS], dir: [1, -0.3, 0], end: [930, 1020], dz: -0.6, sag: 1.1, bow: [0.8, 0] },
  // back panel: hang behind the neck, seen when he turns
  { start: [-0.6, -2.6, -5.1 * DS], dir: [0, -0.4, -1], end: [610, 900], dz: -2.4, sag: 0.4, bow: [0, -0.4] },
  { start: [0.8, -2.6, -5.1 * DS], dir: [0, -0.4, -1], end: [700, 900], dz: -2.4, sag: 0.4, bow: [0, -0.4] },
];

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
      // the front frame: dark, satin metal rather than a shiny chrome rim
      chrome: new THREE.MeshStandardMaterial({
        color: "#55575c",
        metalness: 0.8,
        roughness: 0.5,
        envMapIntensity: 0.45,
      }),
      bezel: new THREE.MeshStandardMaterial({
        color: "#0a0a0b",
        metalness: 0.05,
        roughness: 0.82,
        envMapIntensity: 0.12,
      }),
      casing: new THREE.MeshStandardMaterial({
        color: "#36383d",
        metalness: 0.75,
        roughness: 0.52,
        roughnessMap: brushed,
        envMapIntensity: 0.5,
      }),
      accent: new THREE.MeshStandardMaterial({ color: "#26282d", metalness: 0.6, roughness: 0.4 }),
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
      ferrite: new THREE.MeshStandardMaterial({ color: "#1a1a1d", metalness: 0.2, roughness: 0.5 }),
      skin: new THREE.MeshStandardMaterial({
        color: "#e8b493",
        roughness: 0.58,
        metalness: 0,
        envMapIntensity: 0.45,
        vertexColors: true,
      }),
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
      plug: new RoundedBoxGeometry(0.2, 0.42, 0.2, 2, 0.04),
      jack: new THREE.CylinderGeometry(0.09, 0.11, 0.34, 16),
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
        position={[sx * (side + 0.01), i < 7 ? 1.2 : -1.6, casingZ - 0.3 * DS - (i % 7) * 0.24 * DS]}
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
      {/* plugs and jacks where the cables leave */}
      {CABLES.map((c, i) => (
        <mesh
          key={`j${i}`}
          geometry={c.dir[1] < -0.5 ? geo.plug : geo.jack}
          material={mats.black}
          position={c.start}
          quaternion={new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(...c.dir).normalize(),
          )}
        />
      ))}
    </group>
  );
}

function Cables({
  head,
  torso,
  mats,
  updater,
}: {
  head: React.RefObject<THREE.Group | null>;
  torso: React.RefObject<THREE.Group | null>;
  mats: Mats;
  updater: React.RefObject<(() => void) | null>;
}) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  const ends = useMemo(() => CABLES.map((c) => torsoLocal(at(c.end[0], c.end[1], BODY_Z + c.dz))), []);
  const empties = useMemo(() => CABLES.map(() => new THREE.BufferGeometry()), []);
  const beadGeo = useMemo(() => new THREE.CylinderGeometry(0.11, 0.11, 0.42, 16), []);
  const lastKey = useRef("");
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  const update = () => {
    const h = head.current;
    const t = torso.current;
    if (!h || !t) return;
    h.updateWorldMatrix(true, false);
    t.updateWorldMatrix(true, false);
    const key = h.matrixWorld.elements
      .concat(t.matrixWorld.elements)
      .map((v) => v.toFixed(3))
      .join(",");
    if (key === lastKey.current) return;
    lastKey.current = key;
    CABLES.forEach((c, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const s = new THREE.Vector3(...c.start).applyMatrix4(h.matrixWorld);
      const dir = new THREE.Vector3(...c.dir).normalize().transformDirection(h.matrixWorld);
      const end = ends[i].clone().applyMatrix4(t.matrixWorld);
      const p1 = s.clone().addScaledVector(dir, 0.45);
      const pe = end.clone().add(new THREE.Vector3(0, 0.45, c.dz < 0 ? -0.1 : 0.12));
      const mid = p1.clone().lerp(pe, 0.5);
      mid.x += c.bow[0];
      mid.z += c.bow[1];
      mid.y -= c.sag;
      const pts = c.dz < 0 ? [s, p1, mid, end] : [s, p1, mid, pe, end];
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      const old = mesh.geometry;
      mesh.geometry = new THREE.TubeGeometry(curve, 48, c.r ?? 0.05, 7, false);
      old.dispose();
      const bead = beads.current[i];
      if (bead && c.ferrite !== undefined) {
        bead.position.copy(curve.getPointAt(c.ferrite));
        bead.quaternion.setFromUnitVectors(up, curve.getTangentAt(c.ferrite));
      }
    });
  };
  useEffect(() => {
    lastKey.current = "";
    updater.current = update;
  });

  return (
    <>
      {CABLES.map((c, i) => (
        <group key={i}>
          <mesh
            ref={(m) => {
              meshes.current[i] = m;
            }}
            material={mats.cable}
            geometry={empties[i]}
          />
          {c.ferrite !== undefined && (
            <mesh
              ref={(m) => {
                beads.current[i] = m;
              }}
              geometry={beadGeo}
              material={mats.ferrite}
            />
          )}
        </group>
      ))}
    </>
  );
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A neck that bends: its base is fixed behind the collar, its top follows the head. */
function Neck({
  head,
  mats,
  updater,
}: {
  head: React.RefObject<THREE.Group | null>;
  mats: Mats;
  updater: React.RefObject<(() => void) | null>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const base = useMemo(() => torsoLocal(at((NECK.left + NECK.right) / 2, NECK.bottom, 0)), []);
  const radius = ((NECK.right - NECK.left) / 200) * 1.02;
  const empty = useMemo(() => new THREE.BufferGeometry(), []);

  const update = () => {
    const h = head.current;
    const m = mesh.current;
    if (!h || !m) return;
    // head pivot transform relative to the torso
    const q = h.quaternion;
    const top = h.position.clone().add(new THREE.Vector3(0, 0.75, 0).applyQuaternion(q));
    const topDir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const len = top.distanceTo(base);
    const curve = new THREE.CubicBezierCurve3(
      base.clone().sub(base),
      new THREE.Vector3(0, len * 0.4, 0),
      top
        .clone()
        .sub(base)
        .addScaledVector(topDir, -len * 0.35),
      top.clone().sub(base),
    );
    const old = m.geometry;
    const g = new THREE.TubeGeometry(curve, 16, radius, 28, false);
    // painted-in shading: dark up under the monitor, soft falloff toward the sides and back
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.floor(i / 29) / 16; // 0 at the collar, 1 inside the monitor
      const under = 1 - 0.7 * smooth(0.35, 0.85, t);
      const facing = 0.5 + 0.5 * Math.pow(Math.max(0, nrm.getZ(i)), 0.8);
      const v = under * facing;
      col[i * 3] = v;
      col[i * 3 + 1] = v * 0.97;
      col[i * 3 + 2] = v * 0.95;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    m.geometry = g;
    old.dispose();
  };
  useEffect(() => {
    updater.current = update;
  });

  // squashed front-to-back so it fits behind the collar
  return (
    <mesh
      ref={mesh}
      position={base}
      scale={[1, 1, 0.72]}
      material={mats.skin}
      geometry={empty}
      receiveShadow
    />
  );
}

function BodyPlate({ onLoad }: { onLoad: () => void }) {
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load("/character/body.webp", () => onLoad());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const k = (CAM_Z - BODY_Z) / CAM_Z;
  const centre = torsoLocal(at(SRC / 2, BODY_TOP + BODY_SIZE.h / 2, BODY_Z));
  return (
    <mesh position={centre} renderOrder={1}>
      <planeGeometry args={[(BODY_SIZE.w / 100) * k, (BODY_SIZE.h / 100) * k]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.03} toneMapped={false} />
    </mesh>
  );
}

/** Frame the whole box-with-margins, then show only the canvas part of it. */
function Framing() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const cw = 1 + 2 * CANVAS.side;
    const ch = 1 + CANVAS.top + CANVAS.bottom;
    const full = 1 + 2 * FULL_M;
    cam.fov = FOV;
    cam.aspect = 1;
    cam.position.set(0, 0, CAM_Z);
    cam.near = 1;
    cam.far = 200;
    cam.setViewOffset(
      (size.width * full) / cw,
      (size.height * full) / ch,
      (size.width * (FULL_M - CANVAS.side)) / cw,
      (size.height * (FULL_M - CANVAS.top)) / ch,
      size.width,
      size.height,
    );
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Scene({ engine, head, led, onReady }: Omit<RendererProps, "paused">) {
  const { gl, scene } = useThree();
  const mats = useMaterials();
  const torso = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const monitorRef = useRef<THREE.Group>(null);
  const frames = useRef(0);
  const bodyLoaded = useRef(false);
  const angle = useRef({ yaw: HEAD.restYawDeg, pitch: HEAD.restPitchDeg, torso: 0 });
  const lastVersion = useRef(-1);
  const updateCables = useRef<(() => void) | null>(null);
  const updateNeck = useRef<(() => void) | null>(null);

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

  // the monitor casts a soft shadow on the neck
  useEffect(() => {
    monitorRef.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }, []);

  const pivotPos = useMemo(() => torsoLocal(at(PIVOT.x, PIVOT.y, 0)), []);

  useFrame((state, dt) => {
    const now = performance.now();
    const a = angle.current;
    const step = Math.min(dt, 0.1);
    if (head.frozen) {
      a.yaw = HEAD.restYawDeg;
      a.pitch = HEAD.restPitchDeg;
      a.torso = HEAD.restYawDeg * TORSO.follow;
    } else {
      const k = 1 - Math.exp(-HEAD.damping * step);
      a.yaw += (head.yaw - a.yaw) * k;
      a.pitch += (head.pitch - a.pitch) * k;
      const kt = 1 - Math.exp(-TORSO.damping * step);
      a.torso += (a.yaw * TORSO.follow - a.torso) * kt;
    }
    engine.setGaze(a.yaw / HEAD.maxYawDeg, a.pitch / HEAD.maxPitchDeg);
    if (engine.draw(now) || engine.version !== lastVersion.current) {
      lastVersion.current = engine.version;
      screenTex.needsUpdate = true;
    }

    let nod = 0;
    const sinceNod = now - head.nodAt;
    if (!head.frozen && sinceNod >= 0 && sinceNod < T.nod) {
      nod = Math.sin((sinceNod / T.nod) * Math.PI) * HEAD.nodPitchDeg;
    }
    const breathe = head.frozen ? 0 : Math.sin((now / T.breathePeriod) * Math.PI * 2);
    // the shoulders sway a little on their own, so the body never looks frozen
    const sway = head.frozen ? 0 : Math.sin((now / TORSO.swayPeriod) * Math.PI * 2) * TORSO.sway;
    const torsoYaw = a.torso + sway;
    if (torso.current) {
      torso.current.rotation.set(
        (a.pitch * TORSO.pitchFollow + breathe * 0.4) * DEG,
        torsoYaw * DEG,
        -torsoYaw * TORSO.roll * DEG,
      );
      torso.current.position.set(TP.x + torsoYaw * TORSO.shift, TP.y + breathe * TORSO.breathe, TP.z);
    }
    if (pivot.current) {
      // the head's own turn is what is left after the torso's
      pivot.current.rotation.set(
        (a.pitch * (1 - TORSO.pitchFollow) + nod) * DEG,
        (a.yaw - torsoYaw) * DEG,
        torsoYaw * TORSO.roll * DEG,
        "YXZ",
      );
    }
    updateNeck.current?.();
    updateCables.current?.();
    if (bodyLoaded.current && ++frames.current === 3) onReady();
    void state;
  });

  return (
    <>
      <Framing />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[-8, 9, 11]}
        intensity={2.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={6}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={[9, 1, 5]} intensity={0.5} color="#dfe6ff" />
      <group ref={torso} position={TP}>
        <BodyPlate onLoad={() => (bodyLoaded.current = true)} />
        <Neck head={pivot} mats={mats} updater={updateNeck} />
        <group ref={pivot} position={pivotPos}>
          <group ref={monitorRef} position={[0, M.lift, M.zOffset + M.d / 2]} scale={M.scale}>
            <Monitor mats={mats} screenMat={screenMat} led={led} />
          </group>
        </group>
      </group>
      <Cables head={monitorRef} torso={torso} mats={mats} updater={updateCables} />
    </>
  );
}

export default function Crt3D({ paused, ...rest }: RendererProps) {
  return (
    <Canvas
      frameloop={paused ? "never" : "always"}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ manual: true, fov: FOV, position: [0, 0, CAM_Z], near: 1, far: 200 }}
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
