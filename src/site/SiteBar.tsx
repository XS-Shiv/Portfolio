"use client";

import { AnimatePresence, domAnimation, LazyMotion, m as motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { contact, hints, site } from "@/hero/content";
import { EASE } from "@/hero/timings";
import { savedSoundPref, saveSoundPref } from "./soundPref";

/**
 * The top bar on the Work pages: the machine's status line top-left (linking
 * home), and the same right side as the hero: the sound toggle and Let's talk.
 * No sound ever plays here; the toggle only changes the shared choice.
 */
export function SiteBar({ status }: { status: string }) {
  const [soundOn, setSoundOn] = useState(true);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => setSoundOn(savedSoundPref()), []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const away = (e: PointerEvent) => {
      if (!(e.target as Element).closest("#connect-panel, .chrome-connect")) setOpen(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", away);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", away);
    };
  }, [open]);

  return (
    <LazyMotion features={domAnimation} strict>
      <header className="chrome site-bar">
        <Link href="/" className="chrome-status site-status" aria-label="Home">
          {status.replace(/_$/, "")}
          <span className="caret caret-block" />
        </Link>
        <div className="chrome-right">
          <button
            type="button"
            className="chrome-sound"
            onClick={() => {
              const on = !soundOn;
              setSoundOn(on);
              saveSoundPref(on);
            }}
            aria-pressed={soundOn}
            aria-label={soundOn ? hints.soundOn : hints.soundOff}
          >
            <SoundIcon on={soundOn} />
          </button>
          <button
            ref={btn}
            type="button"
            className="chrome-connect"
            aria-expanded={open}
            aria-controls="connect-panel"
            onClick={() => setOpen(!open)}
          >
            <span className="glitch-hover" data-text={site.connectLabel}>
              {site.connectLabel}
            </span>
            <OutArrow />
          </button>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              id="connect-panel"
              role="dialog"
              aria-label={site.connectLabel}
              className="panel"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
              transition={{ duration: 0.3, ease: EASE.arrive }}
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
    </LazyMotion>
  );
}

export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
      {on ? (
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function OutArrow({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Arrow({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M5 12h13M13 6.5 18.5 12 13 17.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
