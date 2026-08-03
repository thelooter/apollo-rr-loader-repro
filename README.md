# apollo-client-integration-react-router: query slower than `streamTimeout` breaks hydration

Minimal reproduction for [apollographql/apollo-client-integrations#562](https://github.com/apollographql/apollo-client-integrations/issues/562).

## The bug

When a GraphQL query preloaded in a loader takes **longer than React Router's `streamTimeout`** (default `4950ms` in `encodeViaTurboStream`), React Router aborts the turbo-stream encode. The transported query ref is truncated, so on the client the Apollo link chain completes without ever emitting, and Apollo throws:

```
Invariant Violation: The link chain completed without emitting a value.
This is likely unintentional and should be updated to emit a value before completing.
```

That error propagates to the route's `ErrorBoundary`, so the user sees an error page — replacing HTML that had already rendered correctly on the server.

The failure mode is the complaint here, not the timeout itself:

- The error names none of the actual causes (`streamTimeout`, turbo-stream, a slow query).
- It surfaces as an unhandled render error rather than a timeout, so there's no obvious way to catch it and fall back to a client-side fetch.
- The threshold is invisible: `react-router reveal` scaffolds `streamTimeout = 5_000`, and nothing connects that number to Apollo.

**This is not React Router 8-specific** — React Router 7.18.2 behaves identically. See the matrix below.

## Results

| Query latency | React Router 7.18.2 | React Router 8.3.0 |
|---|---|---|
| **2000ms** (under `streamTimeout`) | ✅ TTFB 0.016s, data streams in, hydrates clean | ✅ TTFB 0.008s, data streams in, hydrates clean |
| **6000ms** (over `streamTimeout`) | ❌ fallback-only HTML, then `link chain completed` + error boundary | ❌ identical |

Under the timeout, everything works exactly as documented: the shell flushes immediately with the Suspense fallback, and the data streams into the same response.

## Reproducing

Requires Node 22+ and pnpm.

```bash
# terminal 1 — mock GraphQL API, 6s slower than streamTimeout
cd mock-api && DELAY_MS=6000 node server.mjs

# terminal 2 — pick one
cd rr8 && pnpm install && pnpm dev   # React Router 8.3.0
cd rr7 && pnpm install && pnpm dev   # React Router 7.18.2
```

Open the printed URL in a browser. You'll see `loading…`, then an **Oops!** error page with the invariant violation.

Now set `DELAY_MS=2000` and restart the API. The same page renders `1,425,119 items found` and hydrates cleanly.

To confirm the threshold is the cause rather than the latency, keep `DELAY_MS=6000` and raise the timeout:

```bash
STREAM_TIMEOUT=30000 pnpm dev
```

It works — at the cost of a 6s wait for the boundary to resolve.

### Measuring from the command line

Use a browser user-agent. `curl`'s default UA trips `isbot`, which selects `onAllReady` over `onShellReady` and hides the streaming behaviour entirely (`ttfb == total` on every request):

```bash
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
curl -s -A "$UA" -o /dev/null -w "ttfb=%{time_starttransfer}s total=%{time_total}s\n" http://localhost:5173/
```

## Layout

```
mock-api/server.mjs   zero-dependency GraphQL endpoint; DELAY_MS controls latency
rr8/                  React Router 8.3.0 + @apollo/client-integration-react-router 0.14.5-alpha.0
rr7/                  React Router 7.18.2, otherwise identical
```

Both apps are wired straight from the package README: `createApolloLoaderHandler` in `app/apollo.ts`, `ApolloProvider` in both entry files, `ApolloHydrationHelper` in the root layout, one route with `preloadQuery` + `useReadQuery`. `streamTimeout` is read from `STREAM_TIMEOUT` so it can be varied without editing files; it defaults to the scaffolded `5_000`.

The mock API returns canned JSON with no resolver work, so `DELAY_MS` *is* the query latency.

## Versions

`@apollo/client-integration-react-router` 0.14.5-alpha.0, `@apollo/client` 4.2.6, react/react-dom 19.2.7, Node 24.19.0. Vite 8 for rr8, Vite 6 for rr7.

## Side note: types don't resolve on newer React Router

`dist/index.d.ts` imports `CreateServerLoaderArgs` from `react-router/route-module`. That subpath exists in the `exports` map of react-router 7.2.0–7.5.0, but was removed during 7.x — it's absent from **7.9.5 onward and all of 8.x**:

```
dist/index.d.ts(3,40): error TS2307: Cannot find module 'react-router/route-module'
  or its corresponding type declarations.
```

With `skipLibCheck: true` (the React Router template default, and what both apps here use) this is silent, and `CreateServerLoaderArgs` degrades to `any` — which removes the constraint from `apolloLoader<Route.LoaderArgs>()`, the typing benefit the README advertises. The type now lives at `react-router/internal`.
