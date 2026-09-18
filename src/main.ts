import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import { createIcons, Camera, CameraOff, Expand, Info, MoveHorizontal, Pause, Play, RotateCcw, X } from 'lucide'
import { LenticularScene } from './scene'
import { ViewerTracker } from './tracker'
import './gallery.css'

const pieces = [
  { name: 'Aperture', medium: 'Chromatic chambers', colours: ['#e54b2b', '#f2ba34', '#1d657d', '#63906b'], statement: [
    'Bright discs sit in dark pockets, catching the light as they move.',
    'Aperture turns a flat screen into something that feels deep enough to touch.',
  ] },
  { name: 'Fold', medium: 'Depth that changes its mind', colours: ['#e65a40', '#78b9a6', '#f0d29b', '#243d49'], statement: [
    'Coloured tiles seem to rise and sink as light and shadow change.',
    'Fold shows how easily our eyes can turn a hollow into a solid form.',
  ] },
  { name: 'Ribbon', medium: 'Interleaved spectrum', colours: ['#d1492d', '#eab82e', '#1c7472', '#233e89'], statement: [
    'Waves of colour slide past one another like flowing ribbons.',
    'The piece explores how a small shift can change the rhythm of a whole image.',
  ] },
  { name: 'Orbit', medium: 'Colour in counterpoint', colours: ['#ef6546', '#246b98', '#e8ba35', '#172c2c'], statement: [
    'Coloured circles drift together and apart, creating new shades where they overlap.',
    'Orbit is a quiet dance of connection and separation.',
  ] },
  { name: 'Moiré', medium: 'Interference in motion', colours: ['#e45c33', '#59bba0', '#182e35', '#e8ebdf'], statement: [
    'Two layers of fine rings overlap to create larger, shifting waves.',
    'Moiré finds unexpected movement in the simple meeting of lines.',
  ] },
  { name: 'Vortex', medium: 'An infinite turning corridor', colours: ['#ec662d', '#2d939f', '#e5c271', '#101d29'], statement: [
    'Repeating shapes twist towards a dark centre, like a corridor with no end.',
    'Vortex draws the eye into a space that exists only on a flat screen.',
  ] },
]

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="header">
    <a class="identity" href="./" aria-label="MultiCard home"><span class="brand">MultiCard<span class="brand-dot">.</span></span><span class="byline">Art by Tejj</span></a>
    <div class="header-tools">
      <button id="camera" class="camera-button" aria-label="Enable viewer tracking" aria-pressed="false" title="Enable viewer tracking"><i data-lucide="camera"></i><span>Enable camera</span></button>
      <button id="fullscreen" class="icon-button" aria-label="Enter fullscreen" title="Enter fullscreen"><i data-lucide="expand"></i></button>
    </div>
  </header>
  <main class="gallery" aria-label="Interactive lenticular artwork">
    <div class="series-label"><span>OPTICAL STUDIES</span><span id="piece-index">01 / ${String(pieces.length).padStart(2, '0')}</span></div>
    <canvas id="art" tabindex="0" role="img" aria-label="Aperture. Colour-shifting chambers controlled by viewing angle."></canvas>
    <div id="render-error" class="notice" role="alert" hidden></div>
    <div class="art-meta"><div><div class="art-heading"><h1 id="art-title">Aperture</h1><button id="art-info" class="icon-button art-info" aria-label="About Aperture" aria-haspopup="dialog" aria-controls="art-statement" title="About Aperture"><i data-lucide="info"></i></button></div><p id="art-medium">Chromatic chambers</p></div><div id="swatches" class="swatches" aria-hidden="true"></div></div>
  </main>
  <footer class="footer">
    <nav class="pieces" aria-label="Artwork series">${pieces.map((piece, index) => `<button class="piece" data-piece="${index}" aria-pressed="${index === 0}" aria-label="${piece.name}"><span class="piece-number">0${index + 1}</span><span>${piece.name}</span></button>`).join('')}</nav>
    <div class="angle-control"><i data-lucide="move-horizontal" aria-hidden="true"></i><input id="angle" type="range" min="-100" max="100" value="0" aria-label="Viewing angle"><output id="angle-value" for="angle">0°</output></div>
    <div class="playback"><button id="auto" class="icon-button" aria-label="Start automatic sweep" title="Start automatic sweep" aria-pressed="false"><i data-lucide="play"></i></button><button id="reset" class="icon-button" aria-label="Centre view" title="Centre view"><i data-lucide="rotate-ccw"></i></button></div>
  </footer>
  <div class="tracking-line"><span id="tracking-status" role="status">Pointer / touch</span><span id="render-quality">Auto</span></div>
  <div id="camera-error" class="notice camera-notice" role="alert" hidden></div>
  <dialog id="art-statement" class="statement-dialog" aria-labelledby="statement-title" aria-describedby="statement-copy">
    <p class="statement-label">Artist's statement</p>
    <div class="statement-heading"><h2 id="statement-title"></h2><button id="statement-close" class="icon-button" aria-label="Close artist statement" title="Close artist statement" autofocus><i data-lucide="x"></i></button></div>
    <div id="statement-copy" class="statement-copy"></div>
    <p class="statement-credit">Art by Tejj</p>
  </dialog>
`
const icons = () => createIcons({ icons: { Camera, CameraOff, Expand, Info, MoveHorizontal, Pause, Play, RotateCcw, X }, attrs: { width: 18, height: 18, 'stroke-width': 1.5, 'aria-hidden': 'true' } })
icons()
const canvas = document.querySelector<HTMLCanvasElement>('#art')!
const slider = document.querySelector<HTMLInputElement>('#angle')!
const autoButton = document.querySelector<HTMLButtonElement>('#auto')!
const fullButton = document.querySelector<HTMLButtonElement>('#fullscreen')!
const app = document.querySelector<HTMLElement>('#app')!
const renderError = document.querySelector<HTMLElement>('#render-error')!
const infoButton = document.querySelector<HTMLButtonElement>('#art-info')!
const statement = document.querySelector<HTMLDialogElement>('#art-statement')!
infoButton.addEventListener('click', () => statement.showModal())
document.querySelector('#statement-close')!.addEventListener('click', () => statement.close())
statement.addEventListener('close', () => (document.fullscreenElement ? canvas : infoButton).focus({ preventScroll: true }))
statement.addEventListener('click', event => {
  if (event.target !== statement) return
  const bounds = statement.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) statement.close()
})
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement && statement.open) { statement.close(); canvas.focus({ preventScroll: true }) }
})
canvas.addEventListener('render-scale', event => {
  const quality = canvas.dataset.quality === 'full-definition' ? 'Full definition' : 'Auto'
  document.querySelector('#render-quality')!.textContent = `${quality} / ${Number((event as CustomEvent<number>).detail.toFixed(2))}x`
})
let scene: LenticularScene | undefined
let auto = false
let currentPiece = 0

function cameraOnly() { return document.fullscreenElement === app }
document.addEventListener('fullscreenchange', () => {
  if (cameraOnly()) { setAuto(false); scene?.holdView() }
})
function setAuto(enabled: boolean) {
  if (enabled && cameraOnly()) return
  if (enabled) tracker?.stop()
  const next = enabled && !matchMedia('(prefers-reduced-motion: reduce)').matches
  if (next === auto) return
  auto = next
  scene?.setAuto(auto)
  autoButton.setAttribute('aria-pressed', String(auto))
  autoButton.setAttribute('aria-label', auto ? 'Stop automatic sweep' : 'Start automatic sweep')
  autoButton.title = autoButton.getAttribute('aria-label')!
  autoButton.innerHTML = `<i data-lucide="${auto ? 'pause' : 'play'}"></i>`
  icons()
}
function selectPiece(index: number) {
  currentPiece = index
  scene?.setPiece(index)
  const piece = pieces[index]!
  document.querySelector('#art-title')!.textContent = piece.name
  document.querySelector('#art-medium')!.textContent = piece.medium
  infoButton.setAttribute('aria-label', `About ${piece.name}`)
  infoButton.title = `About ${piece.name}`
  document.querySelector('#statement-title')!.textContent = piece.name
  document.querySelector('#statement-copy')!.replaceChildren(...piece.statement.map(text => {
    const paragraph = document.createElement('p')
    paragraph.textContent = text
    return paragraph
  }))
  document.querySelector('#piece-index')!.textContent = `${String(index + 1).padStart(2, '0')} / ${String(pieces.length).padStart(2, '0')}`
  canvas.setAttribute('aria-label', `${piece.name}. ${piece.medium}, controlled by viewing angle.`)
  document.querySelectorAll<HTMLButtonElement>('button[data-piece]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.piece) === index)))
  document.querySelector('#swatches')!.innerHTML = piece.colours.map(colour => `<span style="background:${colour}"></span>`).join('')
}
try {
  scene = new LenticularScene(canvas, value => {
    slider.value = String(Math.round(value * 100))
    document.querySelector('#angle-value')!.textContent = `${Math.round(value * 30)}°`
  }, message => { renderError.textContent = message; renderError.hidden = !message })
} catch {
  renderError.textContent = 'WebGL is unavailable. Enable hardware acceleration or open MultiCard in a current browser.'
  renderError.hidden = false
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(control => { control.disabled = true })
}
selectPiece(0)
function setAngle(value: number) {
  if (cameraOnly()) return
  setAuto(false); scene?.setView(value)
}
slider.addEventListener('input', () => {
  if (cameraOnly()) return
  tracker?.stop(); setAngle(Number(slider.value) / 100)
})
canvas.addEventListener('pointermove', event => {
  if (cameraOnly() || document.body.dataset.input === 'camera') return
  const bounds = canvas.getBoundingClientRect()
  setAngle((event.clientX - bounds.left) / bounds.width * 2 - 1)
})
canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }) })
document.addEventListener('keydown', event => {
  if (statement.open) return
  if (event.target instanceof HTMLElement && event.target.matches('input, button, a')) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (cameraOnly() && ['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) { event.preventDefault(); return }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); tracker?.stop(); setAngle(Number(slider.value) / 100 + (event.key === 'ArrowRight' ? .12 : -.12)) }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); selectPiece((currentPiece + (event.key === 'ArrowDown' ? 1 : pieces.length - 1)) % pieces.length) }
  if (event.key === ' ') { event.preventDefault(); setAuto(!auto) }
})
document.querySelectorAll<HTMLButtonElement>('button[data-piece]').forEach(button => button.addEventListener('click', () => selectPiece(Number(button.dataset.piece))))
autoButton.addEventListener('click', () => setAuto(!auto))
document.querySelector('#reset')!.addEventListener('click', () => setAngle(0))
fullButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else if (app.requestFullscreen) { await app.requestFullscreen(); canvas.focus({ preventScroll: true }) }
    else throw new Error('unsupported')
  } catch { renderError.textContent = 'Fullscreen is unavailable in this browser. The artwork remains available here.'; renderError.hidden = false }
})
document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.fullscreenElement) void document.exitFullscreen() })
document.addEventListener('visibilitychange', () => { if (document.hidden) setAuto(false) })
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { if (event.matches) setAuto(false) })
window.addEventListener('pagehide', () => setAuto(false))
const cameraButton = document.querySelector<HTMLButtonElement>('#camera')!
const cameraError = document.querySelector<HTMLElement>('#camera-error')!
let tracker: ViewerTracker | undefined = new ViewerTracker(value => { scene?.setView(value) }, (state, message) => {
  const active = state === 'tracking' || state === 'searching'
  const pending = state === 'starting'
  if (cameraOnly() && state !== 'tracking') scene?.holdView()
  document.body.dataset.input = state === 'tracking' ? 'camera' : 'pointer'
  cameraButton.dataset.state = state
  cameraButton.setAttribute('aria-pressed', String(active))
  const label = pending ? 'Cancel viewer tracking' : active ? 'Stop viewer tracking' : 'Enable viewer tracking'
  cameraButton.setAttribute('aria-label', label); cameraButton.title = label
  cameraButton.innerHTML = `<i data-lucide="${active || pending ? 'camera-off' : 'camera'}"></i><span>${pending ? 'Connecting' : active ? 'Camera on' : 'Enable camera'}</span>`
  document.querySelector('#tracking-status')!.textContent = state === 'tracking' ? 'Body tracked / on-device' : state === 'searching' ? 'Camera on / finding body' : pending ? 'Starting camera / local processing' : 'Pointer / touch'
  cameraError.hidden = !message; cameraError.textContent = message || ''
  icons()
})
cameraButton.addEventListener('click', () => {
  if (tracker && ['starting', 'tracking', 'searching'].includes(tracker.state)) tracker.stop()
  else { setAuto(false); void tracker?.start() }
})
canvas.addEventListener('webglcontextlost', () => { setAuto(false); tracker?.stop() })
document.querySelector('#reset')!.addEventListener('click', () => { if (!cameraOnly()) tracker?.calibrate() })
slider.addEventListener('pointerdown', () => { if (!cameraOnly()) tracker?.stop() })
document.addEventListener('keydown', event => { if (event.code === 'KeyC' && document.fullscreenElement && !event.repeat) tracker?.stop() })
if (import.meta.hot) import.meta.hot.dispose(() => { tracker?.dispose(); scene?.dispose() })
