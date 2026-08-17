import { Icon } from '../Icon/Icon'
import styles from './Stepper.module.css'

export interface StepperStep {
  key: string
  label: string
}

export interface StepperProps {
  steps: StepperStep[]
  /** Zero-based index of the step being edited. */
  currentIndex: number
  /** Jump back to an already-completed step. Omit to make the stepper purely indicative. */
  onStepSelect?: (index: number) => void
}

/**
 * Progress indicator for the multi-step create wizards.
 *
 * Presented as an ordered list so the sequence is conveyed structurally rather than only visually,
 * with `aria-current` marking the active step. Completed steps become buttons — going back to fix
 * an earlier answer is a normal thing to want, and forcing a cancel-and-restart for it is the kind
 * of small hostility that makes admin tools tiring.
 */
export function Stepper({ steps, currentIndex, onStepSelect }: StepperProps) {
  return (
    <ol className={styles.list}>
      {steps.map((step, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex
        const canNavigate = Boolean(onStepSelect) && isComplete

        const marker = (
          <>
            <span
              className={
                isCurrent ? styles.markerCurrent : isComplete ? styles.markerComplete : styles.marker
              }
              aria-hidden="true"
            >
              {isComplete ? <Icon.Check width={14} height={14} /> : index + 1}
            </span>
            <span className={isCurrent ? styles.labelCurrent : styles.label}>{step.label}</span>
          </>
        )

        return (
          <li key={step.key} className={styles.item} aria-current={isCurrent ? 'step' : undefined}>
            {canNavigate ? (
              <button type="button" className={styles.stepButton} onClick={() => onStepSelect?.(index)}>
                {marker}
                <span className={styles.srOnly}>(completed — go back to edit)</span>
              </button>
            ) : (
              <span className={styles.stepStatic}>{marker}</span>
            )}
            {index < steps.length - 1 && <span className={styles.connector} aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}
