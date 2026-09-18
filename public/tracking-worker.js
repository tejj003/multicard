let detector = null
let busy = false
self.onmessage = async event => {
  if (event.data.type === 'init') {
    try {
      importScripts('./tracking/vision_bundle.js')
      const files = await Vision.FilesetResolver.forVisionTasks(new URL('./tracking/wasm', self.location.href).href)
      detector = await Vision.FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./tracking/blaze-face.tflite', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: .6,
      })
      self.postMessage({ type: 'ready' })
    } catch { self.postMessage({ type: 'error', message: 'The local face detector could not load. Mouse and touch are still available.' }) }
    return
  }
  const frame = event.data.frame
  if (!frame) return
  if (!detector || busy) { frame.close(); self.postMessage({ type: 'position', centre: null }); return }
  busy = true
  try {
    const result = detector.detectForVideo(frame, event.data.timestamp)
    const faces = result.detections.filter(detection => detection.boundingBox)
    faces.sort((first, second) => second.boundingBox.width * second.boundingBox.height - first.boundingBox.width * first.boundingBox.height)
    const bounds = faces[0]?.boundingBox
    self.postMessage({ type: 'position', centre: bounds ? (bounds.originX + bounds.width / 2) / frame.width : null })
  } catch { self.postMessage({ type: 'error', message: 'Tracking stopped. Restart the camera or use mouse and touch.' }) }
  finally { frame.close(); busy = false }
}