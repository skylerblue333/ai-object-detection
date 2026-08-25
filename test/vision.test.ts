import assert from 'node:assert/strict';
import test from 'node:test';

import { DetectionEventEngine, VisionJobRegistry, type DetectionInput } from '../src/index';

function job() {
  return {
    id: 'vision-job-1',
    assetId: 'asset-1',
    requestedCapabilities: ['object-detection'],
    contentType: 'image/jpeg' as const,
    byteLength: 1024,
    createdAt: 1_700_000_000_000,
  };
}

function detection(overrides: Partial<DetectionInput> = {}): DetectionInput {
  return {
    id: 'det-1',
    objectType: 'person',
    confidence: 0.95,
    boundingBox: { x: 1, y: 1, width: 20, height: 30 },
    timestamp: 1_700_000_000_010,
    ...overrides,
  };
}

test('creates planned metadata without claiming model execution or asset inspection', () => {
  const registry = new VisionJobRegistry();
  const created = registry.submit(job());
  assert.equal(created.status, 'planned');
  assert.equal(created.modelExecutionPerformed, false);
  assert.equal(created.assetInspected, false);
});

test('validates bounded job inputs and duplicate IDs', () => {
  const registry = new VisionJobRegistry();
  assert.throws(() => registry.submit({ ...job(), byteLength: 0 }), /byteLength/);
  assert.throws(() => registry.submit({ ...job(), requestedCapabilities: [] }), /requestedCapabilities/);
  assert.throws(
    () => registry.submit({ ...job(), requestedCapabilities: ['object-detection', 'object-detection'] }),
    /duplicates/,
  );
  registry.submit(job());
  assert.throws(() => registry.submit(job()), /already exists/);
});

test('bridges caller-supplied detections into the existing event engine', () => {
  const registry = new VisionJobRegistry();
  const engine = new DetectionEventEngine({ confidenceThreshold: 0.8 });
  registry.submit(job());

  const result = registry.recordExternalDetections(
    'vision-job-1',
    [detection(), detection({ id: 'low', confidence: 0.5 })],
    engine,
  );

  assert.equal(result.receipt.jobId, 'vision-job-1');
  assert.equal(result.receipt.acceptedDetections, 1);
  assert.equal(result.receipt.modelExecutionPerformed, false);
  assert.equal(result.receipt.externalResultsTrusted, false);
  assert.equal(result.detections.length, 1);
  assert.equal(result.detections[0].metadata?.visionJobId, 'vision-job-1');
  assert.equal(result.detections[0].metadata?.externalInference, true);
  assert.equal(registry.get('vision-job-1')?.status, 'results_recorded');
});

test('prevents a second result batch for the same job', () => {
  const registry = new VisionJobRegistry();
  const engine = new DetectionEventEngine();
  registry.submit(job());
  registry.recordExternalDetections('vision-job-1', [detection()], engine);
  assert.throws(
    () => registry.recordExternalDetections('vision-job-1', [detection({ id: 'det-2' })], engine),
    /already recorded/,
  );
});

test('returns defensive job snapshots in deterministic order', () => {
  const registry = new VisionJobRegistry();
  const first = registry.submit(job());
  registry.submit({ ...job(), id: 'vision-job-2', assetId: 'asset-2', createdAt: job().createdAt + 1 });
  (first.requestedCapabilities as string[]).push('mutated');

  assert.deepEqual(registry.list().map((item) => item.id), ['vision-job-1', 'vision-job-2']);
  assert.deepEqual(registry.get('vision-job-1')?.requestedCapabilities, ['object-detection']);
});
