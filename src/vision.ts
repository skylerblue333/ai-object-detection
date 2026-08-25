import { DetectionEventEngine, type DetectionInput, type DetectionResult } from './index';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_CAPABILITY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MAX_JOBS = 10_000;
const MAX_CAPABILITIES = 32;

export interface VisionJobInput {
  id: string;
  assetId: string;
  requestedCapabilities: string[];
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteLength: number;
  createdAt: number;
}

export interface VisionJob {
  readonly id: string;
  readonly assetId: string;
  readonly requestedCapabilities: readonly string[];
  readonly contentType: VisionJobInput['contentType'];
  readonly byteLength: number;
  readonly createdAt: number;
  readonly status: 'planned' | 'results_recorded';
  readonly modelExecutionPerformed: false;
  readonly assetInspected: false;
}

export interface VisionResultReceipt {
  readonly jobId: string;
  readonly acceptedDetections: number;
  readonly modelExecutionPerformed: false;
  readonly externalResultsTrusted: false;
}

function validateId(name: string, value: string): string {
  const normalized = value.trim();
  if (!SAFE_ID.test(normalized)) throw new TypeError(`${name} must be 1-128 safe characters`);
  return normalized;
}

function validateCapabilities(values: string[]): string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_CAPABILITIES) {
    throw new TypeError(`requestedCapabilities must contain 1-${MAX_CAPABILITIES} entries`);
  }
  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => !SAFE_CAPABILITY.test(value))) {
    throw new TypeError('requestedCapabilities entries must be 1-64 safe characters');
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError('requestedCapabilities must not contain duplicates');
  }
  return normalized;
}

function validateJob(input: VisionJobInput): Omit<VisionJob, 'status' | 'modelExecutionPerformed' | 'assetInspected'> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.contentType)) {
    throw new TypeError('contentType must be image/jpeg, image/png, or image/webp');
  }
  if (!Number.isSafeInteger(input.byteLength) || input.byteLength < 1 || input.byteLength > 50 * 1024 * 1024) {
    throw new TypeError('byteLength must be an integer between 1 and 52428800');
  }
  if (!Number.isSafeInteger(input.createdAt) || input.createdAt < 0) {
    throw new TypeError('createdAt must be a non-negative safe integer');
  }
  return {
    id: validateId('id', input.id),
    assetId: validateId('assetId', input.assetId),
    requestedCapabilities: validateCapabilities(input.requestedCapabilities),
    contentType: input.contentType,
    byteLength: input.byteLength,
    createdAt: input.createdAt,
  };
}

function cloneJob(job: VisionJob): VisionJob {
  return { ...job, requestedCapabilities: [...job.requestedCapabilities] };
}

/**
 * SkyVision records bounded vision-work metadata and bridges externally produced
 * detections into DetectionEventEngine. It never reads image bytes or executes a model.
 */
export class VisionJobRegistry {
  private readonly jobs = new Map<string, VisionJob>();

  submit(input: VisionJobInput): VisionJob {
    if (this.jobs.size >= MAX_JOBS) throw new RangeError(`job capacity cannot exceed ${MAX_JOBS}`);
    const normalized = validateJob(input);
    if (this.jobs.has(normalized.id)) throw new Error('job id already exists');
    const job: VisionJob = {
      ...normalized,
      status: 'planned',
      modelExecutionPerformed: false,
      assetInspected: false,
    };
    this.jobs.set(job.id, job);
    return cloneJob(job);
  }

  get(id: string): VisionJob | undefined {
    const job = this.jobs.get(validateId('id', id));
    return job ? cloneJob(job) : undefined;
  }

  list(): VisionJob[] {
    return [...this.jobs.values()]
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map(cloneJob);
  }

  recordExternalDetections(
    jobId: string,
    detections: DetectionInput[],
    engine: DetectionEventEngine,
  ): { receipt: VisionResultReceipt; detections: DetectionResult[] } {
    const id = validateId('jobId', jobId);
    const job = this.jobs.get(id);
    if (!job) throw new Error('job not found');
    if (job.status !== 'planned') throw new Error('results already recorded for job');
    if (!Array.isArray(detections) || detections.length > 10_000) {
      throw new RangeError('detections must contain at most 10000 entries');
    }

    const enriched = detections.map((item) => ({
      ...item,
      metadata: { ...(item.metadata ?? {}), visionJobId: id, externalInference: true },
    }));
    const accepted = engine.recordBatch(enriched);
    this.jobs.set(id, { ...job, status: 'results_recorded' });

    return {
      receipt: {
        jobId: id,
        acceptedDetections: accepted.length,
        modelExecutionPerformed: false,
        externalResultsTrusted: false,
      },
      detections: accepted,
    };
  }
}
