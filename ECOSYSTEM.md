# SKYCOIN4444 Integration

Sky Detection Events can sit between an upstream vision/model service and downstream SKYCOIN4444 analytics, moderation, or observability components. The stable boundary is the validated `DetectionInput`/`DetectionResult` contract exported by the TypeScript library.

Keep model execution separate. This repository should remain reusable by any detector that can emit the documented event shape.
