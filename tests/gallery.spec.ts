import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const artworkNames = ['Aperture', 'Fold', 'Ribbon', 'Orbit', 'Moiré', 'Vortex']

test('all six artworks have distinct nonblank left and right views on desktop and mobile', async ({ page }, testInfo) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 640], [844, 430]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.locator('#art')).toHaveAttribute('data-ready', 'true')
    const signatures = new Set<string>()
    for (const piece of artworkNames) {
      await page.getByRole('button', { name: piece, exact: true }).click()
      await expect(page.locator('#art-title')).toHaveText(piece)
      await expect(page.locator('#piece-index')).toHaveText(`${String(artworkNames.indexOf(piece) + 1).padStart(2, '0')} / 06`)
      const frames: number[][] = []
      for (const angle of [-90, 90]) {
        await page.locator('#angle').fill(String(angle))
        await expect(page.locator('#art')).toHaveAttribute('data-view', (angle / 100).toFixed(4))
        const sample = await page.locator('#art').evaluate((canvas: HTMLCanvasElement) => {
          const snapshot = document.createElement('canvas'); snapshot.width = 128; snapshot.height = 128
          const context = snapshot.getContext('2d')!
          context.drawImage(canvas, 0, 0, 128, 128)
          const pixels = [...context.getImageData(0, 0, 128, 128).data]
          let colour = 0
          for (let index = 0; index < pixels.length; index += 4) if (Math.max(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!) - Math.min(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!) > 30) colour++
          return { pixels, fraction: colour / (128 * 128) }
        })
        expect(sample.fraction, `${piece} at ${width}`).toBeGreaterThan(.015)
        frames.push(sample.pixels)
        await page.screenshot({ path: testInfo.outputPath(`${piece}-${width}-${angle}.png`) })
      }
      const difference = frames[0]!.reduce((total, value, index) => total + Math.abs(value - frames[1]![index]!), 0) / frames[0]!.length
      expect(difference, piece).toBeGreaterThan(1.2)
      signatures.add(frames[0]!.join(','))
    }
    expect(signatures.size).toBe(6)
    const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, clipped: [...document.querySelectorAll<HTMLElement>('button, h1, .brand, #angle')].filter(element => element.getBoundingClientRect().width).some(element => { const box = element.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth + 1 || box.top < 0 || box.bottom > innerHeight + 1 }) }))
    expect(geometry).toEqual({ overflow: false, clipped: false })
  }
  expect(errors).toEqual([])
})

test('Vortex blends colour palettes with viewing angle and restores its centre view', async ({ page, browserName }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const canvas = page.locator('#art')
    await expect(canvas).toHaveAttribute('data-ready', 'true')
    await page.getByRole('button', { name: 'Vortex', exact: true }).click()
    for (const fullscreen of browserName === 'chromium' ? [false, true] : [false]) {
      if (fullscreen) {
        await page.getByRole('button', { name: 'Enter fullscreen' }).click()
        await expect(canvas).toHaveAttribute('data-quality', 'full-definition')
      }
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const centre = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
      for (const angle of [-90, 0, 90, 0]) {
        if (fullscreen) {
          await page.keyboard.press('Escape')
          await expect(canvas).toHaveAttribute('data-presentation', 'gallery')
        }
        await page.locator('#angle').fill(String(angle))
        await expect(canvas).toHaveAttribute('data-view', (angle / 100).toFixed(4))
        if (fullscreen) {
          await page.getByRole('button', { name: 'Enter fullscreen' }).click()
          await expect(canvas).toHaveAttribute('data-quality', 'full-definition')
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        }
        const colour = await canvas.evaluate((element: HTMLCanvasElement) => {
          const snapshot = document.createElement('canvas'); snapshot.width = 128; snapshot.height = 128
          const context = snapshot.getContext('2d')!
          context.drawImage(element, 0, 0, 128, 128)
          const pixels = context.getImageData(0, 0, 128, 128).data
          let green = 0
          let blue = 0
          for (let offset = 0; offset < pixels.length; offset += 4) {
            const redValue = pixels[offset]!, greenValue = pixels[offset + 1]!, blueValue = pixels[offset + 2]!
            if (greenValue > redValue * 1.2 && greenValue > blueValue * 1.2 && greenValue > 45) green++
            if (blueValue > redValue * 1.2 && blueValue > greenValue * 1.2 && blueValue > 45) blue++
          }
          return { green: green / (128 * 128), blue: blue / (128 * 128) }
        })
        if (angle < 0) { expect(colour.green).toBeGreaterThan(.04); expect(colour.blue).toBeLessThan(.01) }
        if (angle > 0) { expect(colour.blue).toBeGreaterThan(.04); expect(colour.green).toBeLessThan(.01) }
        if (angle === 0) expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(centre)
        await page.screenshot({ path: testInfo.outputPath(`vortex-colour-${width}-${fullscreen ? 'fullscreen' : 'gallery'}-${angle}.png`) })
      }
      if (fullscreen) {
        await expect(canvas).toHaveAttribute('data-render-scale', '2')
        await expect(page.locator('button:visible')).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(canvas).toHaveAttribute('data-presentation', 'gallery')
      }
    }
  }
})

test('Aperture retains curved shading and view-responsive gloss', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#art')).toHaveAttribute('data-ready', 'true')
  const highlights: number[] = []
  for (const angle of [-.7, .7]) {
    await page.locator('#angle').fill(String(angle * 100))
    await expect(page.locator('#art')).toHaveAttribute('data-view', angle.toFixed(4))
    const shading = await page.locator('#art').evaluate((canvas: HTMLCanvasElement, angle) => {
      const bounds = canvas.getBoundingClientRect()
      const aspect = bounds.width / bounds.height
      const scale = Math.max(4.6, 4.75 / aspect)
      const identity = 6
      const centreX = .52 + angle * .16
      const centreY = Math.sin(angle * 2.2 + identity * .73) * .23
      const radius = .25 + Math.sin(identity) * .012
      const snapshot = document.createElement('canvas')
      snapshot.width = canvas.width; snapshot.height = canvas.height
      const context = snapshot.getContext('2d')!
      context.drawImage(canvas, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let brightest = 0
      let darkest = 1
      let highlightX = 0
      for (let row = -16; row <= 16; row++) for (let column = -16; column <= 16; column++) {
        const normalX = column / 20
        const normalY = row / 20
        if (normalX * normalX + normalY * normalY > .64) continue
        const pointX = centreX + normalX * radius / 1.05
        const pointY = centreY + normalY * radius / 1.20
        const pixelX = Math.floor((pointX / (aspect * scale) + .5) * canvas.width)
        const pixelY = Math.floor((.5 - (pointY + .08) / scale) * canvas.height)
        const offset = (pixelY * canvas.width + pixelX) * 4
        const luminance = (pixels[offset]! * .2126 + pixels[offset + 1]! * .7152 + pixels[offset + 2]! * .0722) / 255
        if (luminance > brightest) { brightest = luminance; highlightX = normalX }
        darkest = Math.min(darkest, luminance)
      }
      return { brightest, darkest, highlightX }
    }, angle)
    expect(shading.brightest).toBeGreaterThan(.65)
    expect(shading.brightest - shading.darkest).toBeGreaterThan(.4)
    highlights.push(shading.highlightX)
  }
  expect(highlights[1]! - highlights[0]!).toBeGreaterThan(.15)
})

test('pointer, keyboard, auto sweep, reset and reduced motion share the same view', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 640, height: 480 })
  await page.clock.install()
  await page.goto('/')
  const canvas = page.locator('#art')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
  const bounds = (await canvas.boundingBox())!
  await canvas.dispatchEvent('pointermove', { clientX: bounds.x + bounds.width * .9, clientY: bounds.y + bounds.height / 2 })
  await page.clock.runFor(700)
  expect(Number(await canvas.getAttribute('data-view'))).toBeGreaterThan(.7)
  await canvas.focus(); await page.keyboard.press('ArrowLeft'); await page.clock.runFor(700)
  expect(Number(await canvas.getAttribute('data-view'))).toBeLessThan(.72)
  await page.keyboard.press('ArrowDown')
  await expect(canvas).toHaveAttribute('data-piece', '1')
  await expect(page.locator('#art-title')).toHaveText('Fold')
  await page.getByRole('button', { name: 'Start automatic sweep' }).click()
  await page.clock.runFor(2000)
  const before = await canvas.getAttribute('data-view')
  await page.clock.runFor(2000)
  expect(await canvas.getAttribute('data-view')).not.toBe(before)
  await page.getByRole('button', { name: 'Centre view' }).click()
  await page.clock.runFor(1000)
  expect(Math.abs(Number(await canvas.getAttribute('data-view')))).toBeLessThan(.001)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Start automatic sweep' }).click()
  await expect(page.locator('#auto')).toHaveAttribute('aria-pressed', 'false')
  await page.locator('#angle').fill('-60')
  await page.clock.runFor(50)
  await expect(canvas).toHaveAttribute('data-view', '-0.6000')
})

test('camera mode selector fits the header and supports keyboard selection', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  for (const [width, height] of [[1440, 1000], [901, 768], [768, 768], [640, 480], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height })
    const boxes = await page.locator('.identity, .tracking-modes, .header-tools').evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect()
      return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }
    }))
    for (const [index, bounds] of boxes.entries()) {
      expect(bounds.left).toBeGreaterThanOrEqual(0)
      expect(bounds.right).toBeLessThanOrEqual(width)
      for (const other of boxes.slice(index + 1)) expect(bounds.right <= other.left || other.right <= bounds.left || bounds.bottom <= other.top || other.bottom <= bounds.top).toBe(true)
    }
    await page.getByRole('radio', { name: 'Body', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Face + Hands', exact: true })).toBeChecked()
    await expect(page.locator('#art')).toHaveAttribute('data-piece', '0')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('radio', { name: 'Body', exact: true })).toBeChecked()
    await page.getByRole('button', { name: 'Fold', exact: true }).click()
    await page.locator('#angle').fill('90')
    await expect.poll(async () => Number(await page.locator('#art').getAttribute('data-view'))).toBeGreaterThan(.89)
    await page.screenshot({ path: testInfo.outputPath(`modes-${width}.png`) })
    await page.getByRole('button', { name: 'Aperture', exact: true }).click()
  }
})

test('interface passes accessibility checks and opens with the camera off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#camera')).toHaveAttribute('aria-pressed', 'false')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  }
})

test('artist statements follow each piece and dismiss accessibly without shifting the artwork', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 640], [844, 430]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const statements = new Set<string>()
    const canvas = page.locator('#art')
    const dialog = page.getByRole('dialog')
    const close = page.getByRole('button', { name: 'Close artist statement' })
    for (const [index, name] of artworkNames.entries()) {
      await page.getByRole('button', { name, exact: true }).click()
      const bounds = await canvas.boundingBox()
      const info = page.getByRole('button', { name: `About ${name}`, exact: true })
      await info.click()
      await expect(dialog).toHaveAccessibleName(name)
      await expect(close).toBeFocused()
      await expect(dialog.locator('#statement-copy p')).toHaveCount(2)
      expect(await dialog.evaluate(element => {
        const background = [...document.querySelectorAll('#app > :not(.statement-dialog)')]
        return { backgroundBlurred: background.every(section => getComputedStyle(section).filter === 'blur(8px)'), dialogFilter: getComputedStyle(element).filter }
      })).toEqual({ backgroundBlurred: true, dialogFilter: 'none' })
      statements.add(await dialog.locator('#statement-copy').innerText())
      await page.keyboard.press('Tab')
      await canvas.evaluate(element => element.focus())
      await expect(canvas).not.toBeFocused()
      await dialog.evaluate(element => element.focus())
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Space')
      await expect(canvas).toHaveAttribute('data-piece', String(index))
      await expect(page.locator('#auto')).toHaveAttribute('aria-pressed', 'false')
      const geometry = await dialog.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        return { fits: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight, overflow: element.scrollWidth > element.clientWidth }
      })
      expect(geometry).toEqual({ fits: true, overflow: false })
      expect(await canvas.boundingBox()).toEqual(bounds)
      if (name === 'Aperture') {
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
        await page.screenshot({ path: testInfo.outputPath(`statement-${width}.png`) })
      }
      if (index % 3 === 0) await page.keyboard.press('Escape')
      else if (index % 3 === 1) await close.click()
      else await page.mouse.click(5, 5)
      await expect(dialog).not.toBeVisible()
      await expect(info).toBeFocused()
      expect(await page.locator('.gallery').evaluate(element => getComputedStyle(element).filter)).toBe('none')
      const title = (await page.locator('#art-title').boundingBox())!
      const icon = (await info.boundingBox())!
      const swatches = (await page.locator('#swatches').boundingBox())!
      expect(icon.x).toBeGreaterThanOrEqual(title.x + title.width)
      expect(icon.x + icon.width).toBeLessThanOrEqual(swatches.x)
    }
    expect(statements.size).toBe(6)
  }
})

test('fullscreen gives the artwork the whole canvas and retains keyboard navigation', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen checked in Chromium.')
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('app')
  await expect(page.locator('button:visible')).toHaveCount(0)
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#art')).toHaveAttribute('data-piece', '1')
  await expect(page.locator('#art-title')).toHaveText('Fold')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible()
})

test('Retina backing store scales without changing composition or control geometry', async ({ browser }) => {
  for (const ratio of [1, 2]) {
    const context = await browser.newContext({ deviceScaleFactor: ratio, viewport: { width: 1024, height: 768 } })
    const page = await context.newPage(); await page.goto('/')
    await expect(page.locator('#art')).toHaveAttribute('data-ready', 'true')
    const dimensions = await page.locator('#art').evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight }))
    expect(dimensions.width).toBe(dimensions.cssWidth * ratio)
    expect(dimensions.height).toBe(dimensions.cssHeight * ratio)
    await context.close()
  }
})

test('fullscreen locks full definition at 2x or higher native density even during slow frames', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen checked in Chromium.')
  test.setTimeout(180000)
  for (const ratio of [1, 2, 3]) {
    const context = await browser.newContext({ deviceScaleFactor: ratio, viewport: { width: 640, height: 480 } })
    try {
      const page = await context.newPage()
      await page.addInitScript(() => {
        const nativeFrame = requestAnimationFrame.bind(window)
        let lastTimestamp = -1
        let simulatedTimestamp = 0
        window.requestAnimationFrame = callback => nativeFrame(timestamp => {
          if (timestamp !== lastTimestamp) { lastTimestamp = timestamp; simulatedTimestamp += 50 }
          callback(simulatedTimestamp)
        })
      })
      await page.goto('/')
      await expect(page.locator('#art')).toHaveAttribute('data-ready', 'true')
      await page.getByRole('button', { name: 'Ribbon', exact: true }).click()
      await page.getByRole('button', { name: 'Start automatic sweep' }).click()
      await page.evaluate(() => new Promise<void>(resolve => {
        let remaining = 110
        const frame = () => { if (--remaining) requestAnimationFrame(frame); else resolve() }
        requestAnimationFrame(frame)
      }))
      await expect(page.locator('#art')).toHaveAttribute('data-render-scale', '1')
      await page.getByRole('button', { name: 'Enter fullscreen' }).click()
      await expect(page.locator('#art')).toHaveAttribute('data-quality', 'full-definition')
      const expected = Math.max(2, ratio)
      const measure = () => page.locator('#art').evaluate((canvas: HTMLCanvasElement) => {
        const bounds = canvas.getBoundingClientRect()
        const context = canvas.getContext('webgl2')!
        return { scale: Number(canvas.dataset.renderScale), width: canvas.width, height: canvas.height, gpuWidth: context.drawingBufferWidth, gpuHeight: context.drawingBufferHeight, cssWidth: bounds.width, cssHeight: bounds.height }
      })
      const before = await measure()
      expect(before.scale).toBe(expected)
      expect(before.width).toBe(Math.floor(before.cssWidth * expected))
      expect(before.height).toBe(Math.floor(before.cssHeight * expected))
      expect(before.gpuWidth).toBe(before.width)
      expect(before.gpuHeight).toBe(before.height)
      await expect(page.locator('#auto')).toHaveAttribute('aria-pressed', 'false')
      await page.evaluate(() => new Promise<void>(resolve => {
        let remaining = 110
        const frame = () => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
          if (--remaining) requestAnimationFrame(frame); else resolve()
        }
        requestAnimationFrame(frame)
      }))
      expect(await measure()).toEqual(before)
      await page.keyboard.press('Escape')
      await expect(page.locator('#art')).toHaveAttribute('data-quality', 'auto')
      await expect(page.locator('#art')).toHaveAttribute('data-render-scale', '1')
    } finally { await context.close() }
  }
})

test('fullscreen Ribbon boundaries remain crisp within physical pixels', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen checked in Chromium.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ribbon', exact: true }).click()
  await page.getByRole('button', { name: 'Enter fullscreen' }).click()
  await expect(page.locator('#art')).toHaveAttribute('data-quality', 'full-definition')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const boundary = await page.locator('#art').evaluate((canvas: HTMLCanvasElement) => {
    const snapshot = document.createElement('canvas'); snapshot.width = canvas.width; snapshot.height = canvas.height
    const context = snapshot.getContext('2d')!
    context.drawImage(canvas, 0, 0)
    const pixels = context.getImageData(Math.floor(canvas.width / 2) - 24, Math.floor(canvas.height / 2), 49, 1).data
    const differences: number[] = []
    for (let column = 1; column < 49; column++) {
      const offset = column * 4
      differences.push((Math.abs(pixels[offset]! - pixels[offset - 4]!) + Math.abs(pixels[offset + 1]! - pixels[offset - 3]!) + Math.abs(pixels[offset + 2]! - pixels[offset - 2]!)) / 3)
    }
    const firstEdge = differences.findIndex(value => value > 5)
    const lastEdge = differences.findLastIndex(value => value > 5)
    return { peak: Math.max(...differences), transitionWidth: lastEdge - firstEdge + 1 }
  })
  expect(boundary.peak).toBeGreaterThan(35)
  expect(boundary.transitionWidth).toBeLessThanOrEqual(3)
  await page.screenshot({ path: testInfo.outputPath('ribbon-full-definition.png') })
})

test('fullscreen reports a constrained GPU resolution instead of silently overclaiming quality', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen checked in Chromium.')
  await page.addInitScript(() => {
    const getParameter = WebGL2RenderingContext.prototype.getParameter
    WebGL2RenderingContext.prototype.getParameter = function (parameter: number) {
      if (parameter === this.MAX_RENDERBUFFER_SIZE || parameter === this.MAX_TEXTURE_SIZE) return 1024
      if (parameter === this.MAX_VIEWPORT_DIMS) return new Int32Array([1024, 1024])
      return getParameter.call(this, parameter)
    }
  })
  await page.goto('/')
  await expect(page.locator('#art')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Enter fullscreen' }).click()
  await expect(page.locator('#art')).toHaveAttribute('data-resolution-limited', 'true')
  await expect(page.locator('#render-error')).toContainText('graphics device limits rendering')
  const resolution = await page.locator('#art').evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height, scale: Number(canvas.dataset.renderScale), requested: Number(canvas.dataset.requestedScale) }))
  expect(resolution.width).toBeLessThanOrEqual(1024)
  expect(resolution.height).toBeLessThanOrEqual(1024)
  expect(resolution.scale).toBeLessThan(resolution.requested)
})

test('fullscreen artwork reaches every edge across wide, square and tall screens', async ({ browser, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen checked in Chromium.')
  test.setTimeout(90000)
  for (const [width, height] of [[1440, 900], [2560, 720], [900, 900], [390, 844], [360, 1200]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    try {
      const page = await context.newPage()
      await page.goto('/')
      const canvas = page.locator('#art')
      await expect(canvas).toHaveAttribute('data-ready', 'true')
      await page.evaluate(() => document.fonts.ready)
      const gallery = await canvas.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height, pixels: element.toDataURL() }))
      await page.getByRole('button', { name: 'Enter fullscreen' }).click()
      await expect(canvas).toHaveAttribute('data-presentation', 'full-bleed')
      await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
        const bounds = element.getBoundingClientRect()
        return bounds.width === innerWidth && bounds.height === innerHeight && bounds.left === 0 && bounds.top === 0
      })).toBe(true)
      for (const piece of artworkNames) {
        if (piece !== 'Aperture') await page.keyboard.press('ArrowDown')
        await expect(page.locator('#art-title')).toHaveText(piece)
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const edges = await canvas.evaluate((element: HTMLCanvasElement) => {
          const snapshot = document.createElement('canvas'); snapshot.width = 256; snapshot.height = 256
          const context = snapshot.getContext('2d')!
          context.drawImage(element, 0, 0, 256, 256)
          const pixels = context.getImageData(0, 0, 256, 256).data
          const edgeCounts = [0, 0, 0, 0]
          for (let row = 0; row < 256; row++) for (let column = 0; column < 256; column++) {
            const offset = (row * 256 + column) * 4
            if (Math.min(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!) >= 180) continue
            if (column < 20) edgeCounts[0]!++
            if (column >= 236) edgeCounts[1]!++
            if (row < 20) edgeCounts[2]!++
            if (row >= 236) edgeCounts[3]!++
          }
          return edgeCounts.map(count => count / (20 * 256))
        })
        for (const coverage of edges) expect(coverage, `${piece} edges at ${width}x${height}`).toBeGreaterThan(.08)
        await expect(page.locator('button:visible')).toHaveCount(0)
        await page.screenshot({ path: testInfo.outputPath(`full-bleed-${piece}-${width}x${height}.png`) })
      }
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Escape')
      await expect(canvas).toHaveAttribute('data-presentation', 'gallery')
      await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height }))).toEqual({ width: gallery.width, height: gallery.height })
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(gallery.pixels)
    } finally { await context.close() }
  }
})

test('fullscreen Aperture packs medium-sized forms into more rows without flattening them', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native fullscreen checked in Chromium.')
  for (const [width, height, expectedRows] of [[1440, 900, 5], [390, 844, 9]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    try {
      const page = await context.newPage()
      await page.goto('/')
      await page.getByRole('button', { name: 'Enter fullscreen' }).click()
      await expect(page.locator('#art')).toHaveAttribute('data-quality', 'full-definition')
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const density = await page.locator('#art').evaluate((canvas: HTMLCanvasElement) => {
        const snapshot = document.createElement('canvas'); snapshot.width = 256; snapshot.height = 512
        const context = snapshot.getContext('2d')!
        context.drawImage(canvas, 0, 0, 256, 512)
        const pixels = context.getImageData(0, 0, 256, 512).data
        let rows = 0
        let previous = false
        let solidRows = 0
        for (let row = 0; row < 512; row++) {
          let dark = 0
          for (let column = 0; column < 256; column++) {
            const offset = (row * 256 + column) * 4
            if (Math.min(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!) < 120) dark++
          }
          const filled = dark > 256 * .18
          if (filled && !previous) rows++
          if (filled) solidRows++
          previous = filled
        }
        return { rows, coverage: solidRows / 512 }
      })
      expect(density.rows).toBe(expectedRows)
      expect(density.coverage).toBeGreaterThan(.7)
      expect(density.coverage).toBeLessThan(.9)
      await expect(page.locator('#art')).toHaveAttribute('data-render-scale', '2')
    } finally { await context.close() }
  }
})

test('keyboard navigation wraps through the complete six-piece series', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('#art')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  await canvas.focus()
  await page.keyboard.press('ArrowUp')
  await expect(canvas).toHaveAttribute('data-piece', '5')
  await expect(page.locator('#art-title')).toHaveText('Vortex')
  for (const [index, name] of artworkNames.entries()) {
    await page.keyboard.press('ArrowDown')
    await expect(canvas).toHaveAttribute('data-piece', String(index))
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  await page.keyboard.press('ArrowDown')
  await expect(canvas).toHaveAttribute('data-piece', '0')
})

test('graphics context loss gives feedback and restores the selected artwork', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Context-loss extension checked in Chromium.')
  await page.goto('/')
  await page.getByRole('button', { name: 'Ribbon', exact: true }).click()
  await expect(page.locator('#art')).toHaveAttribute('data-piece', '2')
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#art')!
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!
    Object.defineProperty(window, 'restoreGraphics', { value: () => extension.restoreContext() })
    extension.loseContext()
  })
  await expect(page.locator('#render-error')).toContainText('Restoring')
  await page.evaluate(() => (window as unknown as { restoreGraphics: () => void }).restoreGraphics())
  await expect(page.locator('#render-error')).toBeHidden()
  await page.locator('#angle').fill('80')
  await expect.poll(async () => Number(await page.locator('#art').getAttribute('data-view'))).toBeGreaterThan(.75)
  await expect(page.locator('#art')).toHaveAttribute('data-piece', '2')
})