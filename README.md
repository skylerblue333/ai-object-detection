# Sky Detection Event Engine

Sky Detection Event Engine is a small TypeScript library for validating, filtering, retaining, and summarizing **detection events produced by an external computer-vision system**.

## Status

**Engineering beta.** The library does not inspect images and does not run an AI/ML model. The earlier repository implementation returned hard-coded `person` and `vehicle` detections for every input; that simulated inference behavior has been removed from the active product path.

## Supported behavior

- validates detection IDs and object labels;
- validates confidence values in the inclusive range `0..1`;
- validates finite non-negative bounding boxes with non-zero dimensions;
- validates non-negative safe-integer timestamps;
- filters events below a configurable confidence threshold;
- bounds retained detection/anomaly history;
- bounds batch submissions to 10,000 events;
- emits deterministic high-density alerts when an accepted detection set exceeds a configured threshold;
- returns defensive copies so callers cannot mutate retained state accidentally.

## Install and verify

```bash
npm install
npm run build
npm test
npm audit --omit=dev --audit-level=high
```

## Example

```ts
import { DetectionEventEngine } from './src';

const engine = new DetectionEventEngine({ confidenceThreshold: 0.8 });

engine.record({
  id: 'camera-7:42',
  objectType: 'person',
  confidence: 0.91,
  boundingBox: { x: 10, y: 20, width: 100, height: 180 },
  timestamp: Date.now(),
});
```

## Product boundary

This component is an event-validation and deterministic anomaly-summary primitive. It does **not** perform image decoding, neural-network inference, object classification, segmentation, tracking, model training, model hosting, accuracy benchmarking, video ingestion, persistence, authentication, tenant isolation, or production deployment.

A real detector can produce events that conform to `DetectionInput`; this library can then enforce input contracts and provide bounded local history/anomaly logic before another service persists or routes those events.

## SKYCOIN4444 integration

The component can sit behind a future vision provider or edge detector as a narrow validation boundary before events enter analytics, alerting, or observability systems. That integration should preserve the distinction between **model inference** and **event processing**.

## Security and operations

Treat metadata as untrusted application data. The library does not execute metadata, open files, make network requests, or deserialize model artifacts. State is process-local and disappears when the process exits. Memory is bounded by configured history and batch limits, but callers remain responsible for request-rate controls and authentication in any network service that wraps this library.

## License

MIT. See `LICENSE`.
