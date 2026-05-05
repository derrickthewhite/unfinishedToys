const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_CHALLENGE_MODE_ID,
  createChallenge,
  normalizeDistinctTables,
  normalizeSetupValues
} = require("./math-problem-manager.js");

function parseBinaryProblem(problemText) {
  const match = problemText.match(/^(\d+)\s*([+\-x])\s*(\d+)$/);
  assert.ok(match, `Unexpected problem text: ${problemText}`);
  return {
    left: Number(match[1]),
    operator: match[2],
    right: Number(match[3])
  };
}

test("normalizeSetupValues clamps invalid input and falls back to default mode", () => {
  const normalized = normalizeSetupValues({
    modeId: "not-a-mode",
    singleTable: "99",
    specifiedTableA: "12",
    specifiedTableB: "12"
  });

  assert.equal(normalized.modeId, DEFAULT_CHALLENGE_MODE_ID);
  assert.equal(normalized.singleTable, 12);
  assert.deepEqual([normalized.specifiedTableA, normalized.specifiedTableB], [11, 12]);
});

test("normalizeDistinctTables always returns a sorted distinct pair", () => {
  assert.deepEqual(normalizeDistinctTables("2", "2"), [2, 3]);
  assert.deepEqual(normalizeDistinctTables("12", "12"), [11, 12]);
  assert.deepEqual(normalizeDistinctTables("9", "4"), [4, 9]);
});

test("default challenge mode is the one-digit addition set", () => {
  const challenge = createChallenge();

  assert.equal(challenge.id, "add-1-to-10-and-0-to-10");
  assert.deepEqual(challenge.answerValues, Array.from({ length: 20 }, (_, index) => index + 1));

  for (let index = 0; index < 40; index += 1) {
    const problem = challenge.generateProblem();
    const parsed = parseBinaryProblem(problem.text);
    assert.equal(parsed.operator, "+");
    assert.ok(parsed.left >= 1 && parsed.left <= 10);
    assert.ok(parsed.right >= 0 && parsed.right <= 10);
    assert.equal(problem.answer, parsed.left + parsed.right);
    assert.ok(challenge.answerValues.includes(problem.answer));
  }
});

test("addition 10-19 plus 1-10 stays within seeded contiguous answers", () => {
  const challenge = createChallenge({ modeId: "add-10-to-19-and-1-to-10" });

  assert.deepEqual(challenge.answerValues, Array.from({ length: 19 }, (_, index) => index + 11));

  for (let index = 0; index < 40; index += 1) {
    const problem = challenge.generateProblem();
    const parsed = parseBinaryProblem(problem.text);
    assert.equal(parsed.operator, "+");
    assert.ok(parsed.left >= 10 && parsed.left <= 19);
    assert.ok(parsed.right >= 1 && parsed.right <= 10);
    assert.equal(problem.answer, parsed.left + parsed.right);
    assert.ok(challenge.answerValues.includes(problem.answer));
  }
});

test("two-digit addition mode uses a 20-number answer window and solvable problems", () => {
  const challenge = createChallenge({ modeId: "add-1-to-9-to-two-digit-numbers" });

  assert.equal(challenge.answerValues.length, 20);
  assert.equal(challenge.answerValues[challenge.answerValues.length - 1] - challenge.answerValues[0], 19);

  for (let index = 0; index < 40; index += 1) {
    const problem = challenge.generateProblem();
    const parsed = parseBinaryProblem(problem.text);
    assert.equal(parsed.operator, "+");
    assert.ok(parsed.left >= 22 && parsed.left <= 78);
    assert.ok(parsed.right >= 1 && parsed.right <= 9);
    assert.equal(problem.answer, parsed.left + parsed.right);
    assert.ok(challenge.answerValues.includes(problem.answer));
  }
});

test("specified-pair times tables stay within the configured pair and 20-button limit", () => {
  const challenge = createChallenge({
    modeId: "times-table-specified-pair",
    specifiedTableA: 7,
    specifiedTableB: 9
  });

  assert.ok(challenge.answerValues.length <= 20);
  assert.equal(challenge.summary, "7 and 9 times tables");

  for (let index = 0; index < 40; index += 1) {
    const problem = challenge.generateProblem();
    const parsed = parseBinaryProblem(problem.text);
    assert.equal(parsed.operator, "x");
    assert.ok([7, 9].includes(parsed.left));
    assert.ok(parsed.right >= 1 && parsed.right <= 10);
    assert.equal(problem.answer, parsed.left * parsed.right);
    assert.ok(challenge.answerValues.includes(problem.answer));
  }
});

test("single-table mode clamps the selected table and generates only that table", () => {
  const challenge = createChallenge({ modeId: "times-table-single", singleTable: 1 });

  assert.equal(challenge.summary, "2 times table");

  for (let index = 0; index < 25; index += 1) {
    const problem = challenge.generateProblem();
    const parsed = parseBinaryProblem(problem.text);
    assert.equal(parsed.operator, "x");
    assert.equal(parsed.left, 2);
    assert.ok(parsed.right >= 1 && parsed.right <= 10);
    assert.equal(problem.answer, parsed.left * parsed.right);
    assert.ok(challenge.answerValues.includes(problem.answer));
  }
});