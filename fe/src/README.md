# Paragliding Harness Drop Test Visualizer

## CSV input expectations

- CSV must contain columns:
  - `time0` (seconds or milliseconds; auto-detected)
  - `accel` (in G)

### Acceleration convention (important)

This tool assumes the uploaded `accel` channel uses:

- ~0 G when stationary (at rest),
- ~-1 G during free fall.

## DRI (Dynamic Response Index)

The app computes DRI over the currently visible (zoomed) time window using the classic
1-DOF biodynamic model:

x'' + 2ζωx' + ω²x = -a(t)

Parameters:

- ω = 52.9 rad/s
- ζ = 0.224

DRI is calculated from the maximum modeled deflection Δmax as:

- DRI = ω²·max(|x|)/g

### DRI implementation details (windowed "one-bounce" mode)

DRI is computed from the SAME "Accel filtered" series shown in the chart (so it uses the same CFC slider).

Because the dataset convention includes free fall around -1 G, DRI internally corrects the baseline so free fall becomes ~0 G loading:

1. Requirement: the first sample of the visible window must be free fall:
   - accelFiltered(window start) < -0.9 G
   - If not true, DRI is not computed.
2. Baseline calculation: take the 200 ms interval immediately BEFORE the window start
   and compute its average accelFiltered value (typically ~-1 G).
3. Subtract baseline during DRI integration:
   - a_used(t) = accelFiltered(t) - baseline

Integration is performed only until the window end time.

### Practical tip

To compute DRI for one bounce, set the zoom window so it starts during free fall just before that bounce.
