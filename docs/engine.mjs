/** Small public demonstration contracts. Synthetic data only; no I/O or authority.
 * Epoch timestamps use whole milliseconds: invalid observations are unavailable;
 * invalid clocks throw. Neither is silently rounded by Date.
 */
export function observe(record, now, freshFor) {
  if (
    !Number.isSafeInteger(now) ||
    !Number.isFinite(new Date(now).getTime()) ||
    !Number.isFinite(freshFor) ||
    freshFor < 0
  ) {
    throw new RangeError(
      'Use a valid whole-millisecond clock and a finite, nonnegative freshness window.'
    );
  }
  const known =
    record &&
    ['positive', 'negative'].includes(record.result) &&
    Number.isSafeInteger(record.observedAt) &&
    Number.isFinite(new Date(record.observedAt).getTime()) &&
    record.observedAt >= 0 &&
    record.observedAt <= now;
  if (!known) return Object.freeze({ condition: 'unknown', freshness: 'unavailable', asOf: null });
  return Object.freeze({
    condition: record.result === 'positive' ? 'intact' : 'not_intact',
    freshness: now - record.observedAt <= freshFor ? 'fresh' : 'last_known',
    asOf: record.observedAt,
  });
}

/** Fixture labels are not authenticated identities. Scope is never inferred. */
export function findForks(leaves) {
  if (!Array.isArray(leaves) || leaves.length > 256)
    throw new TypeError('Use a bounded leaf list.');
  const groups = new Map(),
    seen = new Map();
  const valid = (value) => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,96}$/.test(value);
  for (const leaf of leaves) {
    if (
      !leaf ||
      !['id', 'project', 'author'].every((key) => valid(leaf[key])) ||
      !(leaf.parent === null || valid(leaf.parent))
    ) {
      throw new TypeError('Invalid fixture identifier.');
    }
    const identity = JSON.stringify([leaf.project, leaf.author, leaf.id]);
    if (seen.has(identity)) {
      if (seen.get(identity) !== leaf.parent)
        throw new TypeError('Ambiguous repeated leaf identifier.');
      continue;
    }
    seen.set(identity, leaf.parent);
    if (leaf.parent === null) continue;
    const key = JSON.stringify([leaf.project, leaf.author, leaf.parent]);
    if (!groups.has(key))
      groups.set(key, {
        project: leaf.project,
        author: leaf.author,
        parent: leaf.parent,
        leaves: [],
      });
    groups.get(key).leaves.push(leaf.id);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .filter(([, group]) => group.leaves.length > 1)
    .map(([, group]) => ({
      ...group,
      leaves: group.leaves.sort(),
      resolution: 'surfaced_not_arbitrated',
    }));
}

export function chooseStudy(
  ids,
  previous,
  word = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 64 ||
    new Set(ids).size !== ids.length ||
    Array.from(ids).some((id, index) => !Object.hasOwn(ids, index) || typeof id !== 'string' || !id)
  ) {
    throw new TypeError('Use a small, nonempty set of study identifiers.');
  }
  const options = ids.length > 1 ? ids.filter((id) => id !== previous) : ids;
  const size = 2 ** 32,
    limit = Math.floor(size / options.length) * options.length;
  for (let attempt = 0; attempt < 32; attempt++) {
    const value = word();
    if (!Number.isInteger(value) || value < 0 || value >= size)
      throw new RangeError('Expected an unsigned random word.');
    if (value < limit) return options[value % options.length];
  }
  throw new Error('Random selection unavailable; choose a study directly.');
}

export function projectDoor(boundary) {
  if (boundary == null)
    return Object.freeze({
      kind: 'unstated',
      relationship: null,
      dataFlow: null,
      interpretation: null,
    });
  if (typeof boundary !== 'object' || Array.isArray(boundary))
    throw new TypeError('Use a boundary record or null.');
  const read = (key) =>
    Object.hasOwn(boundary, key) && typeof boundary[key] === 'string' && boundary[key].trim()
      ? boundary[key]
      : null;
  const fields = {
    relationship: read('relationship'),
    dataFlow: read('dataFlow'),
    interpretation: read('interpretation'),
  };
  return Object.freeze({
    kind: Object.values(fields).every((value) => value !== null) ? 'stated' : 'partial',
    ...fields,
  });
}

export function phraseObservation(card, surface) {
  if (!['brief', 'full', 'data'].includes(surface)) throw new TypeError('Unknown representation.');
  if (
    !card ||
    typeof card !== 'object' ||
    Array.isArray(card) ||
    !['condition', 'freshness', 'asOf'].every((key) => Object.hasOwn(card, key))
  )
    throw new TypeError('Use a valid observation card.');
  const { condition, freshness, asOf } = card;
  const valid =
    condition === 'unknown'
      ? freshness === 'unavailable' && asOf === null
      : ['intact', 'not_intact'].includes(condition) &&
        ['fresh', 'last_known'].includes(freshness) &&
        Number.isSafeInteger(asOf) &&
        asOf >= 0 &&
        Number.isFinite(new Date(asOf).getTime());
  if (!valid) throw new TypeError('Use a valid observation card.');
  if (surface === 'data') return JSON.stringify({ condition, freshness, asOf }, null, 2);
  if (condition === 'unknown') {
    return surface === 'brief'
      ? 'Unknown · no observation available'
      : 'No observation is available. This is not an observed failure.';
  }
  const finding = condition === 'intact' ? 'intact' : 'not intact';
  const age = freshness === 'fresh' ? 'fresh' : 'last known';
  const time = new Date(asOf).toISOString();
  return surface === 'brief'
    ? `Recorded ${finding} · ${age} · observed ${time}`
    : `The record says ${finding}, observed at ${time}. The evidence is ${age} under the selected freshness policy. Its timestamp stays with it.`;
}
