// Numeric kernel: indexed loops implement the reference STFT and Slaney mel projection.
// Port of LiquidAI/LFM3-Audio-2B feature_extraction_lfm3_audio.py.
// Copyright 2026 The HuggingFace Team. All rights reserved.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy at https://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
const fftSize = 400;
const hop = 160;
const bins = 201;
const mels = 128;
const window = Float64Array.from(
  { length: fftSize },
  (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / fftSize),
);
// Precomputed DFT is small at N=400 and avoids a padded FFT changing the frequency grid.
const cosine = Float64Array.from({ length: bins * fftSize }, (_, i) =>
  Math.cos((2 * Math.PI * Math.floor(i / fftSize) * (i % fftSize)) / fftSize),
);
const sine = Float64Array.from({ length: bins * fftSize }, (_, i) =>
  Math.sin((2 * Math.PI * Math.floor(i / fftSize) * (i % fftSize)) / fftSize),
);
const toMel = (hz: number) =>
  hz < 1000 ? (hz * 3) / 200 : 15 + (Math.log(hz / 1000) * 27) / Math.log(6.4);
const toHz = (mel: number) =>
  mel < 15 ? (mel * 200) / 3 : 1000 * Math.exp(((mel - 15) * Math.log(6.4)) / 27);
const edges = Float64Array.from({ length: mels + 2 }, (_, i) =>
  toHz((toMel(8000) * i) / (mels + 1)),
);
const at = (values: Float64Array | Float32Array, index: number): number => values[index] ?? 0;
const filters = Float64Array.from({ length: mels * bins }, (_, i) => {
  const mel = Math.floor(i / bins);
  const hz = (i % bins) * 40;
  const left = at(edges, mel),
    center = at(edges, mel + 1),
    right = at(edges, mel + 2);
  return (
    (Math.max(0, Math.min((hz - left) / (center - left), (right - hz) / (right - center))) * 2) /
    (right - left)
  );
});

export interface AudioFeatures {
  readonly inputFeatures: Float32Array;
  readonly featureAttentionMask: BigInt64Array;
  readonly numFrames: number;
  readonly numAudioTokens: number;
}

const framePower = (pcm: Float32Array, frame: number): Float64Array => {
  const samples = Float64Array.from(
    { length: fftSize },
    (_, n) => at(pcm, frame * hop + n) * at(window, n),
  );
  const power = new Float64Array(bins);
  for (let k = 0; k < bins; k += 1) {
    let real = 0,
      imaginary = 0;
    for (let n = 0; n < fftSize; n += 1) {
      real += at(samples, n) * at(cosine, k * fftSize + n);
      imaginary -= at(samples, n) * at(sine, k * fftSize + n);
    }
    power[k] = real * real + imaginary * imaginary;
  }
  return power;
};
const melEnergy = (power: Float64Array, mel: number): number => {
  let energy = 0;
  for (let k = 0; k < bins; k += 1) energy += at(filters, mel * bins + k) * at(power, k);
  return (Math.max(-12, Math.log10(energy)) + 4) / 4;
};
/** Mono 16 kHz PCM -> [1, 128, frames], with an uncentered periodic Hann STFT. */
export const extractAudioFeatures = (pcm16k: Float32Array): AudioFeatures => {
  if (pcm16k.length === 0 || !pcm16k.every(Number.isFinite))
    throw new Error("Expected nonempty finite mono 16 kHz PCM");
  const numFrames = 1 + Math.ceil(Math.max(0, pcm16k.length - fftSize) / hop);
  const inputFeatures = new Float32Array(mels * numFrames);
  for (let frame = 0; frame < numFrames; frame += 1) {
    const power = framePower(pcm16k, frame);
    for (let mel = 0; mel < mels; mel += 1)
      inputFeatures[mel * numFrames + frame] = melEnergy(power, mel);
  }
  return {
    inputFeatures,
    featureAttentionMask: new BigInt64Array(numFrames).fill(1n),
    numFrames,
    numAudioTokens: Math.ceil(numFrames / 8),
  };
};
