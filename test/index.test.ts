import assert from 'node:assert/strict';
import test from 'node:test';

import { DetectionEventEngine, type DetectionInput } from '../src/index';

function detection(overrides: Partial<DetectionInput> = {}): DetectionInput {
  return {
    id: 'det-1',
    objectType: 'person',
    confidence: 0.9,
    boundingBox: { x: 1, y: 2, width: 10, height: 20 },
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

test('records only detections at or above confidence threshold', () => {
  const engine = new DetectionEventEngine({ confidenceThreshold: 0.8 });
  assert.equal(engine.record(detection({ confidence: 0.7 })), null);
  assert.equal(engine.record(detection({ id: 'accepted', confidence: 0.8 }))?.id, 'accepted');
  assert.equal(engine.getDetectionHistory().length, 1);
});

test('rejects malformed detections', () => {
  const engine = new DetectionEventEngine();
  assert.throws(() => engine.record(detection({ confidence: 2 })), /confidence/);
  assert.throws(
    () => engine.record(detection({ boundingBox: { x: 0, y: 0, width: 0, height: 1 } })),
    /greater than zero/,
  );
  assert.throws(() => engine.record(detection({ id: '   ' })), /id/);
});

test('bounds history to configured limit', () => {
  const engine = new DetectionEventEngine({ historyLimit: 2 });
  engine.record(detection({ id: 'one' }));
  engine.record(detection({ id: 'two' }));
  engine.record(detection({ id: 'three' }));
  assert.deepEqual(engine.getDetectionHistory().map((item) => item.id), ['two', 'three']);
});

test('creates deterministic density alert from accepted events', () => {
  const engine = new DetectionEventEngine({ densityThreshold: 2 });
  const accepted = engine.recordBatch([
    detection({ id: 'one' }),
    detection({ id: 'two' }),
    detection({ id: 'three' }),
  ]);
  const alerts = engine.detectDensityAnomaly(accepted, 1234);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, 'density-1234-1');
  assert.match(alerts[0].description, /3 exceeded configured threshold 2/);
});

test('does not expose mutable internal detection state including nested metadata', () => {
  const engine = new DetectionEventEngine();
  const input = detection({ metadata: { nested: { score: 1 } } });
  const recorded = engine.record(input)!;

  input.boundingBox.width = 999;
  (input.metadata!.nested as { score: number }).score = 2;
  recorded.boundingBox.width = 888;
  (recorded.metadata!.nested as { score: number }).score = 3;

  const history = engine.getDetectionHistory();
  assert.equal(history[0].boundingBox.width, 10);
  assert.equal((history[0].metadata!.nested as { score: number }).score, 1);

  (history[0].metadata!.nested as { score: number }).score = 4;
  assert.equal((engine.getDetectionHistory()[0].metadata!.nested as { score: number }).score, 1);
});

test('anomaly IDs remain unique after retained history is trimmed', () => {
  const engine = new DetectionEventEngine({ densityThreshold: 1, historyLimit: 1 });
  const accepted = engine.recordBatch([detection({ id: 'one' }), detection({ id: 'two' })]);
  const first = engine.detectDensityAnomaly(accepted, 999)[0];
  const second = engine.detectDensityAnomaly(accepted, 999)[0];
  assert.notEqual(first.id, second.id);
  assert.equal(engine.getAnomalyAlerts().length, 1);
});

test('returned anomaly alerts cannot mutate retained anomaly state', () => {
  const engine = new DetectionEventEngine({ densityThreshold: 1 });
  const accepted = engine.recordBatch([detection({ id: 'one' }), detection({ id: 'two' })]);
  const alert = engine.detectDensityAnomaly(accepted, 1000)[0];
  alert.description = 'mutated';
  alert.detections[0].boundingBox.width = 999;

  const retained = engine.getAnomalyAlerts()[0];
  assert.notEqual(retained.description, 'mutated');
  assert.equal(retained.detections[0].boundingBox.width, 10);
});
