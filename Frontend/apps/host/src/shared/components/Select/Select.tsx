import { useId, type SelectHTMLAttributes, type ReactNode } from 'react'
import { Icon } from '../Icon/Icon'
import styles from './Select.module.css'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  errorText?: string
  children: ReactNode
}

/**
 * Styled native select.
 *
 * Native rather than a custom listbox on purpose: it inherits correct keyboard behaviour, screen
 * reader semantics, and the platform's own picker on touch devices — none of which a hand-rolled
 * dropdown gets for free. Every page previously hand-rolled `<select className={styles.select}>`
 * with its own copy of the styling, so they had drifted apart.
 *
 * Mirrors Input's API (label / helperText / errorText) so the two compose in a form without
 * looking like they came from different systems.
 */
export function Select({ label, helperText, errorText, id, className, children, ...rest }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const describedById = `${selectId}-description`
  const hasError = Boolean(errorText)

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
        </label>
      )}

      <div className={styles.control}>
        <select
          {...rest}
          id={selectId}
          className={`${hasError ? styles.selectError : styles.select} ${className ?? ''}`}
          aria-invalid={hasError || undefined}
          aria-describedby={errorText || helperText ? describedById : undefined}
        >
          {children}
        </select>
        {/* The native arrow is hidden in CSS so the control matches Input's visual weight. */}
        <span className={styles.arrow} aria-hidden="true">
          <Icon.ChevronDown width={16} height={16} />
        </span>
      </div>

      {errorText ? (
        <span id={describedById} className={styles.error} role="alert">
          {errorText}
        </span>
      ) : helperText ? (
        <span id={describedById} className={styles.helper}>
          {helperText}
        </span>
      ) : null}
    </div>
  )
}
