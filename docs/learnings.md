# Lessons from building the CRT hero

Things that were not obvious and are not visible in the final code.

## One coordinate system for three renderers

The 3D head, the 2D body plate and the photo fallback all live in one square "character box" measured in pixels of the 1254×1254 source photo (`src/hero/character/geometry.ts`). The 3D camera is set so that the world plane z=0 maps exactly onto that box (`VIEW_H`, `CAM_Z` in `Crt3D.tsx`), with one world unit = 100 source pixels. That is why the 3D cables can end exactly where the photographed cables continue on the sweater, and why the photo-to-3D crossfade does not jump.

## The first paint is laid out in CSS, not JS

The State 1 position of the character is pure CSS (`.character` in `globals.css`, using `min()` over `vw`/`dvh`). The JS only adds a transform offset for State 2. Measuring in JS first would shift the character on hydration and hurt CLS. `layout.ts` mirrors the CSS numbers for the State 2 targets.

## The recessed screen poked through

The curved screen plane sits a few hundredths of a unit behind the bezel. With a bulge, its corners were further back than its centre, and they ended up behind the front plate of the casing, which showed through as grey triangles in the corners. It looked like a glass reflection and took a colour-coded debug render (screen red, bezel green, frame blue) to see. Keep the screen's corner depth in front of the casing's front face.

## Studio environment vs dark plastic

`RoomEnvironment` has very bright emissive panels. Any dark material with some metalness or low roughness (the bezel, the glass) turned light grey when the head tilted up and faced the ceiling panel. Dark parts get low metalness, higher roughness and a reduced `envMapIntensity`; the separate glass layer was dropped and the screen's sheen is drawn in the canvas instead.

## Matching the photo's turn

The photo shows a lot of the monitor's side. That comes partly from yaw (the rest pose is 22°) and partly from the photographer's wider lens, so the 3D camera uses a 28° field of view rather than a telephoto-like 20°.

## Cutting the body plate

A luminance key works because everything on the body is dark and the backdrop is light. A morphological opening (radius 9 px) removes the thin cables that hang over the backdrop, so they never detach from a turning head. The neck under the monitor is synthesised from the plug-free half of the real neck, mirrored. The photo's own hole-filled cutout (for the fallback) traps backdrop between cables, so the body plate re-applies the darkness key on top of it.

## Testing without a GPU

Headless Chromium here renders WebGL in software at 2–3 fps, which also slows `setTimeout`-driven typing. Tests wait for elements (`.pill`) rather than fixed delays.

## The I <-> we flip

The flip swaps one pronoun at a time, never a whole sentence, and only after everything has appeared, so it reads as the machine slipping rather than as a typo. The swapped word is wrapped in a `nowrap` span so the line never reflows while it glitches, and on the dark cards the colour-split copies use `screen` blending instead of `multiply`, or they vanish into the dark background.

## Slimming the monitor

The casing depths in `Crt3D.tsx` were tuned for a 5.0-deep monitor. Jacks, vents and the back-panel cables are placed in absolute depth, so they are scaled by `DS = M.d / 5`; without that, cables float behind a thinner casing.

## Making the head look imposing

Height alone did not do it: the monitor was already taller than in the reference. What reads as "grand" is the frame. In State 2 the torso group scales up (1.38x) while the head's pivot group scales by the inverse, so the shoulders get broad and the head keeps its size. The pivot is also re-positioned so it rides on the collar rather than drifting up with the torso, or a long stretch of neck appears. The cables need no change: their ends live in torso space and their starts in head space. Add a three-quarter turn toward the text, a few degrees of tilt and a slight downward look, and keep the cursor-follow small around that pose. The eyes on the screen look relative to the pose (`yawBias`), not to the front, or they stare off to one side.

## Scaling the torso without breaking the head

Scaling the torso group scales everything inside it, including depth. Three things went wrong at once: the neck got 1.38x thicker and longer and poked out through the thin monitor's glass when the head turned; the sweater plate moved 1.38x further forward, in front of the head's lower corner; and the cable ends followed it. The fix keeps each in real units inside the scaled group: the neck's radius and reach are divided by the torso scale and it now ends just inside the bottom of the casing; the plate's and cable ends' depth is divided by it too; and the head comes forward a little as the torso grows, while the neck's top stays back behind the collar. Check every change here with the head turned hard toward the text and looking up, and mid-transition.

## The neck has to look like it is in shadow

A short, evenly lit, bright neck reads as a flat block. The photo's neck is a warm, fairly dark tone (about rgb 110, 72, 54) that falls into the monitor's shadow toward the top. The 3D neck's base colour and painted-in vertex shading match that, with darker sides so it reads as round. If the neck's length changes, re-check the shading range (`smooth(...)` on `t`), since it is measured along the neck.

## Keep the 3D canvas no bigger than it needs to be

The canvas covers the character box plus margins (`CANVAS` in geometry.ts). Widening the sides to 0.34 for the scaled-up torso made it about 7 million pixels with shadows on a 1920 screen, enough to make the whole page, scrolling included, feel stuck on a modest GPU. With the torso back at its photographed size, 0.18 is enough. Headless tests here render WebGL in software, so they cannot judge scroll smoothness: every wheel listener on the page is passive, which is what matters on real hardware.

## Springs, and why these numbers

The head is a second-order spring per axis, integrated in 1/240 s sub-steps of the real frame time (`springs.ts`), so it feels the same at any frame rate. ω = 18 rad/s with ζ = 0.75 reaches 90% of a step in about 155 ms with a 3% overshoot: fast enough to read as "looking at you", and the overshoot is what makes a fast flick snap. The old version was a single exponential with λ = 2.2 (about 450 ms to 63%), which is why it felt like a sticker drifting. A critically damped follower lags a moving target by about 2/ω, which sets the layers: the neck (ω = 50, ~40 ms) chases the head, the torso (ω = 13, ~150 ms) chases a quarter of it. That overlap, not the range, is most of what makes it feel alive. Pointer data stays in a mutable object; React never re-renders on pointermove.

The cursor is turned into angles by projecting it onto a plane in front of the head (`atan2(dx, 0.55·viewport height)`), multiplied by a gain of 1.25 and passed through `max·tanh(x/max)`. Near the head that is almost linear with a slope above 1, so small moves show; at the edges it eases into the limit instead of stopping.

## The 2.5D torso

A flat plate turning in 3D just slides. The sweater stays facing the camera and its vertex shader moves each vertex as if the photo were wrapped round an ellipse (half-width 5.2, half-depth 2.3 units) turned by the torso's yaw, minus the centre's own shift, which the torso group provides by turning round an axis 2.3 units behind the sweater. Two details matter. The collar band moves by the neck's depth, not the chest's, or the neck slides out of its hole in the collar. And `plateWarp()` in Crt3D repeats the shader's maths so the collar plugs ride on the same surface. A 3D torso would need a knit GLB; the 2.5D plate keeps the photo's real knit.

## Cords as ropes

Each cord is a verlet chain of 22 points with a fixed length (slack × the plugs' distance at rest), 20 length passes per 1/120 s step, gravity 140 units/s². The two points at each end are pinned along the plug's axis, so a cord always leaves its boot straight. Three things went wrong before it looked right: the tube's triangles were wound inward, so cords looked hollow and grey and the neck striped (`Tube` winds counter-clockwise from outside); a sharp-cornered collision box made cords kink round invisible corners (it is now a rounded box, by distance field); and a hard "stay in front of the sweater below the collar" rule made cords jump forward at the rim (the minimum depth now eases in over 0.6 units). Plug every cord on the side it comes from, or it wraps round the neck.

## The neck seam

The seam had two causes. The tube met the flat underside of the monitor with nothing between them, so at any angle there was a hard edge, and the photo's neck hole in the collar showed the backdrop whenever the neck bent away from it. The neck now goes up into a rubber grommet that belongs to the head (so it turns with it), and a half-cylinder of dark knit sits behind the neck as the inside of the turtleneck. The neck also carries 35% of the head's bend, so the head rides on an arc rather than pivoting on one point.

## Voice and loudness

Web Speech audio cannot be routed through WebAudio, so its loudness cannot be measured. The clips are pre-generated (Kokoro offline TTS), played as buffers through an AnalyserNode in front of the master gain, and the RMS of each frame drives a CSS variable `--vox` on the hero (one style write per change, no React) and the face. The buttons use the separate `scale` property, which composes with the transform Motion writes. Kokoro gives no word timings, so each sentence is synthesised on its own (exact sentence boundaries) and words within it are timed by syllable weight. A clip is only used when its stored text matches the line exactly; otherwise the browser voice reads it.

## Keeping three.js out of the first paint

`Hero` imported one tiny helper from a file that also imported three.js, which pulled 100 KB into the first-paint bundle. The plain-number helpers now live in `springs.ts`. Check `first-load` after any import into the page from `character/`.

## Focus after an animated swap

With `AnimatePresence mode="wait"`, a new element mounts only after the old one has left, and on a slow device a timeout is not enough. Focus is moved from the element's ref callback when it mounts.

## Coming back to a settled State 2

Leaving the hero for /work writes a one-use mark to sessionStorage (`src/hero/session.ts`). When the hero mounts and finds it, a `SETTLE` event takes the state machine straight from idle to a finished conversation, and for the first ~120 ms nothing animates in (the character jumps to its State 2 box, the buttons and cards appear without their reveal). The mark is read in a layout effect, so on a client-side back navigation no State 1 frame is ever painted; it is removed on read, so a reload starts at State 1 again. The CRT exit animates only transform and opacity, and navigation runs on a timer rather than on the animation's finish: a full-screen brightness filter, or waiting for `finished`, stretched a 420 ms exit to several seconds while the 3D was rendering.

## Work tabs are computed, not configured

`visibleTabs()` decides which tabs exist from the items in hand (at least two published, Featured at least one, Playground behind a flag), and the same function runs on the server and in the browser, so the dev-only "Show drafts" toggle recomputes tabs over drafts too. The tab and the Design filter live in the URL; tab clicks use `history.pushState`, which Next's `useSearchParams` follows, so back/forward works without a server round trip. Because reading the URL makes a static page bail out to client rendering, the listing is wrapped in Suspense with a prerendered fallback for the default tab.

## Keeping three.js and the voice out of /work

The Work pages import nothing from the hero except plain data (`content.ts`, `timings.ts`) and the sound preference, which moved to `src/site/soundPref.ts` so the toggle never pulls in the audio code. Check with the network tab: no chunk on /work should contain `WebGLRenderer`, and nothing under /voice or /audio is requested. One side effect: `motion` is now shared by two routes, so the bundler moved it into shared chunks, which adds about 9 KB gzipped to the hero's first load even though the hero's own code did not grow.
