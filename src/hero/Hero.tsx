"use client";

import { AnimatePresence, domAnimation, LazyMotion, m as motion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { Character, type Box } from "./character/Character";
import { HEAD_CENTER, SRC } from "./character/geometry";
import { soft } from "./character/springs";
import type { HeadControl } from "./character/types";
import { contact, hints, intro, screen, sections, site, status } from "./content";
import { idleBox, isCompact, talkBox } from "./layout";
import { initialState, ledOf, reducer } from "./machine";
import { flipAt, flipCount } from "./pronouns";
import { ScreenEngine } from "./screen/engine";
import { markLeaving, takeReturn } from "./session";
import { savedSoundPref, Sound } from "./sound";
import { EASE, MOTION, T, TAP_SLOP, VOICE } from "./timings";
import { Narrator, type Speech } from "./voice";

const DEG = Math.PI / 180;

/** Live tuning panel for every motion constant: `npm run dev`, then ?tune. Stripped from production builds. */
const Tune =
  process.env.NODE_ENV === "development" ? dynamic(() => import("./dev/Tune"), { ssr: false }) : () => null;
const arrive = { duration: 0.3, ease: EASE.arrive };

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

type FlipStage = "in" | "hold" | "notice" | "out";
type FlipState = { slot: string; k: number; stage: FlipStage };

/** Text with one word mid-flip (I <-> we), or plain text when nothing is flipping. */
function Flip({ text, flip }: { text: string; flip: { k: number; stage: FlipStage } | null }) {
  const parts = flip === null ? null : flipAt(text, flip.k);
  if (!parts || !flip) return <>{text}</>;
  return (
    <>
      {parts.before}
      <span className="glitch glitch-word" data-text={parts.word} data-stage={flip.stage}>
        {parts.word}
      </span>
      {parts.after}
    </>
  );
}

/**
 * A line that never shifts the layout: an invisible copy of the full text holds
 * the space, and the revealed part is drawn on top of it.
 */
function Typed({
  full,
  shown,
  flip,
  caret,
}: {
  full: string;
  shown: string;
  flip: { k: number; stage: FlipStage } | null;
  caret?: boolean;
}) {
  return (
    <span className="typed">
      <span className="typed-ghost" aria-hidden>
        {full}
      </span>
      <span className="typed-live">
        {shown === full ? <Flip text={full} flip={flip} /> : shown}
        {caret && <span className="caret" />}
      </span>
    </span>
  );
}

function Arrow({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M5 12h13M13 6.5 18.5 12 13 17.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
      {on ? (
        <path
          d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

function OutArrow() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
      <path
        d="M7 17 17 7M9 7h8v8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Hero() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();
  /** Back from /work: State 2 appears already settled; for the first frames nothing animates in. */
  const [settling, setSettling] = useState(false);
  const faceOnSettle = useRef(false);
  useLayoutEffect(() => {
    if (!takeReturn()) return;
    faceOnSettle.current = true;
    setSettling(true);
    dispatch({ type: "SETTLE" });
  }, []);
  useEffect(() => {
    if (!settling) return;
    const id = window.setTimeout(() => setSettling(false), 120);
    return () => clearTimeout(id);
  }, [settling]);
  const { phase, transcript, typedUpTo } = state;
  const reduced = useMedia("(prefers-reduced-motion: reduce)");

  const [engine, setEngine] = useState<ScreenEngine | null>(null);
  const sound = useRef<Sound | null>(null);
  const narrator = useRef<Narrator | null>(null);
  const speech = useRef<Speech | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const head = useRef<HeadControl>({
    yaw: MOTION.neutralYaw,
    pitch: MOTION.neutralPitch,
    roll: 0,
    yawBias: 0,
    movedAt: 0,
    ease: MOTION.leaveEase,
    nodAt: -1e9,
    frozen: false,
    voice: 0,
  });
  const heroEl = useRef<HTMLElement>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<"none" | "connect">("none");
  const [typed, setTyped] = useState<{ id: number; n: number }>({ id: -1, n: 0 });
  const [announce, setAnnounce] = useState("");
  const [flip, setFlip] = useState<FlipState | null>(null);
  const [cardChars, setCardChars] = useState(0);
  const [section, setSection] = useState<string | null>(null);
  const connectBtn = useRef<HTMLButtonElement>(null);
  const mainCta = useRef<HTMLButtonElement>(null);
  const backBtn = useRef<HTMLButtonElement>(null);
  const byKey = useRef(false);
  /** ?pose=yaw,pitch holds the head at one angle (for checking extremes and screenshots). */
  const fixedPose = useRef<[number, number] | null>(null);
  const [tune, setTune] = useState(false);
  /** ?still: the character frozen in its first pose with a blank screen, for baking the first-paint image. */
  const [still, setStill] = useState(false);

  const talking = phase === "booting" || phase === "conversation";

  // ---------- setup ----------
  useEffect(() => {
    const e = new ScreenEngine();
    e.showText(screen.idle);
    e.loadImages(screen.images);
    setEngine(e);
    const s = new Sound();
    sound.current = s;
    narrator.current = new Narrator(s);
    setSoundOn(savedSoundPref());
    const params = new URLSearchParams(window.location.search);
    setTune(params.has("tune"));
    setStill(params.has("still"));
    const pose = params.get("pose");
    if (pose) {
      const [y, p] = pose.split(",").map(Number);
      if (Number.isFinite(y) && Number.isFinite(p)) fixedPose.current = [y, p];
    }
    const preload = window.setTimeout(() => s.preload(), 2500);
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    // the first click, tap or key anywhere unlocks audio (browsers need a gesture)
    const unlock = () => s.unlock();
    window.addEventListener("pointerdown", unlock, { capture: true, once: true });
    window.addEventListener("keydown", unlock, { capture: true, once: true });
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      clearTimeout(preload);
      narrator.current?.stop();
      s.dispose();
    };
  }, []);

  useEffect(() => {
    head.current.frozen = reduced || still;
    if (engine) engine.reducedMotion = reduced || still;
  }, [reduced, engine, still]);

  // ---------- layout ----------
  const compact = viewport ? isCompact(viewport.w, viewport.h) : false;
  const talk = viewport ? talkBox(viewport.w, viewport.h) : null;
  const target: Box | null = talking ? (talk?.box ?? null) : null;

  // ---------- screen + phase choreography ----------
  useEffect(() => {
    if (!engine) return;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    if (still) {
      engine.showText("");
    } else if (phase === "idle") {
      engine.showText(screen.idle);
      // alternate: picture, text nudge, picture, picture, text nudge, ...
      let k = 0;
      let n = 0;
      const nudge = () => {
        later(
          () => {
            const pictureTurn = n++ % 3 !== 1;
            if (!(pictureTurn && engine.popImage())) engine.flickerTo(screen.nudges[k++ % screen.nudges.length]);
            nudge();
          },
          T.nudgeMin + Math.random() * (T.nudgeMax - T.nudgeMin),
        );
      };
      later(() => engine.popImage(), T.firstPop);
      nudge();
    } else if (phase === "conversation" && faceOnSettle.current) {
      faceOnSettle.current = false;
      engine.showFace();
    } else if (phase === "booting") {
      sound.current?.hum();
      narrator.current?.load();
      engine.powerOn(screen.boot);
      later(() => engine.showFace(), reduced ? 0 : T.bootLineUntil);
      later(() => dispatch({ type: "BOOT_DONE" }), reduced ? 0 : T.slideDelay + T.slide);
    } else if (phase === "restarting") {
      engine.setTalking(false);
      engine.flickerTo(screen.idle);
      setPanel("none");
      setSection(null);
      later(() => dispatch({ type: "RESTART_DONE" }), reduced ? 0 : T.restartSlide);
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, engine, reduced, still]);

  // ---------- the lines: spoken, revealed word by word with the voice ----------
  const line = transcript[typedUpTo];
  useEffect(() => {
    if (!talking || !line || !narrator.current) return;
    if (reduced) {
      setTyped({ id: line.id, n: line.text.length });
      dispatch({ type: "LINE_TYPED" });
      return;
    }
    const timers: number[] = [];
    setTyped({ id: line.id, n: 0 });
    timers.push(
      window.setTimeout(
        () => {
          engine?.setTalking(true);
          speech.current = narrator.current!.speak(
            line,
            (n) => setTyped({ id: line.id, n }),
            () => {
              engine?.setTalking(false);
              timers.push(window.setTimeout(() => dispatch({ type: "LINE_TYPED" }), T.betweenLines));
            },
          );
        },
        typedUpTo === 0 ? T.firstLineAt : VOICE.sentence,
      ),
    );
    return () => {
      timers.forEach(clearTimeout);
      speech.current?.cancel();
      speech.current = null;
      engine?.setTalking(false);
    };
    // phase intentionally left out: booting -> conversation must not restart a line
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.id, talking, reduced, engine]);

  // reduced motion: the text is all there at once, and the voice still reads it
  useEffect(() => {
    if (!reduced || phase !== "booting" || !narrator.current) return;
    const q = narrator.current.queue(transcript, VOICE.sentence);
    speech.current = q;
    return () => {
      if (speech.current === q) speech.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, phase]);

  // the voice's loudness drives the face and makes the buttons pulse, outside React
  useEffect(() => {
    if (!talking) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      const lvl = narrator.current?.level() ?? 0;
      head.current.voice = lvl;
      const q = Math.round(lvl * 100) / 100;
      if (q !== last) {
        last = q;
        heroEl.current?.style.setProperty("--vox", q.toFixed(2));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      head.current.voice = 0;
      heroEl.current?.style.setProperty("--vox", "0");
    };
  }, [talking]);

  const textOf = (i: number) => {
    const l = transcript[i];
    if (!l) return "";
    if (i < typedUpTo) return l.text;
    if (i === typedUpTo && typed.id === l.id) return l.text.slice(0, typed.n);
    return "";
  };
  const done = talking && transcript.length > 0 && typedUpTo >= transcript.length;
  /** The button and cards arrive while he is still talking, so they can pulse with his voice. */
  const ctaShown = talking && transcript.length > 0 && typedUpTo > T.ctaAfterLine;

  // the cards' text types in together once they land
  const cardLen = Math.max(...intro.cards.map((c) => c.label.length + c.sub.length));
  useEffect(() => {
    if (!ctaShown) {
      setCardChars(0);
      return;
    }
    if (reduced || settling) {
      setCardChars(cardLen);
      return;
    }
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setCardChars(n);
      if (n >= cardLen) clearInterval(id);
    }, T.cardPerChar);
    return () => clearInterval(id);
    // settling only matters for the first frames; it must not retrigger the typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctaShown, reduced, cardLen]);
  const allDone = done && cardChars >= cardLen;

  // screen readers hear each line as it completes
  useEffect(() => {
    if (!talking || typedUpTo === 0) {
      setAnnounce("");
      return;
    }
    setAnnounce(
      transcript
        .slice(0, typedUpTo)
        .map((l) => l.text.replace(/\n/g, ". "))
        .join(". "),
    );
  }, [typedUpTo, talking, transcript]);

  // keyboard visitors land on the main button once he has finished
  useEffect(() => {
    if (!done || !byKey.current) return;
    byKey.current = false;
    const id = window.setTimeout(() => mainCta.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [done]);

  // ---------- the occasional I -> we beat, in the headline: "Hey, I'm Shiv." -> "Hey, we're Shiv." ----------
  useEffect(() => {
    if (!allDone || reduced || section || !flipCount(intro.lines[0].text)) return;
    const timers: number[] = [];
    const at = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const slot = "line-0";
    const k = 0;
    const loop = (first: boolean) => {
      const wait = first ? T.flipFirst : T.flipEveryMin + Math.random() * (T.flipEveryMax - T.flipEveryMin);
      at(() => {
        // glitch in -> hold "we're" -> a small flicker as he notices -> glitch back
        setFlip({ slot, k, stage: "in" });
        engine?.glitch(180);
        sound.current?.glitch();
        let t = T.flipIn;
        at(() => setFlip({ slot, k, stage: "hold" }), t);
        t += T.flipHold;
        at(() => setFlip({ slot, k, stage: "notice" }), t);
        t += T.flipNotice;
        at(() => setFlip({ slot, k, stage: "hold" }), t);
        t += 260;
        at(() => {
          setFlip({ slot, k, stage: "out" });
          engine?.glitch(140);
        }, t);
        t += T.flipOut;
        at(() => {
          setFlip(null);
          loop(false);
        }, t);
      }, wait);
    };
    loop(true);
    return () => {
      timers.forEach(clearTimeout);
      setFlip(null);
    };
  }, [allDone, reduced, engine, section]);
  const flipOf = (slot: string) => (flip?.slot === slot ? { k: flip.k, stage: flip.stage } : null);

  // ---------- the head looks at the pointer ----------
  // State 2 holds a three-quarter pose toward the text and follows a little around it.
  const pose = talking
    ? compact
      ? { yaw: MOTION.talkYawCompact, pitch: MOTION.talkPitchCompact, roll: 2, follow: MOTION.talkFollowCompact }
      : { yaw: MOTION.talkYaw, pitch: MOTION.talkPitch, roll: MOTION.talkRoll, follow: MOTION.talkFollow }
    : { yaw: 0, pitch: 0, roll: 0, follow: 1 };
  const neutral = talking
    ? { yaw: pose.yaw + 3, pitch: pose.pitch }
    : { yaw: MOTION.neutralYaw, pitch: MOTION.neutralPitch };

  const aimAt = useCallback(
    (x: number, y: number) => {
      if (!viewport || reduced || fixedPose.current) return;
      const box = target ?? idleBox(viewport.w, viewport.h);
      const cx = box.x + (HEAD_CENTER.x / SRC) * box.s;
      const cy = box.y + (HEAD_CENTER.y / SRC) * box.s;
      // project onto a plane in front of the head, so it points at the cursor
      const d = MOTION.planeDist * viewport.h;
      const yaw = (Math.atan2(x - cx, d) / DEG) * MOTION.gain;
      const pitch = (Math.atan2(y - cy, d) / DEG) * MOTION.gain;
      const h = head.current;
      h.yaw = pose.yaw + soft(yaw, MOTION.maxYaw) * pose.follow;
      h.pitch = pose.pitch + soft(pitch, pitch > 0 ? MOTION.maxPitchDown : MOTION.maxPitchUp) * pose.follow;
      h.movedAt = performance.now();
      h.ease = 0;
    },
    // pose is derived from talking and compact
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport, target, talking, compact, reduced],
  );

  const settle = useCallback(
    (rate: number) => {
      const h = head.current;
      const f = fixedPose.current;
      h.yaw = f ? pose.yaw + f[0] : neutral.yaw;
      h.pitch = f ? pose.pitch + f[1] : neutral.pitch;
      h.ease = f ? 0 : rate;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [talking, compact],
  );

  // when the state changes, swing into that state's pose
  useEffect(() => {
    const h = head.current;
    h.roll = pose.roll;
    h.yawBias = talking ? pose.yaw : 0;
    settle(5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talking, compact]);

  const down = useRef<{ x: number; y: number; id: number; touch: boolean } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || down.current) aimAt(e.clientX, e.clientY);
    };
    // the cursor left the window: ease to a neutral, slightly off-centre pose
    const leave = (e: MouseEvent) => {
      if (!e.relatedTarget) settle(MOTION.leaveEase);
    };
    window.addEventListener("pointermove", move);
    document.addEventListener("mouseout", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseout", leave);
    };
  }, [aimAt, settle]);

  /** A hovered or focused button draws the head's attention. */
  const glance = (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    aimAt(r.left + r.width / 2, r.top + r.height / 2);
  };

  // ---------- starting ----------
  const start = useCallback(() => {
    if (phase !== "idle") return;
    setPanel("none");
    sound.current?.unlock();
    dispatch({ type: "START" });
  }, [phase]);

  const isUi = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest("[data-ui], a, button, input, [role='dialog']");

  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== "mouse" };
    if (e.pointerType !== "mouse") aimAt(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    // a finger lifted: the head eases back instead of staring at where it was
    if (d?.touch) settle(MOTION.leaveEase);
    if (!d || isUi(e.target)) return;
    if (panel !== "none") {
      setPanel("none");
      return;
    }
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= TAP_SLOP) start();
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panel !== "none") {
        setPanel("none");
        connectBtn.current?.focus();
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && phase === "idle" && !isUi(e.target)) {
        e.preventDefault();
        byKey.current = true;
        start();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [phase, panel, start]);

  /** Stop talking now: the rest of the introduction appears at once. */
  const hush = () => {
    speech.current?.cancel();
    speech.current = null;
    narrator.current?.stop();
    if (typedUpTo < transcript.length) dispatch({ type: "FINISH_ALL" });
  };

  const open = (id: string, e?: React.MouseEvent) => {
    hush();
    head.current.nodAt = performance.now();
    byKey.current = !!e && e.detail === 0;
    setSection(id);
  };
  // keyboard visitors land on the section's Back button as soon as it mounts
  const focusNext = useRef<"back" | "cta" | null>(null);
  useEffect(() => {
    if (!byKey.current) return;
    byKey.current = false;
    focusNext.current = section ? "back" : "cta";
    const el = section ? backBtn.current : mainCta.current;
    if (el && document.contains(el)) {
      focusNext.current = null;
      el.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);
  const focusOnMount = (which: "back" | "cta") => (el: HTMLButtonElement | null) => {
    if (which === "back") backBtn.current = el;
    else mainCta.current = el;
    if (el && focusNext.current === which) {
      focusNext.current = null;
      el.focus();
    }
  };

  const restart = () => {
    hush();
    dispatch({ type: "RESTART" });
  };

  // ---------- leaving for another page: speech stops, the screen collapses like a CRT, then we go ----------
  const leaving = useRef(false);
  const leaveTo = (href: string) => {
    if (leaving.current) return;
    leaving.current = true;
    hush();
    markLeaving();
    const el = heroEl.current;
    if (reduced || !el) {
      router.push(href);
      return;
    }
    // transform and opacity only, so it stays on the compositor even while the 3D renders;
    // navigation runs on a timer, so the exit never takes longer than T.crtExit
    // (the browser's own Web Animations API, which motion's mini animate wraps; calling it
    // directly keeps the hero bundle unchanged)
    el.animate(
      [
        { transform: "scale(1, 1)", opacity: 1, offset: 0 },
        { transform: "scale(1, 0.006)", opacity: 1, offset: 0.55 },
        { transform: "scale(1, 0.006)", opacity: 1, offset: 0.7 },
        { transform: "scale(0, 0.006)", opacity: 0, offset: 1 },
      ],
      { duration: T.crtExit, easing: "ease-in", fill: "forwards" },
    );
    window.setTimeout(() => router.push(href), T.crtExit);
  };
  useEffect(() => {
    if (ctaShown) router.prefetch(intro.primaryHref);
  }, [ctaShown, router]);
  // restored from the back-forward cache mid-exit: undo the collapse
  useEffect(() => {
    const show = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      leaving.current = false;
      heroEl.current?.getAnimations().forEach((a) => a.cancel());
    };
    window.addEventListener("pageshow", show);
    return () => window.removeEventListener("pageshow", show);
  }, []);

  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    sound.current?.setEnabled(on);
    if (!on) window.speechSynthesis?.cancel();
  };

  /** Clicking the text finishes the line he is saying. */
  const skipLine = (e: React.MouseEvent) => {
    if (section || (e.target as Element).closest("button, a")) return;
    speech.current?.finish();
  };

  const led = ledOf(state);
  const compactTop = talk && talk.columnTop ? `${talk.columnTop}px` : undefined;
  const statusText = phase === "booting" ? status.booting : phase === "conversation" ? status.ready : "";
  const reveal = {
    initial: settling ? (false as const) : { opacity: 0, y: reduced ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { ...arrive, duration: reduced ? 0 : 0.35 },
  };
  const sec = sections.find((s) => s.id === section) ?? null;

  return (
    <LazyMotion features={domAnimation} strict>
      <main className="page">
        <section
          ref={heroEl}
          className="hero"
          data-phase={phase}
          data-section={section ? "open" : "none"}
          data-reduced={reduced ? "on" : "off"}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          style={compactTop ? ({ "--column-top": compactTop } as React.CSSProperties) : undefined}
        >
          <h1 className="sr-only">{site.name}, AI-first product manager. Interactive introduction.</h1>

          <Character
            engine={engine}
            head={head.current}
            led={led}
            target={target}
            transition={{
              duration: phase === "restarting" ? T.restartSlide : T.slide,
              delay: phase === "booting" ? T.slideDelay : 0,
              instant: reduced || settling,
            }}
            fadeBody={talking && !!talk?.columnTop}
            paused={paused}
          />

          {/* ---------- top bar, every state ---------- */}
          <header className="chrome" data-ui>
            {/* top-left: only the machine's status line, in State 2 (nothing in State 1) */}
            <AnimatePresence mode="wait">
              {statusText ? (
                <motion.p
                  key={statusText}
                  className="chrome-status"
                  aria-hidden
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2 }}
                >
                  {"> "}
                  {statusText.replace(/_$/, "")}
                  {statusText.endsWith("_") && <span className="caret caret-block" />}
                </motion.p>
              ) : (
                <span />
              )}
            </AnimatePresence>

            <div className="chrome-right">
              <button
                type="button"
                className="chrome-sound"
                onClick={toggleSound}
                aria-pressed={soundOn}
                aria-label={soundOn ? hints.soundOn : hints.soundOff}
              >
                <SoundIcon on={soundOn} />
              </button>
              <button
                ref={connectBtn}
                type="button"
                className="chrome-connect"
                aria-expanded={panel === "connect"}
                aria-controls="connect-panel"
                onClick={() => setPanel(panel === "connect" ? "none" : "connect")}
              >
                <span className="glitch-hover" data-text={site.connectLabel}>
                  {site.connectLabel}
                </span>
                <OutArrow />
              </button>
            </div>

            <AnimatePresence>
              {panel === "connect" && (
                <motion.div
                  id="connect-panel"
                  role="dialog"
                  aria-label={site.connectLabel}
                  className="panel"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
                  transition={arrive}
                >
                  <ul>
                    {contact.map((c) => (
                      <li key={c.label}>
                        <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                          <span className="panel-label">{c.label}</span>
                          <span className="panel-value">{c.href.replace(/^mailto:|^https:\/\/(www\.)?/g, "")}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          {/* ---------- State 1 ---------- */}
          {phase === "idle" && (
            <button
              type="button"
              className="sr-start"
              onClick={(e) => {
                byKey.current = e.detail === 0; // detail 0 = keyboard "click"
                start();
              }}
            >
              Start the conversation
            </button>
          )}

          {/* ---------- State 2 ---------- */}
          <AnimatePresence>
            {talking && (
              <motion.section
                className="column"
                data-ui
                aria-label="Introduction"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
                onClick={skipLine}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {sec ? (
                    <motion.div
                      key={sec.id}
                      className="section-view"
                      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={arrive}
                    >
                      <p className="system-line" aria-hidden>
                        <span className="sec-num">{sec.number}</span>
                        {"> "}
                        {sec.status.replace(/_$/, "")}
                        <span className="caret caret-block" />
                      </p>
                      <div className="sec-head">
                        <h2 className="sec-title">{sec.title}</h2>
                        <p className="sec-line">{sec.line}</p>
                      </div>
                      <div className="sec-foot">
                      <p className="sec-note">{sec.note}</p>
                      <div className="sec-links">
                        {sec.links.map((l) => (
                          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="sec-link">
                            {l.label}
                            <OutArrow />
                          </a>
                        ))}
                        <button
                          ref={focusOnMount("back")}
                          type="button"
                          className="sec-back"
                          onClick={(e) => {
                            byKey.current = e.detail === 0;
                            setSection(null);
                          }}
                          onFocus={glance}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                            <path
                              d="M19 12H6M11 6.5 5.5 12 11 17.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {hints.back}
                        </button>
                      </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="intro"
                      className="intro"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="intro-head">
                      <p className="intro-title" aria-hidden>
                        <Typed full={intro.lines[0].text} shown={textOf(0)} flip={flipOf("line-0")} caret={typedUpTo === 0} />
                      </p>
                      <p className="intro-subtitle" aria-hidden>
                        <Typed full={intro.lines[1].text} shown={textOf(1)} flip={null} caret={typedUpTo === 1} />
                      </p>
                      </div>
                      <div className="intro-body">
                        {intro.body.map((l, j) => {
                          const i = intro.lines.length + j;
                          return (
                            <p key={j} aria-hidden>
                              <Typed full={l.text} shown={textOf(i)} flip={null} caret={typedUpTo === i} />
                            </p>
                          );
                        })}
                      </div>

                      <div className="cta-row">
                        {ctaShown && (
                          <>
                            <motion.button
                              ref={focusOnMount("cta")}
                              type="button"
                              className="cta-main vox"
                              onClick={() => leaveTo(intro.primaryHref)}
                              onFocus={glance}
                              {...reveal}
                            >
                              {intro.primary}
                              <Arrow size={20} />
                            </motion.button>
                            <motion.button
                              type="button"
                              className="restart"
                              onClick={restart}
                              onFocus={glance}
                              aria-label={hints.restart}
                              {...reveal}
                            >
                              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                                <path
                                  d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </motion.button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}
          </AnimatePresence>

          {/* the three ways in: glass cards that open their section */}
          <AnimatePresence>
            {ctaShown && (
              <motion.nav className="cards" data-ui aria-label="Explore" exit={{ opacity: 0, transition: { duration: 0.18 } }}>
                {intro.cards.map((c, i) => (
                  <motion.button
                    key={c.id}
                    type="button"
                    className={i === 0 ? "card card-primary vox" : "card vox"}
                    whileHover={reduced ? undefined : { y: -4 }}
                    whileFocus={reduced ? undefined : { y: -4 }}
                    aria-current={section === c.id ? "true" : undefined}
                    onClick={(e) => (c.href ? leaveTo(c.href) : open(c.id, e))}
                    onFocus={glance}
                    {...reveal}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="card-img" src={c.image} alt="" draggable={false} />
                    <span className="card-num" aria-hidden>
                      {c.number} <span className="card-dash" />
                    </span>
                    <span className="card-label">
                      <Typed full={c.label} shown={c.label.slice(0, cardChars)} flip={null} />
                    </span>
                    <span className="card-sub">
                      <Typed full={c.sub} shown={c.sub.slice(0, Math.max(0, cardChars - c.label.length))} flip={null} />
                    </span>
                    <span className="card-arrow" aria-hidden>
                      <Arrow size={16} />
                    </span>
                  </motion.button>
                ))}
              </motion.nav>
            )}
          </AnimatePresence>

          {tune && <Tune />}

          <div className="sr-only" role="status" aria-live="polite">
            {announce}
          </div>
        </section>
      </main>
    </LazyMotion>
  );
}
