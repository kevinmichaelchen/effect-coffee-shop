# Coffee Shop UI

A Foldkit app (Model, Messages, `update`, Commands) served next to the Coffee Worker, with an
on-device LFM3 assistant in a Web Worker and Coffee Api clients over Effect RPC.

Run from the repo root: `bun run dev`. Tests: `bun run test`.

<details>
<summary>What lives where</summary>

| Path                           | What                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `src/entry.ts`                 | Runtime entry                                            |
| `src/app/`                     | Model, messages, update, commands, routes, subscriptions |
| `src/app/view/`                | Views                                                    |
| `src/features/coffee-shop/api` | Domain Api clients and order failure mapping             |
| `src/features/auth/`           | Yielded's browser auth client and viewer state           |
| `src/features/assistant/`      | LFM3 text and audio workers, tools, and prompt plumbing  |
| `src/worker.ts`                | Website Worker: static assets, backend paths to `COFFEE` |

`src/worker.ts` forwards only the prefixes in `@effect-coffee-shop/coffee-routes` to the Coffee
Worker over a service binding, so the session cookie stays first-party.

</details>
