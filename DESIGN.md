# MultiCard

## Exhibit Brief

An original series of six movement-responsive optical artworks for Tejj's exhibit. References establish a Bauhaus-adjacent vocabulary of repeated apertures, chromatic bands and overlapping circles. The goal is a clear angle-dependent transformation, not a generic parallax image or a copy of the photographed prints. The user subsequently requested three more perceptually ambitious illusions, preserving the first three.

The user selected physical viewer movement via webcam, with mouse/touch fallback, and requested installation/use of MengTo/Skills. The Three.js and 3D Retina Resolution skills were installed personally and read. Camera analysis is local and opt-in. On 2026-09-18, the user authorised a separate GitHub repository and GitHub Pages publication for MultiCard, requested Fold in the second position, and asked for an installation-wide statement in the README.

## Visual Direction

The actual artwork is the first screen. A neutral off-white surface, DM Sans/IBM Plex Mono and understated controls frame the experience without decorative cards or marketing copy. A small vermilion identity dot is the only UI accent; all saturated colour belongs to the artworks. The locally installed Figma design reference contributes neutral hierarchy and restrained border roles only, not branding or layout imitation.

1. Aperture: twelve dark recesses with coloured discs, fine simulated lens grooves, depth shading and independently phased colour changes.
2. Fold: a rhombille-style field of three-face tiles; angle-driven lighting reverses perceived relief while the lattice bends gently. Quantized cell identity prevents colour noise at floating-point boundaries; antialiasing derives from continuous field coordinates rather than discontinuous local cells.
3. Ribbon: a broad chromatic field with curving interleaved bands, subtle corrugation and a different arrangement at either end of the viewing range.
4. Orbit: overlapping coloured discs with subtractive-looking intersections, counter-rotation and a stable repeated grid.
5. Moiré: two concentric line layers with slightly different spacing and angle-dependent centres; interference creates evolving larger waveforms. Coral, mint and graphite make the two optical layers readable.
6. Vortex: logarithmically nested octagonal portals, a view-dependent vanishing point and twist, and continuous warm/cool surface lighting. The perspective illusion comes from receding scale, not a translated flat image.

The new pieces use the existing one-pass Three.js shader, locked high-definition fullscreen, camera angle, manual slider, keyboard and optional sweep. No camera/privacy changes or new dependencies. The selector is now six items with a two-row mobile layout; fullscreen still hides all UI. Automatic sweep starts off. No explicit flashing or strobing; retain a still/reduced-motion path for visually intense patterns. Compare screenshots and actual pixels at both angle extremes rather than promising an identical perceptual effect for every viewer.

Normal gallery grids use four columns/three rows in landscape and three columns/four rows in portrait, keeping artwork clear of title/footer regions. Fullscreen removes every control and caption and now fills the entire display with the pattern. Aperture and Orbit use aspect-responsive row/column counts with uniform world-to-screen scale; edge cells may be partially cropped as the pattern continues offscreen. Ribbon bypasses its normal bounding rectangle for continuous edge-to-edge bands. No stretching or empty outer framing at wide, square or tall ratios. Exiting restores the exact normal-view composition. Keyboard workflow, gloss and tracking remain intact. No sound, floating decoration, caption overlay or cursor trail.

## Interaction And Quality

- Smooth view changes use exponential damping, not fixed per-frame lerp.
- A detected face's first centre calibrates the origin; no identity is inferred. The largest face controls the piece. Missing detections hold the last state; manual fallback is available only in the gallery.
- Camera analysis runs in a worker, transfers only the current low-resolution bitmap and closes it after processing. No frames leave the machine.
- In the gallery, manual slider/keyboard and Auto mode override camera tracking explicitly; Centre view recalibrates it.
- Fullscreen movement is camera-only. Entry stops automatic sweep and freezes the current view before accepting further camera positions. Pointer/touch, slider/reset, Left/Right and Space cannot change the angle or interrupt capture while fullscreen. Camera-off, denied, disconnected or searching states hold still without manual fallback. Up/Down artwork selection, C camera stop and Escape exit remain available; no new visible fullscreen controls or automatic permission requests. Exit restores gallery controls without restarting sweep or capture.
- The scene has one shader pass, no post-processing chain and no external art textures. Normal gallery DPR uses adaptive Auto, capped at 2x. The latest fullscreen definition request overrides that: fullscreen locks `max(native DPR, 2)` without performance-driven reduction, even if the gallery previously dropped to 1x. GPU dimension limits may constrain it only with a visible actual-resolution notice. Preserve composition and CSS-space input. Shader derivatives handle edges without redundant multisampling; definition takes priority over frame rate in fullscreen.
- Reduced motion disables auto movement and removes damping for deliberate inputs. Geometry remains sharp.
- Test actual pixel differences and screenshots, not only data attributes. Confirm fonts and shader compilation, 1x/2x sizing, small-screen control bounds and camera cleanup.

## Review

The latest Aperture screenshot feedback requests many medium-sized forms in fullscreen rather than a few enlarged ones. Only fullscreen Aperture now uses five rows in landscape (world height 5.05) or four columns in portrait (world width 3.76), with cell spacing tightened to .94 x 1.01. Normal gallery size/spacing remains unchanged, as do Orbit and Ribbon. Fullscreen-only half-pixel derivative antialiasing, compact contact/cast shadows and slightly quieter grooves address the remaining soft outline without flattening the approved hemisphere shading, reflections or Fresnel light. Keep the existing full-definition resolution lock. Desktop/mobile captures and pixel row-count/coverage checks verify the density.

The latest fullscreen blur report was traced to the shared adaptive resolution cap and Ribbon's fixed-width band blend with per-groove edge offsets. Fullscreen now restores and holds full definition, and Ribbon uses physical-pixel-scale edge antialiasing plus filtered low-contrast grooves without offsetting boundaries. Tests cover slow-frame stability at 2x/3x, explicit GPU-limit reporting, full-bleed coverage and a maximum three-physical-pixel colour transition. The glossy Aperture material is untouched by this correction.

The user found the clarity pass too flat and asked to restore the earlier 3D feel with a glossier finish. Aperture now uses hemisphere normals, directional diffuse lighting, a broad soft reflection plus a smaller glossy highlight, and angle-dependent Fresnel edge light. Shaded cavity walls, illuminated bevels and offset contact shadows restore the recessed depth. Keep the crisp antialiased silhouettes, thin lens rims and low-contrast filtered grooves rather than restoring a blurry halo. View mapping, composition, tracking and the Ribbon/Orbit shaders stay unchanged. A pixel regression checks substantial light-to-dark curvature contrast and movement of the highlight relative to the lens centre.

Self-review of desktop and mobile captures led to brighter Aperture colours, capped distance-field derivatives to avoid false lines at grid boundaries, and taller portrait compositions. Remaining exhibition acceptance checks require the actual camera, display, ambient light and viewing distance. Do not describe automated/fake-camera tests as physical venue verification.