export type ProximitySeverityReturn = 'success' | 'warn' | 'danger' | 'secondary'

export function proximitySeverity(
  proximity: 'safe' | 'approaching' | 'firing' | 'unknown' | 'unset' | 'not-applicable',
): ProximitySeverityReturn {
  switch (proximity) {
    case 'safe':
      return 'success'
    case 'approaching':
      return 'warn'
    case 'firing':
      return 'danger'
    case 'unset':
      return 'warn'
    case 'unknown':
      return 'secondary'
    case 'not-applicable':
      return 'secondary'
  }
}

export function barFillStyle(info: {
  currentValue: number | null
  thresholdValue: number | null
  rule: { condition: import('../../types/grow').RuleCondition }
}): { width: string } {
  const { currentValue, thresholdValue } = info
  if (currentValue == null || thresholdValue == null || thresholdValue === 0) {
    return { width: '0%' }
  }
  const ratio = currentValue / thresholdValue
  const clamped = Math.max(0, Math.min(1.5, ratio))
  return { width: `${(clamped / 1.5) * 100}%` }
}
