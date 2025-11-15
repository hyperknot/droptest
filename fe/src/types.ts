export interface SamplePoint {
  timeMs: number // milliseconds from detected origin (first sample after origin = 0)

  // Raw acceleration from CSV (already in G units)
  accelG: number

  // Kinematic quantities from CSV (if present)
  speed: number | null
  pos: number | null
  jerk: number | null

  // MAIN filtered series used by the app (Savitzky–Golay "auto" smoothing)
  accelFiltered: number | null

  // Original factory/logger-provided filtered acceleration from CSV
  accelFactoryFiltered: number | null

  // Additional experimental series:
  // - Savitzky–Golay with a shorter window (more detail, less smoothing)
  accelSGShort: number | null

  // - Simple centered moving average with window size 9 samples
  accelMA9: number | null

  // - Approximate SAE J211 / ISO 6487 crash filters (4th‑order Butterworth, zero‑phase)
  //   Common channel frequency classes (CFC):
  //   - CFC 60: used for many occupant accelerations
  //   - CFC 180: used for some harder / stiffer measurements
  accelCFC60: number | null
  accelCFC180: number | null
}

export interface FileMetadata {
  info: Array<string>
  date?: string
}

export interface DropTestData {
  filename: string
  samples: Array<SamplePoint>
  metadata: FileMetadata
}
