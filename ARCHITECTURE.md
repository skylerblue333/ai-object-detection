# Architecture

Sky Detection Events is a dependency-light TypeScript library that accepts detection events produced elsewhere, validates them, keeps a bounded in-memory history, and derives deterministic high-density alerts.

`src/index.ts` contains the public contracts and `DetectionEventEngine`. The engine has no network, filesystem, image-decoding, or model-execution dependency. State is process-local and bounded by `historyLimit`.

## Flow

1. A trusted upstream detector produces a `DetectionInput`.
2. `record` validates identifiers, confidence, timestamp, bounding-box geometry, and metadata cloneability.
3. Events below the configured confidence threshold are ignored.
4. Accepted events are retained up to the configured history bound.
5. `detectDensityAnomaly` can derive a bounded alert record from a supplied detection set.

## Integration boundary

SKYCOIN4444 services can place this library behind an authenticated API or use it inside a worker that already owns image/model inference. This repository deliberately does not duplicate those responsibilities.
