# Coffee Shop UI

Foldkit app (Model, Messages, `update`, Commands) served next to the Coffee Worker.

| Path                 | What                                      |
| -------------------- | ----------------------------------------- |
| `src/entry.ts`       | Runtime entry                             |
| `src/app/`           | Model, messages, update, commands, routes |
| `src/app/view/`      | Views                                     |
| `src/features/*/api` | Api clients                               |
| `src/worker.ts`      | Website Worker: assets plus backend paths |

Run from the repo root: `bun run dev`. Tests: `bun run test`.
