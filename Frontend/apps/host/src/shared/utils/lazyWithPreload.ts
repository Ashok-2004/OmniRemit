import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * React.lazy plus the ability to start the chunk download early.
 *
 * Route-level code splitting keeps the login bundle small, but it moves a network round trip to the
 * moment the user navigates — so the first thing they see after signing in is a Suspense fallback
 * while the dashboard chunk downloads. That gap was being read as "it showed the error page, then
 * after some time the success page".
 *
 * `preload()` starts that same dynamic import ahead of time. Both paths share one promise, so calling
 * preload() and then rendering the component does not fetch twice: by the time the route changes the
 * chunk is already parsed and the component mounts with no fallback frame.
 *
 * Preloading is triggered from intent (the user submitted the login form) and from idle time, never
 * eagerly at import — eager loading would defeat the code splitting it exists to enable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- must match the factory's constraint below
export interface PreloadableComponent<T extends ComponentType<any>> {
  Component: LazyExoticComponent<T>
  preload: () => Promise<void>
}

/**
 * The generic is the COMPONENT type, not its props. Parameterising on props instead makes TypeScript
 * infer `never` for a component that takes none (props are contravariant in that position), which then
 * fails to satisfy LazyExoticComponent. Inferring T straight from the factory sidesteps that and also
 * preserves the component's real prop types at every call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the constraint must admit any props shape
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): PreloadableComponent<T> {
  let started: Promise<{ default: T }> | undefined

  // Sharing one promise is what makes preload() and lazy() collapse into a single fetch.
  const load = () => {
    started ??= factory()
    return started
  }

  return {
    Component: lazy(load),
    preload: () =>
      load().then(
        () => undefined,
        () => {
          // A failed preload is speculative, not something the user should be told about. Clearing the
          // cached rejection lets the real render path retry and surface a genuine failure through
          // Suspense instead of permanently poisoning the component.
          started = undefined
        },
      ),
  }
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
}

/**
 * Runs a preload once the browser is idle, so speculative fetching never competes with work the user
 * is actually waiting on. Falls back to a short timeout where requestIdleCallback is unavailable
 * (Safari, notably).
 */
export function preloadWhenIdle(preload: () => Promise<void>, timeoutMs = 2000) {
  if (typeof window === 'undefined') return

  const idleWindow = window as IdleWindow
  const run = () => void preload()

  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(run, { timeout: timeoutMs })
  } else {
    window.setTimeout(run, timeoutMs)
  }
}
