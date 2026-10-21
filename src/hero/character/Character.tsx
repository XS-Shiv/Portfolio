"use client";

import { m as motion } from "motion/react";
import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ScreenEngine } from "../screen/engine";
import { EASE } from "../timings";
import { CANVAS, LEDS, SCREEN_QUAD, SRC } from "./geometry";
import { quadToMatrix3d } from "./quad";
import type { HeadControl } from "./types";

/**
 * The one interface the hero talks to. Inside, it shows the photo with a live
 * screen first (fast paint, and the no-WebGL fallback), then swaps in the 3D
 * head when it is ready. Replace Crt3D with a GLB renderer without touching
 * anything outside this folder.
 */

const Crt3D = dynamic(() => import("./Crt3D"), { ssr: false });

export type Box = { x: number; y: number; s: number };

type Props = {
  engine: ScreenEngine | null;
  head: HeadControl;
  led: number;
  /**
   * Where the box should be, in viewport pixels. null = its CSS home (State 1,
   * centre stage), which is laid out in CSS so the first paint never shifts.
   */
  target: Box | null;
  transition: { duration: number; delay: number; instant: boolean };
  /** Phone conversation layout: fade the sweater out below the collar. */
  fadeBody: boolean;
  paused: boolean;
  /** Extras positioned in the box (percentages of the source photo). */
  children?: React.ReactNode;
};

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Character({ engine, head, led, target, transition, fadeBody, paused, children }: Props) {
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  const [ready3d, setReady3d] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const [home, setHome] = useState<Box | null>(null);

  // the box's untransformed layout position (its CSS home)
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const measure = () => setHome({ x: node.offsetLeft, y: node.offsetTop, s: node.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const forceStatic = new URLSearchParams(window.location.search).has("nowebgl");
    // let the photo paint first, then start fetching the 3D bundle
    const id = requestAnimationFrame(() => setMode(!forceStatic && hasWebGL() ? "3d" : "static"));
    return () => cancelAnimationFrame(id);
  }, []);

  const showStatic = mode !== "3d" || !ready3d;
  const offset =
    target && home
      ? { x: target.x - home.x, y: target.y - home.y, scale: target.s / home.s }
      : { x: 0, y: 0, scale: 1 };

  return (
    <motion.div
      ref={el}
      className="character"
      style={{ transformOrigin: "0 0" }}
      initial={false}
      animate={offset}
      transition={
        transition.instant
          ? { duration: 0 }
          : { duration: transition.duration / 1000, delay: transition.delay / 1000, ease: EASE.settle }
      }
      data-fade={fadeBody ? "on" : "off"}
    >
      {mode === "3d" && (
        <div
          className="character-canvas"
          style={{
            top: `${-CANVAS.top * 100}%`,
            left: `${-CANVAS.side * 100}%`,
            right: `${-CANVAS.side * 100}%`,
            bottom: `${-CANVAS.bottom * 100}%`,
            opacity: ready3d ? 1 : 0,
          }}
        >
          {engine && (
            <Crt3D engine={engine} head={head} led={led} paused={paused} onReady={() => setReady3d(true)} />
          )}
        </div>
      )}
      <div className="character-breathe">
        <StaticCharacter engine={engine} led={led} visible={showStatic} size={home?.s ?? 0} paused={paused} />
      </div>
      {children}
    </motion.div>
  );
}

/** The photo, with the live screen canvas warped onto its glass. */
function StaticCharacter({
  engine,
  led,
  visible,
  size,
  paused,
}: {
  engine: ScreenEngine | null;
  led: number;
  visible: boolean;
  size: number;
  paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const matrix = useMemo(
    () => (engine ? quadToMatrix3d(engine.width, engine.height, SCREEN_QUAD) : "none"),
    [engine],
  );

  // mount the engine's canvas and keep it drawing while the photo is showing
  useEffect(() => {
    if (!engine || !host.current || !visible || paused) return;
    const c = engine.canvas;
    host.current.appendChild(c);
    let raf = 0;
    const loop = () => {
      engine.draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (c.parentNode === host.current) host.current?.removeChild(c);
    };
  }, [engine, visible, paused]);

  return (
    <div className="character-static" style={{ opacity: visible ? 1 : 0 }} aria-hidden>
      <picture>
        <source srcSet="/character/front-blank.avif" type="image/avif" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character/front-blank.webp" alt="" draggable={false} fetchPriority="high" />
      </picture>
      {/* overlay layer in source-photo pixels, scaled to the box */}
      <div
        className="character-overlay"
        style={{ width: SRC, height: SRC, transform: `scale(${size / SRC})`, opacity: size ? 1 : 0 }}
      >
        <div
          ref={host}
          className="character-screen"
          style={{ width: engine?.width, height: engine?.height, transform: matrix }}
        />
        {led !== 0 &&
          LEDS.map(([x, y], i) =>
            i === 0 || i === led ? (
              <span
                key={i}
                className={i === led ? "led led-on" : "led led-off"}
                style={{ left: x - 9, top: y - 4 }}
              />
            ) : null,
          )}
      </div>
    </div>
  );
}
