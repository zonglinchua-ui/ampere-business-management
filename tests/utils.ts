import assert from 'node:assert'
import { JSDOM } from 'jsdom'

export type TestFunction = () => Promise<void> | void

const tests: { name: string; fn: TestFunction }[] = []

export function test(name: string, fn: TestFunction) {
  tests.push({ name, fn })
}

export async function run() {
  let failed = false
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`✔ ${name}`)
    } catch (error) {
      failed = true
      console.error(`✖ ${name}`)
      console.error(error)
    }
  }

  if (failed) {
    process.exitCode = 1
  }
}

export function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })

  const { window } = dom
  const assignGlobal = (key: string, value: unknown) => {
    Object.defineProperty(global as any, key, {
      value,
      configurable: true,
      writable: true
    })
  }

  assignGlobal('window', window)
  assignGlobal('document', window.document)
  assignGlobal('navigator', window.navigator)
  assignGlobal('HTMLElement', window.HTMLElement)
  assignGlobal('Node', window.Node)
  assignGlobal('MouseEvent', window.MouseEvent)
  assignGlobal('CustomEvent', window.CustomEvent)
  assignGlobal('getComputedStyle', window.getComputedStyle)

  const requestFrame = window.requestAnimationFrame || ((cb: FrameRequestCallback) => setTimeout(cb, 0))
  const cancelFrame = window.cancelAnimationFrame || ((id: number) => clearTimeout(id))

  assignGlobal('requestAnimationFrame', requestFrame)
  assignGlobal('cancelAnimationFrame', cancelFrame)
  assignGlobal('DOMRect', window.DOMRect)
  assignGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {}
  }

  if (!(window as any).ResizeObserver) {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    assignGlobal('ResizeObserver', ResizeObserver)
  } else {
    assignGlobal('ResizeObserver', (window as any).ResizeObserver)
  }

  return dom
}

export { assert }
