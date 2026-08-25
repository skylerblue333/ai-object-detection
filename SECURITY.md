# Security Policy

## Status

Sky Detection Events is an engineering-beta validation and event-history component. It does not inspect images, run ML inference, authenticate callers, persist records, or provide tenant isolation.

## Supported security boundary

The library validates detection identifiers, labels, confidence values, timestamps, bounding boxes, batch size, history limits, and cloneability of metadata before accepting events. Returned history and alerts are cloned so callers cannot mutate internal state through returned objects.

Consumers remain responsible for authenticating upstream detectors, validating model provenance, protecting image/video data, applying authorization and tenant boundaries, and controlling resource usage at the service boundary.

## Reporting

Please report suspected vulnerabilities privately to the repository owner rather than publishing exploit details in a public issue before remediation is available.
