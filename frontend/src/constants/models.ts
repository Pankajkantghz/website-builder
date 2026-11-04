export const AI_MODELS = [
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
] as const;

export type AIModelId = (typeof AI_MODELS)[number]["id"];
export const DEFAULT_AI_MODEL: AIModelId = AI_MODELS[0].id;
