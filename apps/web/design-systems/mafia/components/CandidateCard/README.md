# CandidateCard

A tappable player in a night pick or a vote: token, name and a tag that says what picking them means.

| State | Class | Border / glow | Tag |
|---|---|---|---|
| Idle | — | `border-subtle` | none |
| Mafia pick | `is-selected` | `role-mafia`, `glow-mafia` | TARGET |
| Doctor pick | `is-selected` + `--pick:var(--role-doctor)` | `glow-doctor` | PROTECTED |
| Sheriff pick | `is-selected` + `--pick:var(--role-sheriff)` | `glow-sheriff` | SUSPECT |
| Vote pick | `is-selected` + `--pick:var(--action-steel)` | — | YOUR PICK |
| Blocked | `is-blocked` | 40% opacity | ALREADY SEEN |

- 140px wide (150 in the vote), `radius-md`, card gradient. Two-up on phones (`calc(50% - 7px)`).
- A tap is a pencil mark; nothing is committed until the confirm Button.
