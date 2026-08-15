import { useEffect, useRef, useState } from 'react'
import { env } from '../../../config/env'
import styles from './GoogleSignInButton.module.css'

interface GoogleCredentialResponse {
  credential: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

export interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void
}

let scriptLoadPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }
  scriptLoadPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'))
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

/**
 * Renders Google's own official Sign-In button once VITE_GOOGLE_CLIENT_ID is set, otherwise shows
 * an honest "not configured" state — never a clickable-but-nonfunctional button. The backend has
 * the matching guard: POST /api/auth/google returns a clear 503 if Google__ClientId isn't set
 * server-side either, so both halves fail the same honest way independently.
 */
export function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptFailed, setScriptFailed] = useState(false)

  useEffect(() => {
    if (!env.googleClientId || !containerRef.current) {
      return
    }
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) {
          return
        }
        window.google.accounts.id.initialize({
          client_id: env.googleClientId!,
          callback: (response) => onCredential(response.credential),
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
        })
      })
      .catch(() => {
        if (!cancelled) setScriptFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [onCredential])

  if (!env.googleClientId) {
    return (
      <div className={styles.notConfigured} title="An administrator hasn't configured Google Sign-In for this deployment yet.">
        Google Sign-In is not configured yet
      </div>
    )
  }

  if (scriptFailed) {
    return <div className={styles.notConfigured}>Google Sign-In failed to load. Check your connection and try again.</div>
  }

  return <div ref={containerRef} className={styles.buttonSlot} />
}
