import * as React from 'react'
import ReactDOM from 'react-dom/client'
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  useLocation,
  useRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { AnyRouter } from '@tanstack/react-router'
import './styles.css'

declare module '@tanstack/react-router' {
  interface HistoryState {
    // The pages under the current one, bottom first. The URL is always the top page.
    stack?: Array<string>
  }
}

const items = Array.from({ length: 50 }, (_, i) => ({
  id: String(i + 1),
  name: `Item ${i + 1}`,
}))

// The main router only renders the stack. Every page of the stack renders in its own
// child router, so a page under a panel stays mounted with its state.
const rootRoute = createRootRouteWithContext<{ child: boolean }>()({
  component: function Root() {
    return rootRoute.useRouteContext().child ? <Outlet /> : <RootComponent />
  },
})

function RootComponent() {
  return (
    <>
      <div className="p-2 flex gap-2 text-lg border-b">
        <Link to="/items" activeProps={{ className: 'font-bold' }}>
          Items
        </Link>
      </div>
      <Stack />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}

const MainRouterContext = React.createContext<AnyRouter | null>(null)

function Stack() {
  const router = useRouter()
  const location = useLocation()
  const hrefs = [...(location.state.stack ?? []), location.href]

  const close = (depth: number) =>
    router.navigate({
      href: hrefs[depth - 1],
      state: { stack: hrefs.slice(0, depth - 1) },
    })

  return (
    <MainRouterContext.Provider value={router}>
      {hrefs.map((href, depth) =>
        depth === 0 ? (
          <Page key={depth} href={href} />
        ) : (
          <Panel key={depth} depth={depth} onClose={() => close(depth)}>
            <Page href={href} />
          </Panel>
        ),
      )}
    </MainRouterContext.Provider>
  )
}

function Page({ href }: { href: string }) {
  const parent = useRouter()
  const [router] = React.useState(() =>
    createRouter({
      routeTree,
      parent,
      location: href,
      context: { child: true },
    }),
  )

  React.useLayoutEffect(() => {
    if (router.latestLocation.href !== href) {
      void router.setLocation(href)
    }
  }, [router, href])

  return <RouterProvider router={router} />
}

function Panel({
  depth,
  onClose,
  children,
}: {
  depth: number
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 w-[min(32rem,90vw)] overflow-auto bg-white shadow-xl dark:bg-gray-800"
        style={{ marginRight: (depth - 1) * 16 }}
      >
        {children}
      </div>
    </>
  )
}

// Navigations run on the page's own child router; the child hands them to the main router.
function useStack() {
  const main = React.useContext(MainRouterContext)!
  const router = useRouter()

  const current = () => main.state.location
  const stack = () => current().state.stack ?? []

  return {
    open: (href: string) =>
      router.navigate({
        href,
        state: { stack: [...stack(), current().href] },
      }),
    close: () => {
      const below = stack()
      const prev = below.at(-1)
      return prev
        ? router.navigate({ href: prev, state: { stack: below.slice(0, -1) } })
        : router.navigate({ to: '/items' })
    },
  }
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/items' })
  },
})

const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/items',
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: ItemsComponent,
})

function ItemsComponent() {
  const { q = '' } = itemsRoute.useSearch()
  const navigate = itemsRoute.useNavigate()
  const stack = useStack()
  const [notes, setNotes] = React.useState('')

  const visible = items.filter((item) =>
    item.name.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="p-2 space-y-2">
      <h3>Items</h3>
      <input
        className="border p-1"
        placeholder="Filter"
        value={q}
        onChange={(e) =>
          navigate({
            search: { q: e.target.value || undefined },
            replace: true,
          })
        }
      />
      <textarea
        className="block w-full border p-1"
        placeholder="Notes (local state, kept while a panel is open)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <ul>
        {visible.map((item) => (
          <li key={item.id} className="flex gap-2 py-2 border-b">
            <span className="flex-1">{item.name}</span>
            <button
              className="text-blue-600"
              onClick={() => stack.open(`/items/${item.id}`)}
            >
              Open
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const itemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/items/$itemId',
  component: ItemComponent,
})

function ItemComponent() {
  const { itemId } = itemRoute.useParams()
  const stack = useStack()
  const [count, setCount] = React.useState(0)
  const next = String((Number(itemId) % items.length) + 1)

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xl">Item {itemId}</h3>
      <button className="border px-2" onClick={() => setCount((c) => c + 1)}>
        Clicked {count} times
      </button>
      <div className="flex flex-col gap-2">
        <button
          className="text-blue-600 text-left"
          onClick={() => stack.open(`/items/${next}`)}
        >
          Open item {next} on top
        </button>
        <Link
          className="text-blue-600"
          to="/items/$itemId"
          params={{ itemId: next }}
        >
          Go to item {next} (replaces the stack)
        </Link>
        <button className="text-blue-600 text-left" onClick={stack.close}>
          Close
        </button>
      </div>
    </div>
  )
}

const routeTree = rootRoute.addChildren([indexRoute, itemsRoute, itemRoute])

const router = createRouter({
  routeTree,
  context: { child: false },
  // The pages stay mounted, so the window must not scroll to the top on navigation.
  scrollRestoration: () => false,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}
