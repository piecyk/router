# TanStack Router - Stack Pages Example

An example of a stack of pages: any page opens as a panel on top of the current one, and the page below keeps its exact state. Each page of the stack renders in its own child router (`createRouter({ parent, location })`).

- [TanStack Router Docs](https://tanstack.com/router)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/stack-pages stack-pages
```

## Getting Started

Install dependencies:

```sh
pnpm install
```

Start the development server:

```sh
pnpm dev
```

## Build

Build for production:

```sh
pnpm build
```

## About This Example

This example demonstrates:

- Child routers that render a location other than the URL
- A stack of pages kept in history state; the URL is always the top page
- The page under a panel keeps its search params, local state and scroll
- Closing a panel and browser Back return to the untouched page below
