This will be an HTML + JavaScript simulation.

# Issues
Each simulation has a set of issues.

Each issue has:
- A name
- A number of sequential modes

Each mode has:
- A color
- A number (position in sequence)
- A letter

For issues with multiple modes, mode colors should run on a light-to-dark spectrum so modes from the same issue are visually grouped.
Mode colors are auto-generated only for now (not user-editable).

Defaults:
- Number of issues: 10
- Random weighting for issue mode count:
	- 1 mode: 0.4
	- 2 modes: 0.3
	- 3 modes: 0.2
	- 4 modes: 0.1

During generation, each mode also has a weight.
Mode weights are generation-only and control how common each mode is among generated opinions.

# Voters
Each simulation has a set of voters.

Each voter has a number of opinions.

Each opinion has:
- A mode
- A weight

Opinion name format:
- Issue name + mode letter

Rules:
- No voter can have two opinions from the same issue.

Defaults:
- Number of voters: 100
- Number of opinions per voter: 3

# Candidates
Each simulation has a set of candidates.

By default, a new simulation starts with 0 candidates (no random candidate generation).

Each candidate has a number of policies.

Each policy is a selected mode of an issue.

Candidates do not need default policies.

Candidate base rating:
- Number of voters who hold opinions that match that candidate's policies.

# Election Process
At any time, each voter's favored candidate can be calculated.

Each voter scores each candidate:
- If candidate policy mode exactly matches voter opinion mode, add the opinion weight.
- If candidate policy is on the same issue but a different mode, and the issue has exactly 2 modes, add the negative opinion weight.
- If candidate policy is on the same issue but a different mode, and the issue has more than 2 modes:
	- Distance is measured linearly only (no wraparound/circular adjacency).
	- If there is only one candidate policy distance represented on that issue, score based on distance to the voter opinion:
		- Distance less than half the number of modes: positive
		- Distance greater than half the number of modes: negative
		- Distance exactly half the number of modes: 0
	- If there are multiple candidate distances represented on that issue, normalize by nearest and farthest distance:
		- Nearest distance gets full positive weight.
		- Farthest distance gets full negative weight.
		- Intermediate distances get linearly scaled values between those two extremes.

If a candidate has no policy on an issue the voter has an opinion on, that issue contributes 0 for that candidate.

Example for a 4-mode issue, voter opinion at mode 1, and one candidate at each mode:
- Mode 1 candidate: +1 x weight
- Mode 2 candidate: +(1/3) x weight
- Mode 3 candidate: -(1/3) x weight
- Mode 4 candidate: -1 x weight

The candidate with the highest score for a voter is that voter's favored candidate.
If there is a tie for highest score, that voter has no favored candidate.

Favored-candidate calculations should be recomputed live after each edit.

# Panels
All panels appear on screen at once, and each panel can be hidden or shown.

## Generation Panel
- Allow changing simulation default numbers.
- Allow creating a new simulation.

## Issues Panel
- Show each issue with all of its modes.
- Show what percentage of voters hold opinions in each mode.

## Voters Panel
- Show a list of voters.
- Show color swatches and names for each voter opinion.
- Include filter text input:
	- If filter text is present, only show voters with at least one opinion name containing that text.
	- Match should be case-insensitive and substring-based (example: Ban should match Banana).
- Allow creating a candidate from a voter by copying all of that voter's opinions as policies.

## Candidates Panel
- Display candidates and their policies.
- Allow adding policies to a candidate:
	- Open a modal with issues the candidate does not already have a policy on, plus all modes for each issue.
- Allow deleting a candidate policy.
- Allow editing a candidate policy:
	- Open a modal with all modes for that policy's issue.
- Allow adding a new candidate with no policies.
- Allow deleting a candidate.

## Save and Load Panel
- Allow saving to local storage with a custom name.
- If a save name already exists, perform an extra overwrite check and then overwrite on confirmation.
- Allow loading from local storage.
- Display past saves.
- Saves in local storage should include app settings (not only simulation data).

# Validation Limits
Use validation limits in the Generation Panel to prevent extreme values that may slow the browser.

Initial high limits:
- Number of issues: 1 to 50
- Modes per issue: 1 to 12
- Number of voters: 1 to 10,000
- Opinions per voter: 1 to 50 (and cannot exceed number of issues)
- Number of candidates: 0 to 20
- Policies per candidate: 0 to number of issues

# Coding rules and structure
Use explicit, named JavaScript functions (avoid anonymous logic blobs).

Keep JavaScript split into focused files. Target file size: under 300 lines when practical.

Refactoring should be functional and incremental:
- Keep each function single-purpose.
- Move repeated logic into utility functions.
- Prefer small modules over one large script.

Use a separate CSS file.

Keep HTML focused on structure:
- No large inline scripts.
- No large inline style blocks.

State and rendering rules:
- Keep simulation state in one central state object.
- All edits should route through update functions.
- Recompute derived values (favored candidates, percentages) immediately after state changes.

Validation rules:
- Validate all user numeric inputs before applying changes.
- Clamp values to configured limits.
- Show clear inline error text for invalid inputs.

Persistence rules:
- Save both simulation data and app settings.
- Use versioned save payloads to allow future migration.

Naming and style:
- Use camelCase for functions and variables.
- Use descriptive names for issues, modes, and scoring helpers.
- Prefer early returns to reduce nested conditionals.

# File Plan
This is the initial file plan for the first implementation pass.

## Core app files
- index.html
	- App shell and panel layout.
	- Modal containers.
	- Script and stylesheet includes.
- styles.css
	- Layout, panel styling, modal styling, color swatches.
	- Hidden/shown panel states.

## JavaScript modules
- js/app.js
	- App bootstrap.
	- Wire UI events to state actions.
	- Initial render.
- js/state.js
	- Central state object.
	- Default settings and reset/new-simulation helpers.
- js/constants.js
	- Validation limits.
	- Default generation values.
	- Save schema version.
- js/utils.js
	- General helpers (id generation, clamp, deep copy, string matching).
- js/colorScale.js
	- Auto-generate light-to-dark mode color scales per issue.
- js/generation.js
	- Issue generation.
	- Voter generation using mode weights.
- js/candidateActions.js
	- Create/delete candidate.
	- Create candidate from voter (copy all opinions as policies).
	- Add/edit/delete candidate policies.
- js/scoring.js
	- Per-issue score calculation.
	- Candidate total scoring per voter.
	- Tie handling and favored-candidate computation.
- js/derivedData.js
	- Issue mode opinion percentages.
	- Candidate base ratings.
- js/persistence.js
	- Save/load to localStorage.
	- Duplicate-name overwrite check.
	- Save list retrieval.
- js/renderApp.js
	- Top-level render coordinator.
	- Calls panel renderers.
- js/renderGenerationPanel.js
	- Generation controls and validation messages.
- js/renderIssuesPanel.js
	- Issue/mode display and percentages.
- js/renderVotersPanel.js
	- Voter list render.
	- Case-insensitive substring filter.
- js/renderCandidatesPanel.js
	- Candidate/policy list render.
	- Buttons for add/edit/delete actions.
- js/renderSaveLoadPanel.js
	- Save form, load list, overwrite flow.
- js/modals.js
	- Shared modal open/close logic.
	- Mode selection modal behaviors.

## Optional later files (not required for first pass)
- js/debugView.js
	- Small diagnostics panel for counts and timings.
- js/migrations.js
	- Save data migrations by version.
- tests/scoring.spec.js
	- Targeted tests for score edge cases.

## Implementation order
1. Build state, constants, utils, and scoring modules.
2. Build generation + derived data modules.
3. Build candidate actions and persistence.
4. Build HTML shell + CSS.
5. Build render modules and modal flow.
6. Wire events in app bootstrap and validate live recompute behavior.