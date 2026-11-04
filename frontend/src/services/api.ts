import axios from "axios";
import type { ChatMessage, ChatResponse, TemplateResponse } from "../types";

const api = axios.create({
  // Set VITE_API_URL to the deployed backend URL. Keep localhost as the dev default.
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
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
  return response.data;
};

export function getGenerationErrorMessage(error: unknown): string {
  const responseMessage = axios.isAxiosError(error)
    ? String(error.response?.data?.message ?? "")
    : "";
  const responseCode = axios.isAxiosError(error)
    ? String(error.response?.data?.code ?? "")
    : "";
  if (responseCode === "MODEL_QUOTA_EXHAUSTED") {
    return "No response was generated because the configured AI model ran out of tokens or hit its rate limit. Please try again after the quota resets.";
  }
  const detail = `${responseMessage} ${error instanceof Error ? error.message : ""}`;
  const tokenLimitReached =
    (axios.isAxiosError(error) && [402, 429].includes(error.response?.status ?? 0)) ||
    /quota|rate.?limit|too many requests|tokens? per (day|minute|hour)|token.{0,40}(limit|exceed|finish|exhaust|maximum|budget)|(?:maximum|exceed|limit).{0,40}tokens?|context length|context window|prompt.{0,20}(?:too long|too large)|request.{0,20}too large|insufficient_quota/i.test(detail);

  if (tokenLimitReached) {
    return "No response was generated because the AI token quota or request token limit was reached. Try a shorter request or try again after your quota resets.";
  }

  return responseMessage || "Website generation failed. Check that the server is running and try again.";
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
