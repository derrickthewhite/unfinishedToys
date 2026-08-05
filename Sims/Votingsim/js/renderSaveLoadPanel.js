import { loadAllSaves, saveSimulation, loadSimulation } from './persistence.js';

export function renderSaveLoadPanel(root, state, callbacks) {
  const saves = loadAllSaves();
  root.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">Save / Load</div>
      <button class="small secondary" data-panel-toggle="saveLoad">${state.ui.panelVisibility.saveLoad ? 'Hide' : 'Show'}</button>
    </div>
    <div class="panel-content">
      <div class="grid">
        <div class="field">
          <label for="saveNameInput">Save name</label>
          <input id="saveNameInput" type="text" value="${state.ui.saveName}" placeholder="My simulation" />
        </div>
        <div class="field-row">
          <button id="saveButton">Save</button>
          <button id="loadButton" class="secondary">Load selected</button>
        </div>
        <div class="error-text" id="saveError"></div>
        <div class="subtle">Saved simulations</div>
        <div class="save-list">
          ${saves.length ? saves.map((save) => `
            <div class="save-card">
              <div class="field-row">
                <strong>${save.name}</strong>
                <button class="small" data-action="load-save" data-save-name="${save.name}">Load</button>
              </div>
            </div>
          `).join('') : '<div class="empty-state">No saves yet.</div>'}
        </div>
      </div>
    </div>
  `;

  root.querySelector('#saveButton').addEventListener('click', () => {
    const name = root.querySelector('#saveNameInput').value.trim();
    state.ui.saveName = name;
    if (!name) {
      state.ui.saveError = 'Please provide a save name.';
      callbacks.render();
      return;
    }

    const saves = loadAllSaves();
    const alreadyExists = saves.some((save) => save.name === name);
    if (alreadyExists && !window.confirm(`Overwrite existing save \"${name}\"?`)) {
      return;
    }

    saveSimulation(state, name);
    state.ui.saveError = '';
    callbacks.render();
  });

  root.querySelector('#loadButton').addEventListener('click', () => {
    const name = root.querySelector('#saveNameInput').value.trim();
    if (!name) {
      state.ui.saveError = 'Please provide a save name.';
      callbacks.render();
      return;
    }

    const loaded = loadSimulation(name);
    if (!loaded) {
      state.ui.saveError = 'Could not load that save.';
      callbacks.render();
      return;
    }

    callbacks.applyState(loaded);
    callbacks.render();
  });

  root.querySelectorAll('[data-action="load-save"]').forEach((button) => {
    button.addEventListener('click', () => {
      const loaded = loadSimulation(button.dataset.saveName);
      if (!loaded) {
        state.ui.saveError = 'Could not load that save.';
        callbacks.render();
        return;
      }

      callbacks.applyState(loaded);
      callbacks.render();
    });
  });

  root.querySelector('[data-panel-toggle="saveLoad"]').addEventListener('click', () => {
    callbacks.togglePanel('saveLoad');
  });
}
