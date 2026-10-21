import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  Link,
  Outlet,
  RouterProvider,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useBlocker,
  useLocation,
} from '../src'
import type { RouterHistory } from '../src'

let history: RouterHistory

beforeEach(() => {
  window.history.replaceState(null, '', '/a')
  history = createBrowserHistory()
})

afterEach(() => {
  history.destroy()
  window.history.replaceState(null, 'root', '/')
  vi.restoreAllMocks()
  cleanup()
})

function setup({
  childLocation = '/b/1',
  shouldBlockFn = () => false,
  trailingSlash,
}: {
  childLocation?: string
  shouldBlockFn?: () => boolean
  trailingSlash?: 'always' | 'never' | 'preserve'
} = {}) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const aRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/a',
    component: () => <h1>page a</h1>,
  })
  const bRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/b/$id',
    component: function B() {
      const { id } = bRoute.useParams()
      const location = useLocation()
      useBlocker({ shouldBlockFn, enableBeforeUnload: false })
      return (
        <section aria-label="child">
          <p>
            b {id} at {location.href}
          </p>
          <Link to="." search={{ tab: 'x' }}>
            same page with tab
          </Link>
        </section>
      )
    },
  })
  const routeTree = rootRoute.addChildren([aRoute, bRoute])

  const parent = createRouter({ routeTree, history, trailingSlash })
  const child = createRouter({
    routeTree,
    trailingSlash,
    parent,
    location: childLocation,
  })

  render(
    <>
      <RouterProvider router={parent} />
      <RouterProvider router={child} />
    </>,
  )

  return { parent, child }
}

describe('child routers', () => {
  test('renders its own location while the parent keeps the URL', async () => {
    setup()

    expect(await screen.findByText('page a')).toBeInTheDocument()
    expect(await screen.findByText('b 1 at /b/1')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/a')
  })

  test('navigates the parent history, relative to its own location', async () => {
    setup()

    fireEvent.click(await screen.findByText('same page with tab'))

    await vi.waitFor(() =>
      expect(window.location.pathname + window.location.search).toBe(
        '/b/1?tab=x',
      ),
    )
    expect(screen.getByText('b 1 at /b/1')).toBeInTheDocument()
  })

  test('does not replace the URL with its canonical location', async () => {
    setup({ childLocation: '/b/1/', trailingSlash: 'never' })

    expect(await screen.findByText(/^b 1 at/)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/a')
  })

  test('setLocation loads and renders the new location', async () => {
    const { child } = setup()
    await screen.findByText('b 1 at /b/1')

    await act(() => child.setLocation('/b/2'))

    expect(await screen.findByText('b 2 at /b/2')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/a')
  })

  test('installs no global listeners and leaves the global router to the parent', async () => {
    const rootRoute = createRootRoute()
    const parent = createRouter({ routeTree: rootRoute, history })
    const addDocumentListener = vi.spyOn(document, 'addEventListener')
    const addWindowListener = vi.spyOn(window, 'addEventListener')

    createRouter({
      routeTree: rootRoute,
      parent,
      location: '/b/1',
      scrollRestoration: true,
    })

    expect(addDocumentListener).not.toHaveBeenCalled()
    expect(addWindowListener).not.toHaveBeenCalled()
    expect((self as any).__TSR_ROUTER__).toBe(parent)
  })

  test.each([
    { block: true, expected: '/a' },
    { block: false, expected: '/b/3' },
  ])(
    'a blocker inside a child applies to parent navigations (block: $block)',
    async ({ block, expected }) => {
      const shouldBlockFn = vi.fn(() => block)
      const { parent } = setup({ shouldBlockFn })
      await screen.findByText('b 1 at /b/1')

      // A blocked navigation never settles, so it is not awaited.
      act(() => {
        void parent.navigate({ to: '/b/$id', params: { id: '3' } })
      })

      await vi.waitFor(() => expect(shouldBlockFn).toHaveBeenCalled())
      await vi.waitFor(() => expect(window.location.pathname).toBe(expected))
    },
  )
})
