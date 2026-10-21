"use client";

import { AnimatePresence, domAnimation, LazyMotion, m as motion } from "motion/react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Character, type Box } from "./character/Character";
import { HEAD_CENTER, SRC } from "./character/geometry";
import type { HeadControl } from "./character/types";
import { contact, dialogue, hints, nav, options, screen, site } from "./content";
import { talkBox } from "./layout";
import { initialState, ledOf, progressOf, reducer } from "./machine";
import { ScreenEngine } from "./screen/engine";
import { Sound } from "./sound";
import { EASE, HEAD, T, TAP_SLOP } from "./timings";

const clamp = (v: number, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const isPunct = (ch: string) => ".,?!".includes(ch);
const arrive = { duration: 0.26, ease: EASE.arrive };

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

export default function Hero() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { phase, transcript, typedUpTo } = state;
  const reduced = useMedia("(prefers-reduced-motion: reduce)");

  const [engine, setEngine] = useState<ScreenEngine | null>(null);
  const sound = useRef<Sound | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const head = useRef<HeadControl>({
    yaw: HEAD.restYawDeg,
    pitch: HEAD.restPitchDeg,
    nodAt: -1e9,
    frozen: false,
  });
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<"none" | "connect" | "menu">("none");
  const [typed, setTyped] = useState<{ id: number; n: number }>({ id: -1, n: 0 });
  const [pillsShown, setPillsShown] = useState(false);
  const [announce, setAnnounce] = useState("");
  const connectBtn = useRef<HTMLButtonElement>(null);
  const firstPill = useRef<HTMLButtonElement>(null);
  const startedByKey = useRef(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  const talking = phase === "booting" || phase === "conversation";

  // ---------- setup ----------
  useEffect(() => {
    const e = new ScreenEngine();
    e.showText(screen.idle);
    e.loadImages(screen.images);
    setEngine(e);
    sound.current = new Sound();
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    head.current.frozen = reduced;
    if (engine) engine.reducedMotion = reduced;
  }, [reduced, engine]);

  // ---------- layout ----------
  const talk = viewport ? talkBox(viewport.w, viewport.h) : null;
  const target: Box | null = phase === "conversation" || phase === "booting" ? (talk?.box ?? null) : null;

  // ---------- screen + phase choreography ----------
  useEffect(() => {
    if (!engine) return;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    if (phase === "idle") {
      engine.showText(screen.idle);
      // alternate: picture, text nudge, picture, picture, text nudge, ...
      let k = 0;
      let n = 0;
      const nudge = () => {
        later(
          () => {
            const pictureTurn = n++ % 3 !== 1;
            if (!(pictureTurn && engine.popImage())) {
              engine.flickerTo(screen.nudges[k++ % screen.nudges.length]);
            }
            nudge();
          },
          T.nudgeMin + Math.random() * (T.nudgeMax - T.nudgeMin),
        );
      };
      // the first picture comes early, so a quick visitor still sees one
      later(() => engine.popImage(), 2200);
      nudge();
    } else if (phase === "booting") {
      sound.current?.hum();
      engine.powerOn(screen.boot);
      later(() => engine.showFace(), reduced ? 0 : T.bootLineUntil);
      later(() => dispatch({ type: "BOOT_DONE" }), reduced ? 0 : T.slideDelay + T.slide);
    } else if (phase === "restarting") {
      engine.setTalking(false);
      engine.flickerTo(screen.idle);
      setPillsShown(false);
      setPanel("none");
      later(() => dispatch({ type: "RESTART_DONE" }), reduced ? 0 : T.restartSlide);
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, engine, reduced]);

  // ---------- typing ----------
  const line = transcript[typedUpTo];
  useEffect(() => {
    if (!talking || !line) return;
    const first = typedUpTo === 0;
    if (reduced) {
      setTyped({ id: line.id, n: line.text.length });
      setAnnounce(line.text);
      dispatch({ type: "LINE_TYPED" });
      return;
    }
    let n = 0;
    let timer = 0;
    setTyped({ id: line.id, n: 0 });
    const step = () => {
      n++;
      setTyped({ id: line.id, n });
      sound.current?.click();
      if (n < line.text.length) {
        timer = window.setTimeout(step, T.perChar + (isPunct(line.text[n - 1]) ? T.punctuationPause : 0));
      } else {
        engine?.setTalking(false);
        setAnnounce(line.text);
        timer = window.setTimeout(() => dispatch({ type: "LINE_TYPED" }), T.betweenLines);
      }
    };
    timer = window.setTimeout(
      () => {
        engine?.setTalking(true);
        step();
      },
      first ? T.firstLineAt : 180,
    );
    return () => {
      clearTimeout(timer);
      engine?.setTalking(false);
    };
    // phase intentionally left out: booting -> conversation must not restart a line
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.id, talking, reduced, engine]);

  useEffect(() => {
    if (talking && transcript.length > 0 && typedUpTo >= transcript.length) setPillsShown(true);
  }, [talking, typedUpTo, transcript.length]);

  // keyboard visitors land on the first reply as soon as the replies appear
  useEffect(() => {
    if (!pillsShown || !startedByKey.current) return;
    startedByKey.current = false;
    const id = window.setTimeout(() => firstPill.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [pillsShown]);

  const textOf = (i: number) => {
    const l = transcript[i];
    if (!l) return "";
    if (i < typedUpTo) return l.text;
    if (i === typedUpTo && typed.id === l.id) return l.text.slice(0, typed.n);
    return "";
  };
  const n = transcript.length;
  const prevText = n >= 2 ? textOf(n - 2) : "";
  const currentText = n >= 1 ? textOf(n - 1) : "";
  const currentDone = n > 0 && typedUpTo >= n;
  const node = dialogue[state.node];

  // ---------- head follows the pointer ----------
  const aimAt = useCallback(
    (x: number, y: number) => {
      if (!viewport) return;
      const box =
        target ??
        ({
          s: 0,
          x: viewport.w / 2,
          y: viewport.h * 0.46,
        } as Box);
      const cx = box.s ? box.x + (HEAD_CENTER.x / SRC) * box.s : box.x;
      const cy = box.s ? box.y + (HEAD_CENTER.y / SRC) * box.s : box.y;
      const bias = target ? HEAD.conversationYawBiasDeg : 0;
      head.current.yaw = clamp((x - cx) / (viewport.w * 0.5)) * HEAD.maxYawDeg + bias * 0.5;
      const dy = clamp((y - cy) / (viewport.h * 0.5));
      head.current.pitch = dy * (dy > 0 ? HEAD.maxPitchDeg : HEAD.maxPitchUpDeg);
    },
    [viewport, target],
  );

  // when the state changes with no pointer, settle into the state's rest pose
  useEffect(() => {
    if (talking) {
      head.current.yaw = HEAD.conversationYawBiasDeg;
      head.current.pitch = 2;
    } else {
      head.current.yaw = HEAD.restYawDeg;
      head.current.pitch = HEAD.restPitchDeg;
    }
  }, [talking]);

  const down = useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || down.current) aimAt(e.clientX, e.clientY);
    };
    const leave = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        head.current.yaw = talking ? HEAD.conversationYawBiasDeg : HEAD.restYawDeg;
        head.current.pitch = talking ? 2 : HEAD.restPitchDeg;
      }
    };
    window.addEventListener("pointermove", move);
    document.addEventListener("mouseout", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseout", leave);
    };
  }, [aimAt, talking]);

  // ---------- starting ----------
  const start = useCallback(() => {
    if (phase !== "idle") return;
    setPanel("none");
    dispatch({ type: "START" });
  }, [phase]);

  const isUi = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest("[data-ui], a, button, input, [role='dialog']");

  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
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
        const btn = panel === "connect" ? connectBtn.current : menuBtn.current;
        setPanel("none");
        btn?.focus();
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && phase === "idle" && !isUi(e.target)) {
        e.preventDefault();
        startedByKey.current = true;
        start();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [phase, panel, start]);

  // ---------- choosing ----------
  const choose = (id: string) => {
    if (!options[id]) return;
    head.current.nodAt = performance.now();
    setPanel("none");
    dispatch({ type: "CHOOSE", option: id });
  };

  const restart = () => dispatch({ type: "RESTART" });

  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    sound.current?.setEnabled(on);
  };

  const led = ledOf(phase);
  const progress = progressOf(state);
  const inConversation = phase === "conversation" || phase === "booting";
  const compactTop = talk && talk.columnTop ? `${talk.columnTop}px` : undefined;

  return (
    <LazyMotion features={domAnimation} strict>
      <main
        className="hero"
        data-phase={phase}
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
            instant: reduced,
          }}
          fadeBody={inConversation && !!talk?.columnTop}
          paused={paused}
        ></Character>

        {/* ---------- top chrome ---------- */}
        <header className="chrome" data-ui>
          <p className="chrome-name">{site.shortName}</p>

          <AnimatePresence>
            {inConversation && (
              <motion.nav
                className="chrome-nav"
                aria-label="Sections"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ ...arrive, delay: reduced ? 0 : 0.6 }}
              >
                {nav.map((item, i) => (
                  <span key={item.label} className="chrome-nav-item">
                    {i > 0 && <span aria-hidden> · </span>}
                    {item.href ? (
                      <a href={item.href} target="_blank" rel="noreferrer">
                        {item.label}
                      </a>
                    ) : (
                      <button type="button" onClick={() => item.topic && choose(item.topic)}>
                        {item.label}
                      </button>
                    )}
                  </span>
                ))}
              </motion.nav>
            )}
          </AnimatePresence>

          <div className="chrome-right">
            {inConversation && (
              <button
                ref={menuBtn}
                type="button"
                className="chrome-menu"
                aria-label={hints.menu}
                aria-expanded={panel === "menu"}
                onClick={() => setPanel(panel === "menu" ? "none" : "menu")}
              >
                <span />
                <span />
              </button>
            )}
            <button
              ref={connectBtn}
              type="button"
              className="chrome-connect"
              aria-expanded={panel === "connect"}
              aria-controls="connect-panel"
              onClick={() => setPanel(panel === "connect" ? "none" : "connect")}
            >
              {site.connectLabel}
            </button>
          </div>

          <AnimatePresence>
            {panel === "connect" && (
              <motion.div
                id="connect-panel"
                role="dialog"
                aria-label={site.connectLabel}
                className="panel panel-connect"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
                transition={arrive}
              >
                <ul>
                  {contact.map((c) => (
                    <li key={c.label}>
                      <a
                        href={c.href}
                        target={c.href.startsWith("http") ? "_blank" : undefined}
                        rel="noreferrer"
                      >
                        <span className="panel-label">{c.label}</span>
                        <span className="panel-value">
                          {c.href.replace(/^mailto:|^https:\/\/(www\.)?/g, "")}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
            {panel === "menu" && (
              <motion.div
                role="dialog"
                aria-label={hints.menu}
                className="panel panel-menu"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
                transition={arrive}
              >
                <ul>
                  {nav.map((item) => (
                    <li key={item.label}>
                      {item.href ? (
                        <a href={item.href} target="_blank" rel="noreferrer">
                          {item.label}
                        </a>
                      ) : (
                        <button type="button" onClick={() => item.topic && choose(item.topic)}>
                          {item.label}
                        </button>
                      )}
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
              startedByKey.current = e.detail === 0; // detail 0 = keyboard "click"
              start();
            }}
          >
            Start the conversation
          </button>
        )}

        {/* ---------- State 2 ---------- */}
        <AnimatePresence>
          {inConversation && (
            <motion.section
              className="column"
              data-ui
              aria-label="Conversation"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
            >
              <p className="line-prev" aria-hidden>
                {prevText}
              </p>
              <p className="line-current" aria-hidden>
                {currentText}
                {!currentDone && n > 0 && typedUpTo === n - 1 && <span className="caret" />}
              </p>
              <div className="line-link">
                <AnimatePresence>
                  {currentDone && node.link && (
                    <motion.a
                      key={node.link.href}
                      href={node.link.href}
                      target="_blank"
                      rel="noreferrer"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={arrive}
                    >
                      {node.link.label}
                    </motion.a>
                  )}
                </AnimatePresence>
              </div>
              <div className="pills" role="group" aria-label="Reply">
                {pillsShown &&
                  node.options.map((id, i) => (
                    <motion.button
                      key={id}
                      ref={i === 0 ? firstPill : undefined}
                      type="button"
                      className={i === 0 ? "pill pill-solid" : "pill"}
                      onClick={() => choose(id)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...arrive, delay: reduced ? 0 : (i * T.pillStagger) / 1000 }}
                    >
                      {options[id].label}
                    </motion.button>
                  ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {inConversation && (
            <motion.div
              className="controls"
              data-ui
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              transition={{ ...arrive, delay: reduced ? 0 : 0.8 }}
            >
              <button type="button" className="restart" onClick={restart} aria-label={hints.restart}>
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
              </button>
              <button
                type="button"
                className="sound"
                onClick={toggleSound}
                aria-pressed={soundOn}
                aria-label={soundOn ? hints.soundOn : hints.soundOff}
              >
                <span className={soundOn ? "sound-opt is-active" : "sound-opt"} aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
                    <path
                      d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className={!soundOn ? "sound-opt is-active" : "sound-opt"} aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
                    <path
                      d="M16 9.5l5 5M21 9.5l-5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="progress"
          role="progressbar"
          aria-label={hints.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          data-visible={inConversation ? "on" : "off"}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {announce}
        </div>
      </main>
    </LazyMotion>
  );
}
