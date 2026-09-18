# Sources And Third-Party Components

- **Three.js**: https://threejs.org/ (MIT), installed via npm; see its package licence.
- **Lucide**: https://lucide.dev/ (ISC), used for UI controls.
- **DM Sans** and **IBM Plex Mono**: self-hosted through Fontsource, under their font licences distributed with the packages.
- **MediaPipe Tasks Vision**: https://github.com/google-ai-edge/mediapipe (Apache-2.0). The runtime is copied from the pinned npm package; its model does not identify people.
- **Pose Landmarker Lite model**, float16, version 1: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task. Official model documentation: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker. Bundled locally for opt-in body tracking; replaces the former short-range face model.
- **Meng To skills**: https://github.com/MengTo/Skills (MIT). Installed `threejs` and `3d-retina-resolution` in the user's personal skill library. They guide implementation, not runtime code loading.
- **Test-only portrait**: https://storage.googleapis.com/mediapipe-assets/portrait.jpg, used locally to verify model position output. Kept in ignored artifacts, not displayed or shipped with the artwork.
- **Test-only body image**: https://storage.googleapis.com/mediapipe-assets/pose.jpg, used locally to check the actual pose model at different image sizes and positions. Kept in ignored artifacts, not displayed or shipped with the artwork.

The user's reference screenshots are not copied into this project or redistributed. All six displayed artworks are original procedural GLSL compositions, including the moiré interference, nested portal and reversible tile-relief additions. No generated recording or customer data is included.