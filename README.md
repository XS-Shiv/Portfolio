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

Everything the site says lives in [`src/hero/content.ts`](src/hero/content.ts): the status line, the State 2 introduction, the three cards, the sections below the hero, the closing contact block and the contact links. The copy has no full stops on purpose; where a line holds two sentences, `\n` puts them on two lines.

## How State 2 works

- Everything types in: title, subtitle, then the two serif lines; then the main button, restart and the three glass cards land together (about 2.5 seconds from the click).
- Once State 2 is up the page scrolls. Below the hero there is one section per card, then a contact block. "View my work", the cards and the scroll cue all scroll to their section. Restart goes back to the top and State 1, and locks scrolling again.
- About every 3 seconds one pronoun flips I -> we (my -> our, myself -> ourselves) with a glitch, then flips back. The word list is in [`src/hero/pronouns.ts`](src/hero/pronouns.ts), the timing in `timings.ts`.

## Music

The background track is `public/audio/the-mountain.mp3` ("The Mountain", 96 seconds, looped, re-encoded to 128 kbps). It starts with the visitor's first click into State 2, fading in, unless they have already turned the speaker off. Swap the file to change the music; the level is `MUSIC_LEVEL` in [`src/hero/sound.ts`](src/hero/sound.ts).

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
| `src/hero/sound.ts` | The background track (looped, faded through a gain node so it also fades on iOS), plus a soft power-on swell and a faint glitch crackle |
| `scripts/make_plates.py` | Rebuilds `public/character/body.*` and `front-blank.*` from `front.png` |

Details: [requirements](docs/plans/2026-10-20-1931-feat-crt-hero-plan.md), [visual direction](docs/design/hero-direction.md), [lessons learned](docs/learnings.md).

## Notes

- **First paint.** The page paints the photo of the character immediately, then loads the 3D head (about 240 KB gzipped) in the background and crossfades to it. The first-paint JavaScript is about 220 KB gzipped, most of which is the Next.js and React runtime itself.
- **Reduced motion.** With "reduce motion" on, the head holds still, the character jumps instead of sliding, and text appears at once.
- **First-paint photo.** The photo that paints before the 3D head (and the no-WebGL fallback) still shows the original silver monitor. On a normal laptop the slimmer dark grey 3D head replaces it within about a second.
- **Better assets.** A taller `body.png` (sweater from the jawline to mid-torso, transparent background) would let the sweater reach the bottom of tall phones without the stretched strip at the very bottom. Drop it in `public/character/` and rerun the script, or ask Claude to wire it in.
