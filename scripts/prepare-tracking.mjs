import { access, cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = resolve('node_modules/@mediapipe/tasks-vision')
const target = resolve('public/tracking')
await mkdir(target, { recursive: true })
await cp(`${source}/vision_bundle.js`, `${target}/vision_bundle.js`)
await cp(`${source}/wasm`, `${target}/wasm`, { recursive: true })
for (const model of ['pose-landmarker-lite.task', 'blaze-face.tflite', 'hand-landmarker.task']) {
	await access(`${target}/${model}`).catch(() => { throw new Error(`Local tracking model is missing: public/tracking/${model}; see README.md.`) })
}
console.log('Local tracking runtime prepared. No camera or network access performed.')