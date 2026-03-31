import { MODEL_CACHE_ASSETS } from "#lib/lfm-model";

export interface LfmCacheStatus {
  readonly label: string;
  readonly phase: "checking" | "cold" | "partial" | "unsupported" | "warm";
}

export const defaultLfmCacheStatus: LfmCacheStatus = {
  label: "Checking whether this browser already has the local model.",
  phase: "checking",
};

export async function getLfmCacheStatus(): Promise<LfmCacheStatus> {
  try {
    if (typeof caches === "undefined") {
      return unavailableCacheStatus();
    }

    const { env } = await import("@huggingface/transformers");
    if (!env.useBrowserCache) {
      return unavailableCacheStatus();
    }

    const cache = await caches.open(env.cacheKey);
    const hitCount = await countAssetCacheHits(cache);
    return describeCacheHits(hitCount, MODEL_CACHE_ASSETS.length);
  } catch {
    return unavailableCacheStatus();
  }
}

async function countAssetCacheHits(cache: Cache): Promise<number> {
  let hitCount = 0;

  for (const asset of MODEL_CACHE_ASSETS) {
    const match = await cache.match(asset);
    if (match !== undefined) {
      hitCount += 1;
    }
  }

  return hitCount;
}

function describeCacheHits(hitCount: number, total: number): LfmCacheStatus {
  if (hitCount === 0) {
    return {
      label: "First use may download the model and tokenizer into this browser.",
      phase: "cold",
    };
  }

  if (hitCount === total) {
    return {
      label: "This browser likely already has the core local model assets.",
      phase: "warm",
    };
  }

  return {
    label: "This browser already has some local assets, but the first reply may still fetch model files.",
    phase: "partial",
  };
}

function unavailableCacheStatus(): LfmCacheStatus {
  return {
    label: "Cache inspection is unavailable on this origin, so the browser may re-download assets.",
    phase: "unsupported",
  };
}
