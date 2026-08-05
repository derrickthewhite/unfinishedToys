import { computeIssueModePercentages, computeCandidateBaseRatings, computeElectionResults } from './derivedData.js';
import { computeFavoredCandidates } from './scoring.js';
import { createInitialState, defaultState, cloneState } from './state.js';
import { renderGenerationPanel } from './renderGenerationPanel.js';
import { renderIssuesPanel } from './renderIssuesPanel.js';
import { renderVotersPanel } from './renderVotersPanel.js';
import { renderCandidatesPanel } from './renderCandidatesPanel.js';
import { renderSaveLoadPanel } from './renderSaveLoadPanel.js';
import { addCandidate, addCandidatePolicy, createCandidateFromVoter, createOpinionatedCandidate, deleteCandidate, deleteCandidatePolicy, editCandidatePolicy } from './candidateActions.js';
import { createPolicyModal, createEditPolicyModal, closeModal } from './modals.js';

function applyPanelVisibility(state, panelName) {
  state.ui.panelVisibility[panelName] = !state.ui.panelVisibility[panelName];
}

export function renderApp(root, state) {
  const derivedData = {
    issueModePercentages: computeIssueModePercentages(state),
    baseRatings: computeCandidateBaseRatings(state)
  };

  state.derived = {
    favoredCandidates: computeFavoredCandidates(state),
    issueModePercentages: derivedData.issueModePercentages
  };

  const electionResults = computeElectionResults(state);
  state.derived.electionResults = electionResults.results;
  state.derived.undecidedPercentage = electionResults.undecidedPercentage;
  derivedData.electionResults = electionResults.results;
  derivedData.undecidedPercentage = electionResults.undecidedPercentage;

  const panelElements = {
    generation: root.querySelector('#generationPanel'),
    issues: root.querySelector('#issuesPanel'),
    saveLoad: root.querySelector('#saveLoadPanel'),
    candidates: root.querySelector('#candidatesPanel'),
    voters: root.querySelector('#votersPanel')
  };

  Object.entries(panelElements).forEach(([panelName, element]) => {
    element.classList.toggle('hidden', !state.ui.panelVisibility[panelName]);
  });

  renderGenerationPanel(panelElements.generation, state, {
    render: () => renderApp(root, state),
    applyState: (nextState) => {
      Object.assign(state, cloneState(nextState));
    },
    reset: () => {
      Object.assign(state, createInitialState());
      renderApp(root, state);
    },
    togglePanel: (panelName) => {
      applyPanelVisibility(state, panelName);
      renderApp(root, state);
    }
  });

  renderIssuesPanel(panelElements.issues, state, derivedData, {
    togglePanel: (panelName) => {
      applyPanelVisibility(state, panelName);
      renderApp(root, state);
    }
  });
  renderVotersPanel(panelElements.voters, state, {
    render: () => renderApp(root, state),
    createCandidateFromVoter: (voterId) => {
      createCandidateFromVoter(state, voterId);
      renderApp(root, state);
    },
    togglePanel: (panelName) => {
      applyPanelVisibility(state, panelName);
      renderApp(root, state);
    }
  });

  renderCandidatesPanel(panelElements.candidates, state, derivedData, {
    addCandidate: () => {
      addCandidate(state);
      renderApp(root, state);
    },
    createOpinionatedCandidate: () => {
      createOpinionatedCandidate(state);
      renderApp(root, state);
    },
    deleteCandidate: (candidateId) => {
      deleteCandidate(state, candidateId);
      renderApp(root, state);
    },
    openPolicyModal: (candidateId, policyId) => {
      const candidate = state.candidates.find((entry) => entry.id === candidateId);
      if (!candidate) {
        return;
      }

      if (policyId) {
        const policy = candidate.policies.find((entry) => entry.id === policyId);
        if (!policy) {
          return;
        }
        createEditPolicyModal({
          candidate,
          policy,
          issues: state.issues,
          onSave: (modeId) => {
            editCandidatePolicy(state, candidateId, policyId, modeId);
            renderApp(root, state);
          },
          onCancel: () => {}
        });
      } else {
        createPolicyModal({
          candidate,
          issues: state.issues,
          state,
          onSave: (issueId, modeId) => {
            addCandidatePolicy(state, candidateId, issueId, modeId);
            renderApp(root, state);
          },
          onCancel: () => {}
        });
      }
    },
    deletePolicy: (candidateId, policyId) => {
      deleteCandidatePolicy(state, candidateId, policyId);
      renderApp(root, state);
    },
    togglePanel: (panelName) => {
      applyPanelVisibility(state, panelName);
      renderApp(root, state);
    }
  });

  renderSaveLoadPanel(panelElements.saveLoad, state, {
    render: () => renderApp(root, state),
    applyState: (nextState) => {
      Object.assign(state, cloneState(nextState));
      renderApp(root, state);
    },
    togglePanel: (panelName) => {
      applyPanelVisibility(state, panelName);
      renderApp(root, state);
    }
  });
}
