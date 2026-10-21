"use client";

import { AnimatePresence, domAnimation, LazyMotion, m as motion } from "motion/react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Character, type Box } from "./character/Character";
import { HEAD_CENTER, SRC } from "./character/geometry";
import type { HeadControl } from "./character/types";
import { contact, hints, intro, screen, site, status } from "./content";
import { isCompact, talkBox } from "./layout";
import { initialState, ledOf, reducer } from "./machine";
import { flipAt, flipCount } from "./pronouns";
import { ScreenEngine } from "./screen/engine";
import { Sound } from "./sound";
import { EASE, HEAD, T, TAP_SLOP } from "./timings";

const clamp = (v: number, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const isPunct = (ch: string) => ".,?!".includes(ch);
const arrive = { duration: 0.3, ease: EASE.arrive };
const pad = (i: number) => String(i + 1).padStart(2, "0");

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

/** Text with one word mid-flip (I <-> we), or plain text when nothing is flipping. */
function Flip({ text, k }: { text: string; k: number | null }) {
  const parts = k === null ? null : flipAt(text, k);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.before}
      <span className="glitch glitch-word" data-text={parts.word}>
        {parts.word}
      </span>
      {parts.after}
    </>
  );
}

/**
 * A typewriter line that never shifts the layout: an invisible copy of the full
 * text holds the space, and the typed part is drawn on top of it.
 */
function Typed({ full, shown, k, caret }: { full: string; shown: string; k: number | null; caret?: boolean }) {
  return (
    <span className="typed">
      <span className="typed-ghost" aria-hidden>
        {full}
      </span>
      <span className="typed-live">
        {shown === full ? <Flip text={full} k={k} /> : shown}
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
        <path
          d="M16 9.5l5 5M21 9.5l-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
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
    roll: 0,
    yawBias: 0,
    body: 1,
    nodAt: -1e9,
    frozen: false,
  });
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<"none" | "connect">("none");
  const [typed, setTyped] = useState<{ id: number; n: number }>({ id: -1, n: 0 });
  const [announce, setAnnounce] = useState("");
  const [flip, setFlip] = useState<{ slot: string; k: number } | null>(null);
  const [cardChars, setCardChars] = useState(0);
  const connectBtn = useRef<HTMLButtonElement>(null);
  const mainCta = useRef<HTMLButtonElement>(null);
  const byKey = useRef(false);

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
      sound.current?.setEnabled(false);
    };
  }, []);

  useEffect(() => {
    head.current.frozen = reduced;
    if (engine) engine.reducedMotion = reduced;
  }, [reduced, engine]);

  // ---------- layout ----------
  const talk = viewport ? talkBox(viewport.w, viewport.h) : null;
  const target: Box | null = talking ? (talk?.box ?? null) : null;

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
      setPanel("none");
      later(() => dispatch({ type: "RESTART_DONE" }), reduced ? 0 : T.restartSlide);
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, engine, reduced]);

  // ---------- typing: title, subtitle, then the body lines (a little faster) ----------
  const line = transcript[typedUpTo];
  useEffect(() => {
    if (!talking || !line) return;
    if (reduced) {
      setTyped({ id: line.id, n: line.text.length });
      dispatch({ type: "LINE_TYPED" });
      return;
    }
    let n = 0;
    let timer = 0;
    setTyped({ id: line.id, n: 0 });
    // body lines type two characters per tick, so they stay quick without a render per letter
    const chunk = typedUpTo >= intro.lines.length ? 2 : 1;
    const step = () => {
      n = Math.min(line.text.length, n + chunk);
      setTyped({ id: line.id, n });
      if (n < line.text.length) {
        const speed = typedUpTo >= intro.lines.length ? T.bodySpeed : 1;
        timer = window.setTimeout(
          step,
          speed * (T.perChar + (isPunct(line.text[n - 1]) ? T.punctuationPause : 0)),
        );
      } else {
        engine?.setTalking(false);
        timer = window.setTimeout(() => dispatch({ type: "LINE_TYPED" }), T.betweenLines);
      }
    };
    timer = window.setTimeout(
      () => {
        engine?.setTalking(true);
        step();
      },
      typedUpTo === 0 ? T.firstLineAt : 120,
    );
    return () => {
      clearTimeout(timer);
      engine?.setTalking(false);
    };
    // phase intentionally left out: booting -> conversation must not restart a line
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.id, talking, reduced, engine]);

  const textOf = (i: number) => {
    const l = transcript[i];
    if (!l) return "";
    if (i < typedUpTo) return l.text;
    if (i === typedUpTo && typed.id === l.id) return l.text.slice(0, typed.n);
    return "";
  };
  const done = talking && transcript.length > 0 && typedUpTo >= transcript.length;

  // the cards type in together once the body has finished
  const cardLen = Math.max(...intro.cards.map((c) => c.label.length + c.sub.length));
  useEffect(() => {
    if (!done) {
      setCardChars(0);
      return;
    }
    if (reduced) {
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
  }, [done, reduced, cardLen]);
  const allDone = done && cardChars >= cardLen;

  useEffect(() => {
    if (done) setAnnounce([...intro.lines, ...intro.body].join(". ").replace(/\n/g, " "));
    else setAnnounce("");
  }, [done]);

  // keyboard visitors land on the main button once it appears
  useEffect(() => {
    if (!done || !byKey.current) return;
    byKey.current = false;
    const id = window.setTimeout(() => mainCta.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [done]);

  // ---------- the recurring I <-> we flip ----------
  useEffect(() => {
    if (!allDone || reduced) return;
    const slots = [
      ...intro.lines.map((text, i) => ({ slot: `line-${i}`, text, weight: 3 })),
      ...intro.body.map((text, i) => ({ slot: `body-${i}`, text, weight: 2 })),
      ...intro.cards.map((c) => ({ slot: `card-${c.id}`, text: c.sub, weight: 1 })),
    ].flatMap((s) => {
      const count = flipCount(s.text);
      return count ? Array.from({ length: s.weight }, () => ({ slot: s.slot, count })) : [];
    });
    if (!slots.length) return;
    const timers: number[] = [];
    const loop = (first: boolean) => {
      // the first flip comes a little sooner, so a quick visitor still sees one
      const wait = first ? 2600 : T.flipEveryMin + Math.random() * (T.flipEveryMax - T.flipEveryMin);
      timers.push(
        window.setTimeout(() => {
          const pick = slots[Math.floor(Math.random() * slots.length)];
          setFlip({ slot: pick.slot, k: Math.floor(Math.random() * pick.count) });
          engine?.glitch(300);
          sound.current?.glitch();
          timers.push(
            window.setTimeout(() => {
              setFlip(null);
              loop(false);
            }, T.flipHold),
          );
        }, wait),
      );
    };
    loop(true);
    return () => {
      timers.forEach(clearTimeout);
      setFlip(null);
    };
  }, [allDone, reduced, engine]);
  const flipK = (slot: string) => (flip?.slot === slot ? flip.k : null);

  // ---------- head follows the pointer ----------
  // In State 2 the head holds an imposing pose (turned toward the text, tilted,
  // on a bigger frame) and follows the cursor only a little around it.
  const compact = viewport ? isCompact(viewport.w, viewport.h) : false;
  const pose = talking
    ? compact
      ? { yaw: -8, pitch: 2, roll: 3, body: 1, follow: 0.6 }
      : {
          yaw: HEAD.conversationYawBiasDeg,
          pitch: HEAD.conversationPitchDeg,
          roll: HEAD.conversationRollDeg,
          body: HEAD.conversationBody,
          follow: HEAD.conversationFollow,
        }
    : { yaw: HEAD.restYawDeg, pitch: HEAD.restPitchDeg, roll: 0, body: 1, follow: 1 };

  const aimAt = useCallback(
    (x: number, y: number) => {
      if (!viewport || reduced) return;
      const box = target ?? ({ s: 0, x: viewport.w / 2, y: viewport.h * 0.46 } as Box);
      const cx = box.s ? box.x + (HEAD_CENTER.x / SRC) * box.s : box.x;
      const cy = box.s ? box.y + (HEAD_CENTER.y / SRC) * box.s : box.y;
      const dx = clamp((x - cx) / (viewport.w * 0.5));
      const dy = clamp((y - cy) / (viewport.h * 0.5));
      if (talking) {
        head.current.yaw = pose.yaw + dx * HEAD.maxYawDeg * pose.follow;
        head.current.pitch = pose.pitch + dy * HEAD.maxPitchDeg * pose.follow;
      } else {
        head.current.yaw = dx * HEAD.maxYawDeg;
        head.current.pitch = dy * (dy > 0 ? HEAD.maxPitchDeg : HEAD.maxPitchUpDeg);
      }
    },
    // pose is derived from talking and compact
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport, target, talking, compact, reduced],
  );

  // when the state changes, settle into that state's pose
  useEffect(() => {
    head.current.yaw = pose.yaw;
    head.current.pitch = pose.pitch;
    head.current.roll = pose.roll;
    head.current.yawBias = talking ? pose.yaw : 0;
    head.current.body = pose.body;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talking, compact]);

  const down = useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || down.current) aimAt(e.clientX, e.clientY);
    };
    const leave = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        head.current.yaw = pose.yaw;
        head.current.pitch = pose.pitch;
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

  const restart = () => dispatch({ type: "RESTART" });

  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    sound.current?.setEnabled(on);
  };

  const led = ledOf(state);
  const compactTop = talk && talk.columnTop ? `${talk.columnTop}px` : undefined;
  const statusText = phase === "booting" ? status.booting : phase === "conversation" ? status.ready : "";
  // the main button, restart and the cards all land together, in one beat
  const reveal = {
    initial: { opacity: 0, y: reduced ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { ...arrive, duration: reduced ? 0 : 0.35 },
  };

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
          fadeBody={talking && !!talk?.columnTop}
          paused={paused}
        />

        {/* ---------- top bar, every state ---------- */}
        <header className="chrome" data-ui>
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
                <span>
                  {"> "}
                  {statusText.replace(/_$/, "")}
                  {statusText.endsWith("_") && <span className="caret caret-block" />}
                </span>
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
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path
                  d="M7 17 17 7M9 7h8v8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
            >
              <p className="intro-title" aria-hidden>
                <Typed full={intro.lines[0]} shown={textOf(0)} k={flipK("line-0")} caret={typedUpTo === 0} />
              </p>
              <p className="intro-subtitle" aria-hidden>
                <Typed full={intro.lines[1]} shown={textOf(1)} k={flipK("line-1")} caret={typedUpTo === 1} />
              </p>
              <div className="intro-body">
                {intro.body.map((text, j) => {
                  const i = intro.lines.length + j;
                  return (
                    <p key={j} className={j === 0 ? "intro-lead" : "intro-aside"} aria-hidden>
                      <Typed full={text} shown={textOf(i)} k={flipK(`body-${j}`)} caret={typedUpTo === i} />
                    </p>
                  );
                })}
              </div>

              <div className="cta-row">
                {done && (
                  <>
                    {/* does nothing yet: the work section comes later */}
                    <motion.button ref={mainCta} type="button" className="cta-main" {...reveal}>
                      {intro.primary}
                      <Arrow size={20} />
                    </motion.button>
                    <motion.button
                      type="button"
                      className="restart"
                      onClick={restart}
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
            </motion.section>
          )}
        </AnimatePresence>

        {/* the three ways in; they do nothing yet */}
        <AnimatePresence>
          {done && (
            <motion.div
              className="cards"
              data-ui
              role="group"
              aria-label="Explore"
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
            >
              {intro.cards.map((c, i) => (
                <motion.button key={c.id} type="button" className="card" {...reveal}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="card-img" src={c.image} alt="" draggable={false} />
                  <span className="card-label">
                    <Typed full={c.label} shown={c.label.slice(0, cardChars)} k={null} />
                  </span>
                  <span className="card-sub">
                    <Typed
                      full={c.sub}
                      shown={c.sub.slice(0, Math.max(0, cardChars - c.label.length))}
                      k={flipK(`card-${c.id}`)}
                    />
                  </span>
                  <span className="card-foot" aria-hidden>
                    <span className="card-num">{pad(i)}</span>
                    <Arrow size={16} />
                  </span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sr-only" role="status" aria-live="polite">
          {announce}
        </div>
      </main>
    </LazyMotion>
  );
}
