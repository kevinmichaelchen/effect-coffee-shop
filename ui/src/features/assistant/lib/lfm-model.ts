export const MODEL_ID = "LiquidAI/LFM2.5-350M-ONNX";
export const MODEL_BASE = `https://huggingface.co/${MODEL_ID}/resolve/main`;
export const MODEL_PATH = `${MODEL_BASE}/onnx/model_q4.onnx`;
export const MODEL_DATA_PATH = `${MODEL_BASE}/onnx/model_q4.onnx_data`;
export const MODEL_CACHE_ASSETS = [
  `${MODEL_BASE}/config.json`,
  `${MODEL_BASE}/generation_config.json`,
  MODEL_PATH,
  MODEL_DATA_PATH,
  `${MODEL_BASE}/tokenizer.json`,
  `${MODEL_BASE}/tokenizer_config.json`,
] as const;
