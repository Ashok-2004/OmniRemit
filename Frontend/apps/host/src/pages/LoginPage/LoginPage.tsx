import { useState, useId, type FormEvent } from 'react'
import { Button } from '../../shared/components/Button/Button'
import { Input } from '../../shared/components/Input/Input'
import { Icon } from '../../shared/components/Icon/Icon'
import { GoogleSignInButton } from '../../features/auth/components/GoogleSignInButton'
import { LoginHero } from './LoginHero'
import styles from './LoginPage.module.css'

export interface LoginPageProps {
  onSubmit: (email: string, password: string) => Promise<void>
  onGoogleCredential: (idToken: string) => Promise<void>
  loading?: boolean
  errorMessage?: string | null
}

export function LoginPage({ onSubmit, onGoogleCredential, loading, errorMessage }: LoginPageProps) {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const passwordId = useId()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email || !password || loading) return
    void onSubmit(email, password)
  }

  return (
    <div className={styles.page}>

      {/* Left — brand hero */}
      <div className={styles.brandPanel}>
        <LoginHero />
      </div>

      {/* Right — login form */}
      <div className={styles.formPanel}>
        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>

          {/* Brand mark */}
          <div className={styles.formBrand}>
            <div className={styles.formBrandIcon} aria-hidden="true">
              <Icon.Lock width={18} height={18} />
            </div>
            <span className={styles.formBrandName}>OmniConnect</span>
          </div>

          {/* Heading */}
          <div className={styles.formHeader}>
            <h2>Welcome back</h2>
            <p>Sign in to continue to your workspace</p>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className={styles.formError} role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Fields */}
          <div className={styles.fields}>
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

            {/* Password row — manual label so we can add "Forgot password?" */}
            <div className={styles.passwordField}>
              <div className={styles.passwordLabelRow}>
                <label htmlFor={passwordId} className={styles.passwordLabel}>
                  Password
                </label>
                <a href="#" className={styles.forgotLink}>Forgot password?</a>
              </div>
              <Input
                id={passwordId}
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
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Sign in
          </Button>

          {/* Divider */}
          <div className={styles.divider} role="separator">
            <span>or continue with</span>
          </div>

          {/* Google */}
          <GoogleSignInButton onCredential={(t) => void onGoogleCredential(t)} />

        </form>
      </div>

    </div>
  )
}
