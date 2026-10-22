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

## Scrolling a page whose hero is a fixed stage

The hero used to be `position: fixed` with the whole document locked. Now the hero is an ordinary 100dvh block and `<html data-scroll>` decides whether the page may scroll ("on" only in State 2). The character keeps working because its box is laid out relative to the hero, which sits at the top of the document; the cursor's y has `scrollY` added before aiming the head; and the 3D pauses once the hero has scrolled out of view. The top bar is `position: fixed` and gets a frosted backing as soon as the page moves.

## Keep the 3D canvas no bigger than it needs to be

The canvas covers the character box plus margins (`CANVAS` in geometry.ts). Widening the sides to 0.34 for the scaled-up torso made it about 7 million pixels with shadows on a 1920 screen, enough to make the whole page, scrolling included, feel stuck on a modest GPU. With the torso back at its photographed size, 0.18 is enough. Headless tests here render WebGL in software, so they cannot judge scroll smoothness: every wheel listener on the page is passive, which is what matters on real hardware.
