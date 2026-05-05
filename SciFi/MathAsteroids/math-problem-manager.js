(function initializeMathAsteroidsProblemManager(globalScope) {
  const TABLE_VALUE_MIN = 2;
  const TABLE_VALUE_MAX = 12;
  const SINGLE_TABLE_MULTIPLIER_MAX = 10;
  const DOUBLE_TABLE_MULTIPLIER_MAX = 10;

  function range(start, end) {
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  function randomInt(min, max, randomSource = Math.random) {
    return Math.floor(randomSource() * (max - min + 1)) + min;
  }

  function pickRandom(values, randomSource = Math.random) {
    return values[randomInt(0, values.length - 1, randomSource)];
  }

  function uniqueSortedNumbers(values) {
    return Array.from(new Set(values)).sort((left, right) => left - right);
  }

  function clampWholeNumber(value, min, max, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  function getRandomDistinctTables(randomSource = Math.random) {
    const first = randomInt(TABLE_VALUE_MIN, TABLE_VALUE_MAX, randomSource);
    let second = randomInt(TABLE_VALUE_MIN, TABLE_VALUE_MAX, randomSource);
    while (second === first) {
      second = randomInt(TABLE_VALUE_MIN, TABLE_VALUE_MAX, randomSource);
    }
    return [first, second].sort((left, right) => left - right);
  }

  function normalizeDistinctTables(firstValue, secondValue) {
    const first = clampWholeNumber(firstValue, TABLE_VALUE_MIN, TABLE_VALUE_MAX, 6);
    let second = clampWholeNumber(secondValue, TABLE_VALUE_MIN, TABLE_VALUE_MAX, 8);

    if (second === first) {
      second = second === TABLE_VALUE_MAX ? second - 1 : second + 1;
    }

    return [first, second].sort((left, right) => left - right);
  }

  function createTimesAnswerValues(tables, maxMultiplier) {
    const values = [];
    tables.forEach((table) => {
      for (let multiplier = 1; multiplier <= maxMultiplier; multiplier += 1) {
        values.push(table * multiplier);
      }
    });
    return uniqueSortedNumbers(values);
  }

  function createRandomHelpers(randomSource = Math.random) {
    return {
      randomInt(min, max) {
        return randomInt(min, max, randomSource);
      },
      pickRandom(values) {
        return pickRandom(values, randomSource);
      },
      getRandomDistinctTables() {
        return getRandomDistinctTables(randomSource);
      }
    };
  }

  const challengeModes = [
    {
      id: "add-1-to-10-and-0-to-10",
      label: "Add 1-10 and 0-10",
      description: "Answers run from 1 to 20.",
      setupFields: [],
      createSession(setupValues, helpers) {
        const answerValues = range(1, 20);
        return {
          answerValues,
          summary: "Answers 1-20",
          generateProblem() {
            const left = helpers.randomInt(1, 10);
            const right = helpers.randomInt(0, 10);
            return { text: `${left} + ${right}`, answer: left + right };
          }
        };
      }
    },
    {
      id: "add-10-to-19-and-1-to-10",
      label: "Add 10-19 and 1-10",
      description: "Answers run from 11 to 29.",
      setupFields: [],
      createSession(setupValues, helpers) {
        const answerValues = range(11, 29);
        return {
          answerValues,
          summary: "Answers 11-29",
          generateProblem() {
            const left = helpers.randomInt(10, 19);
            const right = helpers.randomInt(1, 10);
            return { text: `${left} + ${right}`, answer: left + right };
          }
        };
      }
    },
    {
      id: "add-1-to-9-to-two-digit-numbers",
      label: "Add 1-9 to two-digit numbers",
      description: "Uses a random 20-number answer window each run.",
      setupFields: [],
      createSession(setupValues, helpers) {
        const answerStart = helpers.randomInt(31, 60);
        const answerValues = range(answerStart, answerStart + 19);
        return {
          answerValues,
          summary: `Answers ${answerStart}-${answerStart + 19}`,
          generateProblem() {
            const answer = helpers.pickRandom(answerValues);
            const right = helpers.randomInt(1, 9);
            const left = answer - right;
            return { text: `${left} + ${right}`, answer };
          }
        };
      }
    },
    {
      id: "subtract-1-to-10-from-11-to-20",
      label: "Subtract 1-10 from 11-20",
      description: "Answers run from 1 to 19.",
      setupFields: [],
      createSession(setupValues, helpers) {
        const answerValues = range(1, 19);
        return {
          answerValues,
          summary: "Answers 1-19",
          generateProblem() {
            const left = helpers.randomInt(11, 20);
            const right = helpers.randomInt(1, 10);
            return { text: `${left} - ${right}`, answer: left - right };
          }
        };
      }
    },
    {
      id: "times-table-single",
      label: "Times table: single set",
      description: "Practice one selected table with multipliers 1-10.",
      setupFields: ["singleTable"],
      createSession(setupValues, helpers) {
        const table = clampWholeNumber(setupValues.singleTable, TABLE_VALUE_MIN, TABLE_VALUE_MAX, 6);
        const answerValues = createTimesAnswerValues([table], SINGLE_TABLE_MULTIPLIER_MAX);
        return {
          answerValues,
          summary: `${table} times table`,
          generateProblem() {
            const multiplier = helpers.randomInt(1, SINGLE_TABLE_MULTIPLIER_MAX);
            return { text: `${table} x ${multiplier}`, answer: table * multiplier };
          }
        };
      }
    },
    {
      id: "times-table-random-pair",
      label: "Times tables: two random sets",
      description: "Two random tables with multipliers 1-10 to stay within 20 buttons.",
      setupFields: [],
      createSession(setupValues, helpers) {
        const tables = helpers.getRandomDistinctTables();
        const answerValues = createTimesAnswerValues(tables, DOUBLE_TABLE_MULTIPLIER_MAX);
        return {
          answerValues,
          summary: `${tables[0]} and ${tables[1]} times tables`,
          generateProblem() {
            const table = helpers.pickRandom(tables);
            const multiplier = helpers.randomInt(1, DOUBLE_TABLE_MULTIPLIER_MAX);
            return { text: `${table} x ${multiplier}`, answer: table * multiplier };
          }
        };
      }
    },
    {
      id: "times-table-specified-pair",
      label: "Times tables: two specified sets",
      description: "Two chosen tables with multipliers 1-10.",
      setupFields: ["specifiedTables"],
      createSession(setupValues, helpers) {
        const tables = normalizeDistinctTables(setupValues.specifiedTableA, setupValues.specifiedTableB);
        const answerValues = createTimesAnswerValues(tables, DOUBLE_TABLE_MULTIPLIER_MAX);
        return {
          answerValues,
          summary: `${tables[0]} and ${tables[1]} times tables`,
          generateProblem() {
            const table = helpers.pickRandom(tables);
            const multiplier = helpers.randomInt(1, DOUBLE_TABLE_MULTIPLIER_MAX);
            return { text: `${table} x ${multiplier}`, answer: table * multiplier };
          }
        };
      }
    }
  ];

  const challengeModeMap = Object.fromEntries(challengeModes.map((mode) => [mode.id, mode]));
  const DEFAULT_CHALLENGE_MODE_ID = challengeModes[0].id;

  function normalizeSetupValues(rawSetupValues = {}) {
    const normalizedModeId = challengeModeMap[rawSetupValues.modeId]
      ? rawSetupValues.modeId
      : DEFAULT_CHALLENGE_MODE_ID;
    const singleTable = clampWholeNumber(rawSetupValues.singleTable, TABLE_VALUE_MIN, TABLE_VALUE_MAX, 6);
    const [specifiedTableA, specifiedTableB] = normalizeDistinctTables(
      rawSetupValues.specifiedTableA,
      rawSetupValues.specifiedTableB
    );

    return {
      modeId: normalizedModeId,
      singleTable,
      specifiedTableA,
      specifiedTableB
    };
  }

  function createChallenge(rawSetupValues = {}, options = {}) {
    const setupValues = normalizeSetupValues(rawSetupValues);
    const definition = challengeModeMap[setupValues.modeId] || challengeModeMap[DEFAULT_CHALLENGE_MODE_ID];
    const helpers = createRandomHelpers(options.randomSource);
    const session = definition.createSession(setupValues, helpers);
    const answerValues = uniqueSortedNumbers(session.answerValues || []);

    if (answerValues.length === 0 || answerValues.length > 20) {
      throw new Error(`Invalid answer seed for challenge mode ${definition.id}`);
    }

    return {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      setupFields: definition.setupFields,
      setupValues,
      answerValues,
      summary: session.summary || "",
      generateProblem() {
        const problem = session.generateProblem();
        if (!answerValues.includes(problem.answer)) {
          throw new Error(`Generated an unsolved asteroid outside the answer rail for ${definition.id}`);
        }
        return problem;
      }
    };
  }

  const api = {
    TABLE_VALUE_MIN,
    TABLE_VALUE_MAX,
    SINGLE_TABLE_MULTIPLIER_MAX,
    DOUBLE_TABLE_MULTIPLIER_MAX,
    range,
    randomInt,
    pickRandom,
    uniqueSortedNumbers,
    clampWholeNumber,
    getRandomDistinctTables,
    normalizeDistinctTables,
    createTimesAnswerValues,
    challengeModes,
    challengeModeMap,
    DEFAULT_CHALLENGE_MODE_ID,
    normalizeSetupValues,
    createChallenge
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.MathAsteroidsProblemManager = api;
})(typeof globalThis !== "undefined" ? globalThis : this);