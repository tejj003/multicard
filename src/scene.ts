import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderer } from 'three'
import fragmentShader from './artwork.frag?raw'

export class LenticularScene {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private geometry = new PlaneGeometry(2, 2)
  private material = new ShaderMaterial({
    uniforms: { uSize: { value: new Vector2(1, 1) }, uView: { value: 0 }, uPiece: { value: 0 }, uDpr: { value: 1 }, uFullscreen: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader, depthTest: false, depthWrite: false,
  })
  private canvas: HTMLCanvasElement
  private observer: ResizeObserver
  private target = 0
  private view = 0
  private auto = false
  private time = 0
  private last = 0
  private frame = 0
  private dirty = true
  private lost = false
  private nativeRatio = devicePixelRatio || 1
  private qualityCap = 2
  private slowFrames = 0
  private resolutionLimited = false
  private onView: (value: number) => void
  private onError: (message: string) => void

  constructor(canvas: HTMLCanvasElement, onView: (value: number) => void, onError: (message: string) => void) {
    this.canvas = canvas; this.onView = onView; this.onError = onError
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true })
    this.renderer.debug.onShaderError = () => onError('The artwork could not be rendered on this graphics device. Try a current browser.')
    this.scene.add(new Mesh(this.geometry, this.material))
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(canvas)
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
    document.addEventListener('fullscreenchange', this.resize)
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
  }
  setPiece(index: number) { this.material.uniforms.uPiece!.value = index; this.canvas.dataset.piece = String(index); this.dirty = true }
  setView(value: number) { this.target = Math.max(-1, Math.min(1, value)); this.dirty = true }
  setAuto(enabled: boolean) { this.auto = enabled; this.time = Math.asin(this.view / 1.01); this.dirty = true }
  private onLost = (event: Event) => { event.preventDefault(); this.lost = true; this.onError('Graphics paused. Restoring the artwork...') }
  private onRestored = () => { this.lost = false; this.onError(''); this.resize() }
  private resize = () => {
    const bounds = this.canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    this.nativeRatio = devicePixelRatio || 1
    const fullscreen = document.fullscreenElement === this.canvas.closest('#app')
    const requestedRatio = fullscreen ? Math.max(2, this.nativeRatio) : Math.min(this.nativeRatio, this.qualityCap)
    const context = this.renderer.getContext()
    const maxBuffer = context.getParameter(context.MAX_RENDERBUFFER_SIZE) as number
    const maxTexture = context.getParameter(context.MAX_TEXTURE_SIZE) as number
    const maxViewport = context.getParameter(context.MAX_VIEWPORT_DIMS) as Int32Array
    const ratio = Math.min(requestedRatio, Math.min(maxBuffer, maxTexture, maxViewport[0]!) / bounds.width, Math.min(maxBuffer, maxTexture, maxViewport[1]!) / bounds.height)
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(bounds.width, bounds.height, false)
    this.material.uniforms.uSize!.value.set(bounds.width, bounds.height)
    this.material.uniforms.uDpr!.value = ratio
    this.material.uniforms.uFullscreen!.value = fullscreen ? 1 : 0
    this.canvas.dataset.presentation = fullscreen ? 'full-bleed' : 'gallery'
    this.canvas.dataset.renderScale = String(ratio)
    this.canvas.dataset.requestedScale = String(requestedRatio)
    this.canvas.dataset.quality = fullscreen ? 'full-definition' : 'auto'
    const limited = ratio < requestedRatio
    this.canvas.dataset.resolutionLimited = String(limited)
    if (limited) this.onError(`This graphics device limits rendering to ${this.canvas.width} x ${this.canvas.height} pixels (${ratio.toFixed(2)}x).`)
    else if (this.resolutionLimited) this.onError('')
    this.resolutionLimited = limited
    this.canvas.dispatchEvent(new CustomEvent('render-scale', { detail: ratio }))
    this.dirty = true
  }
  private tick = (timestamp: number) => {
    const elapsed = (timestamp - this.last) / 1000 || .016
    const delta = Math.min(elapsed, .05)
    this.last = timestamp
    if (!document.hidden && !this.lost) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      if (this.nativeRatio !== (devicePixelRatio || 1)) { this.qualityCap = 2; this.slowFrames = 0; this.resize() }
      if (this.auto && !reduced) { this.time += delta * .55; this.target = Math.sin(this.time) * .98; this.dirty = true }
      if (Math.abs(this.target - this.view) > .0001 || this.dirty) {
        if (this.material.uniforms.uFullscreen!.value < .5 && elapsed < .2 && elapsed > .028) this.slowFrames++
        else this.slowFrames = Math.max(0, this.slowFrames - 1)
        if (this.material.uniforms.uFullscreen!.value < .5 && this.slowFrames >= 45 && this.renderer.getPixelRatio() > 1) {
          this.qualityCap = Math.max(1, this.renderer.getPixelRatio() - .5)
          this.slowFrames = 0
          this.resize()
        }
        this.view = reduced ? this.target : this.view + (this.target - this.view) * (1 - Math.exp(-9 * delta))
        this.material.uniforms.uView!.value = this.view
        this.renderer.render(this.scene, this.camera)
        this.onView(this.view)
        this.canvas.dataset.view = this.view.toFixed(4)
        this.canvas.dataset.ready = 'true'
        this.dirty = false
      }
    }
    this.frame = requestAnimationFrame(this.tick)
  }
  dispose() {
    cancelAnimationFrame(this.frame); this.observer.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    document.removeEventListener('fullscreenchange', this.resize)
    this.geometry.dispose(); this.material.dispose(); this.renderer.dispose()
  }
}