import test from 'node:test';
import assert from 'node:assert/strict';
import { createIssueNameGenerator } from './issueNames.js';

test('creates unique category-based issue names and falls back when needed', () => {
  const generator = createIssueNameGenerator();
  const fruitNames = [];
  const vegetableNames = [];
  const dairyNames = [];
  const pastaNames = [];

  for (let index = 0; index < 25; index += 1) {
    const modeCount = index % 4 === 0 ? 1 : index % 4 === 1 ? 2 : index % 4 === 2 ? 3 : 4;
    const name = generator.getName(modeCount, index + 1);
    if (modeCount === 1) fruitNames.push(name);
    if (modeCount === 2) vegetableNames.push(name);
    if (modeCount === 3) dairyNames.push(name);
    if (modeCount === 4) pastaNames.push(name);
  }

  assert.equal(fruitNames.length, 7);
  assert.equal(vegetableNames.length, 6);
  assert.equal(dairyNames.length, 6);
  assert.equal(pastaNames.length, 6);
  assert.equal(new Set(fruitNames).size, fruitNames.length);
  assert.equal(new Set(vegetableNames).size, vegetableNames.length);
  assert.equal(new Set(dairyNames).size, dairyNames.length);
  assert.equal(new Set(pastaNames).size, pastaNames.length);
  const exhaustedGenerator = createIssueNameGenerator();
  for (let index = 0; index < 21; index += 1) {
    exhaustedGenerator.getName(1, index + 1);
  }
  assert.match(exhaustedGenerator.getName(1, 100), /^Issue 100$/);
});
