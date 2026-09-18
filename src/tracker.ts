export type TrackingState = 'off' | 'starting' | 'searching' | 'tracking' | 'error'
export type TrackingMode = 'body' | 'face'

export class ViewerTracker {
  state: TrackingState = 'off'
  mode: TrackingMode = 'body'
  source: 'body' | 'face' | 'hand' | null = null
  private stream: MediaStream | null = null
  private worker: Worker | null = null
  private video = document.createElement('video')
  private generation = 0
  private animation = 0
  private timeout = 0
  private frameTimeout = 0
  private sampled = 0
  private busy = false
  private centre: number | null = null
  private origin = 0
  private value = 0
  private lastSeen = 0
  private onView: (value: number) => void
  private onState: (state: TrackingState, message?: string) => void

  constructor(onView: (value: number) => void, onState: (state: TrackingState, message?: string) => void) {
    this.onView = onView; this.onState = onState
    this.video.muted = true; this.video.playsInline = true
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.onPageHide)
  }
  private setState(state: TrackingState, message?: string) { this.state = state; this.onState(state, message) }
  private onVisibility = () => { if (document.hidden) this.stop() }
  private onPageHide = () => this.stop()
  private fail(message: string) { this.stop(); this.setState('error', message) }
  calibrate() { this.centre = null; this.source = null; this.origin = 0; this.value = 0; if (this.stream) this.setState('searching') }
  setMode(mode: TrackingMode) {
    if (mode === this.mode) return
    const active = ['starting', 'searching', 'tracking'].includes(this.state)
    this.mode = mode
    if (active) void this.start()
    else this.stop()
  }

  async start() {
    this.stop()
    if (!navigator.mediaDevices?.getUserMedia || !window.Worker || !window.createImageBitmap) return this.setState('error', 'Camera tracking is unavailable. Use mouse, touch or the viewing-angle slider.')
    if (document.hidden) return
    const generation = this.generation
    this.setState('starting')
    this.timeout = window.setTimeout(() => { if (generation === this.generation) this.fail('Camera setup timed out. Check permissions and try again.') }, 30000)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } })
      if (generation !== this.generation || document.hidden) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream
      stream.getTracks().forEach(track => { track.onended = () => this.fail('The camera disconnected. Enable it again to continue tracking.') })
      this.video.srcObject = stream
      await this.video.play()
      if (generation !== this.generation) return
      const worker = new Worker(`${import.meta.env.BASE_URL}tracking-worker.js?v=modes-1`)
      this.worker = worker
      worker.onerror = () => { if (generation === this.generation) this.fail('The local tracker could not start. Mouse and touch are still available.') }
      worker.onmessage = event => {
        if (generation !== this.generation || document.hidden) return
        if (event.data.type === 'ready') {
          clearTimeout(this.timeout)
          this.setState('searching')
          this.animation = requestAnimationFrame(this.tick)
        } else if (event.data.type === 'position') {
          clearTimeout(this.frameTimeout)
          this.busy = false
          const centre = event.data.centre
          if (typeof centre === 'number' && Number.isFinite(centre) && centre >= 0 && centre <= 1) {
            const source = this.mode === 'body' ? 'body' : event.data.source === 'hand' ? 'hand' : 'face'
            const changed = source !== this.source
            if (this.centre === null || changed) { this.centre = centre; this.origin = this.value }
            this.source = source
            this.lastSeen = performance.now()
            this.value = Math.max(-1, Math.min(1, this.origin + (this.centre - centre) * 5))
            this.onView(this.value)
            if (this.state !== 'tracking' || changed) this.setState('tracking')
          } else if (performance.now() - this.lastSeen > 900 && this.state !== 'searching') this.setState('searching')
        } else if (event.data.type === 'error') this.fail(event.data.message)
      }
      worker.postMessage({ type: 'init', mode: this.mode })
    } catch (error) {
      if (generation !== this.generation) return
      this.fail(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera permission was not granted. Allow access in your browser settings or use mouse and touch.'
        : 'The camera could not start. Check your camera connection and try again.')
    }
  }
  private tick = (timestamp: number) => {
    if (!this.worker || !this.stream || document.hidden) return
    if (!this.busy && timestamp - this.sampled >= 100 && this.video.readyState >= 2) {
      this.busy = true; this.sampled = timestamp
      const generation = this.generation
      const worker = this.worker
      this.frameTimeout = window.setTimeout(() => { if (generation === this.generation) this.fail('Camera analysis stalled. Restart viewer tracking to try again.') }, 5000)
      const frameWidth = Math.min(640, this.video.videoWidth)
      void createImageBitmap(this.video, { resizeWidth: frameWidth, resizeHeight: Math.round(frameWidth * this.video.videoHeight / this.video.videoWidth) }).then(frame => {
        if (generation !== this.generation) { frame.close(); return }
        worker.postMessage({ type: 'frame', frame, timestamp }, [frame])
      }).catch(() => { if (generation === this.generation) this.fail('Camera frames could not be read. Mouse and touch are still available.') })
    }
    this.animation = requestAnimationFrame(this.tick)
  }
  stop() {
    this.generation++
    clearTimeout(this.timeout); clearTimeout(this.frameTimeout); cancelAnimationFrame(this.animation)
    this.worker?.terminate(); this.worker = null
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop() })
    this.stream = null
    this.video.pause(); this.video.srcObject = null
    this.busy = false; this.centre = null; this.sampled = 0; this.lastSeen = 0
    this.source = null; this.origin = 0; this.value = 0
    this.setState('off')
  }
  dispose() { this.stop(); document.removeEventListener('visibilitychange', this.onVisibility); window.removeEventListener('pagehide', this.onPageHide) }
}