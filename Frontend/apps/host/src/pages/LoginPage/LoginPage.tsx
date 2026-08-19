import { useState, useId, type FormEvent } from 'react'
import { Icon } from '../../shared/components/Icon/Icon'
import { LoginHero } from './LoginHero'
import styles from './LoginPage.module.css'
import { APP_NAME } from '../../shared/config/branding'

export interface LoginPageProps {
  onSubmit: (email: string, password: string) => Promise<void>
  onGoogleCredential: (idToken: string) => Promise<void>
  loading?: boolean
  errorMessage?: string | null
}

export function LoginPage({ onSubmit, loading, errorMessage }: LoginPageProps) {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe]     = useState(true)
  const [showSsoPrompt, setShowSsoPrompt] = useState(false)
  const passwordId = useId()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email || !password || loading) return
    void onSubmit(email, password)
  }

  function handleSsoClick() {
    setShowSsoPrompt(true)
    setTimeout(() => setShowSsoPrompt(false), 3500)
  }

  return (
    <div className={styles.page}>
      {/* Left Column — Brand & Isometric Hub Hero */}
      <div className={styles.brandPanel}>
        <LoginHero />
      </div>

      {/* Right Column — Floating Card Login */}
      <div className={styles.formPanel}>
        <div className={styles.formCardContainer}>
          <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
            
            {/* Top Brand Badge */}
            <div className={styles.brandBadge}>
              <div className={styles.brandBadgeIcon}>
                <Icon.Lock width={18} height={18} />
              </div>
              <span className={styles.brandBadgeText}>{APP_NAME}</span>
            </div>

            {/* Header / Titles */}
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Welcome back</h2>
              <p className={styles.cardSubtitle}>Glad to see you again! Please sign in to continue.</p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className={styles.errorAlert} role="alert">
                <span className={styles.errorIcon}>⚠</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className={styles.formFields}>
              {/* Email Address */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="login-email">
                  Email address
                </label>
                <div className={styles.inputWrapper}>
                  <Icon.Mail width={17} height={17} className={styles.inputLeadingIcon} />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className={styles.textInput}
                  />
                </div>
              </div>

              {/* Password */}
              <div className={styles.fieldGroup}>
                <div className={styles.passwordLabelRow}>
                  <label htmlFor={passwordId} className={styles.fieldLabel}>
                    Password
                  </label>
                  <a href="#" className={styles.forgotPasswordLink}>
                    Forgot password?
                  </a>
                </div>
                <div className={styles.inputWrapper}>
                  <Icon.Lock width={17} height={17} className={styles.inputLeadingIcon} />
                  <input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className={styles.textInput}
                  />
                  <button
                    type="button"
                    className={styles.eyeToggleBtn}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <Icon.EyeOff width={17} height={17} /> : <Icon.Eye width={17} height={17} />}
                  </button>
                </div>
              </div>

              {/* Remember me Checkbox */}
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={styles.hiddenCheckbox}
                />
                <span className={`${styles.customCheckbox} ${rememberMe ? styles.checked : ''}`}>
                  {rememberMe && <Icon.Check width={12} height={12} strokeWidth={3} />}
                </span>
                <span className={styles.checkboxLabel}>Remember me on this device</span>
              </label>
            </div>

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className={styles.signInButton}
            >
              {loading ? (
                <>
                  <Icon.Loader width={18} height={18} className={styles.spinner} />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <Icon.ArrowRight width={17} height={17} />
                </>
              )}
            </button>

            {/* OR Divider */}
            <div className={styles.orDivider}>
              <span>OR</span>
            </div>

            {/* SSO / Alternative Sign In */}
            <button
              type="button"
              onClick={handleSsoClick}
              className={styles.ssoButton}
            >
              <Icon.Building width={17} height={17} />
              <span>Sign in with SSO</span>
            </button>

            {showSsoPrompt && (
              <div className={styles.ssoInfoToast}>
                Corporate SSO is active for enterprise domains. Please contact your administrator.
              </div>
            )}

          </form>

          {/* Under-Card Footer Navigation Links */}
          <div className={styles.cardFooterLinks}>
            <a href="#" className={styles.footerLink}>Privacy Policy</a>
            <span className={styles.footerDot}>•</span>
            <a href="#" className={styles.footerLink}>Terms of Service</a>
            <span className={styles.footerDot}>•</span>
            <a href="#" className={styles.footerLink}>Support</a>
          </div>
        </div>
      </div>
    </div>
  )
}
