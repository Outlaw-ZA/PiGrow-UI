export interface TimeAxisConfig {
  unit: 'minute' | 'hour'
  stepSize: number
  displayFormats: Record<string, string>
}

const PRESET_CONFIGS: Record<number, TimeAxisConfig> = {
  3600: { unit: 'minute', stepSize: 10, displayFormats: { minute: 'HH:mm' } },
  21600: { unit: 'minute', stepSize: 30, displayFormats: { minute: 'HH:mm' } },
  86400: { unit: 'hour', stepSize: 2, displayFormats: { hour: 'HH:mm' } },
  604800: { unit: 'hour', stepSize: 12, displayFormats: { hour: 'MMM dd HH:mm' } },
}

const DEFAULT_CONFIG: TimeAxisConfig = {
  unit: 'hour',
  stepSize: 1,
  displayFormats: { hour: 'HH:mm' },
}

export function getTimeAxisConfig(rangeSeconds: number): TimeAxisConfig {
  return PRESET_CONFIGS[rangeSeconds] ?? DEFAULT_CONFIG
}
