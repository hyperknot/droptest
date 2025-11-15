declare module 'fili' {
  export class IirCalculator {
    lowpass(options: {
      order: number
      characteristic: string
      Fs: number
      Fc: number
      gain?: number
      preGain?: boolean
    }): any
  }

  export class IirFilter {
    constructor(coeffs: any)
    singleStep(x: number): number
    multiStep(data: Array<number>): Array<number>
  }
}
