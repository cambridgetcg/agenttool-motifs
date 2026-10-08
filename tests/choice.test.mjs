import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../web/engine.mjs';

test('a random entrance excludes the immediately previous study', () => {
  assert.equal(
    engine.chooseStudy(['observations', 'doors', 'branches'], 'observations', () => 0),
    'doors'
  );
  assert.equal(
    engine.chooseStudy(['observations'], 'observations', () => 0),
    'observations'
  );
});

test('rejection sampling avoids modulo bias and has a finite retry budget', () => {
  let calls = 0;
  const words = [0xffffffff, 0];
  assert.equal(
    engine.chooseStudy(['a', 'b', 'c'], null, () => {
      calls++;
      return words.shift();
    }),
    'a'
  );
  assert.equal(calls, 2);
  assert.throws(() => engine.chooseStudy([], null, () => 0), TypeError);
  calls = 0;
  assert.throws(
    () =>
      engine.chooseStudy(['a', 'b', 'c'], null, () => {
        calls++;
        return 0xffffffff;
      }),
    /Random selection unavailable/
  );
  assert.equal(calls, 32);
  assert.throws(() => engine.chooseStudy(['a', 'b'], null, () => -1), RangeError);
});

for (const [name, ids, previous] of [
  ['a one-hole list', Array(1), null],
  ['a sparse list whose only real ID is the previous selection', ['a', ,], 'a'],
]) {
  test(`random selection rejects ${name} before requesting randomness`, () => {
    let calls = 0;
    assert.throws(
      () =>
        engine.chooseStudy(ids, previous, () => {
          calls++;
          return 0;
        }),
      { name: 'TypeError', message: /study identifiers/ }
    );
    assert.equal(calls, 0);
  });
}
