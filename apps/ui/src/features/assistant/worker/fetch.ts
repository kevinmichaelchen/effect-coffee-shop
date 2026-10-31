/**
 * Hugging Face answers 404, with no CORS headers, to any request whose
 * Referer is on `*.workers.dev`, which is where this app deploys. Model
 * downloads go out without a referrer so they work from any origin.
 */
export const fetchWithoutReferrer = async (input: string | URL, init?: RequestInit) =>
  fetch(input, { ...init, referrerPolicy: "no-referrer" });
