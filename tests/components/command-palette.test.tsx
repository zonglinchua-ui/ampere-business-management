import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { CommandPalette } from '@/components/CommandPalette'
import { GlobalSearchResult } from '@/lib/search'
import { assert, setupDom, test } from '../utils'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'

test('renders results and triggers navigation on selection', async () => {
  const dom = setupDom()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)

  let open = true
  let lastNavigate = ''
  const handleOpenChange = (value: boolean) => {
    open = value
  }

  const results: GlobalSearchResult[] = [
    {
      id: 'sup-1',
      type: 'supplier',
      title: 'Supplier One',
      subtitle: 'Alex',
      href: '/suppliers/1'
    },
    {
      id: 'proj-1',
      type: 'project',
      title: 'Project One (PRJ-001)',
      subtitle: 'Acme Corp',
      status: 'ACTIVE',
      href: '/projects/1'
    }
  ]

  const searcher = async () => results
  const router = {
    back() {},
    forward() {},
    refresh() {},
    replace() {},
    prefetch: async () => {},
    push: (href: string) => {
      lastNavigate = href
    }
  }

  const root = createRoot(container)
  await act(async () => {
    root.render(
      <AppRouterContext.Provider value={router as any}>
        <CommandPalette
          open={open}
          onOpenChange={handleOpenChange}
          recentResults={results}
          searcher={searcher}
          searchDebounceMs={0}
          testMode
          onNavigate={(href) => {
            lastNavigate = href
          }}
        />
      </AppRouterContext.Provider>
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  const input = container.querySelector('[data-testid="command-palette"] input') as HTMLInputElement

  assert.ok(input)

  await act(async () => {
    input.value = 'sup'
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  const commandItem = dom.window.document.querySelector('[cmdk-item]') as HTMLElement
  assert.ok(commandItem)

  await act(async () => {
    commandItem.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  await act(async () => {
    root.render(
      <AppRouterContext.Provider value={router as any}>
        <CommandPalette
          open={open}
          onOpenChange={handleOpenChange}
          recentResults={results}
          searcher={searcher}
          searchDebounceMs={0}
          testMode
          onNavigate={(href) => {
            lastNavigate = href
          }}
        />
      </AppRouterContext.Provider>
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  assert.strictEqual(lastNavigate, '/suppliers/1')
  assert.strictEqual(open, false)

  root.unmount()
})

test('hides palette content when closed', async () => {
  const dom = setupDom()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)

  let open = true
  const toggleOpen = (value: boolean) => {
    open = value
  }

  const results: GlobalSearchResult[] = [
    {
      id: 'sup-1',
      type: 'supplier',
      title: 'Supplier One',
      href: '/suppliers/1'
    }
  ]

  const root = createRoot(container)
  await act(async () => {
    root.render(
      <AppRouterContext.Provider
        value={{
          back() {},
          forward() {},
          refresh() {},
          replace() {},
          prefetch: async () => {},
          push: () => {}
        } as any}
      >
        <CommandPalette
          open={open}
          onOpenChange={toggleOpen}
          recentResults={results}
          searcher={async () => results}
          searchDebounceMs={0}
          testMode
        />
      </AppRouterContext.Provider>
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  assert.ok(container.querySelector('[data-testid="command-palette"] input'))

  await act(async () => {
    toggleOpen(false)
    root.render(
      <AppRouterContext.Provider
        value={{
          back() {},
          forward() {},
          refresh() {},
          replace() {},
          prefetch: async () => {},
          push: () => {}
        } as any}
      >
        <CommandPalette
          open={open}
          onOpenChange={toggleOpen}
          recentResults={results}
          searcher={async () => results}
          searchDebounceMs={0}
          testMode
        />
      </AppRouterContext.Provider>
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  const dialogInput = container.querySelector('[data-testid="command-palette"] input')
  assert.ok(!dialogInput)

  root.unmount()
})
