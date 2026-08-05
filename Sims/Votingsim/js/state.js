import { DEFAULT_GENERATION_VALUES, SAVE_SCHEMA_VERSION } from './constants.js';
import { deepCopy, createId, pickWeightedIndex, shuffle } from './utils.js';
import { generateModeColors } from './colorScale.js';
import { generateIssueSet } from './generation.js';

export const defaultState = () => ({
  settings: {
    issueCount: DEFAULT_GENERATION_VALUES.issueCount,
    voterCount: DEFAULT_GENERATION_VALUES.voterCount,
    opinionsPerVoter: DEFAULT_GENERATION_VALUES.opinionsPerVoter,
    candidateCount: DEFAULT_GENERATION_VALUES.candidateCount
  },
  issues: [],
  voters: [],
  candidates: [],
  derived: {
    favoredCandidates: [],
    issueModePercentages: []
  },
  ui: {
    generationErrors: {},
    saveName: '',
    saveError: '',
    loadError: '',
    panelVisibility: {
      generation: true,
      issues: true,
      voters: true,
      candidates: true,
      saveLoad: true
    },
    votersScrollMode: false
  }
});

export function createInitialState() {
  const state = defaultState();
  state.issues = [
    {
      id: createId('issue'),
      name: 'Economy',
      modes: [
        { id: createId('mode'), letter: 'A', number: 1, color: '#4f46e5', weight: 0.4 },
        { id: createId('mode'), letter: 'B', number: 2, color: '#0f766e', weight: 0.6 }
      ]
    }
  ];
  state.issues[0].modes = state.issues[0].modes.map((mode, index) => ({ ...mode, color: generateModeColors(state.issues[0].modes.length, 0)[index] }));
  state.voters = [
    {
      id: createId('voter'),
      opinions: [
        { id: createId('opinion'), issueId: state.issues[0].id, modeId: state.issues[0].modes[0].id, weight: 1 },
        { id: createId('opinion'), issueId: state.issues[0].id, modeId: state.issues[0].modes[1].id, weight: 1 }
      ]
    }
  ];
  return state;
}

export function cloneState(state) {
  return deepCopy(state);
}

export function createSavePayload(state) {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    state
  };
}

export function createSimulationState({ issueCount, voterCount, opinionsPerVoter }) {
  const state = defaultState();

  state.settings.issueCount = issueCount;
  state.settings.voterCount = voterCount;
  state.settings.opinionsPerVoter = opinionsPerVoter;

  state.issues = generateIssues(issueCount);
  state.voters = generateVoters(state.issues, voterCount, opinionsPerVoter);
  state.candidates = [];
  return state;
}

function generateIssues(count) {
  const issues = generateIssueSet(count);
  return issues.map((issue, issueIndex) => {
    const colors = generateModeColors(issue.modes.length, issueIndex);
    const modes = issue.modes.map((mode, modeIndex) => ({
      ...mode,
      color: colors[modeIndex]
    }));

    return {
      ...issue,
      modes
    };
  });
}

function generateVoters(issues, voterCount, opinionsPerVoter) {
  const opinionsPerIssue = Math.min(opinionsPerVoter, issues.length);
  return Array.from({ length: voterCount }, () => {
    const opinions = [];
    const availableIssues = shuffle(issues).slice(0, opinionsPerIssue);
    for (const issue of availableIssues) {
      const mode = issue.modes[pickWeightedIndex(issue.modes.map((mode) => mode.weight))];
      opinions.push({
        id: createId('opinion'),
        issueId: issue.id,
        modeId: mode.id,
        weight: (Math.floor(Math.random() * 10) + 1) * 0.1
      });
    }
    return { id: createId('voter'), opinions };
  });
}

function pickModeCount() {
  const weights = [0.4, 0.3, 0.2, 0.1];
  const values = [1, 2, 3, 4];
  return values[pickWeightedIndex(weights)];
}
