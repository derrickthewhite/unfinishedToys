import { matchesFilter } from './utils.js';
import { createCandidateAnalysisModal } from './modals.js';

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

export function renderVotersPanel(root, state, callbacks) {
  const filter = state.ui.voterFilter || '';
  const visibleVoters = state.voters.filter((voter) => {
    return voter.opinions.some((opinion) => {
      const issue = state.issues.find((entry) => entry.id === opinion.issueId);
      const mode = issue?.modes.find((entry) => entry.id === opinion.modeId);
      return matchesFilter(`${issue?.name ?? ''} ${mode?.letter ?? ''}`.trim(), filter);
    });
  });

  const rerenderVotersPanel = () => {
    renderVotersPanel(root, state, {
      ...callbacks,
      render: rerenderVotersPanel
    });
  };

  const hasHeader = root.querySelector('.panel-header');
  if (!hasHeader) {
    root.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">Voters</div>
        <div class="field-row">
          <button class="small secondary" id="votersScrollToggle">${state.ui.votersScrollMode ? 'All' : 'Scroll'}</button>
          <button class="small secondary" data-panel-toggle="voters">${state.ui.panelVisibility.voters ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <div class="panel-content">
        <div class="field">
          <label for="voterFilterInput">Filter opinions</label>
          <input id="voterFilterInput" type="text" value="${filter}" placeholder="Search by opinion name" />
        </div>
        <div id="votersList" class="grid ${state.ui.votersScrollMode ? 'voters-scroll-region' : ''}" style="margin-top:10px;"></div>
      </div>
    `;
  } else {
    const filterInput = root.querySelector('#voterFilterInput');
    if (filterInput) {
      filterInput.value = filter;
    }
  }

  const votersList = root.querySelector('#votersList');
  const filterInput = root.querySelector('#voterFilterInput');
  const scrollToggle = root.querySelector('#votersScrollToggle');
  const panelToggle = root.querySelector('[data-panel-toggle="voters"]');
  if (!votersList) {
    return;
  }

  votersList.className = `grid ${state.ui.votersScrollMode ? 'voters-scroll-region' : ''}`;
  votersList.style.marginTop = '10px';
  votersList.innerHTML = visibleVoters.length ? visibleVoters.map((voter) => {
    const preferredCandidateResult = (state.derived?.favoredCandidates ?? []).find((entry) => entry.voterId === voter.id);
    const preferredCandidate = state.candidates.find((candidate) => candidate.id === preferredCandidateResult?.candidateId);
    const preferredLabel = preferredCandidate ? preferredCandidate.name : 'Undecided';

    return `
      <div class="voter-card">
        <div class="field-row">
          <div>
            <strong>Voter ${voter.id.slice(-4)}</strong>
            <div style="font-size:0.85rem; opacity:0.8;">Prefers: ${preferredLabel}</div>
          </div>
          <div class="field-row">
            <button class="small" data-action="candidate-analysis" data-voter-id="${voter.id}">Candidate Analysis</button>
            <button class="small" data-action="create-candidate-from-voter" data-voter-id="${voter.id}">Create candidate</button>
          </div>
        </div>
        <div class="opinion-list">
        ${[...voter.opinions].sort((a, b) => {
          return (b.weight ?? 0) - (a.weight ?? 0);
        }).map((opinion) => {
          const issue = state.issues.find((entry) => entry.id === opinion.issueId);
          const mode = issue?.modes.find((entry) => entry.id === opinion.modeId);
          const textColor = mode?.color ? getReadableTextColor(mode.color) : '#f9fafb';
          const displayWeight = typeof opinion.weight === 'number' ? opinion.weight : 0;
          return `
            <div class="opinion-chip" style="background:${mode?.color || '#374151'}; color:${textColor};">
              <span class="swatch" style="background:${mode?.color || '#374151'}"></span>
              ${issue?.name ?? 'Unknown'} ${mode?.letter ?? '?'} · ${displayWeight.toFixed(1)}
            </div>
          `;
        }).join('')}
      </div>
    </div>
    `;
  }).join('') : '<div class="empty-state">No matching voters.</div>';

  if (filterInput && !filterInput.dataset.bound) {
    filterInput.addEventListener('input', (event) => {
      state.ui.voterFilter = event.target.value;
      rerenderVotersPanel();
    });
    filterInput.dataset.bound = 'true';
  }

  if (votersList && !votersList.dataset.bound) {
    votersList.addEventListener('click', (event) => {
      const analysisButton = event.target.closest('[data-action="candidate-analysis"]');
      if (analysisButton) {
        const voter = state.voters.find((entry) => entry.id === analysisButton.dataset.voterId);
        if (voter) {
          createCandidateAnalysisModal({
            voter,
            candidates: state.candidates,
            issues: state.issues,
            onCancel: () => {}
          });
        }
        return;
      }

      const button = event.target.closest('[data-action="create-candidate-from-voter"]');
      if (!button) {
        return;
      }
      callbacks.createCandidateFromVoter(button.dataset.voterId);
    });
    votersList.dataset.bound = 'true';
  }

  if (scrollToggle && !scrollToggle.dataset.bound) {
    scrollToggle.addEventListener('click', () => {
      state.ui.votersScrollMode = !state.ui.votersScrollMode;
      rerenderVotersPanel();
    });
    scrollToggle.dataset.bound = 'true';
  }

  if (panelToggle && !panelToggle.dataset.bound) {
    panelToggle.addEventListener('click', () => {
      callbacks.togglePanel('voters');
    });
    panelToggle.dataset.bound = 'true';
  }
}
