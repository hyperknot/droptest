// @ts-expect-error

import Fili from 'fili'
import savitzkyGolay from 'ml-savitzky-golay'
import type { SamplePoint } from '../../types'

export function calculateJerkSG(
  samples: Array<SamplePoint>,
  windowSize: number,
  poly: number,
  sampleRate: number,
): Array<number | null> {
  let win = Math.round(windowSize)
  if (win % 2 === 0) win += 1
  if (win < 5) win = 5

  // Constraint: Polynomial order must be less than window size
  let p = Math.round(poly)
  if (p >= win) p = win - 1

  const values = samples.map((s) => s.accelCFC ?? s.accelRaw)
  const dt = 1 / sampleRate

  // Derivative 1 gives unit/second (e.g. g/s)
  const deriv = savitzkyGolay(values, dt, {
    windowSize: win,
    polynomial: p,
    derivative: 1,
  })

  return deriv
}
