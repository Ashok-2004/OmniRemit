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
        <svg className={styles.googleIcon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Google Sign-In is not configured yet</span>
      </div>
    )
  }

  if (scriptFailed) {
    return <div className={styles.notConfigured}>Google Sign-In failed to load. Check your connection and try again.</div>
  }

  return <div ref={containerRef} className={styles.buttonSlot} />
}
