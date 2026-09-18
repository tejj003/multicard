let detector = null
let busy = false
let crop = null
function bodyCandidates(result, offsetX = 0, offsetY = 0, scaleX = 1, scaleY = 1) {
  return result.landmarks.flatMap(landmarks => {
    const torso = [11, 12, 23, 24].map(index => landmarks[index])
    if (torso.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !(point.visibility >= .5))) return []
    const centre = offsetX + torso.reduce((total, point) => total + point.x, 0) / torso.length * scaleX
    const centreY = offsetY + torso.reduce((total, point) => total + point.y, 0) / torso.length * scaleY
    const width = (Math.max(...torso.map(point => point.x)) - Math.min(...torso.map(point => point.x))) * scaleX
    const height = (Math.max(...torso.map(point => point.y)) - Math.min(...torso.map(point => point.y))) * scaleY
    if (centre < 0 || centre > 1 || centreY < 0 || centreY > 1 || width <= 0 || height <= 0) return []
    return [{ centre, area: width * height }]
  })
}
self.onmessage = async event => {
  if (event.data.type === 'init') {
    try {
      importScripts('./tracking/vision_bundle.js')
      const files = await Vision.FilesetResolver.forVisionTasks(new URL('./tracking/wasm', self.location.href).href)
      detector = await Vision.PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./tracking/pose-landmarker-lite.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'IMAGE', numPoses: 3, minPoseDetectionConfidence: .5,
        minPosePresenceConfidence: .5, minTrackingConfidence: .5, outputSegmentationMasks: false,
      })
      self.postMessage({ type: 'ready' })
    } catch { self.postMessage({ type: 'error', message: 'The local body tracker could not load. Exit fullscreen to retry or use the gallery controls.' }) }
    return
  }
  const frame = event.data.frame
  if (!frame) return
  if (!detector || busy) { frame.close(); self.postMessage({ type: 'position', centre: null }); return }
  busy = true
  try {
    const result = detector.detect(frame)
    const bodies = bodyCandidates(result)
    const size = Math.min(frame.width, frame.height)
    if (!bodies.length && Math.max(frame.width, frame.height) / size > 1.2) {
      if (!crop || crop.width !== size) crop = new OffscreenCanvas(size, size)
      const context = crop.getContext('2d')
      for (const portion of [0, .5, 1]) {
        const originX = Math.round((frame.width - size) * portion)
        const originY = Math.round((frame.height - size) * portion)
        context.drawImage(frame, originX, originY, size, size, 0, 0, size, size)
        bodies.push(...bodyCandidates(detector.detect(crop), originX / frame.width, originY / frame.height, size / frame.width, size / frame.height))
      }
    }
    bodies.sort((first, second) => second.area - first.area)
    self.postMessage({ type: 'position', centre: bodies[0]?.centre ?? null })
  } catch { self.postMessage({ type: 'error', message: 'Body tracking stopped. Exit fullscreen to restart the camera.' }) }
  finally { frame.close(); busy = false }
}