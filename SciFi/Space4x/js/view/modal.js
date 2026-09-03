var Space4x = Space4x || {};

Space4x.hideModal = function (ui) {
	if (!ui || !ui.gameModal) return;
	ui.gameModal.hidden = true;
	if (ui.gameModalForm) ui.gameModalForm.hidden = true;
	if (ui.gameModalText) ui.gameModalText.hidden = false;
	ui.gameModalPrompt = null;
};

Space4x.showModal = function (ui, text) {
	if (!ui || !ui.gameModal || !ui.gameModalText) return;
	ui.gameModalPrompt = null;
	if (ui.gameModalForm) ui.gameModalForm.hidden = true;
	ui.gameModalText.hidden = false;
	Space4x.setText(ui.gameModalText, text || "");
	ui.gameModal.hidden = false;
};

Space4x.showPromptModal = function (ui, opts) {
	if (!ui || !ui.gameModal || !ui.gameModalForm || !ui.gameModalInput) return;
	opts = opts || {};
	ui.gameModalPrompt = opts;
	if (ui.gameModalText) {
		ui.gameModalText.hidden = !opts.message;
		Space4x.setText(ui.gameModalText, opts.message || "");
	}
	if (ui.gameModalLabel) Space4x.setText(ui.gameModalLabel, opts.label || "Name");
	ui.gameModalInput.value = opts.value != null ? opts.value : "";
	ui.gameModalForm.hidden = false;
	ui.gameModal.hidden = false;
	ui.gameModalInput.focus();
	ui.gameModalInput.select();
};

Space4x.submitPromptModal = function (ui) {
	if (!ui || !ui.gameModalPrompt) return;
	const opts = ui.gameModalPrompt;
	const value = ui.gameModalInput ? ui.gameModalInput.value : "";
	Space4x.hideModal(ui);
	if (opts.onOk) opts.onOk(value);
};

Space4x.cancelPromptModal = function (ui) {
	if (!ui || !ui.gameModalPrompt) return;
	const opts = ui.gameModalPrompt;
	Space4x.hideModal(ui);
	if (opts.onCancel) opts.onCancel();
};
