import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '../Button/Button'
import styles from './FederationErrorBoundary.module.css'

export interface FederationErrorBoundaryProps {
  appDisplayName: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches a remote app's load/render failures — a bad manifest URL, a network blip, a runtime
 * error thrown by the remote itself — and shows a distinct, recoverable error state instead of
 * taking down the whole host shell. Deliberately separate from MaintenancePage: this is an
 * unplanned failure, not an admin-set status.
 */
export class FederationErrorBoundary extends Component<FederationErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Failed to render remote app "${this.props.appDisplayName}":`, error, info.componentStack)
  }

  private retry = () => this.setState({ error: null })

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className={styles.wrapper}>
        <div className={styles.icon} aria-hidden="true">
          ⚠
        </div>
        <h1>Couldn't load {this.props.appDisplayName}</h1>
        <p className={styles.message}>{this.state.error.message}</p>
        <Button variant="secondary" onClick={this.retry}>
          Try again
        </Button>
      </div>
    )
  }
}
