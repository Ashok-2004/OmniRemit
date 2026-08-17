import { useCallback, useEffect, useRef, useState } from 'react'

/** Events that count as the user being present. Passive listeners so scrolling stays smooth. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'visibilitychange'] as const

export interface IdleTimeoutOptions {
  /** Inactivity before the warning appears. */
  idleMs: number
  /** How long the warning counts down before signing the user out. */
  warningMs: number
  /** Called when the countdown reaches zero. */
  onTimeout: () => void
  enabled: boolean
}

export interface IdleTimeoutState {
  /** True while the countdown modal should be shown. */
  warning: boolean
  /** Whole seconds left before automatic sign-out. */
  secondsRemaining: number
  /** Dismiss the warning and restart the idle clock. */
  stayActive: () => void
}

/**
 * Signs a user out after a period of genuine inactivity, warning them first.
 *
 * An unattended workstation previously stayed signed in indefinitely: the proactive refresh timer
 * renewed the session forever as long as the tab was open, and there was no idle detection at all.
 * For a product with an audit-log module aimed at banks, that is a compliance gap.
 *
 * Activity is tracked with a ref rather than state so the frequent events never re-render the app;
 * only entering/leaving the warning does. While the warning is showing, activity deliberately does
 * NOT reset the clock — the user must make an explicit choice, so a stray mouse-move cannot silently
 * extend a session someone has walked away from.
 */
export function useIdleTimeout({ idleMs, warningMs, onTimeout, enabled }: IdleTimeoutOptions): IdleTimeoutState {
  const [warning, setWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(warningMs / 1000))

  const lastActivityRef = useRef(Date.now())
  const warningRef = useRef(false)
  const onTimeoutRef = useRef(onTimeout)

  // Kept in a ref so changing the callback never restarts the timers.
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  const stayActive = useCallback(() => {
    lastActivityRef.current = Date.now()
    warningRef.current = false
    setWarning(false)
    setSecondsRemaining(Math.ceil(warningMs / 1000))
  }, [warningMs])

  useEffect(() => {
    if (!enabled) return

    const markActive = () => {
      // Ignore activity once the warning is up — see the doc comment.
      if (warningRef.current) return
      lastActivityRef.current = Date.now()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true })
    }

    // One second-resolution tick drives both phases. A single interval is used rather than nested
    // setTimeouts because browsers throttle background timers unpredictably; re-deriving state from
    // real timestamps each tick means a throttled or slept tab settles on the correct answer as soon
    // as it resumes, instead of drifting.
    const interval = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current

      if (idleFor >= idleMs + warningMs) {
        warningRef.current = false
        setWarning(false)
        onTimeoutRef.current()
        return
      }

      if (idleFor >= idleMs) {
        if (!warningRef.current) {
          warningRef.current = true
          setWarning(true)
        }
        setSecondsRemaining(Math.max(0, Math.ceil((idleMs + warningMs - idleFor) / 1000)))
      } else if (warningRef.current) {
        warningRef.current = false
        setWarning(false)
      }
    }, 1000)

    return () => {
      window.clearInterval(interval)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive)
      }
    }
  }, [enabled, idleMs, warningMs])

  return { warning, secondsRemaining, stayActive }
}
