import type { Tensor } from "onnxruntime-web";
export const required = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) throw new Error(`Missing ${name}`);
  return value;
};
export const disposeTensors = (values: Readonly<Record<string, Tensor>>) => {
  for (const value of Object.values(values)) value.dispose();
};
