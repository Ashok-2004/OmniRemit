import { useState, type FormEvent } from 'react'
import { Button } from '../../shared/components/Button/Button'
import { Input } from '../../shared/components/Input/Input'
import { Icon } from '../../shared/components/Icon/Icon'
import { GoogleSignInButton } from '../../features/auth/components/GoogleSignInButton'
import styles from './LoginPage.module.css'

export interface LoginPageProps {
  onSubmit: (email: string, password: string) => Promise<void>
  onGoogleCredential: (idToken: string) => Promise<void>
  loading?: boolean
  errorMessage?: string | null
}

const TRUST_ITEMS = [
  { icon: Icon.ShieldCheck, title: 'Secure', desc: 'Bank-grade security for your data' },
  { icon: Icon.Clock, title: 'Reliable', desc: '99.9% uptime guarantee' },
  { icon: Icon.Chat, title: 'Support', desc: '24/7 dedicated support' },
]

export function LoginPage({ onSubmit, onGoogleCredential, loading, errorMessage }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email || !password || loading) return
    void onSubmit(email, password)
  }

  return (
    <div className={styles.page}>
      <div className={styles.brandPanel}>
        <div className={styles.brandMark}>
          <span className={styles.brandMarkIcon} aria-hidden="true">
            <Icon.Grid width={20} height={20} />
          </span>
          <span className={styles.brandMarkText}>
            OmniRemit
            <span className={styles.brandMarkBadge}>CRM</span>
          </span>
        </div>

        <div className={styles.brandGraphic} aria-hidden="true">
          <div className={styles.geo}>
            <div className={styles.geoTile} />
            <div className={styles.geoTile} />
            <div className={styles.geoTile} />
            <div className={styles.geoDot} style={{ left: 20, top: 20 }} />
            <div className={styles.geoDot} style={{ right: 10, top: 60 }} />
            <div className={styles.geoDot} style={{ left: 40, bottom: 10 }} />
          </div>
        </div>

        <div className={styles.brandCopy}>
          <h1 className={styles.brandHeadline}>
            One platform for every team, <span className={styles.brandHeadlineAccent}>every app.</span>
          </h1>
          <p className={styles.brandSubcopy}>
            Sign in to reach the tools your role gives you access to — all in one place, managed
            from one Setup panel.
          </p>
        </div>

        <div className={styles.brandFooter}>&copy; {new Date().getFullYear()} OmniRemit. All rights reserved.</div>
      </div>

      <div className={styles.formPanel}>
        <button type="button" className={styles.langButton}>
          <Icon.Grid width={14} height={14} />
          English
          <Icon.ChevronDown width={14} height={14} />
        </button>

        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          <div className={styles.formIcon} aria-hidden="true">
            <Icon.Lock width={22} height={22} />
          </div>

          <div className={styles.formHeader}>
            <h2>Welcome back</h2>
            <p>Sign in to continue to OmniRemit</p>
          </div>

          {errorMessage && (
            <div className={styles.formError} role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className={styles.form}>
            <Input
              label="Email address"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              leading={<Icon.Mail />}
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              leading={<Icon.Lock />}
              trailing={
                <button
                  type="button"
                  className={styles.eyeToggle}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              }
            />

            <Button type="submit" fullWidth loading={loading}>
              Sign in
            </Button>

            <div className={styles.divider} role="separator">
              <span>or</span>
            </div>

            <GoogleSignInButton onCredential={(idToken) => void onGoogleCredential(idToken)} />
          </div>
        </form>

        <div className={styles.trustRow}>
          {TRUST_ITEMS.map(({ icon: ItemIcon, title, desc }) => (
            <div className={styles.trustItem} key={title}>
              <span className={styles.trustIcon} aria-hidden="true">
                <ItemIcon width={15} height={15} />
              </span>
              <span>
                <span className={styles.trustTitle}>{title}</span>
                <br />
                <span className={styles.trustDesc}>{desc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
