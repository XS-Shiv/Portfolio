---
title: CRT Character Hero - Plan
type: feat
date: 2026-10-20
topic: crt-hero
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# CRT Character Hero - Plan

## Goal Capsule

- **Objective:** A recruiter or hiring manager who opens Shivanand Shukla's portfolio link stops, smiles at a CRT-headed character that looks back at them, clicks, and within a few seconds is being talked to by "Shiv" and offered four clear next steps.
- **Means:** A single-viewport interactive hero built as a state machine (idle, booting, conversation, restart), with a 3D monitor head over a 2D photographic body plate.
- **Product authority:** Shivanand Shukla (owner). This plan covers the hero only. The work, builds, about, resume and writing destinations are later areas, not active scope.
- **Open blockers:** Four Resolve Before Planning questions (Outstanding Questions below). Asset gaps do not block; placeholders are allowed per R27.

---

## Product Contract

### Summary

Build a one-screen hero for Shiv's portfolio. In idle, a man in a navy sweater with a CRT monitor for a head follows the cursor and coaxes the visitor to click. Clicking boots the screen, moves the character to the bottom-right and opens a typed conversation with four reply options. The dialogue is data-driven so later states can be added without component changes.

### Problem Frame

Recruiters give a portfolio link under a minute. A conventional PM portfolio (headshot, headline, case-study grid) reads like every other one and does not show that Shiv builds things himself. The hero has to prove "AI-first PM who builds" through the experience itself, before the visitor reads a word of case study.

### Key Decisions

- **Interaction concept only from lisa.locomotive.ca.** No code, copy, sounds, branding or character design is taken from it. The reference screenshots in `reference/lisa` were not supplied, so planning works from the brief's own description. Governs R1, R10.
- **The brief overrides the Stitch design system wherever they disagree.** Stitch (`reference/stitch`) is a loose layout reference only. Its sharp-corner, no-pill rule, grid, multiplayer cursors, floating tiles and "STAGE_01 // READY"-style metadata labels are not adopted. The brief's pills, round restart button and Inter Tight win. Governs R13, R14, R22.
- **3D monitor over a 2D body plate is the working hypothesis, not a settled choice.** The prototype step decides procedural CRT vs GLB vs a fallback approach before planning commits. Governs R23–R26.
- **Dialogue is data.** Every line, pill, nudge and reply lives in one content file, and the conversation is a graph of nodes. Governs R18, R19.
- **Timings are named constants in one file.** Governs R32.

### Actors

- A1. Visitor: a recruiter or hiring manager on desktop (mouse/keyboard) or mobile (touch), possibly with reduced motion or without WebGL.
- A2. Shiv (owner): edits copy, contact links and later dialogue states without touching components.

### Requirements

**Global chrome (every state)**

- R1. Top-left shows "Shivanand Shukla" and top-right shows a "Let's connect" text link in every state.
- R2. "Let's connect" opens a small panel with email, LinkedIn and GitHub. Values are placeholders in the content file. The panel closes on Escape, outside click or the link again, and opening it never starts the conversation.
- R3. The backdrop is a soft studio radial gradient, about #EDEDED at the centre to #BDBDBD at the edges, and the character sits in it with no visible seam.
- R4. The hero fills exactly one viewport with no page scroll and no layout shift on load, at 1440×900 and 390×844 and sizes in between.

**State 1: idle**

- R5. The character is centred and large, shoulders cropped by the bottom edge, monitor near the vertical centre.
- R6. The monitor turns toward the pointer, about ±25° yaw and ±15° pitch, eased with a slight lag. The body breathes 1–2px, slowly.
- R7. The screen shows "[CLICK] TO START_" in pixel type with a blinking underscore over faint drifting stars. LED 1 of 5 is lit blue.
- R8. After 6–8s without a start, the screen flickers and shows the next nudge in the cycle "psst… click me" → "I don't bite" → "[CLICK] TO START_", repeating. A small "psst… click the screen" hint occasionally appears beside the monitor.
- R9. After 4s a bottom-centre hint fades in: "move your cursor · click anywhere to start" on pointer devices, "tap anywhere to start" on touch.

**Transition: booting**

- R10. A click or tap anywhere on the stage, or Enter or Space, starts the transition. Clicks on "Let's connect", its panel and other chrome controls do not.
- R11. The screen plays a power-on scan-line flash, then a very short boot line.
- R12. Over about 800ms the character slides to the bottom-right, scales down slightly and turns a little toward the left column, while the left column types itself in line by line.

**State 2: conversation**

- R13. The left column (about 45% width, vertically centred) shows the previous line faded and slightly blurred ("Oh, hey. You found me.") and the current line large ("I'm Shiv. A product manager who builds what he plans, with AI. What do you want to see first?").
- R14. Four stacked reply pills follow: "Show me your work →" (solid black), then outlined "What have you built with AI?", "Who are you, really?", "Grab the resume ↓".
- R15. Choosing a pill makes the character nod and types a one-line "coming soon" reply for that topic. The four pills stay available.
- R16. The screen shows a pixel face with happy closed eyes (^ ^) that blinks every few seconds and plays a talking animation while text types. LED 2 is lit.
- R17. A top-centre nav shows Work · Builds · About · Writing as placeholder links.
- R18. Bottom-left has a round black restart button that reverses the transition back to State 1 and resets conversation progress.
- R19. Bottom-right has a vertical sound toggle (on / muted), muted by default.
- R20. A thin bar on the bottom edge shows conversation progress (definition pending, see Outstanding Questions).
- R21. The head keeps following the pointer in State 2.

**Content model**

- R22. All visible copy (names, lines, pills, replies, nudges, hints, boot line, contact placeholders) lives in one data file.
- R23. Dialogue is modelled as nodes with lines and options pointing to next nodes, so work, builds, about and resume states can be added later by editing data only.

**Character and screen**

- R24. The character is rendered behind one `<Character />` interface so the head implementation can be swapped (procedural CRT now, GLB later) without touching the state machine or layout.
- R25. The monitor matches `turnaround.png`: rounded casing, bezel, curved screen, vents, side speaker cup with blue ring, five LEDs, cables. Its lighting and materials read as the same photo as the body plate.
- R26. All screen content (text, caret, stars, flicker, power-on, face, blink, talk) is drawn live. No screen content is baked into shipped images.
- R27. If an asset is missing or unsuitable, the build uses a placeholder and the gap is reported with an exact generation prompt.

**Sound**

- R28. When sound is on, power-on plays a short CRT hum and typing plays soft key clicks, synthesised in the browser with no audio files.

**Accessibility and fallbacks**

- R29. The whole hero is keyboard operable; pills are real buttons with visible focus; typed text is announced through a live region; visible text has at least 4.5:1 contrast.
- R30. With reduced motion, head tracking, slides, breathing and typing are off and text appears instantly. (Whether the 3D head still renders is pending, see Outstanding Questions.)
- R31. Without WebGL, a static character image is shown with screen content as a DOM overlay, and the full state machine still works.

**Mobile (390×844)**

- R32. State 1 centres the character. State 2 places the character top-right at about 45% width with the conversation below. The nav collapses into a menu icon beside "Let's connect". The head follows touch-drag; a tap without a drag starts.

**Engineering constraints (from the brief)**

- R33. Next.js App Router, TypeScript, Tailwind, Motion for DOM transitions, React Three Fiber + drei for the character, deployed on Vercel.
- R34. States (idle → booting → conversation, plus restart) are explicit, with all timings as named constants in one file.
- R35. The static character image paints first and the 3D bundle lazy-loads after it. Images ship as AVIF/WebP. Rendering pauses when the tab is hidden.

### Key Flows

- F1. First visit, desktop
  - **Trigger:** Visitor opens the link.
  - **Steps:** Static character paints (LCP) → 3D head swaps in invisibly → head tracks the cursor → after 4s the bottom hint fades in → after 6–8s the first nudge flickers on → visitor clicks → power-on flash and boot line → character slides bottom-right while the left column types → pills appear.
  - **Covered by:** R3–R14, R35
- F2. Choosing a reply
  - **Trigger:** Visitor clicks or presses Enter on a pill.
  - **Steps:** Character nods → face talks while the reply types → progress bar advances → pills remain.
  - **Covered by:** R15, R16, R20, R23
- F3. Restart
  - **Trigger:** Restart button.
  - **Steps:** Left column clears → character slides back to centre and grows → screen returns to "[CLICK] TO START_" with LED 1 → nudge timer restarts.
  - **Covered by:** R18, R8

### Acceptance Examples

- AE1. **Covers R10.** Given State 1, when the visitor clicks "Let's connect", the panel opens and the hero stays in idle.
- AE2. **Covers R10, R29.** Given State 1 with focus on the page body, when the visitor presses Space, the transition starts and the page does not scroll.
- AE3. **Covers R8.** Given State 1 for 20s with no input, the screen has shown at least two different nudges, each with a flicker.
- AE4. **Covers R30.** Given reduced motion, when the visitor presses Enter, State 2 appears with all lines and pills present at once and the character already in its State 2 position.
- AE5. **Covers R31.** Given a browser with WebGL disabled, the visitor can start, choose each pill, and restart, and the screen overlay shows the correct content in each state.
- AE6. **Covers R32.** Given 390×844 touch, a horizontal drag across the stage turns the head and does not start; a tap starts.
- AE7. **Covers R18.** Given State 2 after two replies, when the visitor presses restart, State 1 returns with progress at zero.

### Success Criteria

- LCP under 2.5s on a mid-range laptop; no CLS from the 3D swap-in.
- Hero JavaScript within the budget agreed in Outstanding Questions.
- The 3D head and the photographed body read as one object in screenshots at both breakpoints (judged at the prototype checkpoint).

### Scope Boundaries

- Deferred: work, builds, about, resume and writing pages or dialogue states; real contact details; a GLB monitor model; device-tilt head tracking; analytics.
- Not adopted: Stitch's "Technical Canvas" system (grid, multiplayer cursors, floating tiles, metadata stamps); anything from Locomotive beyond the interaction concept.
- `dark.png` is not used in this hero; no screen text that is not Shiv's ships.

### Dependencies / Assumptions

- Only three assets exist, all supplied in chat rather than the repo: front (1254², matches `front.png`), three-quarter (1254², `three-quarter.png`) and turnaround (1774×887, `turnaround.png`). All are RGB with a baked light-grey background (about #D9D8DB, slightly cool), not transparent. `dark.png`, `front-blank.png`, `body.png` and the Lisa screenshots were not supplied.
- Without a transparent `body.png`, a seamless body plate needs either a cutout of `front.png` or a backdrop tuned to its baked grey. The prototype will try a cutout first.
- `front.png` has "[CLICK] TO START_" baked in, so the no-WebGL fallback needs `front-blank.png` (or a covered screen region) to avoid doubled text.
- `github.com/XS-Shiv/Portfolio` is empty (no default branch yet). A PR needs a base branch to exist.
- Vercel is not known to be connected to the repo; a preview link in the PR depends on that.

### Outstanding Questions

**Resolve Before Planning**

- Q1. Is the ~250KB gzip JS budget for the initial hero bundle only (3D chunk lazy and counted separately), or for everything including three.js? three + R3F + drei alone is roughly 180–220KB gzip before Next.js and Motion.
- Q2. Under reduced motion, does the 3D head still render (frozen facing forward, screen face still drawn), or does the hero swap to the static image as the brief states?
- Q3. What does the progress bar measure?
- Q4. How should the empty repo get a base branch for the PR?

**Deferred to Planning**

- Exact easing curves, type scale and spacing (frontend-design step).
- Procedural CRT vs GLB vs image-based fallback (prototype step).
- How touch-drag vs tap is thresholded.
- Copy for the four "coming soon" replies and the boot line (drafted in the content file for Shiv to edit).

### Sources / Research

- `reference/stitch/` (Stitch export): idle and conversation `screen.png`, `code.html`, and `DESIGN.md` ("Studio Minimalist Gallery"). Useful for column proportions and chrome placement; its design-system rules are not adopted.
