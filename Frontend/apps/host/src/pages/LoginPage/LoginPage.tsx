import { useState, type FormEvent } from 'react'
import { Button } from '../../shared/components/Button/Button'
import { Input } from '../../shared/components/Input/Input'
import { Icon } from '../../shared/components/Icon/Icon'
import { GoogleSignInButton } from '../../features/auth/components/GoogleSignInButton'
import { APP_NAME } from '../../shared/config/branding'
import styles from './LoginPage.module.css'

export interface LoginPageProps {
  onSubmit: (email: string, password: string) => Promise<void>
  onGoogleCredential: (idToken: string) => Promise<void>
  loading?: boolean
  errorMessage?: string | null
}

/*
 * These describe how the platform WORKS. They deliberately no longer make service commitments.
 *
 * The previous copy promised "99.9% uptime guarantee" and "24/7 dedicated support" — an availability
 * SLA and a support SLA. Neither is something the software can deliver on its own; both are
 * contractual undertakings by whoever operates the deployment, and this console is shipped to banks
 * who will have their own (probably different) numbers in their own agreements. Printing an SLA on the
 * sign-in page of a product you are handing to a customer creates a claim nobody has agreed to.
 *
 * "Bank-grade security" was equally unfalsifiable marketing, so it is now a statement of the actual
 * mechanism instead. Each line below is something a reader can go and verify in the code.
 */
const TRUST_ITEMS = [
  { icon: Icon.ShieldCheck, title: 'Role-based access', desc: 'Every action checked against your role' },
  { icon: Icon.Clock, title: 'Session protection', desc: 'Idle timeout and automatic sign-out' },
  { icon: Icon.FileText, title: 'Fully audited', desc: 'Every change recorded and attributable' },
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
      {/* Left Brand Image Panel */}
      <div className={styles.brandPanel}>
        <img
          src="/login-hero.png"
          alt={`${APP_NAME} — one platform for every team, every app`}
          className={styles.brandHeroImg}
        />
      </div>

      {/* Right Login Form Panel */}
      <div className={styles.formPanel}>
        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          <div className={styles.formIcon} aria-hidden="true">
            <Icon.Lock width={22} height={22} />
          </div>

          <div className={styles.formHeader}>
            <h2>Welcome back</h2>
            <p>Sign in to continue to {APP_NAME}</p>
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
