"use client";

import { AnimatePresence, domAnimation, LazyMotion, m as motion } from "motion/react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Character, type Box } from "./character/Character";
import { HEAD_CENTER, SRC } from "./character/geometry";
import type { HeadControl } from "./character/types";
import { contact, dialogue, hints, options, screen, site, type DialogueOption } from "./content";
import { talkBox } from "./layout";
import { finalText, initialState, ledOf, progressOf, reducer } from "./machine";
import { ScreenEngine } from "./screen/engine";
import { Sound } from "./sound";
import { EASE, HEAD, T, TAP_SLOP } from "./timings";

const clamp = (v: number, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const isPunct = (ch: string) => ".,?!".includes(ch);
const arrive = { duration: 0.26, ease: EASE.arrive };
const pad = (i: number) => String(i + 1).padStart(2, "0");

type Typed = { id: number; n: number; show: "text" | "slip" | "recovery" };

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

/** Text that can be mid-glitch: the slip frame renders with a torn, colour-split copy. */
function Spoken({ text, glitch }: { text: string; glitch: boolean }) {
  if (!glitch) return <>{text}</>;
  return (
    <span className="glitch" data-text={text}>
      {text}
    </span>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
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
    nodAt: -1e9,
    frozen: false,
  });
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<"none" | "connect">("none");
  const [typed, setTyped] = useState<Typed>({ id: -1, n: 0, show: "text" });
  const [announce, setAnnounce] = useState("");
  const connectBtn = useRef<HTMLButtonElement>(null);
  const firstCta = useRef<HTMLElement | null>(null);
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
      engine.setCaption("");
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
      engine.setCaption("");
      engine.flickerTo(screen.idle);
      setPanel("none");
      later(() => dispatch({ type: "RESTART_DONE" }), reduced ? 0 : T.restartSlide);
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, engine, reduced]);

  // the caption under the eyes follows the conversation
  useEffect(() => {
    if (engine && talking) engine.setCaption(dialogue[state.node].screen);
  }, [engine, talking, state.node]);

  // ---------- typing (with the occasional "I -> we" slip) ----------
  const line = transcript[typedUpTo];
  useEffect(() => {
    if (!talking || !line) return;
    const final = finalText(line);
    if (reduced) {
      setTyped({ id: line.id, n: final.length, show: line.recovery ? "recovery" : "text" });
      setAnnounce(final);
      dispatch({ type: "LINE_TYPED" });
      return;
    }
    let timer = 0;
    const later = (fn: () => void, ms: number) => {
      timer = window.setTimeout(fn, ms);
    };
    const typeOut = (text: string, show: Typed["show"], speed: number, done: () => void) => {
      let n = 0;
      engine?.setTalking(true);
      const step = () => {
        n++;
        setTyped({ id: line.id, n, show });
        sound.current?.click();
        if (n < text.length) {
          later(step, speed * (T.perChar + (isPunct(text[n - 1]) ? T.punctuationPause : 0)));
        } else {
          engine?.setTalking(false);
          done();
        }
      };
      setTyped({ id: line.id, n: 0, show });
      step();
    };
    const finish = () => {
      setAnnounce(final);
      later(() => dispatch({ type: "LINE_TYPED" }), T.betweenLines);
    };
    const slip = () => {
      if (!line.slip) return finish();
      later(() => {
        // the machine slips into "we"...
        setTyped({ id: line.id, n: line.slip!.length, show: "slip" });
        engine?.glitch(T.slipHold);
        sound.current?.glitch();
        // ...then catches itself
        later(() => {
          if (line.recovery) typeOut(line.recovery, "recovery", T.slipRetype, finish);
          else {
            setTyped({ id: line.id, n: line.text.length, show: "text" });
            finish();
          }
        }, T.slipHold);
      }, T.slipAfter);
    };
    later(() => typeOut(line.text, "text", 1, slip), typedUpTo === 0 ? T.firstLineAt : 180);
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
    if (i < typedUpTo) return finalText(l);
    if (i === typedUpTo && typed.id === l.id) {
      if (typed.show === "slip") return l.slip ?? l.text;
      if (typed.show === "recovery") return (l.recovery ?? "").slice(0, typed.n);
      return l.text.slice(0, typed.n);
    }
    return "";
  };
  const n = transcript.length;
  const prevIdx = n - 2;
  const curIdx = n - 1;
  const done = n > 0 && typedUpTo >= n;
  const slipping = typed.show === "slip" && transcript[typedUpTo]?.id === typed.id;
  const node = dialogue[state.node];
  const ctas = node.options.map((id) => options[id]).filter(Boolean);
  const ctasShown = talking && done;

  // keyboard visitors land on the main call to action whenever the replies appear
  useEffect(() => {
    if (!ctasShown || !byKey.current) return;
    byKey.current = false;
    const id = window.setTimeout(() => firstCta.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [ctasShown, state.node]);

  // ---------- head follows the pointer ----------
  const aimAt = useCallback(
    (x: number, y: number) => {
      if (!viewport) return;
      const box = target ?? ({ s: 0, x: viewport.w / 2, y: viewport.h * 0.46 } as Box);
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
    head.current.yaw = talking ? HEAD.conversationYawBiasDeg : HEAD.restYawDeg;
    head.current.pitch = talking ? 2 : HEAD.restPitchDeg;
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

  // ---------- choosing ----------
  const choose = (opt: DialogueOption, keyboard: boolean) => {
    if (opt.action === "connect") {
      setPanel("connect");
      return;
    }
    if (!opt.next) return;
    byKey.current = keyboard;
    head.current.nodAt = performance.now();
    setPanel("none");
    dispatch({ type: "CHOOSE", option: opt.id });
  };

  const restart = () => dispatch({ type: "RESTART" });

  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    sound.current?.setEnabled(on);
  };

  const led = ledOf(state);
  const progress = progressOf(state);
  const compactTop = talk && talk.columnTop ? `${talk.columnTop}px` : undefined;

  const renderCta = (opt: DialogueOption, i: number) => {
    const primary = i === 0;
    const cls = primary ? "cta cta-primary" : "cta cta-minor";
    const inner = (
      <>
        <span className="cta-num" aria-hidden>
          {pad(i)}
        </span>
        <span className="cta-body">
          <span className="cta-label">{opt.label}</span>
          {opt.sub && <span className="cta-sub">{opt.sub}</span>}
        </span>
        <span className="cta-arrow" aria-hidden>
          <Arrow />
        </span>
      </>
    );
    const anim = {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: { ...arrive, delay: reduced ? 0 : (i * T.pillStagger) / 1000 },
    };
    const ref = primary ? (el: HTMLElement | null) => void (firstCta.current = el) : undefined;
    if (opt.href) {
      return (
        <motion.a
          key={`${state.node}-${opt.id}`}
          ref={ref}
          className={cls}
          href={opt.href}
          target={opt.href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          {...anim}
        >
          {inner}
        </motion.a>
      );
    }
    return (
      <motion.button
        key={`${state.node}-${opt.id}`}
        ref={ref}
        type="button"
        className={cls}
        aria-haspopup={opt.action === "connect" ? "dialog" : undefined}
        onClick={(e) => choose(opt, e.detail === 0)}
        {...anim}
      >
        {inner}
      </motion.button>
    );
  };

  const prevLive = typedUpTo === prevIdx;
  const curLive = typedUpTo === curIdx;

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
          <p className="chrome-name">{site.signature}</p>

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
              aria-label="Conversation"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
            >
              <motion.p
                key={`sys-${state.node}`}
                className="line-system"
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: reduced ? 0 : 0.1 }}
              >
                {"> "}
                {node.system.replace(/_$/, "")}
                {node.system.endsWith("_") && <span className="caret caret-block" />}
              </motion.p>

              <p className={prevLive ? "line-prev is-live" : "line-prev"} aria-hidden>
                <Spoken text={textOf(prevIdx)} glitch={prevLive && slipping} />
                {prevLive && !slipping && textOf(prevIdx) && <span className="caret" />}
              </p>

              <p className="line-current" aria-hidden>
                <Spoken text={textOf(curIdx)} glitch={curLive && slipping} />
                {curLive && !slipping && <span className="caret" />}
              </p>

              <div className="line-sub" aria-hidden>
                <AnimatePresence mode="wait">
                  {done && (
                    <motion.p
                      key={`sub-${state.node}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={arrive}
                    >
                      {node.sub}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="ctas" role="group" aria-label="Where to next">
                {ctasShown && (
                  <>
                    {ctas[0] && renderCta(ctas[0], 0)}
                    {ctas.length > 1 && <div className="cta-minors">{ctas.slice(1).map((o, i) => renderCta(o, i + 1))}</div>}
                  </>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {talking && (
            <motion.div
              className="controls"
              data-ui
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              transition={{ ...arrive, delay: reduced ? 0 : 0.8 }}
            >
              <button type="button" className="restart" onClick={restart} aria-label={hints.restart}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
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
          data-visible={talking ? "on" : "off"}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {announce}
          {done ? ` ${node.sub}` : ""}
        </div>
      </main>
    </LazyMotion>
  );
}
