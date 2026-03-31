import type * as OnnxRuntime from "onnxruntime-web";

export function toFloat32Array(values: OnnxRuntime.Tensor["data"]): Float32Array {
  if (values instanceof Float32Array) {
    return values;
  }

  if (Array.isArray(values)) {
    return Float32Array.from(values.map((value) => Number(value)));
  }

  const normalized: number[] = [];
  for (const value of values as Iterable<number | bigint>) {
    normalized.push(Number(value));
  }

  return Float32Array.from(normalized);
}
