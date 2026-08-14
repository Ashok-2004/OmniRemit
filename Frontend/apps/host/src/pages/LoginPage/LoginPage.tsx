import { useState, type FormEvent } from 'react'
import { Button } from '../../shared/components/Button/Button'
import { Input } from '../../shared/components/Input/Input'
import styles from './LoginPage.module.css'

export interface LoginPageProps {
  onSubmit: (email: string, password: string) => Promise<void>
  loading?: boolean
  errorMessage?: string | null
}

export function LoginPage({ onSubmit, loading, errorMessage }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
            O
          </span>
          <span className={styles.brandMarkText}>OmniRemit</span>
        </div>

        <div className={styles.brandCopy}>
          <h1 className={styles.brandHeadline}>One platform for every team, every app.</h1>
          <p className={styles.brandSubcopy}>
            Sign in to reach the tools your role gives you access to — all in one place, managed
            from one Setup panel.
          </p>
        </div>

        <div className={styles.brandFooter}>&copy; {new Date().getFullYear()} OmniRemit</div>
      </div>

      <div className={styles.formPanel}>
        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHeader}>
            <h2>Sign in</h2>
            <p>Enter your credentials to continue.</p>
          </div>

          {errorMessage && (
            <div className={styles.formError} role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className={styles.form}>
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />

            <Button type="submit" fullWidth loading={loading}>
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
