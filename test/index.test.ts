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

test('does not expose mutable internal history', () => {
  const engine = new DetectionEventEngine();
  engine.record(detection());
  const history = engine.getDetectionHistory();
  history[0].boundingBox.width = 999;
  assert.equal(engine.getDetectionHistory()[0].boundingBox.width, 10);
});
