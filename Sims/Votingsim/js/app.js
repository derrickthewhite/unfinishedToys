import { createInitialState } from './state.js';
import { renderApp } from './renderApp.js';

const appRoot = document.body;
const state = createInitialState();

renderApp(appRoot, state);
