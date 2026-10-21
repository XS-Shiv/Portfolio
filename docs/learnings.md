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
