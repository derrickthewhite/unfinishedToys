(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./data.js'));
        return;
    }
    root.HordesController = factory(root.HordesData);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            resetControllerRuntime() {
                this._controllerActionToken = (this._controllerActionToken || 0) + 1;
                this._controllerActionRunning = false;
                this._controllerActionScheduled = false;
                this._lastComputerActionAt = 0;
            },

            nowMs() {
                return (typeof performance !== 'undefined' && typeof performance.now === 'function')
                    ? performance.now()
                    : Date.now();
            },

            getController(playerId) {
                return data.normalizeController(this.getPlayer(playerId)?.controller);
            },

            isLocalPlayer(playerId) {
                return this.getController(playerId) === 'local';
            },

            isComputerPlayer(playerId) {
                return this.getController(playerId) === 'computer';
            },

            isRemotePlayer(playerId) {
                return this.getController(playerId) === 'remote';
            },

            canLocallyControl(playerId) {
                return this.isLocalPlayer(playerId);
            },

            hasLocalHuman() {
                return data.PLAYER_IDS.some((playerId) => this.isLocalPlayer(playerId));
            },

            hasComputerPlayer() {
                return data.PLAYER_IDS.some((playerId) => this.isComputerPlayer(playerId));
            },

            isComputerMatch() {
                return data.PLAYER_IDS.every((playerId) => this.isComputerPlayer(playerId));
            },

            isComputerSetupActor(playerId) {
                return this.isComputerPlayer(playerId);
            },

            markComputerAction() {
                this._lastComputerActionAt = this.nowMs();
            },

            setComputerThinking(playerId, message) {
                this.state.controllerThinking = {
                    playerId: playerId || null,
                    message: message || 'Thinking…'
                };
                this.syncControllerHud();
            },

            clearComputerThinking() {
                this.state.controllerThinking = null;
                this.syncControllerHud();
            },

            setControllerPaused(paused) {
                const next = Boolean(paused);
                if (this.state.controllerPaused === next) {
                    return;
                }
                this.state.controllerPaused = next;
                this._controllerActionToken = (this._controllerActionToken || 0) + 1;
                if (next) {
                    this.clearComputerThinking();
                    this.updateStatus('Computer paused.');
                    return;
                }
                this.scheduleControllerAction();
                this.updateStatus('Computer resumed.');
            },

            toggleControllerPaused() {
                this.setControllerPaused(!this.state.controllerPaused);
            },

            isControllerIdleLocked() {
                if (this.state.controllerPaused) {
                    return true;
                }
                if (typeof this.isGameOver === 'function' && this.isGameOver()) {
                    return true;
                }
                if (this.state.mode === 'edit' && this.state.setupStage === 'game') {
                    return true;
                }
                if (this.state.autoMoveModalOpen) {
                    return true;
                }
                if (this.state.confirmation === 'skip-shooting' || this.state.setup?.confirmation) {
                    return true;
                }
                return false;
            },

            getPendingControllerDecision() {
                if (this.isControllerIdleLocked()) {
                    return null;
                }
                if (this.state.combatResolution) {
                    if (this.isComputerMatch()) {
                        return { kind: 'ack-combat', playerId: this.state.activePlayerId };
                    }
                    return null;
                }
                if (this.state.setupStage === 'army-builder') {
                    return null;
                }
                if (this.state.setupStage === 'terrain-placement') {
                    const defenderPlayerId = this.getTerrainSetup()?.defenderPlayerId;
                    if (!defenderPlayerId || this.isLocalPlayer(defenderPlayerId)) {
                        return null;
                    }
                    if (this.getTerrainSetup()?.computerTerrainAttempted && !this.isTerrainReady()) {
                        return null;
                    }
                    return {
                        kind: this.isTerrainReady() ? 'confirm-terrain' : 'place-terrain',
                        playerId: defenderPlayerId
                    };
                }
                if (this.state.setupStage === 'unit-deployment') {
                    const activePlayerId = this.getDeploymentSetup()?.activePlayerId;
                    if (!activePlayerId || this.isLocalPlayer(activePlayerId)) {
                        return null;
                    }
                    const attempted = this.getDeploymentSetup()?.computerDeployAttemptedByPlayerId || {};
                    if (attempted[activePlayerId] && !this.canFinishDeploymentTurn()) {
                        return null;
                    }
                    return { kind: 'deploy', playerId: activePlayerId };
                }
                if (this.state.setupStage !== 'game' || this.state.mode !== 'game') {
                    return null;
                }
                if (this.state.phase === 'move') {
                    if (this.isLocalPlayer(this.state.activePlayerId)) {
                        return null;
                    }
                    return { kind: 'move', playerId: this.state.activePlayerId };
                }
                if (this.state.phase === 'form-up') {
                    if (this.isLocalPlayer(this.state.activePlayerId)) {
                        return null;
                    }
                    return { kind: 'ack-form-up', playerId: this.state.activePlayerId };
                }
                if (this.state.phase === 'shooting') {
                    const undeclaredComputer = data.PLAYER_IDS.find((playerId) => (
                        !this.isLocalPlayer(playerId)
                        && !this.state.computerShotsDeclared?.[playerId]
                    ));
                    if (undeclaredComputer) {
                        return { kind: 'declare-shots', playerId: undeclaredComputer };
                    }
                    if (!this.hasLocalHuman()) {
                        return { kind: 'resolve-shooting', playerId: this.state.activePlayerId };
                    }
                    return null;
                }
                if (this.state.phase === 'melee') {
                    if (this.isLocalPlayer(this.state.activePlayerId)) {
                        return null;
                    }
                    return { kind: 'resolve-melee', playerId: this.state.activePlayerId };
                }
                return null;
            },

            scheduleControllerAction() {
                if (this._controllerActionScheduled) {
                    return;
                }
                this._controllerActionScheduled = true;
                const token = this._controllerActionToken || 0;
                setTimeout(() => {
                    this._controllerActionScheduled = false;
                    if (token !== this._controllerActionToken) {
                        return;
                    }
                    void this.runPendingControllerAction();
                }, 0);
            },

            async waitForComputerDelay(startedAt) {
                if (this._skipControllerDelay) {
                    return this._controllerActionToken;
                }
                const elapsed = this.nowMs() - (startedAt || this._lastComputerActionAt || 0);
                const remaining = Math.max(0, data.COMPUTER_ACTION_DELAY_MS - elapsed);
                const token = this._controllerActionToken;
                if (remaining > 0) {
                    await new Promise((resolve) => setTimeout(resolve, remaining));
                }
                return token;
            },

            isControllerActionCurrent(token) {
                return token === this._controllerActionToken && !this.state.controllerPaused;
            },

            async runPendingControllerAction() {
                if (this._controllerActionRunning) {
                    return;
                }
                this._controllerActionRunning = true;
                try {
                    while (!this.isControllerIdleLocked()) {
                        const decision = this.getPendingControllerDecision();
                        if (!decision) {
                            break;
                        }
                        if (this.isRemotePlayer(decision.playerId)) {
                            break;
                        }
                        if (!this.isComputerPlayer(decision.playerId)) {
                            break;
                        }
                        const token = this._controllerActionToken;
                        await this.performComputerDecision(decision);
                        if (!this.isControllerActionCurrent(token)) {
                            break;
                        }
                    }
                } finally {
                    this._controllerActionRunning = false;
                    this.clearComputerThinking();
                    if (typeof this.syncUiFromState === 'function') {
                        this.syncUiFromState();
                    }
                }
            },

            async performComputerDecision(decision) {
                const startedAt = this.nowMs();
                const label = this.getPlayerSelectLabel(decision.playerId);
                if (decision.kind === 'place-terrain') {
                    this.setComputerThinking(decision.playerId, `${label} is placing terrain…`);
                    this.autoPlaceTerrain();
                    const terrain = this.getTerrainSetup();
                    if (terrain) {
                        terrain.computerTerrainAttempted = true;
                    }
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(startedAt))) {
                        return;
                    }
                    this.markComputerAction();
                    this.syncUiFromState();
                    this.requestRender();
                    return;
                }
                if (decision.kind === 'confirm-terrain') {
                    this.setComputerThinking(decision.playerId, `${label} confirms the terrain.`);
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(this._lastComputerActionAt || startedAt))) {
                        return;
                    }
                    this.confirmTerrainPlacement();
                    this.markComputerAction();
                    return;
                }
                if (decision.kind === 'deploy') {
                    const deployment = this.getDeploymentSetup();
                    this.setComputerThinking(decision.playerId, `${label} is deploying…`);
                    if (deployment && !deployment.computerDeployAttemptedByPlayerId?.[decision.playerId]) {
                        this.autoDeployActiveArmy();
                        deployment.computerDeployAttemptedByPlayerId = {
                            ...(deployment.computerDeployAttemptedByPlayerId || {}),
                            [decision.playerId]: true
                        };
                    }
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(startedAt))) {
                        return;
                    }
                    if (this.canFinishDeploymentTurn()) {
                        this.finishDeploymentTurn();
                    } else {
                        this.updateStatus(`${label} could not finish a legal deployment.`);
                    }
                    this.markComputerAction();
                    return;
                }
                if (decision.kind === 'move') {
                    this.setComputerThinking(decision.playerId, `${label} is considering a move…`);
                    const result = await this.playComputerMove();
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(startedAt))) {
                        return;
                    }
                    if (result === 'end-phase') {
                        this.endMovePhase();
                    }
                    this.markComputerAction();
                    this.syncUiFromState();
                    this.requestRender();
                    return;
                }
                if (decision.kind === 'ack-form-up') {
                    this.setComputerThinking(decision.playerId, `${label} reviews form-up.`);
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(startedAt))) {
                        return;
                    }
                    this.acknowledgePhase();
                    this.markComputerAction();
                    return;
                }
                if (decision.kind === 'declare-shots') {
                    this.setComputerThinking(decision.playerId, `${label} is choosing shooting targets…`);
                    this.declareComputerShooting(decision.playerId);
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(startedAt))) {
                        return;
                    }
                    this.markComputerAction();
                    this.syncUiFromState();
                    this.requestRender();
                    return;
                }
                if (decision.kind === 'resolve-shooting') {
                    this.setComputerThinking(decision.playerId, `${label} resolves shooting.`);
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(startedAt))) {
                        return;
                    }
                    this.resolveShootingPhase({ skipUndeclared: true });
                    this.markComputerAction();
                    return;
                }
                if (decision.kind === 'resolve-melee') {
                    this.setComputerThinking(decision.playerId, `${label} resolves melee.`);
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(startedAt))) {
                        return;
                    }
                    this.resolveMeleePhase();
                    this.markComputerAction();
                    return;
                }
                if (decision.kind === 'ack-combat') {
                    this.setComputerThinking(decision.playerId, 'Reviewing combat…');
                    if (!this.isControllerActionCurrent(await this.waitForComputerDelay(startedAt))) {
                        return;
                    }
                    this.acknowledgePhase();
                    this.markComputerAction();
                }
            },

            syncControllerHud() {
                const thinking = this.state.controllerThinking;
                const setupActive = this.isSetupActive();
                const showSetupHud = this.hasComputerPlayer()
                    && setupActive
                    && this.state.setupStage !== 'army-builder';
                if (this.ui.controllerHud) {
                    this.ui.controllerHud.hidden = !showSetupHud;
                }
                if (this.ui.controllerThinkingText) {
                    const message = thinking?.message
                        || (this.state.controllerPaused ? 'Computer paused.' : '');
                    this.ui.controllerThinkingText.textContent = message;
                    this.ui.controllerThinkingText.hidden = !message;
                }
                if (this.ui.pauseControllerButton) {
                    this.ui.pauseControllerButton.hidden = !showSetupHud;
                    this.ui.pauseControllerButton.textContent = this.state.controllerPaused ? 'Resume' : 'Pause';
                }
                if (this.ui.gamePauseControllerButton) {
                    const showGamePause = this.hasComputerPlayer()
                        && this.state.setupStage === 'game'
                        && this.state.mode === 'game';
                    this.ui.gamePauseControllerButton.hidden = !showGamePause;
                    this.ui.gamePauseControllerButton.textContent = this.state.controllerPaused ? 'Resume' : 'Pause';
                }
                if (this.ui.gameThinkingText) {
                    const show = this.hasComputerPlayer()
                        && this.state.setupStage === 'game'
                        && this.state.mode === 'game';
                    this.ui.gameThinkingText.hidden = !show;
                    this.ui.gameThinkingText.textContent = thinking?.message
                        || (this.state.controllerPaused ? 'Computer paused.' : 'Computer ready.');
                }
            }
        });
    }

    return { install };
}));
