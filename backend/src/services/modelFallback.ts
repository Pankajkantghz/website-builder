import type { generateText } from "ai";

const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "allam-2-7b",
];

export function isQuotaOrRateLimitError(error: unknown): boolean {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  const messages: string[] = [];

  while (pending.length) {
    const current = pending.pop();
    if (typeof current === "string") {
      messages.push(current);
      continue;
    }
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    const value = current as Record<string, unknown>;
    if ([402, 429].includes(Number(value.status ?? value.statusCode)))
      return true;
    for (const [key, nested] of Object.entries(value)) {
      if (typeof nested === "string") messages.push(`${key}: ${nested}`);
      else if (nested && typeof nested === "object") pending.push(nested);
    }
  }

  return /quota|rate.?limit|too many requests|tokens per (day|minute|hour)|token limit|token.{0,40}(?:exceed|exhaust|maximum|budget)|(?:maximum|exceed|limit).{0,40}tokens?|context length|context window|prompt.{0,20}(?:too long|too large)|request.{0,20}too large|insufficient_quota|\bTPD\b/i.test(messages.join(" "));
}

export async function generateWithFallback(
  generate: (modelId: string) => ReturnType<typeof generateText>,
  preferredModel?: unknown,
): Promise<Awaited<ReturnType<typeof generateText>>> {
  const preferredIndex = GROQ_MODELS.indexOf(
    typeof preferredModel === "string" ? preferredModel : "",
  );
  const order =
    preferredIndex > 0
      ? [
          ...GROQ_MODELS.slice(preferredIndex),
          ...GROQ_MODELS.slice(0, preferredIndex),
        ]
      : GROQ_MODELS;
  let lastError: unknown;

  for (const model of order) {
    try {
      return await generate(model);
    } catch (error) {
      if (!isQuotaOrRateLimitError(error)) throw error;
      lastError = error;
      console.warn(
        `Groq quota/rate limit reached for ${model}; trying the next model.`,
      );
    }
  }

  throw lastError ?? new Error("No Groq models are configured.");
}
