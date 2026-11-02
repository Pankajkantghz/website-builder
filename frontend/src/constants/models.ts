export const AI_MODELS = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
  { id: "allam-2-7b", label: "ALLaM 2 7B" },
] as const;

export type AIModelId = (typeof AI_MODELS)[number]["id"];
export const DEFAULT_AI_MODEL: AIModelId = AI_MODELS[0].id;
