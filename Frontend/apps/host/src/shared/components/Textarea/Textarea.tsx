import { useId, type TextareaHTMLAttributes } from 'react'
import styles from './Textarea.module.css'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  errorText?: string
}

/** Multi-line input matching Input/Select's API, so a form built from all three stays coherent. */
export function Textarea({ label, helperText, errorText, id, className, rows = 3, ...rest }: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const describedById = `${textareaId}-description`
  const hasError = Boolean(errorText)

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={textareaId}>
          {label}
        </label>
      )}

      <textarea
        {...rest}
        id={textareaId}
        rows={rows}
        className={`${hasError ? styles.textareaError : styles.textarea} ${className ?? ''}`}
        aria-invalid={hasError || undefined}
        aria-describedby={errorText || helperText ? describedById : undefined}
      />

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
