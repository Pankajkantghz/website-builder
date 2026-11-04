import type { Response } from "express";

export function sendError(res: Response, error: unknown) {
  const value = error as {
    status?: number;
    statusCode?: number;
    message?: string;
  };
  const status = Number(value?.status ?? value?.statusCode);
  const message = value?.message ?? "";

  if (
    status === 402 ||
    status === 429 ||
    /quota|rate.?limit|too many requests/i.test(message)
  ) {
    console.error(
      `[Groq] Token or rate limit error (${status || "unknown"}): ${message || "No provider message."}`,
    );
    res.status(429).json({
      code: "MODEL_QUOTA_EXHAUSTED",
      message:
        "The Groq model quota or rate limit was reached. Try again later.",
    });
    return;
  }
  if (
    status === 401 ||
    status === 403 ||
    /api key|authentication|unauthorized/i.test(message)
  ) {
    res.status(503).json({
      code: "AI_PROVIDER_AUTH_ERROR",
      message: "Groq rejected the server credentials. Check GROQ_API_KEY.",
    });
    return;
  }
  if (
    status === 408 ||
    status === 504 ||
    /timeout|timed out|deadline exceeded/i.test(message)
  ) {
    res.status(504).json({
      code: "AI_PROVIDER_TIMEOUT",
      message: "Groq took too long to respond. Please try again.",
    });
    return;
  }
  if (
    status === 413 ||
    /context length|context window|prompt too (long|large)|request too large/i.test(
      message,
    )
  ) {
    console.error(
      `[Groq] Input token/context limit error (${status || "unknown"}): ${message || "No provider message."}`,
    );
    res.status(413).json({
      code: "AI_INPUT_TOO_LARGE",
      message: "The conversation is too large. Shorten it and try again.",
    });
    return;
  }
  if (
    status >= 500 ||
    /econnreset|econnrefused|enotfound|network|fetch failed/i.test(message)
  ) {
    res.status(503).json({
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "Groq is temporarily unavailable. Please try again.",
    });
    return;
  }

  console.error("AI request failed:", message || error);
  res.status(502).json({
    code: "AI_GENERATION_FAILED",
    message: "Groq could not generate a response. Please try again.",
  });
}
