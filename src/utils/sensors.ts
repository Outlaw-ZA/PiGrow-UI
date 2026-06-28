import { SensorProtocol, SensorType } from '../types/grow'

export const SENSOR_TYPE_OPTIONS: { label: string; value: SensorType }[] = [
  { label: 'Humidity', value: SensorType.HUMIDITY },
  { label: 'Temperature', value: SensorType.TEMPERATURE },
  { label: 'Temp + Humidity', value: SensorType.TEMP_HUMIDITY },
  { label: 'CO₂', value: SensorType.CO2 },
  { label: 'pH', value: SensorType.PH },
  { label: 'EC', value: SensorType.EC },
]

export const SENSOR_PROTOCOL_OPTIONS: { label: string; value: SensorProtocol }[] = [
  { label: 'I²C', value: SensorProtocol.I2C },
  { label: 'SPI', value: SensorProtocol.SPI },
  { label: 'UART', value: SensorProtocol.UART },
  { label: 'RS-485', value: SensorProtocol.RS485 },
]

export const SENSOR_PIN_OPTIONS: { label: string; value: number }[] = Array.from(
  { length: 40 },
  (_, i) => ({
    label: String(i + 1),
    value: i + 1,
  }),
)

export function formatSensorType(type: SensorType): string {
  return SENSOR_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

export function formatSensorProtocol(protocol: SensorProtocol): string {
  return SENSOR_PROTOCOL_OPTIONS.find((o) => o.value === protocol)?.label ?? protocol
}

export function defaultSensorForm(): {
  name: string
  type: SensorType
  mqttTopic: string
  pinNumbers: number[]
  protocol: SensorProtocol
} {
  return {
    mqttTopic: '',
    name: '',
    pinNumbers: [],
    protocol: SensorProtocol.I2C,
    type: SensorType.TEMP_HUMIDITY,
  }
}
