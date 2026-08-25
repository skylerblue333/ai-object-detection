# Changelog

## 0.2.0 — engineering beta

- Reframed the repository from implied image inference to a truthful detection-event registry.
- Added bounded event and alert history.
- Added strict validation for confidence, timestamps, identifiers, and bounding boxes.
- Added deterministic high-density alert generation.
- Added structured cloning so returned data cannot mutate internal history.
- Added TypeScript build, tests, and production dependency audit CI.
- Documented security and product boundaries.

The component still does not run a trained object-detection model or inspect image content.
