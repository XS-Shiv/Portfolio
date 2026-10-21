# Portfolio

Personal portfolio of Shivanand Shukla. The hero is a CRT-headed character that follows your cursor, boots up when you click, and talks to you through his screen.

![State 1](docs/screenshots/desktop-idle.jpg)
![State 2](docs/screenshots/desktop-conversation.jpg)

## Deploy on Vercel (one time)

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import the `XS-Shiv/Portfolio` repository. Vercel detects Next.js; keep every default.
3. Click **Deploy**. Every push to `main` then redeploys the live site, and every other branch gets its own preview link.

No environment variables are needed.

## Change the words

Everything the site says lives in [`src/hero/content.ts`](src/hero/content.ts): the status line, the contact links, the screen text and the State 2 introduction (title, subtitle, body lines, the main button and the three cards). All of it types in like a typewriter: the title, subtitle and body one after another, then the three cards together. The copy has no full stops on purpose.

For now the "View my work" button and the three cards do nothing when clicked. They are real buttons, so wiring them to sections later only needs an `onClick` in `Hero.tsx`.

### The "I <-> we" flip

Once State 2 has settled, every 6 to 11 seconds one pronoun in the visible text flips into its opposite (I to we, my to our, we to I) with a glitch, then flips back. It blurs who is talking, the human or the machine. The word list is in [`src/hero/pronouns.ts`](src/hero/pronouns.ts) and the timing in `timings.ts`.

## Change the pictures on the screen

Before anyone clicks, the screen flashes pictures for a few seconds, broadcast in CRT colours with glitches. They are listed in `screen.images` in `src/hero/content.ts`. Put your own photos in `public/screen/` and add their paths there; `pixel:heart`, `pixel:bulb`, `pixel:spark` and `pixel:hi` are built in.

## Change the timing

Every duration (nudges, typing speed, the glitch, the slide, blinks, the head's lag) and how much the body follows the head is a named constant in [`src/hero/timings.ts`](src/hero/timings.ts).

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build, what Vercel runs
```

Add `?nowebgl` to the URL to see the photo fallback that browsers without WebGL get.

## How it fits together

| Path | What it does |
|---|---|
| `src/hero/Hero.tsx` | The page: state machine wiring, conversation column, chrome, controls |
| `src/hero/machine.ts` | Explicit states: `idle → booting → conversation`, plus `restarting` |
| `src/hero/pronouns.ts` | The I <-> we flip: which words swap and how |
| `src/hero/screen/engine.ts` | Draws the monitor screen live on a canvas: stars, text, caret, flicker, power-on, the face |
| `src/hero/character/Character.tsx` | The one `<Character />` interface: photo first, then the 3D head |
| `src/hero/character/Crt3D.tsx` | The procedural 3D monitor (React Three Fiber). Swap for a GLB here |
| `src/hero/sound.ts` | A soft, slow instrumental synthesised live (electric-piano arpeggio, round bass, faint pad, a few melody notes, soft reverb), plus a soft power-on swell and a faint glitch crackle. Off until the top-bar speaker is pressed |
| `scripts/make_plates.py` | Rebuilds `public/character/body.*` and `front-blank.*` from `front.png` |

Details: [requirements](docs/plans/2026-10-20-1931-feat-crt-hero-plan.md), [visual direction](docs/design/hero-direction.md), [lessons learned](docs/learnings.md).

## Notes

- **First paint.** The page paints the photo of the character immediately, then loads the 3D head (about 240 KB gzipped) in the background and crossfades to it. The first-paint JavaScript is about 220 KB gzipped, most of which is the Next.js and React runtime itself.
- **Reduced motion.** With "reduce motion" on, the head holds still, the character jumps instead of sliding, and text appears at once.
- **First-paint photo.** The photo that paints before the 3D head (and the no-WebGL fallback) still shows the original silver monitor. On a normal laptop the slimmer dark grey 3D head replaces it within about a second.
- **Better assets.** A taller `body.png` (sweater from the jawline to mid-torso, transparent background) would let the sweater reach the bottom of tall phones without the stretched strip at the very bottom. Drop it in `public/character/` and rerun the script, or ask Claude to wire it in.
