import type { Device } from '../types/grow'

export interface DeviceWiring {
  signal: number
}

export function getDeviceWiring(device: Device): DeviceWiring {
  return {
    signal: device.pinNumber,
  }
}
