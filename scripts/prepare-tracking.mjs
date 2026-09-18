import { access, cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = resolve('node_modules/@mediapipe/tasks-vision')
const target = resolve('public/tracking')
await mkdir(target, { recursive: true })
await cp(`${source}/vision_bundle.js`, `${target}/vision_bundle.js`)
await cp(`${source}/wasm`, `${target}/wasm`, { recursive: true })
await access(`${target}/pose-landmarker-lite.task`).catch(() => { throw new Error('Local body model is missing. Restore public/tracking/pose-landmarker-lite.task; see README.md.') })
console.log('Local tracking runtime prepared. No camera or network access performed.')