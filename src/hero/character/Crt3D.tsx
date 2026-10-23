"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CABLE, MOTION, T } from "../timings";
import { BODY_SIZE, BODY_TOP, CANVAS, NECK, PIVOT, SRC, TORSO_PIVOT } from "./geometry";
import { Rope, Tube } from "./physics";
import { damp, spring, type Spring } from "./springs";
import type { RendererProps } from "./types";

/**
 * The 3D character: a procedural CRT head on a bending neck, audio cords
 * plugged from the monitor into the neck, and the photographed sweater as a
 * 2.5D plate that turns with the shoulders. Units: 1 world unit = 100
 * source-photo pixels on the z=0 plane. Swap the Monitor for a GLB later; the
 * props stay the same.
 *
 * Motion is layered: the head chases the cursor on a slightly underdamped
 * spring, the neck trails it by ~40ms and carries part of the bend, and the
 * torso trails by ~150ms. Cables are ropes pinned at both plugs.
 */

const DEG = Math.PI / 180;
const CAM_Z = 33.2;
/** The camera frames the box plus FULL_M on every side; the canvas shows a part of that. */
const FULL_M = Math.max(CANVAS.side, CANVAS.top, CANVAS.bottom);
const FULL = (SRC * (1 + 2 * FULL_M)) / 100;
const FOV = (2 * Math.atan(FULL / 2 / CAM_Z)) / DEG;

/** Depth of the sweater plate. In front of the neck, so the collar hides the neck's base. */
const BODY_Z = 1.0;
/** The torso turns around an axis this far behind the sweater's front (half its depth). */
const TORSO_DEPTH = 2.3;
/** Half the shoulders' width in world units: the 2.5D turn treats the torso as an ellipse. */
const TORSO_HALF_W = 5.2;

/** source-photo pixel -> world, on a plane at depth z (scaled so it still lines up with the photo) */
const at = (x: number, y: number, z = 0) => {
  const k = (CAM_Z - z) / CAM_Z;
  return new THREE.Vector3(((x - SRC / 2) / 100) * k, ((SRC / 2 - y) / 100) * k, z);
};

const TP = at(TORSO_PIVOT.x, TORSO_PIVOT.y, BODY_Z - TORSO_DEPTH);
/** world -> torso-local (the torso group sits at TP with no rest rotation) */
const torsoLocal = (v: THREE.Vector3) => v.clone().sub(TP);

/** The sweater plate's own scale (it sits at BODY_Z, a little closer than z=0). */
const PLATE_K = (CAM_Z - BODY_Z) / CAM_Z;
/** photo row / column -> plate-local coordinates (plate centred on the photo's middle column) */
const plateX = (x: number) => ((x - SRC / 2) / 100) * PLATE_K;
const plateY = (row: number) => ((BODY_TOP + BODY_SIZE.h / 2 - row) / 100) * PLATE_K;

// monitor dimensions (world units), tuned against front.png
const M = {
  scale: 0.9,
  w: 6.0,
  h: 6.2,
  d: 3.3, // slim: the original casing was 5.0 deep
  frame: 0.15, // rim width
  frameDepth: 0.34,
  screenW: 5.0,
  screenH: 4.66,
  screenY: 0.3, // screen sits a little above centre; LEDs below
  lift: 3.1, // monitor centre above the neck's top, leaving a band of neck for the plugs
  zOffset: -0.1,
};
/** Depths were tuned for a 5.0-deep casing; scale them with the slimmer one. */
const DS = M.d / 5;
const SIDE = (M.w - 0.18) / 2;
const CASING_Z = -M.frameDepth - (M.d * 0.7) / 2 + 0.05;
/** Underside of the monitor's foot, where the bottom plugs go in (monitor-local). */
const FOOT_Y = -M.h / 2 + 0.02 - 0.13;

/** Side cups: 1.5x the old diameter, half the depth, sitting close to the casing. */
const CUP = { r: 0.88, depth: 0.17, capR: 0.62, capDepth: 0.07, ringR: 0.75, y: -0.3, z: CASING_Z + 0.08 };

/** What the cords collide with, monitor-local: the casing, its foot and the cups, with rounded edges. */
const MON_BOX = (() => {
  const xHi = SIDE + CUP.depth + 0.06;
  const yLo = FOOT_Y;
  const yHi = M.h / 2;
  const zLo = CASING_Z - (M.d * 0.7) / 2 - M.d * 0.34 + 0.25;
  const zHi = 0.05;
  return { cx: 0, cy: (yLo + yHi) / 2, cz: (zLo + zHi) / 2, hx: xHi, hy: (yHi - yLo) / 2, hz: (zHi - zLo) / 2, round: 0.45 };
})();

// ---------------------------------------------------------------- neck

/** How far the neck reaches up into the monitor, above the head's pivot (world units). */
const NECK_TOP = 0.42;
const NECK_R = ((NECK.right - NECK.left) / 200) * 1.02;
const NECK_SQUASH = 0.72; // front-to-back, so it fits behind the collar
/** Height above the neck's base where it comes out of the collar; below that the sweater keeps cords off it. */
const NECK_RIM = 0.55;
/** The rubber grommet the neck goes into, under the monitor (pivot-local). */
const GROMMET = { top: M.lift + FOOT_Y * M.scale + 0.03, depth: 0.26, flare: 0.16 };

// ---------------------------------------------------------------- cables

/** Visible length of a jack plug, from the socket to where the cord leaves the boot. */
const PLUG_LEN = 0.44;

type End = { neck: [number, number] } | { collar: [number, number] };
type CableDef = {
  /** socket on the monitor, monitor-local, and the way the plug points out of it */
  pos: [number, number, number];
  dir: [number, number, number];
  /** where it plugs in: the neck ([height along the neck 0..1, angle round it in degrees, 0 = front]) or the collar ([photo x, photo row]) */
  to: End;
  /** cord length / straight distance; more slack hangs lower */
  slack?: number;
};

/**
 * Five cords, plugged in at both ends. Balanced but not mirrored: two cross in
 * front of the collar, and the left one loops out wider than the rest.
 */
const CABLES: CableDef[] = [
  // under the foot, front left -> neck, front left: a loose loop over the collar
  { pos: [-1.15, FOOT_Y, CASING_Z + 0.85], dir: [0, -1, 0.15], to: { neck: [0.56, -22] }, slack: 2.6 },
  // under the foot, front right -> collar, left of centre: crosses the first one
  { pos: [1.3, FOOT_Y, CASING_Z + 0.8], dir: [0.1, -1, 0.15], to: { collar: [560, 935] }, slack: 1.7 },
  // left side panel -> neck, left side: the wide loop
  { pos: [-SIDE - 0.02, -2.15, CASING_Z - 0.45], dir: [-1, -0.25, 0.1], to: { neck: [0.6, -58] }, slack: 2.3 },
  // right side panel -> neck, right side
  { pos: [SIDE + 0.02, -2.35, CASING_Z - 0.3], dir: [1, -0.3, 0.1], to: { neck: [0.62, 55] }, slack: 2.0 },
  // under the foot, centre -> collar, right
  { pos: [0.3, FOOT_Y, CASING_Z + 0.55], dir: [0, -1, 0.1], to: { collar: [800, 950] }, slack: 2.1 },
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

/** Fine vertical streaks for the brushed-metal casing. */
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
      chrome: new THREE.MeshStandardMaterial({ color: "#55575c", metalness: 0.8, roughness: 0.5, envMapIntensity: 0.45 }),
      bezel: new THREE.MeshStandardMaterial({ color: "#0a0a0b", metalness: 0.05, roughness: 0.82, envMapIntensity: 0.12 }),
      casing: new THREE.MeshStandardMaterial({
        color: "#36383d",
        metalness: 0.75,
        roughness: 0.52,
        roughnessMap: brushed,
        envMapIntensity: 0.5,
      }),
      accent: new THREE.MeshStandardMaterial({ color: "#26282d", metalness: 0.6, roughness: 0.4 }),
      black: new THREE.MeshStandardMaterial({ color: "#151517", metalness: 0.1, roughness: 0.6, envMapIntensity: 0.4 }),
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
      // black rubber with a slight sheen
      cord: new THREE.MeshStandardMaterial({ color: "#060607", metalness: 0, roughness: 0.42, envMapIntensity: 0.32 }),
      boot: new THREE.MeshStandardMaterial({ color: "#09090a", metalness: 0, roughness: 0.5, envMapIntensity: 0.3 }),
      // nickel-plated jack sleeves that catch the studio light
      plugMetal: new THREE.MeshStandardMaterial({ color: "#d9dade", metalness: 1, roughness: 0.22, envMapIntensity: 1.3 }),
      socket: new THREE.MeshStandardMaterial({ color: "#08080a", metalness: 0.3, roughness: 0.5 }),
      socketRim: new THREE.MeshStandardMaterial({ color: "#9a9ca2", metalness: 1, roughness: 0.3 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#101012", metalness: 0, roughness: 0.75, envMapIntensity: 0.35 }),
      // the turtleneck's inside, seen through the collar when the neck bends
      knit: new THREE.MeshStandardMaterial({ color: "#151821", roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
      // matched to the photo's neck: a warm, fairly dark skin tone, mostly in the monitor's shadow
      skin: new THREE.MeshStandardMaterial({
        color: "#93603f",
        roughness: 0.7,
        metalness: 0,
        envMapIntensity: 0.3,
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
      vent: new THREE.BoxGeometry(0.035, 1.5, 0.07),
      ventShort: new THREE.BoxGeometry(0.035, 0.55, 0.07),
      // slim ear cup: a low dish with a bevelled edge, then a flat cap and the glow ring
      cup: new THREE.CylinderGeometry(CUP.r - 0.05, CUP.r, CUP.depth, 56),
      cap: new THREE.CylinderGeometry(CUP.capR - 0.02, CUP.capR, CUP.capDepth, 56),
      ring: new THREE.TorusGeometry(CUP.ringR, 0.045, 12, 64),
      led: new RoundedBoxGeometry(0.17, 0.06, 0.04, 2, 0.02),
      socket: new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20),
      socketRim: new THREE.TorusGeometry(0.085, 0.018, 8, 20),
    };
  }, []);

  const { w, h, d, frameDepth, screenY } = M;
  const front = 0; // front face of the frame at local z = 0
  const backZ = CASING_Z - (d * 0.7) / 2 - (d * 0.34) / 2 + 0.25;

  // vents above and below the cup, so the bigger cup never overlaps them
  const vents = (sx: number) =>
    Array.from({ length: 10 }, (_, i) => (
      <mesh
        key={`v${sx}${i}`}
        geometry={i < 7 ? geo.vent : geo.ventShort}
        material={mats.vent}
        position={[sx * (SIDE + 0.01), i < 7 ? 1.55 : -1.75, CASING_Z - 0.3 * DS - (i % 7) * 0.24 * DS]}
      />
    ));

  const cup = (sx: number) => (
    <group position={[sx * (SIDE + CUP.depth / 2), CUP.y, CUP.z]} rotation={[0, 0, (sx * Math.PI) / 2]}>
      <mesh geometry={geo.cup} material={mats.black} />
      {/* after the z-rotation, local -y points away from the casing on both sides */}
      <mesh geometry={geo.cap} material={mats.cupCap} position={[0, -(CUP.depth + CUP.capDepth) / 2 + 0.005, 0]} />
      <mesh
        geometry={geo.ring}
        material={mats.ring}
        position={[0, -CUP.depth / 2 - 0.005, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  );

  const up = new THREE.Vector3(0, 1, 0);
  return (
    <group>
      <mesh geometry={geo.frame} material={mats.chrome} position={[0, 0, front]} />
      <mesh geometry={geo.bezel} material={mats.bezel} position={[0, 0, front - 0.03]} />
      <mesh geometry={geo.screen} material={screenMat} position={[0, screenY, front - frameDepth + 0.1]} />
      <mesh geometry={geo.accent} material={mats.accent} position={[0, 0, -frameDepth - 0.02]} />
      <mesh geometry={geo.casing} material={mats.casing} position={[0, 0, CASING_Z]} />
      <mesh geometry={geo.back} material={mats.casing} position={[0, -0.05, backZ]} />
      <mesh geometry={geo.top} material={mats.black} position={[0, h / 2 - 0.02, CASING_Z - 0.2]} />
      <mesh geometry={geo.bottom} material={mats.black} position={[0.15, -h / 2 + 0.02, CASING_Z + 0.1]} />
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
      {/* the sockets the cords are plugged into */}
      {CABLES.map((c, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(...c.dir).normalize());
        return (
          <group key={`s${i}`} position={c.pos} quaternion={q}>
            <mesh geometry={geo.socket} material={mats.socket} />
            <mesh geometry={geo.socketRim} material={mats.socketRim} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
          </group>
        );
      })}
      {void w}
    </group>
  );
}

/** A jack plug: nickel sleeve, metal collar, black strain-relief boot, then a thicker bit where the cord starts. Points along +Y. */
function usePlugGeometry() {
  return useMemo(() => {
    const lathe = (pts: [number, number][]) =>
      new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(r, y)),
        24,
      );
    return {
      sleeve: lathe([
        [0, -0.06],
        [0.03, -0.06],
        [0.032, 0.0],
        [0.032, 0.1],
        [0, 0.1],
      ]),
      collar: lathe([
        [0.03, 0.095],
        [0.052, 0.1],
        [0.055, 0.135],
        [0.05, 0.145],
        [0.03, 0.145],
      ]),
      boot: lathe([
        [0.045, 0.14],
        [0.07, 0.15],
        [0.072, 0.2],
        [0.066, 0.31],
        [0.054, 0.345],
        [0.052, 0.44],
        [0.044, 0.47],
        [0.0, 0.47],
      ]),
      grommet: new THREE.TorusGeometry(0.085, 0.022, 8, 20),
    };
  }, []);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The 2.5D sweater: the photo on a subdivided plane whose vertices are moved as
 * if it were wrapped round an elliptical torso turning by uYaw. The collar band
 * moves a little less (it sits closer to the neck's axis), the side turning
 * away darkens a touch, and the monitor's soft contact shadow falls on the collar.
 */
function plateMaterial(tex: THREE.Texture, edgeFade: THREE.Texture) {
  const uniforms = {
    uYaw: { value: 0 },
    uA: { value: TORSO_HALF_W },
    uB: { value: TORSO_DEPTH },
    uCx: { value: 0 },
    uCollar: { value: 0 },
    uCollarY: { value: new THREE.Vector2(plateY(1060), plateY(980)) },
    uShade: { value: 0.32 },
    uShadow: { value: new THREE.Vector3(0, plateY(820), 0.5) },
    uShadowSize: { value: new THREE.Vector2(1.9, 0.7) },
  };
  const m = new THREE.MeshBasicMaterial({ map: tex, alphaMap: edgeFade, transparent: true, alphaTest: 0.03, toneMapped: false });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uYaw, uA, uB, uCx, uCollar, uShade;
        uniform vec2 uCollarY;
        varying float vShade;
        varying vec2 vPlate;`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed = vec3(position);
        float u = clamp((position.x - uCx) / uA, -0.995, 0.995);
        float phi = asin(u);
        // a point on an ellipse (half-width uA, half-depth uB) turned by uYaw, minus the
        // centre's own shift (the torso group carries that)
        float x2 = uA * sin(phi) * cos(uYaw) + uB * cos(phi) * sin(uYaw) - uB * sin(uYaw);
        transformed.x = uCx + x2 + uCollar * smoothstep(uCollarY.x, uCollarY.y, position.y);
        vShade = 1.0 - uShade * (sin(phi + uYaw) - sin(phi)) * cos(phi);
        vPlate = transformed.xy;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uShadow;
        uniform vec2 uShadowSize;
        varying float vShade;
        varying vec2 vPlate;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec2 sd = (vPlate - uShadow.xy) / uShadowSize;
        float sh = exp(-dot(sd, sd) * 2.2) * uShadow.z;
        diffuseColor.rgb *= vShade * (1.0 - sh);`,
      );
  };
  return { material: m, uniforms };
}

/** The same turn as the plate's shader, for points that ride on the sweater (collar plugs). */
function plateWarp(x: number, y: number, yaw: number, collar: number) {
  const u = Math.max(-0.995, Math.min(0.995, x / TORSO_HALF_W));
  const phi = Math.asin(u);
  const x2 = TORSO_HALF_W * Math.sin(phi) * Math.cos(yaw) + TORSO_DEPTH * Math.cos(phi) * Math.sin(yaw) - TORSO_DEPTH * Math.sin(yaw);
  return x2 + collar * smooth(plateY(1060), plateY(980), y);
}

/** Frame the whole box-with-margins, then show only the canvas part of it. */
function Framing({ still }: { still?: boolean }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const C = still ? { side: 0, top: 0, bottom: 0 } : CANVAS;
    const cw = 1 + 2 * C.side;
    const ch = 1 + C.top + C.bottom;
    const full = 1 + 2 * FULL_M;
    cam.fov = FOV;
    cam.aspect = 1;
    cam.position.set(0, 0, CAM_Z);
    cam.near = 1;
    cam.far = 200;
    cam.setViewOffset(
      (size.width * full) / cw,
      (size.height * full) / ch,
      (size.width * (FULL_M - C.side)) / cw,
      (size.height * (FULL_M - C.top)) / ch,
      size.width,
      size.height,
    );
    cam.updateProjectionMatrix();
  }, [camera, size, still]);
  return null;
}

/** Per-cable runtime state. */
type CableRun = {
  rope: Rope;
  tube: Tube;
  curve: THREE.CatmullRomCurve3;
  length: number;
  plugA: THREE.Group | null;
  plugB: THREE.Group | null;
  socketB: THREE.Group | null;
};

function Scene({ engine, head, led, onReady, still }: Omit<RendererProps, "paused">) {
  const { gl, scene, camera } = useThree();
  const mats = useMaterials();
  const plugGeo = usePlugGeometry();
  const torso = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const monitorRef = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Mesh>(null);
  const neckMesh = useRef<THREE.Mesh>(null);
  const frames = useRef(0);
  const bodyLoaded = useRef(false);
  const lastVersion = useRef(-1);

  // ---- motion state
  const st = useRef({
    aimYaw: MOTION.neutralYaw,
    aimPitch: MOTION.neutralPitch,
    hYaw: { x: MOTION.neutralYaw, v: 0 } as Spring,
    hPitch: { x: MOTION.neutralPitch, v: 0 } as Spring,
    hRoll: { x: 0, v: 0 } as Spring,
    nYaw: { x: MOTION.neutralYaw, v: 0 } as Spring,
    nPitch: { x: MOTION.neutralPitch, v: 0 } as Spring,
    tYaw: { x: 0, v: 0 } as Spring,
    tPitch: { x: 0, v: 0 } as Spring,
    saccade: { yaw: 0, pitch: 0, next: 0 },
    tilt: { at: -1e9, dir: 1, next: 0 },
    lastAimYaw: MOTION.neutralYaw,
    flickAt: 0,
    acc: 0,
    settled: false,
  });

  // ---- textures, screen
  const screenTex = useMemo(() => {
    const t = new THREE.CanvasTexture(engine.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [engine]);
  const screenMat = useMemo(() => new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), [screenTex]);

  const plateMat = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/character/body.webp", () => (bodyLoaded.current = true));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // soften the photo's own left and right edges
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 1;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "#000");
    g.addColorStop(0.1, "#fff");
    g.addColorStop(0.9, "#fff");
    g.addColorStop(1, "#000");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 1);
    return plateMaterial(tex, new THREE.CanvasTexture(c));
  }, []);

  // ---- geometry anchors (torso-local)
  const plateCentre = useMemo(() => torsoLocal(at(SRC / 2, BODY_TOP + BODY_SIZE.h / 2, BODY_Z)), []);
  const neckBase = useMemo(() => torsoLocal(at((NECK.left + NECK.right) / 2, NECK.bottom, 0)), []);
  const pivotRest = useMemo(() => torsoLocal(at(PIVOT.x, PIVOT.y, 0)), []);
  /** the collar layer sits on the neck's axis: it moves by the neck's depth, not the sweater front's */
  const collarDepth = plateCentre.z - neckBase.z;

  // ---- neck tube (+ shading baked into vertex colours)
  const neck = useMemo(() => {
    const tube = new Tube(16, 28);
    const count = tube.rings * (tube.radial + 1);
    tube.geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
    return { tube, curve };
  }, []);

  // ---- cables
  const cables = useMemo<CableRun[]>(
    () =>
      CABLES.map(() => ({
        rope: new Rope(CABLE.points),
        tube: new Tube(CABLE.tubeSegments, CABLE.tubeRadial),
        curve: new THREE.CatmullRomCurve3(
          Array.from({ length: CABLE.points }, () => new THREE.Vector3()),
          false,
          "centripetal",
        ),
        length: 0,
        plugA: null,
        plugB: null,
        socketB: null,
      })),
    [],
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

  // scratch objects, so the frame loop allocates nothing
  const tmp = useMemo(
    () => ({
      v: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      v3: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      up: new THREE.Vector3(0, 1, 0),
      m: new THREE.Matrix4(),
      monInv: new THREE.Matrix4(),
      neckInv: new THREE.Matrix4(),
      plateInv: new THREE.Matrix4(),
      tan: new THREE.Vector3(),
      sx: new THREE.Vector3(),
      sz: new THREE.Vector3(),
      a: CABLES.map(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3() })),
      b: CABLES.map(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3() })),
    }),
    [],
  );
  const shared = useRef({ yaw: 0, collar: 0 });

  /** A point on the neck's surface (neck-local), at height t along it and angle deg round it. */
  const neckPoint = (t: number, deg: number, r: number, out: THREE.Vector3, dir: THREE.Vector3) => {
    const c = neck.curve;
    c.getPoint(t, out);
    c.getTangent(t, tmp.tan).normalize();
    tmp.sx.set(0, 0, 1).cross(tmp.tan).normalize(); // sideways (+x)
    tmp.sz.crossVectors(tmp.tan, tmp.sx).normalize(); // forward (+z)
    const a = deg * DEG;
    dir.copy(tmp.sx).multiplyScalar(Math.sin(a)).addScaledVector(tmp.sz, Math.cos(a));
    out.addScaledVector(dir, r);
    return out;
  };

  /** World position + outward direction of each cable's two ends. */
  const anchors = () => {
    const mon = monitorRef.current!;
    const nm = neckMesh.current!;
    const pl = plate.current!;
    CABLES.forEach((c, i) => {
      const A = tmp.a[i];
      A.p.set(...c.pos).applyMatrix4(mon.matrixWorld);
      A.d.set(...c.dir).normalize().transformDirection(mon.matrixWorld);
      const B = tmp.b[i];
      if ("neck" in c.to) {
        const [t, deg] = c.to.neck;
        neckPoint(t, deg, NECK_R, B.p, B.d);
        // through the neck's squash, then to world
        tmp.v.copy(B.p).addScaledVector(B.d, 0.2);
        B.p.applyMatrix4(nm.matrixWorld);
        tmp.v.applyMatrix4(nm.matrixWorld);
        B.d.subVectors(tmp.v, B.p).normalize();
      } else {
        const [x, row] = c.to.collar;
        const lx = plateX(x);
        const ly = plateY(row);
        B.p.set(plateWarp(lx, ly, shared.current.yaw, shared.current.collar), ly, 0.03).applyMatrix4(pl.matrixWorld);
        B.d.set(0, 0.45, 1).normalize().transformDirection(pl.matrixWorld);
      }
      // plugs and the neck/collar sockets follow their anchors
      const run = cables[i];
      placeAlong(run.plugA, A.p, A.d);
      placeAlong(run.plugB, B.p, B.d);
      placeAlong(run.socketB, B.p, B.d);
      // the cord starts where the plug's boot ends
      A.p.addScaledVector(A.d, PLUG_LEN);
      B.p.addScaledVector(B.d, PLUG_LEN);
    });
  };

  const placeAlong = (g: THREE.Group | null, p: THREE.Vector3, d: THREE.Vector3) => {
    if (!g) return;
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(tmp.up, d);
  };

  /** Keep a rope point out of the monitor, the neck and the sweater. */
  const collide = (p: THREE.Vector3, r: number) => {
    // monitor (monitor-local, so it turns with the head; includes the cups): a box with
    // rounded edges, so a cord sliding round a corner bends smoothly instead of kinking
    const v = tmp.v3.copy(p).applyMatrix4(tmp.monInv);
    const rr = r / M.scale + 0.04;
    const qx = Math.abs(v.x - MON_BOX.cx) - (MON_BOX.hx - MON_BOX.round);
    const qy = Math.abs(v.y - MON_BOX.cy) - (MON_BOX.hy - MON_BOX.round);
    const qz = Math.abs(v.z - MON_BOX.cz) - (MON_BOX.hz - MON_BOX.round);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const oz = Math.max(qz, 0);
    const outside = Math.hypot(ox, oy, oz);
    const dist = outside + Math.min(Math.max(qx, qy, qz), 0) - MON_BOX.round;
    if (dist < rr) {
      const push = rr - dist;
      if (outside > 1e-6) {
        v.x += Math.sign(v.x - MON_BOX.cx) * (ox / outside) * push;
        v.y += Math.sign(v.y - MON_BOX.cy) * (oy / outside) * push;
        v.z += Math.sign(v.z - MON_BOX.cz) * (oz / outside) * push;
      } else if (qx >= qy && qx >= qz) v.x += Math.sign(v.x - MON_BOX.cx) * push;
      else if (qy >= qz) v.y += Math.sign(v.y - MON_BOX.cy) * push;
      else v.z += Math.sign(v.z - MON_BOX.cz) * push;
      p.copy(v.applyMatrix4(monitorRef.current!.matrixWorld));
    }
    // neck: a cylinder along its straight axis (neck-local, which carries the squash)
    const n = tmp.v3.copy(p).applyMatrix4(tmp.neckInv);
    const top = neck.curve.v3;
    if (n.y > NECK_RIM && n.y < top.y + 0.3) {
      const ax = (n.y / Math.max(0.01, top.y)) * top.x;
      const az = (n.y / Math.max(0.01, top.y)) * top.z;
      const dx = n.x - ax;
      const dz = n.z - az;
      const d = Math.hypot(dx, dz);
      const min = NECK_R * 0.94 + r / NECK_SQUASH;
      if (d < min && d > 1e-5) {
        n.x = ax + (dx / d) * min;
        n.z = az + (dz / d) * min;
        p.copy(n.applyMatrix4(neckMesh.current!.matrixWorld));
      }
    }
    // sweater: over the chest and shoulders a cord stays in front of the plate (else the photo would
    // hide it). The rule eases in over the collar's rim, so a cord bends onto the sweater instead of kinking.
    const sp = tmp.v3.copy(p).applyMatrix4(tmp.plateInv);
    const col = Math.abs(sp.x) / PLATE_K;
    if (col < 5.4) {
      const rim = plateY(880 + Math.max(0, col - 1.9) * 38);
      const k = smooth(rim + 0.6, rim - 0.05, sp.y);
      const zMin = -1.6 + (1.6 + r + 0.02) * k;
      if (k > 0 && sp.z < zMin) {
        sp.z = zMin;
        p.copy(sp.applyMatrix4(plate.current!.matrixWorld));
      }
    }
  };

  useFrame((_, dtRaw) => {
    const now = performance.now();
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;

    // ---------- 1. where to look
    if (head.frozen) {
      s.aimYaw = head.yaw;
      s.aimPitch = head.pitch;
    } else if (head.ease > 0) {
      s.aimYaw = damp(s.aimYaw, head.yaw, head.ease, dt);
      s.aimPitch = damp(s.aimPitch, head.pitch, head.ease, dt);
    } else {
      s.aimYaw = head.yaw;
      s.aimPitch = head.pitch;
    }

    // idle life: tiny darts and an occasional curious tilt once the cursor is still
    const idle = !head.frozen && now - head.movedAt > MOTION.idleAfter;
    if (idle && now > s.saccade.next) {
      s.saccade.yaw = (Math.random() * 2 - 1) * MOTION.saccadeDeg;
      s.saccade.pitch = (Math.random() * 2 - 1) * MOTION.saccadeDeg * 0.6;
      s.saccade.next = now + MOTION.saccadeMin + Math.random() * (MOTION.saccadeMax - MOTION.saccadeMin);
    } else if (!idle) {
      s.saccade.yaw = s.saccade.pitch = 0;
      s.saccade.next = now + 400;
    }
    if (idle && now > s.tilt.next) {
      s.tilt.at = now;
      s.tilt.dir = Math.random() < 0.5 ? -1 : 1;
      s.tilt.next = now + MOTION.tiltMin + Math.random() * (MOTION.tiltMax - MOTION.tiltMin);
    } else if (!idle && s.tilt.next < now + 3000) {
      s.tilt.next = now + 3000;
    }
    const tiltT = (now - s.tilt.at) / MOTION.tiltFor;
    const tilt = tiltT >= 0 && tiltT < 1 ? Math.sin(tiltT * Math.PI) * MOTION.tiltDeg * s.tilt.dir : 0;

    const yawT = s.aimYaw + s.saccade.yaw;
    const pitchT = s.aimPitch + s.saccade.pitch;
    const rollT = head.roll - (yawT - head.yawBias) * MOTION.rollPerYaw + tilt;

    // ---------- 2. layered springs
    if (head.frozen) {
      s.hYaw.x = s.nYaw.x = yawT;
      s.hPitch.x = s.nPitch.x = pitchT;
      s.hRoll.x = rollT;
      s.tYaw.x = yawT * MOTION.torsoYaw;
      s.tPitch.x = pitchT * MOTION.torsoPitch;
      s.hYaw.v = s.hPitch.v = s.hRoll.v = s.nYaw.v = s.nPitch.v = s.tYaw.v = s.tPitch.v = 0;
    } else {
      spring(s.hYaw, yawT, MOTION.headOmega, MOTION.headZeta, dt);
      spring(s.hPitch, pitchT, MOTION.headOmega, MOTION.headZeta, dt);
      spring(s.hRoll, rollT, MOTION.headOmega, MOTION.headZeta, dt);
      spring(s.nYaw, s.hYaw.x, MOTION.neckOmega, 1, dt);
      spring(s.nPitch, s.hPitch.x, MOTION.neckOmega, 1, dt);
      spring(s.tYaw, s.hYaw.x * MOTION.torsoYaw, MOTION.torsoOmega, 1, dt);
      spring(s.tPitch, s.hPitch.x * MOTION.torsoPitch, MOTION.torsoOmega, 1, dt);
    }

    // a fast flick: one frame of screen flicker as the head snaps
    const speed = Math.abs(yawT - s.lastAimYaw) / Math.max(dt, 1e-3);
    s.lastAimYaw = yawT;
    if (!head.frozen && speed > MOTION.flickDegPerSec && now - s.flickAt > 900) {
      s.flickAt = now;
      engine.flick();
    }

    // ---------- 3. screen
    const yawRel = s.hYaw.x - head.yawBias;
    engine.setGaze(yawRel / MOTION.maxYaw, s.hPitch.x / MOTION.maxPitchDown);
    engine.setParallax(-yawRel / MOTION.maxYaw, -s.hPitch.x / MOTION.maxPitchDown);
    engine.setVoice(head.voice);
    if (engine.draw(now) || engine.version !== lastVersion.current) {
      lastVersion.current = engine.version;
      screenTex.needsUpdate = true;
    }

    // ---------- 4. pose the body
    let nod = 0;
    const sinceNod = now - head.nodAt;
    if (!head.frozen && sinceNod >= 0 && sinceNod < T.nod) nod = Math.sin((sinceNod / T.nod) * Math.PI) * MOTION.nodDeg;
    const breath = head.frozen ? 0 : Math.sin((now / T.breathePeriod) * Math.PI * 2);
    const tYaw = s.tYaw.x;
    const tPitch = s.tPitch.x;
    const tRoll = -tYaw * MOTION.torsoRoll;
    const leanX = (yawRel / MOTION.maxYaw) * MOTION.lean * (SRC / 100);
    const t = torso.current!;
    t.rotation.set((tPitch + breath * MOTION.breatheTilt) * DEG, tYaw * DEG, tRoll * DEG);
    t.position.set(TP.x + leanX, TP.y + breath * MOTION.breathe, TP.z);

    // the sweater stays facing the camera; its shader does the turn
    const p = plate.current!;
    const yawRad = tYaw * DEG;
    const collar = -collarDepth * Math.sin(yawRad) * 0.5;
    shared.current.yaw = yawRad;
    shared.current.collar = collar;
    p.rotation.y = -yawRad;
    const u = plateMat.uniforms;
    u.uYaw.value = yawRad;
    u.uCollar.value = collar;

    // the neck carries part of the bend, so the head rides on an arc rather than a single point
    const pv = pivot.current!;
    tmp.e.set((s.nPitch.x - tPitch) * MOTION.neckShare * DEG, (s.nYaw.x - tYaw) * MOTION.neckShare * DEG, 0, "YXZ");
    tmp.v.copy(pivotRest).sub(neckBase).applyEuler(tmp.e).add(neckBase);
    pv.position.copy(tmp.v);
    pv.rotation.set((s.hPitch.x - tPitch + nod) * DEG, (s.hYaw.x - tYaw) * DEG, (s.hRoll.x - tRoll) * DEG, "YXZ");

    // contact shadow under the monitor, on the collar: it slides with the head
    const sx = (pv.position.x - pivotRest.x) * 1.3 + Math.sin((s.hYaw.x - tYaw) * DEG) * 0.6;
    u.uShadow.value.set(sx, plateY(830) - Math.max(0, s.hPitch.x) * 0.012, 0.42 + Math.max(0, s.hPitch.x) * 0.012);

    // ---------- 5. neck tube
    pv.updateMatrix();
    tmp.q.setFromEuler(pv.rotation);
    const headUp = tmp.v2.set(0, 1, 0).applyQuaternion(tmp.q);
    const top = tmp.v3.copy(pv.position).sub(neckBase).addScaledVector(headUp, NECK_TOP);
    const len = top.length();
    const c = neck.curve;
    c.v0.set(0, 0, 0);
    c.v1.set(0, len * 0.4, 0);
    c.v3.copy(top);
    c.v2.copy(top).addScaledVector(headUp, -len * 0.45);
    neck.tube.update(c, NECK_R);
    paintNeck(neck.tube);

    // ---------- 6. cables
    scene.updateMatrixWorld();
    tmp.monInv.copy(monitorRef.current!.matrixWorld).invert();
    tmp.neckInv.copy(neckMesh.current!.matrixWorld).invert();
    tmp.plateInv.copy(p.matrixWorld).invert();
    anchors();
    if (!s.settled) {
      // first frame: lay every cord out at its length and let it settle into its drape
      cables.forEach((run, i) => {
        const def = CABLES[i];
        run.length = tmp.a[i].p.distanceTo(tmp.b[i].p) * (def.slack ?? CABLE.slack);
        run.rope.reset(tmp.a[i].p, tmp.a[i].d, tmp.b[i].p, tmp.b[i].d, run.length);
      });
      for (let k = 0; k < 150; k++) stepRopes(CABLE.step);
      s.settled = true;
    } else if (head.frozen) {
      stepRopes(CABLE.step);
    } else {
      s.acc = Math.min(s.acc + dt, CABLE.step * 6);
      while (s.acc >= CABLE.step) {
        stepRopes(CABLE.step);
        s.acc -= CABLE.step;
      }
    }
    cables.forEach((run) => {
      const pts = run.curve.points;
      run.rope.p.forEach((q, j) => pts[j].copy(q));
      run.curve.updateArcLengths();
      run.tube.update(run.curve, CABLE.radius);
    });

    if (bodyLoaded.current && ++frames.current === 3) onReady();
    if (still && frames.current === 30) reportStill();
  });

  /** ?still: where the screen glass and the LEDs land in the box, in source-photo pixels. */
  const reportStill = () => {
    const mon = monitorRef.current!;
    const px = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(mon.matrixWorld).project(camera);
      return [Math.round(((v.x + 1) / 2) * SRC), Math.round(((1 - v.y) / 2) * SRC)];
    };
    const z = -M.frameDepth + 0.1 + 0.04;
    const hw = (M.screenW - 0.1) / 2;
    const hh = (M.screenH - 0.1) / 2;
    const quad = [px(-hw, M.screenY + hh, z), px(hw, M.screenY + hh, z), px(hw, M.screenY - hh, z), px(-hw, M.screenY - hh, z)];
    const leds = Array.from({ length: 5 }, (_, i) => px(1.22 + i * 0.27, -M.h / 2 + 0.42, 0.03));
    (window as unknown as { __still: unknown }).__still = { quad, leds };
  };

  const stepRopes = (h: number) => {
    cables.forEach((run, i) =>
      run.rope.step(tmp.a[i].p, tmp.a[i].d, tmp.b[i].p, tmp.b[i].d, h, CABLE.gravity, CABLE.damping, CABLE.iterations, CABLE.radius, collide),
    );
  };

  return (
    <>
      <Framing still={still} />
      <ambientLight intensity={0.25} />
      {/* key light, top left: casts the monitor's shadow onto the neck */}
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
      {/* fill from the right, and a cool rim from behind that catches the casing's edges as he turns */}
      <directionalLight position={[9, 1, 5]} intensity={0.5} color="#dfe6ff" />
      <directionalLight position={[6, 5, -9]} intensity={1.6} color="#e8eeff" />
      <group ref={torso} position={TP}>
        <mesh ref={plate} position={plateCentre} renderOrder={1} material={plateMat.material}>
          <planeGeometry args={[(BODY_SIZE.w / 100) * PLATE_K, (BODY_SIZE.h / 100) * PLATE_K, 64, 12]} />
        </mesh>
        {/* the inside of the turtleneck, behind the neck: no backdrop ever shows through the collar */}
        <mesh
          position={[neckBase.x, neckBase.y + 0.25, neckBase.z]}
          scale={[1, 1, NECK_SQUASH]}
          material={mats.knit}
        >
          <cylinderGeometry args={[NECK_R * 1.07, NECK_R * 1.1, 0.9, 32, 1, true, Math.PI / 2, Math.PI]} />
        </mesh>
        <mesh
          ref={neckMesh}
          position={neckBase}
          scale={[1, 1, NECK_SQUASH]}
          material={mats.skin}
          geometry={neck.tube.geometry}
          receiveShadow
          frustumCulled={false}
        />
        <group ref={pivot} position={pivotRest}>
          {/* rubber grommet: the neck goes up into the monitor through it, at every angle */}
          <mesh position={[0, GROMMET.top, 0]} scale={[1, 1, NECK_SQUASH]} material={mats.rubber}>
            <latheGeometry
              args={[
                [
                  new THREE.Vector2(NECK_R + GROMMET.flare, 0.02),
                  new THREE.Vector2(NECK_R + GROMMET.flare, -0.03),
                  new THREE.Vector2(NECK_R + GROMMET.flare * 0.6, -GROMMET.depth * 0.55),
                  new THREE.Vector2(NECK_R + 0.03, -GROMMET.depth),
                  new THREE.Vector2(NECK_R - 0.02, -GROMMET.depth),
                ],
                40,
              ]}
            />
          </mesh>
          <group ref={monitorRef} position={[0, M.lift, M.zOffset + M.d / 2]} scale={M.scale}>
            <Monitor mats={mats} screenMat={screenMat} led={led} />
          </group>
        </group>
      </group>
      {cables.map((run, i) => (
        <group key={i}>
          <mesh geometry={run.tube.geometry} material={mats.cord} frustumCulled={false} />
          {(["plugA", "plugB"] as const).map((k) => (
            <group
              key={k}
              ref={(g) => {
                run[k] = g;
              }}
            >
              <mesh geometry={plugGeo.sleeve} material={mats.plugMetal} />
              <mesh geometry={plugGeo.collar} material={mats.plugMetal} />
              <mesh geometry={plugGeo.boot} material={mats.boot} />
            </group>
          ))}
          <group
            ref={(g) => {
              run.socketB = g;
            }}
          >
            <mesh geometry={plugGeo.grommet} material={mats.socketRim} rotation={[Math.PI / 2, 0, 0]} />
          </group>
        </group>
      ))}
    </>
  );
}

/** Painted-in shading like the photo: lit by the collar, falling into the monitor's shadow toward the top, darker round the sides. */
function paintNeck(tube: Tube) {
  const col = tube.geometry.attributes.color as THREE.BufferAttribute;
  const nrm = tube.geometry.attributes.normal as THREE.BufferAttribute;
  const arr = col.array as Float32Array;
  const per = tube.radial + 1;
  for (let i = 0; i < col.count; i++) {
    const t = Math.floor(i / per) / (tube.rings - 1); // 0 at the collar, 1 inside the monitor
    const under = 1 - 0.7 * smooth(0.2, 0.55, t);
    const facing = 0.35 + 0.65 * Math.pow(Math.max(0, nrm.getZ(i)), 0.9);
    const v = under * facing;
    arr[i * 3] = v;
    arr[i * 3 + 1] = v * 0.95;
    arr[i * 3 + 2] = v * 0.92;
  }
  col.needsUpdate = true;
}

export default function Crt3D({ paused, ...rest }: RendererProps) {
  return (
    <Canvas
      frameloop={paused ? "never" : "always"}
      dpr={rest.still ? 1 : [1, 1.5]}
      shadows
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: !!rest.still }}
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
