import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../web/engine.mjs';

test('a silent door stays unstated rather than gaining a safety claim', () => {
  assert.deepEqual(engine.projectDoor(null), {
    kind: 'unstated',
    relationship: null,
    dataFlow: null,
    interpretation: null,
  });
  const partial = engine.projectDoor({ relationship: 'Independent service', dataFlow: '   ' });
  assert.equal(partial.kind, 'partial');
  assert.equal(partial.dataFlow, null);
});

test('a stated boundary preserves the publisher words, without certifying them', () => {
  const boundary = {
    relationship: 'Independent service',
    dataFlow: 'No data sent by this page.',
    interpretation: 'Discovery is not permission.',
  };
  const before = JSON.stringify(boundary);
  assert.deepEqual(engine.projectDoor(boundary), { kind: 'stated', ...boundary });
  assert.equal(JSON.stringify(boundary), before);
  assert.ok(Object.isFrozen(engine.projectDoor(boundary)));
  assert.throws(() => engine.projectDoor('safe'), TypeError);
});
