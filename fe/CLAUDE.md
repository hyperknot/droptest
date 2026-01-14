# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paragliding harness drop test visualizer - a client-side web tool for analyzing accelerometer CSV data from impact tests.

## Development Commands

typecheck, lint is run automatically, you do not need to run it.
build is not needed either, the automatic typecheck is enough.


## Tech Stack

- **Framework**: Solid.js (reactive signals/stores, not React)
- **Build**: Vite with vite-plugin-solid
- **Styling**: Tailwind CSS v4
- **Charts**: ECharts
- **Filters**: fili (IIR), ml-savitzky-golay

## Architecture

```
src/
├── index.tsx              # App render entry
├── App.tsx                # Root component with drag-drop file handling
├── types.ts               # RawSample, ProcessedSample interfaces
├── components/
│   ├── LandingPage.tsx    # File upload UI (shown when no file)
│   ├── MainLayout.tsx     # Analysis interface with sidebar + metrics
│   └── AccelerationProfileChart.tsx  # ECharts visualization
├── stores/
│   └── uiStore.ts         # Global state (Solid.js store pattern)
└── lib/
    ├── csv-parser.ts      # CSV parsing with auto-detection
    ├── filter/
    │   ├── cfc.ts         # CFC low-pass (SAE J211/1 forward-backward)
    │   ├── sg.ts          # Savitzky-Golay for jerk derivative
    │   ├── resample.ts    # Variable to uniform sample rate
    │   └── range.ts       # Hit detection (free-fall boundaries)
    └── metrics/
        ├── dri.ts         # DRI via 1-DOF biodynamic model (RK4)
        └── energy.ts      # Impact velocity, COR, bounce height
```

## Data Flow

1. CSV upload → `parseRawCSV()` → RawSample[]
2. `resampleToUniform()` → uniform time grid
3. `detectOriginTime()` → trim to test start
4. `processRawSamples()` → CFC filter + SG jerk → ProcessedSample[]
5. Chart render + metrics computation in visible time window

## Acceleration Convention

- ~0 G at rest (device stationary)
- ~-1 G in free fall
- Positive G on impact/deceleration

This convention is critical for all calculations. The sign convention differs from some other systems.

## Key Algorithms

- **CFC Filter**: SAE J211/1 standard, `fDesign = 2.0775 * CFC`, zero-phase filtfilt
- **DRI**: 1-DOF spring-damper model (ω=52.9 rad/s, ζ=0.224), RK4 integration
- **Energy**: Velocity from acceleration integration, COR = v_rebound/v_impact

## State Management

Single global store in `uiStore.ts`. Key methods:

- `loadFile(file)` - Entry point for CSV processing
- `setVisibleTimeRange()` - Triggers metric recomputation
- `setAccelCfc()` / `setJerkWindowMs()` - Filter parameter changes

## Notes

- 100% client-side processing (no backend)
- Solid.js uses `<Show>` for conditional rendering, not ternaries
- Algorithm documentation is embedded in lib/ file comments
