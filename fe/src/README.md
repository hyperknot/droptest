# Paragliding Harness Drop Test Visualizer

## CSV input expectations

- CSV must contain columns:
  - `time0` (seconds or milliseconds; auto-detected)
  - `accel` (in G)

### Acceleration convention (important)

This tool assumes the uploaded `accel` channel uses:

- ~0 G when stationary (at rest),
- ~-1 G during free fall.

Many accelerometers/loggers export **+1 G at rest** (because they include gravity).
If your data is +1 G at rest, subtract 1.0 G before importing (or adjust parsing).

## DRI (Dynamic Response Index)

The app computes DRI over the currently visible (zoomed) time window using the classic
1-DOF biodynamic model:

- \( \omega_n = 52.9 \) rad/s
- damping ratio \( \zeta = 0.224 \)

DRI is calculated from the maximum modeled deflection \(\Delta\_{\max}\) as:

- DRI = ωn²·Δmax/g

This implementation is intended for repeatable calculation on your impact windows
(not as a medical “danger” interpretation).
