// Unit tests for the pure fingerspelling logic. Run with `npm test`
// (tsx + node's built-in test runner — no new dependencies).
//
// The fixture case feeds canned Gemini responses through the real
// recognition pipeline: parse → smooth → commit → word buffer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFingerspellResponse,
  createFingerspellAccumulator,
  createRecognitionGate,
  type CommittedLetter,
  type FingerspellAccumulator,
} from '../fingerspell';

// --- parseFingerspellResponse: the JSON parsing guard -----------------------

test('parseFingerspellResponse accepts a bare JSON payload', () => {
  assert.deepEqual(parseFingerspellResponse('{"letter":"A","confidence":0.93}'), {
    letter: 'A',
    confidence: 0.93,
  });
});

test('parseFingerspellResponse unwraps markdown-fenced JSON', () => {
  const raw = '```json\n{"letter":"B","confidence":0.71}\n```';
  assert.deepEqual(parseFingerspellResponse(raw), { letter: 'B', confidence: 0.71 });
});

test('parseFingerspellResponse extracts JSON embedded in prose', () => {
  const raw = 'Sure — the handshape reads as {"letter":"C","confidence":0.55} in this frame.';
  assert.deepEqual(parseFingerspellResponse(raw), { letter: 'C', confidence: 0.55 });
});

test('parseFingerspellResponse normalizes case and whitespace', () => {
  assert.deepEqual(parseFingerspellResponse('{"letter":" d ","confidence":0.9}'), {
    letter: 'D',
    confidence: 0.9,
  });
});

test('parseFingerspellResponse keeps the empty letter (no handshape) as a valid payload', () => {
  assert.deepEqual(parseFingerspellResponse('{"letter":"","confidence":0.2}'), {
    letter: '',
    confidence: 0.2,
  });
});

test('parseFingerspellResponse clamps confidence into [0,1]', () => {
  assert.equal(parseFingerspellResponse('{"letter":"E","confidence":1.7}')?.confidence, 1);
  assert.equal(parseFingerspellResponse('{"letter":"E","confidence":-0.4}')?.confidence, 0);
});

test('parseFingerspellResponse rejects hallucinated letters wholesale', () => {
  assert.equal(parseFingerspellResponse('{"letter":"HELLO","confidence":0.9}'), null);
  assert.equal(parseFingerspellResponse('{"letter":"1","confidence":0.9}'), null);
  assert.equal(parseFingerspellResponse('{"letter":"AB","confidence":0.9}'), null);
});

test('parseFingerspellResponse rejects malformed responses', () => {
  assert.equal(parseFingerspellResponse('not json at all'), null);
  assert.equal(parseFingerspellResponse('{"letter":"A","confidence":broken'), null);
  assert.equal(parseFingerspellResponse('{"letter":123,"confidence":0.5}'), null);
  assert.equal(parseFingerspellResponse('{"confidence":0.5}'), null);
  assert.equal(parseFingerspellResponse(''), null);
});

// --- createFingerspellAccumulator: majority-vote smoothing ------------------

// A fresh accumulator with an explicit clock each test controls by advancing
// `clock` between samples.
function makeHarness(opts?: { windowSize?: number; quorum?: number; repeatCooldownMs?: number }) {
  const commits: CommittedLetter[] = [];
  let clock = 0;
  const accumulator: FingerspellAccumulator = createFingerspellAccumulator({
    ...opts,
    now: () => clock,
  });
  return {
    commits,
    accumulator,
    add(letter: string, confidence: number, atMs: number): CommittedLetter | null {
      clock = atMs;
      const committed = accumulator.add({ letter, confidence });
      if (committed) commits.push(committed);
      return committed;
    },
  };
}

test('accumulator commits a letter after a quorum of agreeing frames', () => {
  const h = makeHarness();
  assert.equal(h.add('A', 0.9, 0), null);
  assert.equal(h.add('A', 0.92, 300), null);
  const third = h.add('A', 0.94, 600);
  // Mean of the quorum, computed the same way the accumulator sums it.
  assert.deepEqual(third, { letter: 'A', confidence: (0.9 + 0.92 + 0.94) / 3 });
});

test('accumulator ignores a noisy window with no majority', () => {
  const h = makeHarness();
  h.add('A', 0.9, 0);
  h.add('B', 0.9, 300);
  assert.equal(h.add('A', 0.9, 600), null);
  assert.equal(h.add('B', 0.9, 900), null);
  assert.equal(h.commits.length, 0);
});

test('accumulator treats a no-handshape frame as a gap, not a veto', () => {
  const h = makeHarness();
  h.add('A', 0.9, 0);
  h.add('A', 0.88, 300);
  h.add('', 0.2, 600); // Gemini saw no clear handshape
  const fourth = h.add('A', 0.95, 900);
  assert.deepEqual(fourth, { letter: 'A', confidence: (0.9 + 0.88 + 0.95) / 3 });
});

test('accumulator drops below-threshold samples as gaps', () => {
  const h = makeHarness();
  h.add('A', 0.3, 0); // under minSampleConfidence → gap
  h.add('A', 0.9, 300);
  h.add('A', 0.9, 600);
  assert.deepEqual(h.add('A', 0.9, 900), { letter: 'A', confidence: 0.9 });
});

test('a quick repeat of the same letter is deduplicated (one gesture, one letter)', () => {
  const h = makeHarness({ repeatCooldownMs: 1500 });
  h.add('A', 0.9, 0);
  h.add('A', 0.9, 300);
  h.add('A', 0.9, 600); // commits "A" at t=600
  h.add('A', 0.9, 1200); // within cooldown → no second commit
  assert.equal(h.add('A', 0.9, 1499), null);
  assert.equal(h.commits.length, 1);
});

test('holding the handshape repeats the letter (double letters)', () => {
  const h = makeHarness({ repeatCooldownMs: 1500 });
  h.add('L', 0.9, 0);
  h.add('L', 0.9, 300);
  h.add('L', 0.9, 600); // first "L"
  // Deliberate hold: the handshape keeps voting past the cooldown.
  h.add('L', 0.9, 2100);
  h.add('L', 0.9, 2400);
  const repeat = h.add('L', 0.9, 2700);
  assert.deepEqual(repeat, { letter: 'L', confidence: 0.9 });
  assert.equal(h.commits.length, 2); // "LL"
});

test('a different letter commits immediately on quorum', () => {
  const h = makeHarness();
  h.add('H', 0.9, 0);
  h.add('H', 0.9, 300);
  h.add('H', 0.9, 600); // "H"
  assert.deepEqual(h.add('I', 0.9, 900), null);
  assert.deepEqual(h.add('I', 0.9, 1200), null);
  assert.deepEqual(h.add('I', 0.9, 1500), { letter: 'I', confidence: 0.9 });
  assert.equal(h.commits.length, 2); // "HI"
});

test('reset allows the same letter to commit again immediately', () => {
  const h = makeHarness();
  h.add('A', 0.9, 0);
  h.add('A', 0.9, 300);
  h.add('A', 0.9, 600); // commits "A"
  h.accumulator.reset();
  h.add('A', 0.9, 700);
  h.add('A', 0.9, 1000);
  assert.deepEqual(h.add('A', 0.9, 1300), { letter: 'A', confidence: 0.9 });
});

// --- Recognition path fixture: canned Gemini response → word buffer --------

test('fixture: canned Gemini responses spell H-E-L-L-O into the word buffer', () => {
  // Canned responses exactly as Gemini emits them (schema-locked JSON).
  const canned = (letter: string, confidence: number) =>
    `{"letter":"${letter}","confidence":${confidence}}`;

  const commits: CommittedLetter[] = [];
  let clock = 0;
  const accumulator = createFingerspellAccumulator({ now: () => clock });

  // One recognition cycle: raw model text → parse → smooth → commit.
  const runFixtureFrame = (letter: string, confidence: number) => {
    clock += 300;
    const payload = parseFingerspellResponse(canned(letter, confidence));
    assert.ok(payload, `fixture response for "${letter}" must parse`);
    const committed = accumulator.add(payload);
    if (committed) commits.push(committed);
  };

  for (const letter of ['H', 'E', 'L', 'L', 'O']) {
    if (letter === 'L' && commits.at(-1)?.letter === 'L') {
      clock += 1600; // the second L is a deliberate hold past the cooldown
    }
    for (let i = 0; i < 3; i++) runFixtureFrame(letter, 0.88);
  }

  assert.deepEqual(
    commits.map(c => ({ letter: c.letter, confidence: c.confidence })),
    [
      { letter: 'H', confidence: 0.88 },
      { letter: 'E', confidence: 0.88 },
      { letter: 'L', confidence: 0.88 },
      { letter: 'L', confidence: 0.88 },
      { letter: 'O', confidence: 0.88 },
    ],
  );
});

// --- createRecognitionGate: in-flight dedupe --------------------------------

test('recognition gate admits one caller at a time', () => {
  const gate = createRecognitionGate();
  assert.equal(gate.tryAcquire(), true);
  assert.equal(gate.tryAcquire(), false); // one in flight → frame dropped
  gate.release();
  assert.equal(gate.tryAcquire(), true);
  gate.release();
});
