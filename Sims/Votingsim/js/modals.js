import { createId } from './utils.js';
import { getIssueScore, scoreCandidateForVoter } from './scoring.js';

export function openModal(modalBackdrop, modalCard, content) {
  modalCard.innerHTML = content;
  modalBackdrop.classList.remove('hidden');
}

export function closeModal(modalBackdrop, modalCard) {
  modalBackdrop.classList.add('hidden');
  modalCard.innerHTML = '';
}

export function createPolicyModal({ candidate, issues, state, onSave, onCancel }) {
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalCard = document.getElementById('modalCard');
  const issueOptions = issues.filter((issue) => !candidate.policies.some((policy) => policy.issueId === issue.id));

  const content = `
    <div class="panel-header">
      <div class="panel-title">Choose a policy</div>
      <button class="secondary" id="closeModalButton">Close</button>
    </div>
    <div class="grid">
      ${issueOptions.length ? issueOptions.map((issue) => `
        <div class="issue-card">
          <div><strong>${issue.name}</strong></div>
          <div class="mode-list">
            ${issue.modes.map((mode) => `
              <button class="small" data-action="select-mode" data-issue-id="${issue.id}" data-mode-id="${mode.id}">${mode.letter}</button>
            `).join('')}
          </div>
        </div>
      `).join('') : '<div class="empty-state">All issues already have policies.</div>'}
    </div>
  `;

  openModal(modalBackdrop, modalCard, content);

  modalCard.querySelector('#closeModalButton').addEventListener('click', () => {
    onCancel();
    closeModal(modalBackdrop, modalCard);
  });
  modalCard.querySelectorAll('[data-action="select-mode"]').forEach((button) => {
    button.addEventListener('click', () => {
      onSave(button.dataset.issueId, button.dataset.modeId);
      closeModal(modalBackdrop, modalCard);
    });
  });
}

export function createEditPolicyModal({ candidate, policy, issues, onSave, onCancel }) {
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalCard = document.getElementById('modalCard');
  const issue = issues.find((entry) => entry.id === policy.issueId);

  const content = `
    <div class="panel-header">
      <div class="panel-title">Edit policy</div>
      <button class="secondary" id="closeModalButton">Close</button>
    </div>
    <div class="grid">
      ${issue ? `
        <div class="issue-card">
          <div><strong>${issue.name}</strong></div>
          <div class="mode-list">
            ${issue.modes.map((mode) => `
              <button class="small" data-action="select-mode" data-mode-id="${mode.id}">${mode.letter}</button>
            `).join('')}
          </div>
        </div>
      ` : '<div class="empty-state">Issue not found.</div>'}
    </div>
  `;

  openModal(modalBackdrop, modalCard, content);

  modalCard.querySelector('#closeModalButton').addEventListener('click', () => {
    onCancel();
    closeModal(modalBackdrop, modalCard);
  });
  modalCard.querySelectorAll('[data-action="select-mode"]').forEach((button) => {
    button.addEventListener('click', () => {
      onSave(button.dataset.modeId);
      closeModal(modalBackdrop, modalCard);
    });
  });
}

export function createCandidateAnalysisModal({ voter, candidates, issues, onCancel }) {
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalCard = document.getElementById('modalCard');
  const issuesById = Object.fromEntries(issues.map((issue) => [issue.id, issue]));
  const policyGroups = new Map();

  candidates.forEach((candidate) => {
    (candidate.policies ?? []).forEach((policy) => {
      if (!policyGroups.has(policy.issueId)) {
        policyGroups.set(policy.issueId, []);
      }
      policyGroups.get(policy.issueId).push(policy);
    });
  });

  const content = `
    <div class="panel-header">
      <div class="panel-title">Candidate analysis</div>
      <button class="secondary" id="closeModalButton">Close</button>
    </div>
    <div class="grid">
      ${candidates.length ? candidates.map((candidate) => {
        const totalScore = scoreCandidateForVoter(voter, candidate, issuesById, candidates);
        const stepRows = voter.opinions.map((opinion) => {
          const issue = issuesById[opinion.issueId];
          const candidatePolicy = (candidate.policies ?? []).find((policy) => policy.issueId === opinion.issueId);
          const issueScore = getIssueScore(opinion, candidatePolicy, issue, policyGroups.get(opinion.issueId));
          return `
            <div class="issue-card">
              <div><strong>${issue?.name ?? 'Unknown'}</strong></div>
              <div>Opinion: ${issue?.modes.find((mode) => mode.id === opinion.modeId)?.letter ?? '?'} · weight ${opinion.weight.toFixed(1)}</div>
              <div>Candidate policy: ${candidatePolicy ? issue?.modes.find((mode) => mode.id === candidatePolicy.modeId)?.letter ?? '?' : 'None'}</div>
              <div>Contribution: ${issueScore.toFixed(2)}</div>
            </div>
          `;
        }).join('');

        return `
          <div class="issue-card">
            <div><strong>${candidate.name}</strong></div>
            <div>Total score: ${totalScore.toFixed(2)}</div>
            <div class="grid" style="margin-top:8px;">
              ${stepRows}
            </div>
          </div>
        `;
      }).join('') : '<div class="empty-state">No candidates yet.</div>'}
    </div>
  `;

  openModal(modalBackdrop, modalCard, content);

  modalCard.querySelector('#closeModalButton').addEventListener('click', () => {
    onCancel();
    closeModal(modalBackdrop, modalCard);
  });
}
