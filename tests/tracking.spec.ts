import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('body worker uses torso landmarks and remaps small-body crops without requiring face landmarks', async () => {
  type Landmark = { x: number; y: number; visibility: number }
  const body = (centre: number, width = .2, visibility = 1) => {
    const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: .05, y: .05, visibility: 0 }))
    landmarks[11] = { x: centre - width / 2, y: .2, visibility }
    landmarks[12] = { x: centre + width / 2, y: .2, visibility }
    landmarks[23] = { x: centre - width / 3, y: .55, visibility }
    landmarks[24] = { x: centre + width / 3, y: .55, visibility }
    return landmarks
  }
  const outputs: { type: string; centre?: number | null; message?: string }[] = []
  const cropped: number[][] = []
  let options: unknown
  let closed = 0
  let failDetection = false
  let detections: Landmark[][][] = []
  const worker = {
    location: { href: 'https://example.test/multicard/tracking-worker.js' },
    postMessage: (message: typeof outputs[number]) => outputs.push(message),
    onmessage: null as unknown as (event: { data: unknown }) => Promise<void>,
  }
  class CropCanvas {
    width: number
    height: number
    constructor(width: number, height: number) { this.width = width; this.height = height }
    getContext() { return { drawImage: (_frame: unknown, ...coordinates: number[]) => cropped.push(coordinates) } }
  }
  runInNewContext(readFileSync('public/tracking-worker.js', 'utf8'), {
    self: worker, URL, importScripts: () => {}, OffscreenCanvas: CropCanvas,
    Vision: {
      FilesetResolver: { forVisionTasks: async (url: string) => { expect(url).toBe('https://example.test/multicard/tracking/wasm'); return {} } },
      PoseLandmarker: { createFromOptions: async (_files: unknown, configuration: unknown) => {
        options = configuration
        return { detect: () => {
          if (failDetection) throw new Error('Test inference failure')
          return { landmarks: detections.shift() ?? [] }
        } }
      } },
    },
  })
  await worker.onmessage({ data: { type: 'init' } })
  expect(outputs.at(-1)).toEqual({ type: 'ready' })
  expect(options).toMatchObject({
    baseOptions: { modelAssetPath: 'https://example.test/multicard/tracking/pose-landmarker-lite.task', delegate: 'CPU' },
    runningMode: 'IMAGE', numPoses: 3, outputSegmentationMasks: false,
  })
  const frame = { width: 640, height: 360, close: () => { closed++ } }
  detections = [[body(.3)]]
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)?.centre).toBeCloseTo(.3)
  expect(cropped).toHaveLength(0)
  detections = [[body(.2, .1), body(.7, .3)]]
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)?.centre).toBeCloseTo(.7)
  detections = [[], [body(.5)], [], []]
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)?.centre).toBeCloseTo(.28125)
  expect(cropped.map(coordinates => coordinates[0])).toEqual([0, 140, 280])
  detections = [[], [], [], [body(.5)]]
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)?.centre).toBeCloseTo(.71875)
  const invalid = body(.5); invalid[11]!.x = NaN
  detections = [[body(.4, .2, .2)], [invalid], [body(2)], []]
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)).toEqual({ type: 'position', centre: null })
  failDetection = true
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)?.type).toBe('error')
  expect(closed).toBe(6)
})

test('face mode loads only face and hand models and prefers a valid palm over a face', async () => {
  const outputs: { type: string; centre?: number | null; source?: string }[] = []
  const models: string[] = []
  let faceCalls = 0
  let closed = 0
  let handLandmarks: { x: number; y: number }[][] = []
  let faces = [{ boundingBox: { originX: 100, width: 100, height: 100 } }, { boundingBox: { originX: 320, width: 160, height: 180 } }]
  const worker = {
    location: { href: 'https://example.test/multicard/tracking-worker.js?v=modes-1' },
    postMessage: (message: typeof outputs[number]) => outputs.push(message),
    onmessage: null as unknown as (event: { data: unknown }) => Promise<void>,
  }
  runInNewContext(readFileSync('public/tracking-worker.js', 'utf8'), {
    self: worker, URL, importScripts: () => {},
    Vision: {
      FilesetResolver: { forVisionTasks: async () => ({}) },
      PoseLandmarker: { createFromOptions: () => { throw new Error('Body model must not load') } },
      FaceDetector: { createFromOptions: async (_files: unknown, options: { baseOptions: { modelAssetPath: string } }) => {
        models.push(options.baseOptions.modelAssetPath)
        return { detect: () => { faceCalls++; return { detections: faces } } }
      } },
      HandLandmarker: { createFromOptions: async (_files: unknown, options: { baseOptions: { modelAssetPath: string } }) => {
        models.push(options.baseOptions.modelAssetPath)
        return { detect: () => ({ landmarks: handLandmarks }) }
      } },
    },
  })
  await worker.onmessage({ data: { type: 'init', mode: 'face' } })
  expect(outputs.at(-1)).toEqual({ type: 'ready' })
  expect(models).toEqual(['https://example.test/multicard/tracking/blaze-face.tflite', 'https://example.test/multicard/tracking/hand-landmarker.task'])
  const frame = { width: 640, height: 360, close: () => { closed++ } }
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)).toEqual({ type: 'position', centre: .625, source: 'face' })
  handLandmarks = [Array.from({ length: 21 }, () => ({ x: .4, y: .5 }))]
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)).toEqual({ type: 'position', centre: .4, source: 'hand' })
  expect(faceCalls).toBe(1)
  handLandmarks[0]![9]!.x = NaN
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)?.source).toBe('face')
  faces = []
  await worker.onmessage({ data: { type: 'frame', frame } })
  expect(outputs.at(-1)?.centre).toBeNull()
  expect(closed).toBe(4)
})

type Probe = { requests: MediaStreamConstraints[]; modes: string[]; stops: number; terminated: number; closed: number; resolve: (() => void) | null; emit: (value: number | null, source?: string) => void; disconnect: () => void }

async function mockCamera(page: Page, mode: 'available' | 'pending' | 'denied' = 'available') {
  await page.addInitScript(mode => {
    const probe = { requests: [] as MediaStreamConstraints[], modes: [] as string[], stops: 0, terminated: 0, closed: 0, resolve: null as (() => void) | null, emit: (_value: number | null, _source?: string) => {}, disconnect: () => {} }
    Object.defineProperty(window, 'trackingProbe', { value: probe })
    const track = { onended: null as (() => void) | null, stop() { probe.stops++ } }
    const stream = { getTracks: () => [track] }
    probe.disconnect = () => track.onended?.()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: (constraints: MediaStreamConstraints) => {
      probe.requests.push(constraints)
      if (mode === 'denied') return Promise.reject(new DOMException('Test denial', 'NotAllowedError'))
      if (mode === 'pending') return new Promise(resolve => { probe.resolve = () => resolve(stream) })
      return Promise.resolve(stream)
    } } })
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, set() {}, get() { return stream } })
    HTMLMediaElement.prototype.play = () => Promise.resolve()
    HTMLMediaElement.prototype.pause = () => {}
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 })
    window.createImageBitmap = async () => ({ close() { probe.closed++ } }) as ImageBitmap
    class FakeWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null
      onerror: (() => void) | null = null
      constructor() { probe.emit = (centre, source) => this.onmessage?.({ data: { type: 'position', centre, source } }) }
      postMessage(message: { type: string; frame?: ImageBitmap; mode?: string }) {
        if (message.type === 'init') { probe.modes.push(message.mode!); queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } })) }
        else { message.frame?.close(); queueMicrotask(() => probe.emit(null)) }
      }
      terminate() { probe.terminated++; this.onmessage = null }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: FakeWorker })
  }, mode)
}

test('tracking modes load only on opt-in and hand off between face and hand without jumps', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await mockCamera(page)
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const canvas = page.locator('#art')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  await expect(page.getByRole('radio', { name: 'Body', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'Face + Hands', exact: true }).check()
  expect(await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.requests.length)).toBe(0)
  await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
  await expect(page.locator('#tracking-status')).toHaveText('Camera on / finding face or hand')
  const position = async (centre: number, source: string) => {
    await page.evaluate(({ centre, source }) => (window as unknown as { trackingProbe: Probe }).trackingProbe.emit(centre, source), { centre, source })
    await page.clock.runFor(50)
  }
  await position(.5, 'face')
  await position(.4, 'face')
  await expect(canvas).toHaveAttribute('data-view', '0.5000')
  await expect(page.locator('#tracking-status')).toHaveText('Face tracked / on-device')
  await position(.8, 'hand')
  await expect(canvas).toHaveAttribute('data-view', '0.5000')
  await expect(page.locator('#tracking-status')).toHaveText('Hand tracked / on-device')
  await position(.9, 'hand')
  await expect(canvas).toHaveAttribute('data-view', '0.0000')
  await position(.35, 'face')
  await expect(canvas).toHaveAttribute('data-view', '0.0000')
  await position(.45, 'face')
  await expect(canvas).toHaveAttribute('data-view', '-0.5000')
  if (browserName === 'chromium') {
    await page.getByRole('button', { name: 'Enter fullscreen' }).click()
    await expect(canvas).toHaveAttribute('data-presentation', 'full-bleed')
    await expect(page.getByRole('group', { name: 'Camera tracking mode' })).not.toBeVisible()
    await position(.4, 'hand')
    await expect(canvas).toHaveAttribute('data-view', '-0.5000')
    await position(.2, 'hand')
    await expect(canvas).toHaveAttribute('data-view', '0.5000')
    await canvas.dispatchEvent('pointermove', { clientX: 630, clientY: 200 })
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Space')
    await page.clock.runFor(50)
    await expect(canvas).toHaveAttribute('data-view', '0.5000')
    await expect(page.locator('#tracking-status')).toHaveText('Hand tracked / on-device')
    await page.keyboard.press('Escape')
    await expect(canvas).toHaveAttribute('data-presentation', 'gallery')
  }
  await page.getByRole('radio', { name: 'Body', exact: true }).check()
  await expect(page.locator('#tracking-status')).toHaveText('Camera on / finding body')
  await position(.5, 'body')
  await position(.4, 'body')
  await expect(canvas).toHaveAttribute('data-view', '0.5000')
  expect(await page.evaluate(() => {
    const probe = (window as unknown as { trackingProbe: Probe }).trackingProbe
    return { modes: probe.modes, requests: probe.requests.length, stops: probe.stops, terminated: probe.terminated }
  })).toEqual({ modes: ['face', 'body'], requests: 2, stops: 1, terminated: 1 })
  await page.getByRole('button', { name: 'Stop viewer tracking' }).click()
  await page.getByRole('radio', { name: 'Face + Hands', exact: true }).check()
  expect(await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.requests.length)).toBe(2)
})

test('switching modes cancels a pending stream and never starts its old worker', async ({ page }) => {
  await mockCamera(page, 'pending')
  await page.goto('/')
  await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
  await page.evaluate(() => { const probe = (window as unknown as { trackingProbe: Probe }).trackingProbe; Object.defineProperty(window, 'oldCameraResolve', { value: probe.resolve }) })
  await page.getByRole('radio', { name: 'Face + Hands', exact: true }).check()
  await page.evaluate(() => (window as unknown as { oldCameraResolve: () => void }).oldCameraResolve())
  expect(await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.stops)).toBe(1)
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'starting')
  await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.resolve?.())
  await expect(page.locator('#tracking-status')).toHaveText('Camera on / finding face or hand')
  expect(await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.modes)).toEqual(['face'])
})

test('viewer position changes the optical angle and holds steady without guessing movement', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 640, height: 480 })
  await mockCamera(page)
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('#art')).toHaveAttribute('data-ready', 'true')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  expect(await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.requests)).toEqual([])
  await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'searching')
  await expect(page.locator('#tracking-status')).toHaveText('Camera on / finding body')
  const position = async (value: number | null) => { await page.evaluate(value => (window as unknown as { trackingProbe: Probe }).trackingProbe.emit(value), value); await page.clock.runFor(650) }
  await position(.5)
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'tracking')
  await expect(page.locator('#tracking-status')).toHaveText('Body tracked / on-device')
  await position(.32)
  expect(Number(await page.locator('#art').getAttribute('data-view'))).toBeGreaterThan(.85)
  await position(.68)
  expect(Number(await page.locator('#art').getAttribute('data-view'))).toBeLessThan(-.85)
  await position(.68)
  expect(Number(await page.locator('#art').getAttribute('data-view'))).toBeCloseTo(-.9, 2)
  for (const name of ['Moiré', 'Vortex', 'Fold']) {
    await page.getByRole('button', { name, exact: true }).click()
    await position(.32)
    const first = await page.locator('#art').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
    await position(.68)
    expect(await page.locator('#art').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(first)
    await expect(page.locator('#camera')).toHaveAttribute('data-state', 'tracking')
  }
  await page.getByRole('button', { name: 'Centre view' }).click()
  await position(.68)
  expect(Math.abs(Number(await page.locator('#art').getAttribute('data-view')))).toBeLessThan(.01)
  await page.clock.runFor(1100)
  await position(null)
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'searching')
  await page.locator('#angle').fill('60')
  await page.clock.runFor(800)
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'off')
  expect(Number(await page.locator('#art').getAttribute('data-view'))).toBeGreaterThan(.59)
  expect(await page.evaluate(() => { const probe = (window as unknown as { trackingProbe: Probe }).trackingProbe; return { stops: probe.stops, terminated: probe.terminated, requests: probe.requests } })).toMatchObject({ stops: 1, terminated: 1, requests: [{ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }] })
})

test('fullscreen accepts only camera movement and returns manual control on exit', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen checked in Chromium.')
  test.setTimeout(90000)
  await page.setViewportSize({ width: 640, height: 480 })
  await mockCamera(page)
  await page.clock.install()
  await page.goto('/')
  const canvas = page.locator('#art')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  await page.getByRole('button', { name: 'Start automatic sweep' }).click()
  await page.clock.runFor(100)
  await page.getByRole('button', { name: 'Enter fullscreen' }).click()
  await expect(canvas).toHaveAttribute('data-presentation', 'full-bleed')
  await expect(page.locator('#auto')).toHaveAttribute('aria-pressed', 'false')
  const assertManualBlocked = async () => {
    await expect(canvas).toHaveAttribute('data-presentation', 'full-bleed')
    await page.clock.runFor(50)
    const before = await canvas.getAttribute('data-view')
    await canvas.dispatchEvent('pointermove', { clientX: 630, clientY: 200, pointerType: 'mouse' })
    await canvas.dispatchEvent('pointermove', { clientX: 10, clientY: 200, pointerType: 'touch' })
    await canvas.focus()
    for (const key of ['ArrowLeft', 'ArrowRight', 'Space']) await page.keyboard.press(key)
    await page.locator('#angle').evaluate((input: HTMLInputElement) => {
      input.value = '-100'; input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await page.locator('#auto').dispatchEvent('click')
    await page.locator('#reset').dispatchEvent('click')
    await page.clock.runFor(160)
    expect(await canvas.getAttribute('data-view')).toBe(before)
    await expect(page.locator('#auto')).toHaveAttribute('aria-pressed', 'false')
  }
  await assertManualBlocked()
  expect(await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.requests)).toEqual([])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'searching')
  await page.getByRole('button', { name: 'Enter fullscreen' }).click()
  await assertManualBlocked()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const position = async (value: number | null) => {
    await page.evaluate(value => (window as unknown as { trackingProbe: Probe }).trackingProbe.emit(value), value)
    await page.clock.runFor(50)
  }
  await position(.5)
  for (const name of ['Aperture', 'Fold', 'Ribbon', 'Orbit', 'Moiré', 'Vortex']) {
    await expect(page.locator('#art-title')).toHaveText(name)
    await position(.32)
    const first = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
    await expect(canvas).toHaveAttribute('data-view', '0.9000')
    await assertManualBlocked()
    await expect(page.locator('#camera')).toHaveAttribute('data-state', 'tracking')
    await position(.68)
    await expect(canvas).toHaveAttribute('data-view', '-0.9000')
    expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(first)
    await page.keyboard.press('ArrowDown')
  }
  await page.clock.runFor(1000)
  await position(null)
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'searching')
  await assertManualBlocked()
  await position(.32)
  await page.keyboard.press('c')
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'off')
  await assertManualBlocked()
  await page.keyboard.press('Escape')
  await expect(canvas).toHaveAttribute('data-presentation', 'gallery')
  await page.locator('#angle').fill('-60')
  await page.clock.runFor(50)
  await expect(canvas).toHaveAttribute('data-view', '-0.6000')
})

test('denied camera leaves fullscreen still with no manual fallback', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen checked in Chromium.')
  await mockCamera(page, 'denied')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
  await expect(page.locator('#camera-error')).toContainText('permission was not granted')
  await page.getByRole('button', { name: 'Enter fullscreen' }).click()
  await expect(page.locator('#art')).toHaveAttribute('data-presentation', 'full-bleed')
  await page.locator('#art').dispatchEvent('pointermove', { clientX: 1000, clientY: 300 })
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(page.locator('#art')).toHaveAttribute('data-view', '0.0000')
  await expect(page.locator('#auto')).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Enable viewer tracking' })).toBeVisible()
})

test('camera stop, hidden page and disconnect release tracking with no automatic restart', async ({ page }) => {
  await mockCamera(page)
  for (const action of ['stop', 'hidden', 'pagehide', 'disconnect']) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
    await expect(page.locator('#camera')).toHaveAttribute('data-state', 'searching')
    if (action === 'stop') await page.getByRole('button', { name: 'Stop viewer tracking' }).click()
    else await page.evaluate(action => {
      if (action === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) }
      else if (action === 'pagehide') window.dispatchEvent(new Event('pagehide'))
      else (window as unknown as { trackingProbe: Probe }).trackingProbe.disconnect()
    }, action)
    await expect(page.locator('#camera')).toHaveAttribute('data-state', action === 'disconnect' ? 'error' : 'off')
    expect(await page.evaluate(() => { const probe = (window as unknown as { trackingProbe: Probe }).trackingProbe; return { stops: probe.stops, workers: probe.terminated, requests: probe.requests.length } })).toEqual({ stops: 1, workers: 1, requests: 1 })
  }
})

test('cancellation and timeout stop a late camera stream', async ({ page }) => {
  await mockCamera(page, 'pending')
  await page.clock.install()
  for (const action of ['cancel', 'timeout']) {
    await page.goto('/')
    await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
    if (action === 'cancel') await page.getByRole('button', { name: 'Cancel viewer tracking' }).click()
    else { await page.clock.fastForward(31000); await expect(page.locator('#camera-error')).toContainText('timed out') }
    await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.resolve?.())
    await expect.poll(() => page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.stops)).toBe(1)
  }
})

test('denied camera retains the complete six-piece collection', async ({ page }) => {
  await mockCamera(page, 'denied')
  await page.goto('/')
  await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
  await expect(page.locator('#camera-error')).toContainText('permission was not granted')
  for (const [index, name] of ['Aperture', 'Fold', 'Ribbon', 'Orbit', 'Moiré', 'Vortex'].entries()) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('#art')).toHaveAttribute('data-piece', String(index))
  }
  await page.locator('#angle').fill('75')
  await expect.poll(async () => Number(await page.locator('#art').getAttribute('data-view'))).toBeGreaterThan(.7)
})