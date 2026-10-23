import * as THREE from "three";

/**
 * Allocation-free helpers for the 3D character: a rope (verlet chain with fixed
 * length) and a tube mesh that can be re-bent every frame without rebuilding
 * its geometry. The plain-number spring helpers live in springs.ts, so the page
 * can use them without pulling three.js into the first paint.
 */

// ---------------------------------------------------------------- rope

export type Collider = (p: THREE.Vector3, r: number) => void;

/**
 * A cord pinned at both ends. The two points at each end are held along the
 * plug's axis, so the cord leaves every plug straight; the rest hangs under
 * gravity with a fixed segment length.
 */
export class Rope {
  readonly p: THREE.Vector3[];
  private prev: THREE.Vector3[];
  seg = 0.2;
  private tmp = new THREE.Vector3();

  constructor(count: number) {
    this.p = Array.from({ length: count }, () => new THREE.Vector3());
    this.prev = Array.from({ length: count }, () => new THREE.Vector3());
  }

  /** Lay the rope out along a sagging curve between two anchors, at rest. */
  reset(a: THREE.Vector3, aDir: THREE.Vector3, b: THREE.Vector3, bDir: THREE.Vector3, length: number) {
    const n = this.p.length;
    this.seg = length / (n - 1);
    const sag = Math.max(0, (length - a.distanceTo(b)) * 0.5);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this.p[i].lerpVectors(a, b, t);
      this.p[i].y -= Math.sin(t * Math.PI) * sag;
      this.prev[i].copy(this.p[i]);
    }
    this.pin(a, aDir, b, bDir);
  }

  private pin(a: THREE.Vector3, aDir: THREE.Vector3, b: THREE.Vector3, bDir: THREE.Vector3) {
    const n = this.p.length;
    this.p[0].copy(a);
    this.p[1].copy(a).addScaledVector(aDir, this.seg);
    this.p[n - 1].copy(b);
    this.p[n - 2].copy(b).addScaledVector(bDir, this.seg);
  }

  step(
    a: THREE.Vector3,
    aDir: THREE.Vector3,
    b: THREE.Vector3,
    bDir: THREE.Vector3,
    h: number,
    gravity: number,
    damping: number,
    iterations: number,
    radius: number,
    collide: Collider,
  ) {
    const n = this.p.length;
    const g = gravity * h * h;
    for (let i = 2; i < n - 2; i++) {
      const p = this.p[i];
      const q = this.prev[i];
      this.tmp.subVectors(p, q).multiplyScalar(damping);
      q.copy(p);
      p.add(this.tmp);
      p.y -= g;
    }
    for (let k = 0; k < iterations; k++) {
      this.pin(a, aDir, b, bDir);
      for (let i = 0; i < n - 1; i++) {
        const p1 = this.p[i];
        const p2 = this.p[i + 1];
        this.tmp.subVectors(p2, p1);
        const d = this.tmp.length() || 1e-6;
        const diff = (d - this.seg) / d;
        const w1 = i < 2 ? 0 : i + 1 >= n - 2 ? 1 : 0.5;
        const w2 = i + 1 >= n - 2 ? 0 : i < 2 ? 1 : 0.5;
        p1.addScaledVector(this.tmp, diff * w1);
        p2.addScaledVector(this.tmp, -diff * w2);
      }
      for (let i = 2; i < n - 2; i++) collide(this.p[i], radius);
    }
    this.pin(a, aDir, b, bDir);
  }
}

// ---------------------------------------------------------------- tube

/**
 * A round tube along a curve, with a fixed number of rings, updated in place.
 * Rings are spaced evenly along the curve's length; frames are carried along
 * the curve so the tube never twists.
 */
export class Tube {
  readonly geometry = new THREE.BufferGeometry();
  readonly rings: number;
  readonly radial: number;
  private pos: Float32Array;
  private nrm: Float32Array;
  private pt = new THREE.Vector3();
  private tan = new THREE.Vector3();
  private n = new THREE.Vector3();
  private b = new THREE.Vector3();
  private prevT = new THREE.Vector3();

  constructor(segments: number, radial: number) {
    this.rings = segments + 1;
    this.radial = radial;
    const verts = this.rings * (radial + 1);
    this.pos = new Float32Array(verts * 3);
    this.nrm = new Float32Array(verts * 3);
    const idx: number[] = [];
    for (let i = 0; i < segments; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        // counter-clockwise seen from outside, so the outside is the front face
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    this.geometry.setIndex(idx);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute("normal", new THREE.BufferAttribute(this.nrm, 3));
  }

  /** Bend the tube along `curve`. `radius` may vary along it (u = 0..1). */
  update(curve: THREE.Curve<THREE.Vector3>, radius: number | ((u: number) => number)) {
    const { rings, radial, pos, nrm } = this;
    for (let i = 0; i < rings; i++) {
      const u = i / (rings - 1);
      curve.getPointAt(u, this.pt);
      curve.getTangentAt(u, this.tan).normalize();
      if (i === 0) {
        // any vector not parallel to the tangent starts the frame
        this.n.set(0, 0, 1);
        if (Math.abs(this.tan.z) > 0.9) this.n.set(1, 0, 0);
        this.b.crossVectors(this.tan, this.n).normalize();
        this.n.crossVectors(this.b, this.tan).normalize();
      } else {
        // carry the previous frame forward (rotation-minimising)
        this.b.crossVectors(this.tan, this.n).normalize();
        this.n.crossVectors(this.b, this.tan).normalize();
      }
      this.prevT.copy(this.tan);
      const r = typeof radius === "number" ? radius : radius(u);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const k = (i * (radial + 1) + j) * 3;
        const nx = c * this.n.x + s * this.b.x;
        const ny = c * this.n.y + s * this.b.y;
        const nz = c * this.n.z + s * this.b.z;
        nrm[k] = nx;
        nrm[k + 1] = ny;
        nrm[k + 2] = nz;
        pos[k] = this.pt.x + nx * r;
        pos[k + 1] = this.pt.y + ny * r;
        pos[k + 2] = this.pt.z + nz * r;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }
}
