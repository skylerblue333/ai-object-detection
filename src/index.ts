export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionInput {
  id: string;
  objectType: string;
  confidence: number;
  boundingBox: BoundingBox;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface DetectionResult extends DetectionInput {}

export interface AnomalyAlert {
  id: string;
  type: 'high_density_detection';
  severity: 'high';
  description: string;
  timestamp: number;
  detections: DetectionResult[];
}

export interface EngineOptions {
  confidenceThreshold?: number;
  historyLimit?: number;
  densityThreshold?: number;
}

const DEFAULT_HISTORY_LIMIT = 1_000;
const DEFAULT_DENSITY_THRESHOLD = 10;

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite non-negative number`);
  }
}

function cloneMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (metadata === undefined) return undefined;
  try {
    return structuredClone(metadata);
  } catch (error) {
    throw new TypeError('metadata must be structured-cloneable', { cause: error });
  }
}

function cloneDetection(detection: DetectionResult): DetectionResult {
  return {
    ...detection,
    boundingBox: { ...detection.boundingBox },
    metadata: cloneMetadata(detection.metadata),
  };
}

function cloneAlert(alert: AnomalyAlert): AnomalyAlert {
  return {
    ...alert,
    detections: alert.detections.map(cloneDetection),
  };
}

function validateDetection(input: DetectionInput): DetectionResult {
  const id = input.id.trim();
  const objectType = input.objectType.trim();
  if (!id || id.length > 128) throw new TypeError('id must be 1-128 characters');
  if (!objectType || objectType.length > 128) {
    throw new TypeError('objectType must be 1-128 characters');
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new TypeError('confidence must be between 0 and 1');
  }
  if (!Number.isSafeInteger(input.timestamp) || input.timestamp < 0) {
    throw new TypeError('timestamp must be a non-negative safe integer');
  }
  assertFiniteNonNegative('boundingBox.x', input.boundingBox.x);
  assertFiniteNonNegative('boundingBox.y', input.boundingBox.y);
  assertFiniteNonNegative('boundingBox.width', input.boundingBox.width);
  assertFiniteNonNegative('boundingBox.height', input.boundingBox.height);
  if (input.boundingBox.width === 0 || input.boundingBox.height === 0) {
    throw new TypeError('bounding box width and height must be greater than zero');
  }

  return {
    ...input,
    id,
    objectType,
    boundingBox: { ...input.boundingBox },
    metadata: cloneMetadata(input.metadata),
  };
}

/**
 * Deterministic registry for detection events produced by an external detector.
 *
 * This class does not inspect images, run a machine-learning model, or infer object labels.
 */
export class DetectionEventEngine {
  private detections: DetectionResult[] = [];
  private anomalies: AnomalyAlert[] = [];
  private anomalySequence = 0;
  private readonly confidenceThreshold: number;
  private readonly historyLimit: number;
  private readonly densityThreshold: number;

  constructor(options: EngineOptions = {}) {
    this.confidenceThreshold = options.confidenceThreshold ?? 0.7;
    this.historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
    this.densityThreshold = options.densityThreshold ?? DEFAULT_DENSITY_THRESHOLD;

    if (
      !Number.isFinite(this.confidenceThreshold) ||
      this.confidenceThreshold < 0 ||
      this.confidenceThreshold > 1
    ) {
      throw new TypeError('confidenceThreshold must be between 0 and 1');
    }
    if (!Number.isSafeInteger(this.historyLimit) || this.historyLimit < 1 || this.historyLimit > 100_000) {
      throw new TypeError('historyLimit must be an integer between 1 and 100000');
    }
    if (
      !Number.isSafeInteger(this.densityThreshold) ||
      this.densityThreshold < 1 ||
      this.densityThreshold > 10_000
    ) {
      throw new TypeError('densityThreshold must be an integer between 1 and 10000');
    }
  }

  record(input: DetectionInput): DetectionResult | null {
    const detection = validateDetection(input);
    if (detection.confidence < this.confidenceThreshold) return null;

    this.detections.push(detection);
    if (this.detections.length > this.historyLimit) {
      this.detections.splice(0, this.detections.length - this.historyLimit);
    }
    return cloneDetection(detection);
  }

  recordBatch(inputs: DetectionInput[]): DetectionResult[] {
    if (inputs.length > 10_000) throw new RangeError('batch size cannot exceed 10000');
    return inputs.map((input) => this.record(input)).filter((item): item is DetectionResult => item !== null);
  }

  detectDensityAnomaly(detections: DetectionResult[], timestamp = Date.now()): AnomalyAlert[] {
    if (detections.length <= this.densityThreshold) return [];
    this.anomalySequence += 1;
    const alert: AnomalyAlert = {
      id: `density-${timestamp}-${this.anomalySequence}`,
      type: 'high_density_detection',
      severity: 'high',
      description: `Detection count ${detections.length} exceeded configured threshold ${this.densityThreshold}`,
      timestamp,
      detections: detections.slice(0, 5).map(cloneDetection),
    };
    this.anomalies.push(alert);
    if (this.anomalies.length > this.historyLimit) {
      this.anomalies.splice(0, this.anomalies.length - this.historyLimit);
    }
    return [cloneAlert(alert)];
  }

  getDetectionHistory(): DetectionResult[] {
    return this.detections.map(cloneDetection);
  }

  getAnomalyAlerts(): AnomalyAlert[] {
    return this.anomalies.map(cloneAlert);
  }
}

// Compatibility alias for existing imports; behavior is now event registration, not image inference.
export const ObjectDetectionEngine = DetectionEventEngine;
export default DetectionEventEngine;

export * from './vision';
