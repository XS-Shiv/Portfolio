# Hero visual direction

Companion to `docs/plans/2026-10-20-1931-feat-crt-hero-plan.md`. The brief fixes the backdrop, the two typefaces and the calm gallery tone. This file sets the numbers.

## Subject, audience, job

- Subject: Shiv, an AI-first PM who builds, played by a CRT-headed character who talks through his screen.
- Audience: recruiters and hiring managers, often on the page for under a minute.
- Job: make them click the screen, then hand them four clear next steps.

## Principles

1. The character is the only loud thing. Type, chrome and controls stay small, grey or black, and still.
2. The one colour is the LED blue. It appears only where attention is: the lit LED, the screen glow, keyboard focus and "sound on". Nothing else on the page is coloured.
3. Motion answers the visitor. The only unprompted motion is the head's lag, the breathing and the screen nudges. Everything else happens because someone clicked, typed or moved.
4. Type does the talking. The current line is set big enough to read as speech, not as a headline above content.

## Palette

| Token | Hex | Use |
|---|---|---|
| `studio-core` | #EDEDED | Backdrop centre |
| `studio-edge` | #BDBDBD | Backdrop edge |
| `ink` | #000000 | Primary text, solid pill, restart button, connect panel |
| `ink-muted` | #4A4A4A | Inactive nav, bottom hint, sound label. 5.1:1 on the darkest backdrop the text sits on (#C5C5C5) |
| `ink-faded` | #5E5E5E | Previous dialogue line. 5.1:1 on #E3E3E3 |
| `led` | #2F6BFF | LED, focus ring (3.6:1 on the backdrop, above the 3:1 non-text minimum), sound-on dot |
| `paper` | #EDEDED | Text on black (pill, panel) |

The backdrop is `radial-gradient(ellipse 75% 85% at 50% 48%, #EDEDED 0%, #DCDCDC 45%, #BDBDBD 100%)`. The 45% stop holds a flat zone around the character, because the photographed plate's own background is #D9D8DB and slightly cool. The prototype tunes this stop until the plate edge disappears.

## Type

Inter Tight 400 only, for everything outside the monitor. VT323 only on the screen canvas. The scale is a perfect fourth (1.333) from 16px.

| Role | Desktop 1440 | Mobile 390 | Leading | Tracking |
|---|---|---|---|---|
| Current line | 50px (clamp 30–56) | 28px | 1.06 | -0.03em |
| Previous line | 21px | 16px | 1.3 | -0.01em |
| Pill label | 16px | 16px | 1 | -0.01em |
| Chrome (name, Let's connect) | 18px | 16px | 1 | -0.015em |
| Nav | 15px | in menu, 28px | 1 | -0.01em |
| Hint, panel meta | 13px | 13px | 1.3 | 0 |
| Screen text (VT323, canvas) | 7% of screen height | same | 1 | 0.02em |

Sentence case throughout. No all-caps labels outside the monitor; the screen's own "[CLICK] TO START_" is part of the CRT and stays as written.

Measure: the current line runs about 22–26 characters per line on desktop (about 5 lines) and about 20 on mobile. That is short on purpose, so it reads like spoken words.

## Spacing and layout

8px base unit. Edge inset is 40px on desktop and 20px on mobile, used by all four corners.

```
Desktop, State 1                         Desktop, State 2
+-------------------------------------+  +-------------------------------------+
|Shivanand Shukla       Let's connect |  |Shivanand Shukla  Work·Builds·About·Writing  Let's connect|
|                                     |  |                                     |
|            .-----------.            |  |  Oh, hey. You found me.             |
|            | [CLICK]_  |  psst…     |  |  I'm Shiv. A product                |
|            '-----------'            |  |  manager who builds    .-------.    |
|              /       \              |  |  what he plans, with   | ^  ^  |    |
|           ( sweater )               |  |  AI. What do you...    '-------'    |
|   move your cursor · click anywhere |  |  (Show me your work →)   /   \      |
+-------------------------------------+  |  (What have you...)    (sweater)    |
                                         |  (o)                           [♪]  |
                                         |======-------------------------------|
                                         +-------------------------------------+
```

- State 1: the character is centred. Monitor centre sits at 46% of viewport height, and the sweater is cropped by the bottom edge. The character's height is about 108% of the viewport.
- State 2: the character moves to the right and its scale drops to 0.82, so the monitor centre sits at about x 70%, y 52%. The left column starts at x = max(40px, 7vw), about 45% wide, centred vertically, left-aligned.
- Column spacing: 24px from the previous line to the current line, then 40px to the pills, then 10px between pills.
- Pills: 48px tall, 0 22px padding, fully rounded, 1px ink outline. The first is filled ink with paper text. Pills are as wide as their content, not stretched.
- Restart: a 52px ink circle, bottom-left at the inset. Sound toggle: a 44×92 vertical capsule, bottom-right at the inset, with the on and muted icons stacked. Progress: a 3px ink bar on the bottom edge, full bleed.
- Connect panel: an ink block with 16px radius and paper text, opening below "Let's connect". No shadow; contrast alone separates it from the backdrop.
- Mobile, State 2: the character sits top-right at 45% of viewport width, with the monitor centre at about y 24%. The conversation starts at 44% of the height. The current line is 28px and the pills stay 48px tall to give touch targets. The nav collapses into a two-line menu icon to the left of "Let's connect".

## Motion

Named curves; durations live in the timing constants file.

| Name | Value | Used for |
|---|---|---|
| `settle` | cubic-bezier(0.76, 0, 0.24, 1), 800ms | Character slide, scale and turn to State 2 (reversed for restart, 700ms) |
| `arrive` | cubic-bezier(0.22, 1, 0.36, 1), 260ms | Pills, hints and the panel appearing (opacity plus a 6px rise) |
| `leave` | ease-in, 180ms | Column clearing on restart; hints fading out |
| Head follow | exponential damping, λ = 4 (about 250ms to 63%) | Yaw ±25°, pitch ±15° toward the pointer |
| Breathing | sine, 4.8s period, 1.5px | Body plate and head together |

Boot timeline after a start: the scan-line power-on runs 0–280ms, the boot line shows 280–700ms, the character slide starts at 200ms and runs 800ms, and the previous line starts typing at 700ms.

Typing runs at 26ms per character, with 160ms extra after `. , ? !` and 350ms between the previous and current lines. Pills arrive 80ms apart once the current line is done.

The screen: a nudge flicker runs 160ms (three brightness steps). Blinks come at random 2.8–5.2s intervals and last 120ms. Talking alternates mouth frames every 90ms while text types. A nod is +8° pitch and back over 420ms.

Reduced motion keeps the frozen 3D head and the drawn face. All of the above becomes instant except the blink, which is an 120ms state change rather than motion.

## Review against the brief and the usual defaults

- The brief asks for pills with "→", middot-separated nav and black-and-grey type. These match common defaults, but the brief names them, so they stay as written.
- Changed: my first pass used tinted near-black (#111) for ink. Pure #000 matches the photographed CRT bezel and the brief's "solid black" pill.
- Changed: a mono face for the hint and nav meta was considered and dropped. The brief keeps VT323 on the monitor, and the hint reads better in Inter Tight at 13px.
- Changed: the connect panel was first sketched as a white card with a shadow. Now it is a black block, so the page uses only two surface tones, the backdrop and ink.
- Kept as the one bold choice: the LED blue as the only colour, which also does the job of the focus ring.
