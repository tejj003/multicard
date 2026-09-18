# MultiCard / Art by Tejj

[Open the installation](https://tejj003.github.io/multicard/) · [Source on GitHub](https://github.com/tejj003/multicard)

## Installation Statement

MultiCard is an invitation to look again. Across six optical artworks, colour shifts, shapes rise and sink, and flat patterns seem to open into deep spaces. A small movement brings a different view.

The viewer becomes part of the work. Moving from side to side changes each image, revealing how easily our eyes can turn lines and light into depth. MultiCard explores a simple idea: what we see depends on where we stand.

**Art by Tejj**

## About The Installation

Six original movement-responsive optical artworks. Viewer movement changes a continuous viewing-angle parameter, revealing different colours, alignments, interference fields and depth cues. This is a digital interpretation of lenticular/optical art, not a simulation of a manufactured lens sheet.

## The Series

- **Aperture**: twelve recessed chambers with colour discs that shift in depth and hue.
- **Fold**: tessellated three-face tiles reverse their light/shadow hierarchy, changing the perceived relief from raised blocks to recessed facets. The geometry gently shears with viewing angle; tile colours stay tied to stable lattice coordinates.
- **Ribbon**: interleaved chromatic bands that bend and exchange positions across the viewing angle.
- **Orbit**: paired translucent discs that separate, overlap and rotate in counterpoint.
- **Moiré**: two offset concentric line fields create broad interference shapes that reorganise as the viewing angle changes. The line patterns are derivative-filtered to avoid unresolved high-frequency noise.
- **Vortex**: nested octagonal portals form a twisting corridor with a shifting vanishing point, receding scale and sculpted light. Lateral movement changes the twist and smoothly blends emerald/gold through the original teal/copper at centre to blue/coral. Colour follows the same camera, pointer, slider or optional sweep angle, with no separate timer; returning to centre restores the original palette. Geometry, lighting and fullscreen resolution are unchanged.

Fold is the second piece in the series. Aperture's dense glossy fullscreen treatment, Ribbon's sharp bands and Orbit's original material are retained. All six are available from the selector and Up/Down keyboard navigation; fullscreen stays edge-to-edge and locks full-definition resolution. On mobile, six selection buttons occupy two compact rows.

The artworks use geometric patterns rendered in real time, with colour and depth responding to the viewer's movement.

## Local Preview

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4174
```

Open http://127.0.0.1:4174/. This project lives in its own `art/multicard` folder with independent dependencies. Links and Akshara Ganesha are not modified. Local development and build commands do not publish anything.

For a production build:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

Use the preview server rather than a `file://` URL; the module worker and model assets require HTTP. The build is portable to a subdirectory (`base: './'`).

## Controls

- Select **Body** or **Face + Hands** beside the camera controls. Body is the default for exhibit displays; Face + Hands is intended for nearby laptop/webcam use. Selecting a mode while the camera is off never starts capture. Switching during capture stops the previous tracker and starts the selected mode, with fresh calibration. Mode selection is hidden in fullscreen.
- The info icon beside the artwork title opens a distinct artist's statement for the selected piece. Close it with Escape, the close icon or a click outside; focus returns to the info icon. Artwork keyboard shortcuts are inactive while the statement is open. Fullscreen remains artwork-only.
- Move the mouse horizontally, drag a finger, or use the viewing-angle slider.
- In the gallery, Left/Right arrow keys adjust angle when the artwork has focus, and Space starts/stops a slow automatic sweep. Up/Down select the previous/next piece in either mode.
- Fullscreen hides the interface and accepts only camera-driven movement. Enable camera and approve permission in the gallery before entering. Mouse/touch movement, the angle slider, Left/Right and Space cannot animate the fullscreen artwork. Entry stops auto sweep and any unfinished manual movement; without a tracked viewer, the image holds still. Escape exits, Up/Down change the selected piece, and C stops camera capture. Manual controls return after exiting; camera access never starts automatically.
- Fullscreen fills the display with the pattern at any aspect ratio. Aperture and Orbit add rows/columns along the longer dimension, with partial edge cells where the pattern continues beyond the screen. Ribbon extends edge-to-edge. Shapes retain their proportions; normal gallery framing returns on exit.
- Fullscreen Aperture uses a denser arrangement of medium-sized chambers: five rows on landscape screens and four columns on portrait screens, with additional cells along the other dimension. At 1440x900 this is nine columns by five rows, including partial edge cells. Silhouettes use tighter pixel antialiasing and contact shadows while keeping the curved glossy material. The normal twelve-chamber composition and the other artworks are unchanged.
- Centre view resets the angle and recalibrates the next detected camera position.
- Auto sweep is optional in the gallery, starts off, stops on page hiding or fullscreen entry, and does not run under reduced motion. Direct deliberate angle changes still work without interpolation under reduced motion.

## Viewer Tracking

Choose a tracking mode, then Enable camera and approve the browser permission. Wait for a **tracked / on-device** status before entering fullscreen. Both modes respond to sideways movement with mirrored mapping and smooth changes. Holding still holds the angle. The installation has one shared view, not independent interaction for each visitor.

**Body:** the first detected torso sets the centre. Shoulders and hips must be visible; moving the body sideways changes the view. Waving only a hand does not control this mode. When several bodies are visible, the largest confidently detected torso controls the artwork.

**Face + Hands:** move your head sideways, or raise one hand and move it sideways in the camera view. A detected hand takes priority, using its palm centre; when it leaves, control returns to the largest detected face. Each face/hand handoff starts from the current angle to avoid a jump. A hand works without a visible face, but keep one controlling hand in view for predictable movement. Centre view recalibrates the current input. This mode suits close webcam use, not distant crowds; it does not interpret named gestures or individual finger movements.

Body mode uses MediaPipe Pose Landmarker Lite in a dedicated worker. All four torso landmarks must be confidently visible. Face + Hands uses BlazeFace and Hand Landmarker in the same worker architecture, without loading the body model. Capture requests 1280x720 where supported; analysis frames preserve aspect ratio and are capped at 640 pixels wide, without upscaling lower-resolution cameras. Analysis is limited to 10 frames/second with one frame in flight. In Body mode, a full-image miss triggers up to three overlapping square scans with coordinates mapped back to the full camera view. This improves small-body detection in wide images but does not guarantee a particular distance or cover subjects that are too small, dark or obscured.

If the selected mode detects no body, face or hand, the last angle is held. Pointer/touch fallback is available only in the gallery, never in fullscreen. Exit fullscreen to switch modes or restart capture after stopping, denial or disconnection. Use Centre view in the gallery to recalibrate after moving the camera or changing viewer position. Face detection locates a face; it does not recognise or identify the person.

Only video is requested. No microphone, recording, identity data, storage, analytics, uploads, external recognition or paid service is used. The runtime, model, fonts and artwork are served locally. Frames are transferred to the worker and closed after analysis. Stop, page hiding, page exit, camera disconnection, timeout or graphics-context loss releases the stream and worker. Late permission responses are discarded and stopped.

Models are bundled locally: `public/tracking/pose-landmarker-lite.task` (~5.5MB), `public/tracking/blaze-face.tflite` (~225KB), and `public/tracking/hand-landmarker.task` (~7.5MB). Only the selected mode's models load after camera opt-in. The MediaPipe runtime is copied from the pinned npm dependency during `predev`/`prebuild`; its WebAssembly directory is ~36MB across alternatives, and only the compatible variant is loaded. There is no runtime model download from a third-party CDN. Model sources are listed in THIRD_PARTY.md.

## Exhibit Setup

1. Run the production preview on the exhibit machine and open it in current desktop Chrome with WebGL/hardware acceleration enabled.
2. Place a stable camera centrally on the display, aimed at the visitor area, with even light. Frame shoulders and hips, preferably the whole body, throughout the intended walking area. Avoid a face-only crop, strong backlighting or clothing blending into a dark background. Check that the browser uses the exhibit camera, not a laptop camera.
3. Select Body, enable the camera, stand at the intended centre position and select Centre view. Wait for **Body tracked / on-device** and check that a step left/right changes the angle. If it stays on **finding body**, check camera framing and lighting, then test closer to the camera; a large screen alone does not establish a usable camera range. For a laptop station, select Face + Hands and check head and single-hand movement separately.
4. Choose one of the six artworks and enter fullscreen. Use Up/Down to change pieces without UI. Keep the page visible; returning from another tab requires explicitly re-enabling capture.
5. Rehearse on the actual screen/projector, viewing distance and room lighting. Test both ends of the viewing range, long-running playback, camera disconnection, recovery and a manual-control fallback. Disable OS sleep using venue-approved settings.

This is a verified local exhibit prototype, not a claim of a completed on-site acceptance test. Physical viewer tracking, final projector/display colour and extended venue performance still need your review.

Moiré, Vortex and Fold are deliberately visually intense spatial patterns. There is no added time-driven flash or strobe, and auto sweep remains off by default. Offer visitors a still view and a way to step away; reduced-motion mode removes automatic sweeping. Perceived illusion strength varies between viewers and exhibit conditions.

## Rendering And Verification

Three.js WebGLRenderer uses an orthographic full-canvas shader pass with derivative-antialiased procedural geometry, simulated relief, interleaved stripe shading, paper grain and bounded view-dependent change. In the normal gallery, portrait displays recompose the grids to three columns/four rows and extend Ribbon vertically. Native fullscreen uses a separate full-bleed shader mode with isotropic scale based on the shorter screen dimension and aspect-responsive grid counts, removing the central fitted-artwork border. Fullscreen-change and resize events both update the mode and drawing buffer. No CSS transform substitutes for the optical image change.

Normal gallery mode uses Auto Retina, starting at `min(devicePixelRatio, 2)`. After 45 sustained slow rendered frames, it steps down by 0.5x to a minimum of 1x. Its actual scale appears in the footer and stays lowered until display density changes, avoiding repeated up/down oscillation.

Fullscreen instead locks full-definition output at `max(devicePixelRatio, 2)`: at least two drawing-buffer pixels per CSS pixel, and native 3x on a 3x display. It ignores the gallery's adaptive cap and does not reduce resolution because of slow frames. Resize, fullscreen entry/exit and display-density changes synchronize the canvas, WebGL buffer and shader uniforms. GPU maximum texture, renderbuffer and viewport dimensions cap allocations; a visible notice reports any resulting limit and actual buffer dimensions. Fullscreen therefore prioritises sharpness over speed and can run slower on software-rendered or low-powered exhibit hardware. It is not an unconditional frame-rate or unlimited-resolution guarantee.

Ribbon boundaries use pixel-scale derivative antialiasing rather than a fixed-width colour fade. Fine lens grooves are filtered and no longer offset the colour edges, avoiding the previous comb-like edge jitter. Aperture's glossy lighting and the full-bleed composition are preserved.

Layout is CSS-sized and pointer input is normalized in CSS coordinates. Static scenes render only when input/size/piece changes; hidden tabs do not render. Context loss is reported, releases camera capture, and restoration redraws the current artwork. Graphics resources and listeners have a disposal path.

In the earlier local automated-browser stress check at 1440x1000 CSS pixels, 1x rendering was approximately 59fps; a software-rendered 2x run was initially around 21fps and recovered to approximately 60fps after adapting to 1x. That fallback now applies only to normal gallery mode, not fullscreen. These are historical local measurements, not a guarantee for venue hardware. Edges use shader derivatives rather than redundant full-buffer multisampling.

```sh
npx playwright install chromium webkit
npm run build
npm test
```

Tests cover real canvas pixels, distinct left/right states for all six pieces, desktop/mobile/short layouts, keyboard/pointer/auto modes, reduced motion, Retina 1x/2x, accessibility, fullscreen, camera permission/cancellation/lifecycle and calibrated angle mapping. Simulated camera-position input verifies that fullscreen remains camera-only for all six artworks. Body-worker tests cover torso selection without requiring face landmarks, crop coordinate mapping, invalid detections, empty results and frame cleanup. Native fullscreen is verified in Chromium, not claimed for WebKit. The real body model was also checked locally with a public sample at different image sizes and positions, including empty frames. These image tests are not measurements of physical viewing distance. No physical webcam was accessed during development.

Fullscreen edge-coverage tests inspect all four edge strips for all six artworks at landscape, ultrawide, square, portrait and extra-tall aspect ratios, and verify identical gallery pixels after exiting. Keyboard tests wrap in both directions through the complete collection. Aperture gloss tests measure curvature contrast and angle-responsive highlight position.

Fullscreen definition tests compare actual canvas and WebGL buffer dimensions at device densities 1x/2x/3x, force sustained slow-frame timing to confirm no resolution downgrade, and verify visible reporting of a simulated GPU limit. A Ribbon boundary test limits the substantial colour transition to three physical pixels. A 1440x1000 CSS fullscreen capture is rendered at 2880x2000 buffer pixels on a standard-density display.