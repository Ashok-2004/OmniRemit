import type { LeadFieldConfig } from '../config/fieldControlRegistry'

/**
 * Lead Management's own masking engine — a local, deliberate duplicate of Customer360's
 * fieldMasking.ts, not a shared/centralized import. Same four rules, parameterized by
 * visibleCharCount rather than a fixed count baked into each rule.
 */
export function applyMaskingRule(raw: string, rule: LeadFieldConfig['maskingRule'], visibleCharCount: number): string {
  const len = raw.length
  if (len === 0) return raw

  const show = Math.max(0, Math.min(visibleCharCount, len))

  switch (rule) {
    case 'FullMask':
      return '*'.repeat(len)

    case 'HideFirstShowLast':
      return '*'.repeat(len - show) + raw.slice(len - show)

    case 'HideLastShowFirst':
      return raw.slice(0, show) + '*'.repeat(len - show)

    case 'HideMiddleShowFirstAndLast': {
      const sideLen = Math.min(show, Math.floor(len / 2))
      if (sideLen <= 0) return '*'.repeat(len)
      const first = raw.slice(0, sideLen)
      const last = raw.slice(len - sideLen)
      const middleLen = len - sideLen * 2
      return first + '*'.repeat(middleLen) + last
    }

    case 'None':
    default:
      return raw
  }
}

export function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '-'
  const s = String(val).trim()
  if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return '-'
  }
  return s
}

export function hasRevealableValue(val: unknown): val is string {
  if (val === null || val === undefined) return false
  const s = String(val).trim()
  return s !== '' && s.toLowerCase() !== 'null'
}
