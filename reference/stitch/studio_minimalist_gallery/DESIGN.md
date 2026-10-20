---
name: Studio Minimalist Gallery
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e2'
  on-secondary-container: '#646464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1d1b1a'
  on-tertiary-container: '#868381'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e6e1df'
  tertiary-fixed-dim: '#cac6c3'
  on-tertiary-fixed: '#1d1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.02em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.02em
  terminal-display:
    fontFamily: Space Mono
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.02em
  terminal-sm:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-meta:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: -0.02em
spacing:
  gutter: 2rem
  gutter-mobile: 1rem
  margin: 4rem
  margin-mobile: 1.5rem
  space-xs: 0.5rem
  space-sm: 1rem
  space-md: 2rem
  space-lg: 4rem
  space-xl: 8rem
---

## Brand & Style

This design system establishes a rarefied, contemplative digital environment inspired by high-end contemporary art institutions, white-cube galleries, and archival monographs. The design rejects the visual noise, saturated cues, and synthetic decoration common to modern software. It treats the screen as an illuminated architectural room where objects, typography, and images command undisturbed focus.

The emotional signature is austere, serene, deliberate, and uncompromising. By eliminating containers, borders, bold emphasis, and artificial dropshadows, the interface relies entirely on spatial tension, disciplined scale ratios, and the physical presence of negative space. Visual hierarchy is achieved strictly through position, proportion, and radical typographic restraint.

## Colors

The environment is anchored by a seamless, custom atmospheric gradient: a subtle radial sweep that transitions from an illuminated center (`#EDEDED`) to a subdued perimeter edge (`#BDBDBD`). This simulates controlled studio lighting cast against a gallery wall, anchoring the interface without relying on hard edges or distinct container planes.

- **Primary (`#111111`)**: Deep charcoal black reserved for primary typographic markers, critical labels, and direct interactions.
- **Secondary (`#767676`)**: Muted concrete neutral for secondary index data, metadata indices, system pagination, and sub-labels.
- **Neutral (`#EDEDED`)**: The luminous center core of the canvas backdrop.

Surfaces and backgrounds must never display sharp dividing lines or saturated status colors. Warnings, active statuses, and confirmations are indicated via spatial shifts, minimalist typographic notations, or monospace terminal readouts.

## Typography

The typography operates under an uncompromising rule: all primary content and navigation must remain strictly set at **Inter regular (400 weight)** with uniform tight tracking (`-0.02em`). Bold weights, italics, and heavy stylistic variations are strictly prohibited. 

Visual priority must be created solely through font scale, line spacing, and composition. The monospaced family serves as a secondary, structural counterpoint—mimicking gallery accession stamps, room plaques, vitrine sensor data, and exhibition coordinates. All monospaced readouts should feel like calibrated instrument stamps embedded quietly within the studio space.

## Layout & Spacing

The layout is governed by expansive margins, deliberate breathing room, and asymmetrical structural anchors. It avoids dense, multi-column utilitarian dashboards in favor of an open exhibition grid.

- **Canvas Alignment**: Content breathes within generous margins (`4rem` desktop, scaling to `1.5rem` on mobile screens).
- **Structural Rhythm**: Generous vertical intervals (`space-lg` and `space-xl`) separate works and textual statements. Large gaps are intentional; white space is treated as physical surface area rather than empty space to be filled.
- **Responsive Handling**:
  - **Desktop (1024px and above)**: Asymmetrical, wide-offset arrangements with generous dead space to allow images and catalog text to float autonomously.
  - **Tablet (768px – 1023px)**: Fluid alignments preserving the minimum margin of `3rem` and proportional vertical spacing.
  - **Mobile (Below 768px)**: Single-column linear pacing. Space shifts downward slightly, but retains deliberate, calm intervals between exhibition objects.

## Elevation & Depth

This design system is completely devoid of dropshadows, glassmorphic blurs, artificial layering, and container borders. 

Depth is purely optical, generated by:
1. **The Radial Studio Gradient**: The vignette sweeping from `#EDEDED` at the center to `#BDBDBD` at the canvas edge naturally recedes the extremities and elevates central content under virtual studio illumination.
2. **Foreground Floating**: Artworks, text, and imagery sit directly on this canvas without bounding boxes, dividers, or elevated cards.
3. **Typographic Scale & Tonality**: Distinctions between background planes, primary works, and auxiliary metadata are established by shifts from high-contrast `#111111` to ambient `#767676`.

## Shapes

The geometry of the interface is unyielding, planar, and pure: `roundedness` is set to `0` (Sharp). 

Buttons, media assets, selections, indicators, and focus states retain razor-sharp right angles. The presence of pills, curved capsules, or rounded corners is strictly avoided, honoring the pristine architectural lines of archival prints, framed works, and industrial gallery vitrines.

## Components

### Buttons
- Stripped of borders, rounded corners, and fill colors.
- Interactive actions present as pristine text links or solid monochrome rectangular blocks (`#111111` fill with `#EDEDED` text) with zero border radius.
- States are signaled by subtle opacity shifts (100% to 60%) or an accompanying monospaced index mark (`[+]`, `[→]`).

### Cards & Grouping
- **Cards do not exist.** Content is never packaged into enclosed surfaces, bordered boxes, or drop-shadow panels.
- Content groups are delineated purely through vertical space, baseline relationships, and spatial offset. Images hang freely against the vignette background.

### Lists & Tables
- Zero horizontal or vertical dividing lines.
- List items are arranged in sparse, open baselines. Index numbering uses monospaced terminal text (`01`, `02`, `03`) set in `#767676`, followed by title and artist descriptions in regular 400 weight with tight tracking.

### Inputs & Form Fields
- No bounding input boxes or encapsulating frames.
- Form inputs exist as naked typography floating on the background, underpinned only by spatial margins or a subtle focus marker. Placeholders use `#767676`. Focus states are conveyed via an active terminal-style cursor or a discreet monospaced indicator.

### Checkboxes & Radios
- Replaced by raw typographic toggles or sharp monospaced brackets: `[ ]` for unselected, `[x]` for selected.
- No rounded controls or native OS form elements are displayed.

### Chips & Tags
- No filled pills or bordered chips. Tags appear as raw metadata labels in monospaced terminal typography, separated by whitespace or catalog slashes (e.g., `INDEX / 04`).

### Exhibition Displays & Media
- Photographic imagery and artworks are displayed edge-to-edge within their natural aspect ratios with no decorative framing, matting shadows, or bevels. Captions sit quietly beneath or to the side, set in regular weight with disciplined margins.