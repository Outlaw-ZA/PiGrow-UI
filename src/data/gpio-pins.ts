export type PinKind = 'gpio' | '3v3' | '5v' | 'gnd' | 'id'
export type BusFamily = 'I2C' | 'SPI' | 'UART' | 'PWM'

export interface GpioPin {
  phys: number
  label: string
  kind: PinKind
  fn?: { family: BusFamily; role: string }
}

export const LEFT_COLUMN: GpioPin[] = [
  { kind: '3v3', label: '3V3', phys: 1 },
  { fn: { family: 'I2C', role: 'SDA' }, kind: 'gpio', label: 'BCM 2', phys: 3 },
  { fn: { family: 'I2C', role: 'SCL' }, kind: 'gpio', label: 'BCM 3', phys: 5 },
  { kind: 'gpio', label: 'BCM 4', phys: 7 },
  { kind: 'gnd', label: 'GND', phys: 9 },
  { kind: 'gpio', label: 'BCM 17', phys: 11 },
  { kind: 'gpio', label: 'BCM 27', phys: 13 },
  { kind: 'gpio', label: 'BCM 22', phys: 15 },
  { kind: '3v3', label: '3V3', phys: 17 },
  { fn: { family: 'SPI', role: 'MOSI' }, kind: 'gpio', label: 'BCM 10', phys: 19 },
  { fn: { family: 'SPI', role: 'MISO' }, kind: 'gpio', label: 'BCM 9', phys: 21 },
  { fn: { family: 'SPI', role: 'SCLK' }, kind: 'gpio', label: 'BCM 11', phys: 23 },
  { kind: 'gnd', label: 'GND', phys: 25 },
  { kind: 'id', label: 'ID_SD', phys: 27 },
  { kind: 'gpio', label: 'BCM 5', phys: 29 },
  { kind: 'gpio', label: 'BCM 6', phys: 31 },
  { fn: { family: 'PWM', role: 'PWM1' }, kind: 'gpio', label: 'BCM 13', phys: 33 },
  { kind: 'gpio', label: 'BCM 19', phys: 35 },
  { kind: 'gpio', label: 'BCM 26', phys: 37 },
  { kind: 'gnd', label: 'GND', phys: 39 },
]

export const RIGHT_COLUMN: GpioPin[] = [
  { kind: '5v', label: '5V', phys: 2 },
  { kind: '5v', label: '5V', phys: 4 },
  { kind: 'gnd', label: 'GND', phys: 6 },
  { fn: { family: 'UART', role: 'TXD' }, kind: 'gpio', label: 'BCM 14', phys: 8 },
  { fn: { family: 'UART', role: 'RXD' }, kind: 'gpio', label: 'BCM 15', phys: 10 },
  { kind: 'gpio', label: 'BCM 18', phys: 12 },
  { kind: 'gnd', label: 'GND', phys: 14 },
  { kind: 'gpio', label: 'BCM 23', phys: 16 },
  { kind: 'gpio', label: 'BCM 24', phys: 18 },
  { kind: 'gnd', label: 'GND', phys: 20 },
  { kind: 'gpio', label: 'BCM 25', phys: 22 },
  { fn: { family: 'SPI', role: 'CE0' }, kind: 'gpio', label: 'BCM 8', phys: 24 },
  { fn: { family: 'SPI', role: 'CE1' }, kind: 'gpio', label: 'BCM 7', phys: 26 },
  { kind: 'id', label: 'ID_SC', phys: 28 },
  { kind: 'gnd', label: 'GND', phys: 30 },
  { fn: { family: 'PWM', role: 'PWM0' }, kind: 'gpio', label: 'BCM 12', phys: 32 },
  { kind: 'gnd', label: 'GND', phys: 34 },
  { kind: 'gpio', label: 'BCM 16', phys: 36 },
  { kind: 'gpio', label: 'BCM 20', phys: 38 },
  { kind: 'gpio', label: 'BCM 21', phys: 40 },
]

export interface PhysToBcmEntry {
  phys: number
  bcm: number | null
  kind: PinKind
}

export const PHYS_TO_BCM: PhysToBcmEntry[] = [...LEFT_COLUMN, ...RIGHT_COLUMN]
  .toSorted((a, b) => a.phys - b.phys)
  .map((p) => ({
    bcm: p.kind === 'gpio' ? Number(p.label.replace('BCM ', '')) : null,
    kind: p.kind,
    phys: p.phys,
  }))

export const BCM_TO_PHYS = new Map<number, number>(
  PHYS_TO_BCM.filter((e) => e.bcm !== null).map((e) => [e.bcm as number, e.phys]),
)
