import { formatPercent } from './utils.js';

function getReadableTextColor(color) {
  const value = color || '#374151';
  const hslMatch = value.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i);
  if (hslMatch) {
    const lightness = Number(hslMatch[3]);
    return lightness > 70 ? '#111827' : '#f9fafb';
  }

  const hex = value.replace('#', '');
  const normalized = hex.length === 3
    ? hex.split('').map((char) => `${char}${char}`).join('')
    : hex;

  if (normalized.length !== 6) {
    return '#f9fafb';
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.6 ? '#111827' : '#f9fafb';
}

export function renderIssuesPanel(root, state, derivedData, callbacks) {
  root.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">Issues</div>
      <button class="small secondary" data-panel-toggle="issues">${state.ui.panelVisibility.issues ? 'Hide' : 'Show'}</button>
    </div>
    <div class="panel-content">
      <div class="grid">
        ${state.issues.length ? state.issues.map((issue) => {
          const data = derivedData.issueModePercentages.find((entry) => entry.issueId === issue.id);
          return `
            <div class="issue-card">
              <div class="issue-row">
                <div class="issue-name"><strong>${issue.name}</strong></div>
                <div class="mode-list">
                  ${issue.modes.map((mode, index) => `
                    <div class="mode-chip" style="background:${mode.color || '#374151'}; color:${getReadableTextColor(mode.color || '#374151')};">
                      <span class="swatch" style="background:${mode.color || '#374151'}"></span>
                      ${mode.letter} ${data ? formatPercent(data.values[index]) : '0.0%' }
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('') : '<div class="empty-state">No issues generated yet.</div>'}
      </div>
    </div>
  `;

  root.querySelector('[data-panel-toggle="issues"]').addEventListener('click', () => {
    callbacks.togglePanel('issues');
  });
}
