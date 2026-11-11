import axios from "axios";
import type { ChatMessage, ChatResponse, TemplateResponse } from "../types";

const api = axios.create({
  // Vite exposes only variables prefixed with VITE_ to browser code.
  // Use the deployed API for local and production frontends unless overridden.
  baseURL: import.meta.env.VITE_API_URL || "https://website-builder-dp0j.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
});

export const generateTemplate = async (
  prompt: string,
): Promise<TemplateResponse> => {
  const response = await api.post("/template", { prompt });
  return response.data;
};

export const sendChatMessage = async (
  messages: ChatMessage[],
): Promise<ChatResponse> => {
  const response = await api.post<ChatResponse>("/chat", { messages });
  const data: unknown = response.data;
  if (typeof data === "string" && /service has been suspended/i.test(data)) {
    throw new Error(
      "The generation API is suspended by its hosting provider. Please contact the site owner; this does not indicate that your AI token quota is exhausted.",
    );
  }
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as { response?: unknown }).response !== "string"
  ) {
    throw new Error(
      "The generation API returned an invalid response. Check that the deployed /chat route is available.",
    );
  }
  return data as ChatResponse;
};

export function getGenerationErrorMessage(error: unknown): string {
  const responseMessage = axios.isAxiosError(error)
    ? String(error.response?.data?.message ?? "")
    : "";
  const responseCode = axios.isAxiosError(error)
    ? String(error.response?.data?.code ?? "")
    : String(error && typeof error === "object" && "code" in error ? error.code : "");
  if (responseCode === "MODEL_QUOTA_EXHAUSTED") {
    return "No response was generated because the configured AI model ran out of tokens or hit its rate limit. Please try again after the quota resets.";
  }
  if (responseCode === "RATE_LIMITED") {
    return "Too many generation requests were sent in a short time. Please wait a minute and try again.";
  }
  if (["AI_INPUT_TOO_LARGE", "CONVERSATION_TOO_LARGE", "PROMPT_TOO_LARGE"].includes(responseCode)) {
    return "This prompt is too large for the free AI model. Shorten it to one focused request under 2,500 characters and try again.";
  }
  const detail = `${responseMessage} ${error instanceof Error ? error.message : ""}`;
  if (/service has been suspended|api is suspended/i.test(detail)) {
    return "The generation API is suspended by its hosting provider. Please contact the site owner; this does not indicate that your AI token quota is exhausted.";
  }
  const tokenLimitReached =
    (axios.isAxiosError(error) && [402, 429].includes(error.response?.status ?? 0)) ||
    /quota|rate.?limit|too many requests|tokens? per (day|minute|hour)|token.{0,40}(limit|exceed|finish|exhaust|maximum|budget)|(?:maximum|exceed|limit).{0,40}tokens?|context length|context window|prompt.{0,20}(?:too long|too large)|request.{0,20}too large|insufficient_quota/i.test(detail);

  if (tokenLimitReached) {
    return "No response was generated because the AI token quota or request token limit was reached. Try a shorter request or try again after your quota resets.";
  }

  return responseMessage || (error instanceof Error && error.message)
    || "Website generation failed. Check that the server is running and try again.";
}

export function logGenerationError(error: unknown): void {
  if (axios.isAxiosError(error)) {
    console.error("[Website Builder] Generation request failed", {
      status: error.response?.status,
      code: error.response?.data?.code,
      message: error.response?.data?.message ?? error.message,
    });
    return;
  }

  console.error("[Website Builder] Generation failed", {
    message: error instanceof Error ? error.message : "Unknown error",
  });
}
