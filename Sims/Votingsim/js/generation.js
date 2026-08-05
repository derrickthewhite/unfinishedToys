import { createId } from './utils.js';
import { VALIDATION_LIMITS } from './constants.js';
import { createIssueNameGenerator } from './issueNames.js';

export function normalizeGenerationValues(values) {
  const errors = {};
  const issueCount = Number(values.issueCount);
  const voterCount = Number(values.voterCount);
  const opinionsPerVoter = Number(values.opinionsPerVoter);

  const clampedIssueCount = Number.isInteger(issueCount)
    ? Math.min(Math.max(issueCount, VALIDATION_LIMITS.issues.min), VALIDATION_LIMITS.issues.max)
    : VALIDATION_LIMITS.issues.min;
  const clampedVoterCount = Number.isInteger(voterCount)
    ? Math.min(Math.max(voterCount, VALIDATION_LIMITS.voters.min), VALIDATION_LIMITS.voters.max)
    : VALIDATION_LIMITS.voters.min;
  const clampedOpinionsPerVoter = Number.isInteger(opinionsPerVoter)
    ? Math.min(Math.max(opinionsPerVoter, VALIDATION_LIMITS.opinionsPerVoter.min), VALIDATION_LIMITS.opinionsPerVoter.max)
    : VALIDATION_LIMITS.opinionsPerVoter.min;

  if (!Number.isInteger(issueCount)) {
    errors.issueCount = `Issues must be an integer between ${VALIDATION_LIMITS.issues.min} and ${VALIDATION_LIMITS.issues.max}.`;
  } else if (issueCount < VALIDATION_LIMITS.issues.min || issueCount > VALIDATION_LIMITS.issues.max) {
    errors.issueCount = `Issues must be between ${VALIDATION_LIMITS.issues.min} and ${VALIDATION_LIMITS.issues.max}.`;
  }

  if (!Number.isInteger(voterCount)) {
    errors.voterCount = `Voters must be an integer between ${VALIDATION_LIMITS.voters.min} and ${VALIDATION_LIMITS.voters.max}.`;
  } else if (voterCount < VALIDATION_LIMITS.voters.min || voterCount > VALIDATION_LIMITS.voters.max) {
    errors.voterCount = `Voters must be between ${VALIDATION_LIMITS.voters.min} and ${VALIDATION_LIMITS.voters.max}.`;
  }

  if (!Number.isInteger(opinionsPerVoter)) {
    errors.opinionsPerVoter = `Opinions per voter must be an integer between ${VALIDATION_LIMITS.opinionsPerVoter.min} and ${VALIDATION_LIMITS.opinionsPerVoter.max}.`;
  } else if (opinionsPerVoter < VALIDATION_LIMITS.opinionsPerVoter.min || opinionsPerVoter > VALIDATION_LIMITS.opinionsPerVoter.max) {
    errors.opinionsPerVoter = `Opinions per voter must be between ${VALIDATION_LIMITS.opinionsPerVoter.min} and ${VALIDATION_LIMITS.opinionsPerVoter.max}.`;
  }

  return {
    errors,
    values: {
      issueCount: clampedIssueCount,
      voterCount: clampedVoterCount,
      opinionsPerVoter: clampedOpinionsPerVoter
    }
  };
}

export function generateIssueModes(count) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: count }, (_, index) => ({
    id: createId('mode'),
    letter: letters[index] ?? `M${index + 1}`,
    color: '',
    weight: 1 / count
  }));
}

export function generateIssueSet(issueCount) {
  const issueNameGenerator = createIssueNameGenerator();
  return Array.from({ length: issueCount }, (_, index) => {
    const modeCount = Math.max(1, Math.min(VALIDATION_LIMITS.modesPerIssue.max, 2 + (index % 3)));
    return {
      id: createId('issue'),
      name: issueNameGenerator.getName(modeCount, index + 1),
      modes: generateIssueModes(modeCount)
    };
  });
}
