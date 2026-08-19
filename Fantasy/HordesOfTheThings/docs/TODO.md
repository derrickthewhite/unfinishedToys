# TODO

Project work. Intended rules that are not in the prototype yet are specified in [Design.md](Design.md) under **Rules not yet in the prototype**. This file tracks doing that work, plus prototype product tasks that are not rules.

## Implement specified rules

- [ ] Hills, hill crests, and obstructing vs non-obstructing features — data, movement, combat, and crest line-of-sight
- [ ] Rivers as a distinct feature, including crossing and road/bridge precedence
- [ ] Crooked and forked roads — check the current strip sampling before adding either shape
- [ ] Retreat as a combat result (backward a specified distance, limited maneuver)
- [ ] Lurkers as a reserve type

## Prototype

- [ ] Put Edit Mode behind an extra confirmation (settings or modal), so it is harder to enter by accident
- [ ] More faction artwork for types that still fall back to generic SVGs
- [ ] Further armies once their artwork exists
- [ ] More unit types, once they have rules in Design.md
- [x] Shooting and melee automation for computer players (local Auto Move remains move-phase only)
- [ ] Opponent lookahead for Auto Move
- [ ] AI perf spike: evaluate moving move-search/scoring to a Web Worker (off-main-thread), with benchmark targets and migration risk assessment before full cutover
- [ ] Auto-deploy: handle "hordes do not fit" placement failure path
