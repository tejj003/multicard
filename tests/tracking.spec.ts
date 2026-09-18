import { test, expect, type Page } from '@playwright/test'

type Probe = { requests: MediaStreamConstraints[]; stops: number; terminated: number; closed: number; resolve: (() => void) | null; emit: (value: number | null) => void; disconnect: () => void }

async function mockCamera(page: Page, mode: 'available' | 'pending' | 'denied' = 'available') {
  await page.addInitScript(mode => {
    const probe = { requests: [] as MediaStreamConstraints[], stops: 0, terminated: 0, closed: 0, resolve: null as (() => void) | null, emit: (_value: number | null) => {}, disconnect: () => {} }
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
      constructor() { probe.emit = centre => this.onmessage?.({ data: { type: 'position', centre } }) }
      postMessage(message: { type: string; frame?: ImageBitmap }) {
        if (message.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }))
        else { message.frame?.close(); queueMicrotask(() => probe.emit(null)) }
      }
      terminate() { probe.terminated++; this.onmessage = null }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: FakeWorker })
  }, mode)
}

test('viewer position changes the optical angle and holds steady without guessing movement', async ({ page }) => {
  await mockCamera(page)
  await page.clock.install()
  await page.goto('/')
  await expect(page.locator('#art')).toHaveAttribute('data-ready', 'true')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  expect(await page.evaluate(() => (window as unknown as { trackingProbe: Probe }).trackingProbe.requests)).toEqual([])
  await page.getByRole('button', { name: 'Enable viewer tracking' }).click()
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'searching')
  const position = async (value: number | null) => { await page.evaluate(value => (window as unknown as { trackingProbe: Probe }).trackingProbe.emit(value), value); await page.clock.runFor(650) }
  await position(.5)
  await expect(page.locator('#camera')).toHaveAttribute('data-state', 'tracking')
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
  expect(await page.evaluate(() => { const probe = (window as unknown as { trackingProbe: Probe }).trackingProbe; return { stops: probe.stops, terminated: probe.terminated, requests: probe.requests } })).toMatchObject({ stops: 1, terminated: 1, requests: [{ audio: false, video: { facingMode: 'user' } }] })
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