import { VALIDATION_LIMITS } from './constants.js';
import { normalizeGenerationValues } from './generation.js';
import { createSimulationState } from './state.js';

export function renderGenerationPanel(root, state, callbacks) {
  root.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">Generation</div>
      <button class="small secondary" data-panel-toggle="generation">${state.ui.panelVisibility.generation ? 'Hide' : 'Show'}</button>
    </div>
    <div class="panel-content">
      <div class="grid">
        <div class="field">
          <label for="issueCountInput">Issue count</label>
          <input id="issueCountInput" type="number" value="${state.settings.issueCount}" />
          <div class="error-text" id="issueCountError">${state.ui.generationErrors.issueCount || ''}</div>
        </div>
        <div class="field">
          <label for="voterCountInput">Voter count</label>
          <input id="voterCountInput" type="number" value="${state.settings.voterCount}" />
          <div class="error-text" id="voterCountError">${state.ui.generationErrors.voterCount || ''}</div>
        </div>
        <div class="field">
          <label for="opinionsPerVoterInput">Opinions per voter</label>
          <input id="opinionsPerVoterInput" type="number" value="${state.settings.opinionsPerVoter}" />
          <div class="error-text" id="opinionsPerVoterError">${state.ui.generationErrors.opinionsPerVoter || ''}</div>
        </div>
        <div class="field-row">
          <button id="generateButton">Generate simulation</button>
          <button id="resetButton" class="secondary">Reset</button>
        </div>
        <div class="subtle">Validation limits: issues ${VALIDATION_LIMITS.issues.min}-${VALIDATION_LIMITS.issues.max}, voters ${VALIDATION_LIMITS.voters.min}-${VALIDATION_LIMITS.voters.max}, opinions ${VALIDATION_LIMITS.opinionsPerVoter.min}-${VALIDATION_LIMITS.opinionsPerVoter.max}</div>
      </div>
    </div>
  `;

  root.querySelector('#generateButton').addEventListener('click', () => {
    const values = {
      issueCount: root.querySelector('#issueCountInput').value,
      voterCount: root.querySelector('#voterCountInput').value,
      opinionsPerVoter: root.querySelector('#opinionsPerVoterInput').value
    };

    const normalized = normalizeGenerationValues(values);
    state.ui.generationErrors = normalized.errors;
    if (Object.keys(normalized.errors).length > 0) {
      callbacks.render();
      return;
    }

    const nextState = createSimulationState({
      issueCount: normalized.values.issueCount,
      voterCount: normalized.values.voterCount,
      opinionsPerVoter: normalized.values.opinionsPerVoter
    });

    callbacks.applyState(nextState);
    callbacks.render();
  });

  root.querySelector('#resetButton').addEventListener('click', () => {
    callbacks.reset();
  });

  root.querySelector('[data-panel-toggle="generation"]').addEventListener('click', () => {
    callbacks.togglePanel('generation');
  });
}
