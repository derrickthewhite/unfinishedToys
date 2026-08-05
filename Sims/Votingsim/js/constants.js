export const SAVE_SCHEMA_VERSION = 1;

export const VALIDATION_LIMITS = {
  issues: { min: 1, max: 50 },
  modesPerIssue: { min: 1, max: 12 },
  voters: { min: 1, max: 10000 },
  opinionsPerVoter: { min: 1, max: 50 },
  candidates: { min: 0, max: 20 },
  policiesPerCandidate: { min: 0, max: 50 }
};

export const DEFAULT_GENERATION_VALUES = {
  issueCount: 10,
  voterCount: 100,
  opinionsPerVoter: 3,
  candidateCount: 0
};
