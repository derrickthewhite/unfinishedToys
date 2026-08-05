import { createId } from './utils.js';

function getReadableTextColor(color) {
  const value = color || '#374151';
  const hslMatch = value.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i);
  if (hslMatch) {
    const lightness = Number(hslMatch[3]);
    return lightness > 70 ? '#111827' : '#f9fafb';
  }

  const hex = value.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((char) => `${char}${char}`).join('') : hex;
  if (normalized.length !== 6) {
    return '#f9fafb';
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.6 ? '#111827' : '#f9fafb';
}

export function renderCandidatesPanel(root, state, derivedData, callbacks) {
  root.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">Candidates</div>
      <button class="small secondary" data-panel-toggle="candidates">${state.ui.panelVisibility.candidates ? 'Hide' : 'Show'}</button>
    </div>
    <div class="panel-content">
      <div class="field-row" style="margin-bottom:10px;">
        <button id="addCandidateButton">Add candidate</button>
        <button id="addOpinionatedCandidateButton" class="secondary">Add opinionated candidate</button>
      </div>
      <div class="grid">
        ${state.candidates.length ? state.candidates.map((candidate) => `
          <div class="candidate-card">
            <div class="field-row">
              <strong>${candidate.name}</strong>
              <span class="badge">Base rating: ${derivedData.baseRatings.find((entry) => entry.candidateId === candidate.id)?.rating ?? 0}</span>
              <span class="badge">Vote share: ${((derivedData.electionResults?.find((entry) => entry.candidateId === candidate.id)?.percentage ?? 0)).toFixed(1)}%</span>
              <button class="small secondary" data-action="delete-candidate" data-candidate-id="${candidate.id}">Delete</button>
            </div>
            <div class="policy-list">
              ${candidate.policies.length ? candidate.policies.map((policy) => {
                const issue = state.issues.find((entry) => entry.id === policy.issueId);
                const mode = issue?.modes.find((entry) => entry.id === policy.modeId);
                const textColor = mode?.color ? getReadableTextColor(mode.color) : '#f9fafb';
                return `
                  <div class="policy-chip" style="background:${mode?.color || '#374151'}; color:${textColor};">
                    <span class="swatch" style="background:${mode?.color || '#374151'}"></span>
                    ${issue?.name ?? 'Unknown'} ${mode?.letter ?? '?'}
                    <button class="small ghost" data-action="edit-policy" data-candidate-id="${candidate.id}" data-policy-id="${policy.id}">Edit</button>
                    <button class="small ghost" data-action="delete-policy" data-candidate-id="${candidate.id}" data-policy-id="${policy.id}">Delete</button>
                  </div>
                `;
              }).join('') : '<div class="empty-state">No policies.</div>'}
            </div>
            <div class="field-row" style="margin-top:8px;">
              <button class="small" data-action="add-policy" data-candidate-id="${candidate.id}">Add policy</button>
            </div>
          </div>
        `).join('') : '<div class="empty-state">No candidates yet.</div>'}
      </div>
      <div class="field-row" style="margin-top:10px; font-weight:600;">
        <span>Undecided: ${(derivedData.undecidedPercentage ?? 0).toFixed(1)}%</span>
      </div>
    </div>
  `;

  root.querySelector('#addCandidateButton').addEventListener('click', () => {
    callbacks.addCandidate();
  });

  root.querySelector('#addOpinionatedCandidateButton').addEventListener('click', () => {
    callbacks.createOpinionatedCandidate();
  });

  root.querySelectorAll('[data-action="delete-candidate"]').forEach((button) => {
    button.addEventListener('click', () => {
      callbacks.deleteCandidate(button.dataset.candidateId);
    });
  });

  root.querySelectorAll('[data-action="add-policy"]').forEach((button) => {
    button.addEventListener('click', () => {
      callbacks.openPolicyModal(button.dataset.candidateId, null);
    });
  });

  root.querySelectorAll('[data-action="edit-policy"]').forEach((button) => {
    button.addEventListener('click', () => {
      callbacks.openPolicyModal(button.dataset.candidateId, button.dataset.policyId);
    });
  });

  root.querySelectorAll('[data-action="delete-policy"]').forEach((button) => {
    button.addEventListener('click', () => {
      callbacks.deletePolicy(button.dataset.candidateId, button.dataset.policyId);
    });
  });

  root.querySelector('[data-panel-toggle="candidates"]').addEventListener('click', () => {
    callbacks.togglePanel('candidates');
  });
}
