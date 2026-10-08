import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../web/engine.mjs';
const a = { id: 'branch-a', parent: 'parent', project: 'demo', author: 'author-a' };
const b = { ...a, id: 'branch-b' };

test('forks are named within a scope, never resolved or reordered in the input', () => {
  const input = [b, a];
  const before = JSON.stringify(input);
  assert.deepEqual(engine.findForks(input), [
    {
      project: 'demo',
      author: 'author-a',
      parent: 'parent',
      leaves: ['branch-a', 'branch-b'],
      resolution: 'surfaced_not_arbitrated',
    },
  ]);
  assert.equal(JSON.stringify(input), before);
});

test('different authors or projects are not silently merged', () => {
  assert.deepEqual(engine.findForks([a, { ...b, author: 'author-b' }]), []);
  assert.deepEqual(engine.findForks([a, { ...b, project: 'another' }]), []);
});

test('duplicate records cannot manufacture a fork; ambiguous IDs fail explicitly', () => {
  assert.deepEqual(engine.findForks([a, a]), []);
  assert.deepEqual(engine.findForks([{ ...a, parent: null }]), []);
  assert.throws(() => engine.findForks([a, { ...a, parent: 'different' }]), TypeError);
  assert.throws(() => engine.findForks([{ ...a, project: 'a\u0000b' }]), TypeError);
});
