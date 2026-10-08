import test from 'node:test';
import assert from 'node:assert/strict';
import { observe, phraseObservation } from '../web/engine.mjs';

const record = { result: 'positive', observedAt: 1000 };

test('an observation retains its time when it becomes last-known', () => {
  assert.deepEqual(observe(record, 1100, 300), {
    condition: 'intact',
    freshness: 'fresh',
    asOf: 1000,
  });
  assert.deepEqual(observe(record, 1500, 300), {
    condition: 'intact',
    freshness: 'last_known',
    asOf: 1000,
  });
  assert.equal(record.observedAt, 1000);
});

test('unavailable is not an observed negative result', () => {
  assert.equal(observe({ ...record, result: 'negative' }, 1100, 300).condition, 'not_intact');
  for (const value of [
    null,
    { result: 'missing', observedAt: 1000 },
    { ...record, observedAt: Infinity },
    { ...record, observedAt: 2000 },
  ]) {
    assert.deepEqual(observe(value, 1100, 300), {
      condition: 'unknown',
      freshness: 'unavailable',
      asOf: null,
    });
  }
});

test('one card keeps the same meaning across three representations', () => {
  const card = observe(record, 1500, 300);
  assert.deepEqual(JSON.parse(phraseObservation(card, 'data')), card);
  assert.match(phraseObservation(card, 'brief'), /last known/i);
  assert.match(phraseObservation(card, 'full'), /last known/i);
  assert.match(phraseObservation(observe(null, 1100, 300), 'full'), /not an observed failure/i);
  assert.throws(() => phraseObservation(card, 'made-up'), TypeError);
});

test('invalid clocks and freshness budgets fail explicitly', () => {
  for (const value of [NaN, Infinity, -1]) {
    assert.throws(() => observe(record, 1100, value), RangeError);
  }
  assert.throws(() => observe(record, NaN, 300), RangeError);
});

for (const surface of ['brief', 'full']) {
  test(`${surface} preserves the full UTC date and milliseconds, not just the minute`, () => {
    const times = [
      Date.UTC(2026, 0, 1, 12, 0, 0, 0),
      Date.UTC(2026, 0, 2, 12, 0, 59, 999),
      Date.UTC(2026, 0, 2, 12, 0, 59, 998),
      0,
      8_640_000_000_000_000,
    ];
    const phrases = [];
    for (const observedAt of times) {
      for (const result of ['positive', 'negative']) {
        const card = observe({ result, observedAt }, observedAt, 300_000);
        const phrase = phraseObservation(card, surface);
        assert.ok(phrase.includes(new Date(observedAt).toISOString()), phrase);
        assert.equal(JSON.parse(phraseObservation(card, 'data')).asOf, observedAt);
        phrases.push(phrase);
      }
    }
    assert.equal(new Set(phrases).size, phrases.length);
    const now = times[1] + 600_000;
    for (const observedAt of times.slice(0, 3)) {
      const phrase = phraseObservation(
        observe({ result: 'positive', observedAt }, now, 300_000),
        surface
      );
      assert.match(phrase, /last known/);
      assert.ok(phrase.includes(new Date(observedAt).toISOString()), phrase);
    }
  });
}

test('sub-millisecond observation times are unavailable, never silently rounded', () => {
  for (const observedAt of [0.5, 1000.25, Date.UTC(2026, 0, 1) + 0.5]) {
    const card = observe({ result: 'positive', observedAt }, Math.ceil(observedAt), 300);
    assert.deepEqual(card, { condition: 'unknown', freshness: 'unavailable', asOf: null });
    assert.match(phraseObservation(card, 'brief'), /unknown/i);
    assert.match(phraseObservation(card, 'full'), /no observation/i);
    assert.equal(JSON.parse(phraseObservation(card, 'data')).asOf, null);
  }
});

test('sub-millisecond clocks fail explicitly', () => {
  for (const now of [0.5, 1100.25, Date.UTC(2026, 0, 1) + 0.5]) {
    assert.throws(() => observe(record, now, 300), RangeError);
  }
});

for (const surface of ['brief', 'full', 'data']) {
  test(`${surface} rejects malformed or inconsistent observation cards`, () => {
    const valid = { condition: 'intact', freshness: 'fresh', asOf: 1000 };
    const malformed = [
      null,
      undefined,
      false,
      0,
      'garbage',
      [],
      Object.assign([], valid),
      {},
      { condition: 'garbage', freshness: 'garbage', asOf: null },
      { ...valid, condition: 'garbage' },
      { ...valid, freshness: 'garbage' },
      { ...valid, freshness: 'unavailable' },
      { ...valid, condition: 'unknown' },
      { condition: 'unknown', freshness: 'unavailable', asOf: 0 },
      { condition: 'unknown', freshness: 'unavailable' },
      { condition: 'intact', freshness: 'fresh' },
      ...[
        null,
        undefined,
        '1000',
        new Date(1000),
        NaN,
        Infinity,
        -1,
        0.5,
        1000.25,
        8_640_000_000_000_001,
      ].map((asOf) => ({ ...valid, asOf })),
    ];
    for (const card of malformed) {
      assert.throws(
        () => phraseObservation(card, surface),
        TypeError,
        `Invalid card: ${String(card)}`
      );
    }
    for (const condition of ['intact', 'not_intact']) {
      for (const freshness of ['fresh', 'last_known']) {
        const card = { condition, freshness, asOf: 0 };
        const phrase = phraseObservation(card, surface);
        if (surface === 'data') assert.deepEqual(JSON.parse(phrase), card);
        else {
          assert.ok(phrase.includes(condition === 'intact' ? 'intact' : 'not intact'));
          assert.ok(phrase.includes(freshness === 'fresh' ? 'fresh' : 'last known'));
          assert.ok(phrase.includes('1970-01-01T00:00:00.000Z'));
        }
      }
    }
    const unknown = observe(null, 1000, 300);
    if (surface === 'data')
      assert.deepEqual(JSON.parse(phraseObservation(unknown, surface)), unknown);
    else assert.match(phraseObservation(unknown, surface), /no observation/i);
  });
}
