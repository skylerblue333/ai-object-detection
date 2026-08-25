# SkyVision — Wave 2 Slot #98

**Lane:** 02  
**Status:** engineering beta / vision-job metadata and policy core.

SkyVision adds bounded vision-work metadata to the existing Detection Event Engine without reintroducing the repository's former false image-inference claims.

## Supported behavior

`VisionJobRegistry` records a bounded job request containing an opaque asset identifier, requested capability names, image content type, byte length, and creation time. Every job explicitly reports:

- `modelExecutionPerformed: false`
- `assetInspected: false`

The registry can accept caller-supplied detection events for a planned job and pass them through the existing `DetectionEventEngine` validation/confidence boundary. Accepted events receive `visionJobId` and `externalInference: true` metadata. The result receipt explicitly reports `externalResultsTrusted: false`.

A job accepts at most one result batch, preventing accidental repeated result attachment inside this in-memory registry.

## Integration direction

A truthful deployment composition is:

`asset metadata -> SkyVision plan -> external detector/model adapter -> caller-supplied detections -> DetectionEventEngine`

The external adapter is not included here. It must independently authenticate the caller/provider, fetch authorized asset bytes, execute a reviewed model, validate provenance, and decide whether results are trustworthy.

## Bounds

- at most 10,000 jobs per registry instance;
- job and asset IDs: at most 128 safe identifier characters;
- 1–32 unique requested capabilities, each at most 64 safe identifier characters;
- accepted metadata content types: JPEG, PNG, WebP;
- declared asset size: 1 byte through 50 MiB;
- result batches: at most 10,000 detection events and still subject to DetectionEventEngine validation.

## Explicit limitations

SkyVision does not read image files, fetch remote assets, decode pixels, execute ML models, perform OCR/classification/detection, establish model accuracy, authenticate users/providers, persist jobs/results, verify result provenance, moderate content, provide surveillance, or claim production deployment.

The repository remains useful as a deterministic orchestration/domain boundary for externally generated vision results, not as evidence that live computer-vision inference exists.
