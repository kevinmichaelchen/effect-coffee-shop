# Runtime Platforms

This directory contains runtime adapters. A platform adapter is the outer shell that reads runtime
configuration, chooses concrete persistence and auth bindings, and hands standard Web
[`Request`/`Response`][mdn-fetch] traffic to shared HTTP routing.

## Directory Map

| Directory                    | Role                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| [`bun`](./bun)               | Local development and command entrypoints, including `Bun.serve` HTTP handlers. |
| [`cloudflare`](./cloudflare) | Cloudflare Worker entrypoints, bindings, D1 persistence, assets, and routes.    |
| [`aws`](./aws)               | AWS Lambda Function URL entrypoints and route composition.                      |

## Nomenclature

`platforms` names deployment/runtime shells, not business capabilities. Each platform can have a
`backend.ts` because each runtime may need a different cache or persistence binding, while
[`../http/backend.ts`](../http/backend.ts) defines the shared app-level backend shape.

`routes` names request branches registered with `createHttpRouter`. The old term `mounts` implied a
framework tree or nested server mount; these modules are simpler path/method matches over Web
requests, which matches the shape of Cloudflare Worker [`fetch` handlers][cloudflare-handlers], Bun
[`Bun.serve`][bun-server], and AWS Lambda [Function URL][aws-function-url] traffic.

## Boundary Rule

Decode platform input here, then pass typed values inward. Do not let Cloudflare bindings, Bun env
objects, or AWS event details spread into Coffee domain packages.

[aws-function-url]: https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
[bun-server]: https://bun.com/docs/runtime/http/server
[cloudflare-handlers]: https://developers.cloudflare.com/workers/runtime-apis/handlers/
[mdn-fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
