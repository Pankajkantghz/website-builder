import axios from "axios";
import type { ChatMessage, ChatResponse, TemplateResponse } from "../types";

const api = axios.create({
  // Vite exposes only variables prefixed with VITE_ to browser code.
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV
      ? "http://localhost:3000"
      : "https://website-builder-api.onrender.com"),
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
  const prompt = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");
  const baseURL = String(api.defaults.baseURL).replace(/\/$/, "");
  const response = await fetch(`${baseURL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body;
    let errorCode = "";
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.message ?? parsed?.error?.message ?? body;
      errorCode = parsed?.code ?? "";
    } catch {
      // Keep the plain-text response for error classification below.
    }
    const error = new Error(detail || `Request failed with status ${response.status}`);
    Object.assign(error, { status: response.status, code: errorCode });
    throw error;
  }

  if (response.headers.get("content-type")?.includes("text/html")) {
    const page = await response.text();
    throw new Error(/service has been suspended/i.test(page)
      ? "The generation API is suspended by its hosting provider. Please contact the site owner; this does not indicate that your AI token quota is exhausted."
      : "The generation API returned a web page instead of generated files. Please check the API deployment and URL.");
  }

  if (!response.body) throw new Error("The server returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let buffer = "";
  const consumeEvent = (event: string) => {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    let parsed: any;
    try {
      parsed = JSON.parse(data);
    } catch {
      output += data;
      return;
    }
    if (parsed?.error || parsed?.type === "error") {
      const message = parsed.error?.message ?? parsed.message ?? "Generation failed.";
      const error = new Error(message);
      Object.assign(error, { code: parsed.code ?? parsed.error?.code ?? "" });
      throw error;
    }
    try {
      output += typeof parsed === "string"
        ? parsed
        : String(parsed.text ?? parsed.content ?? parsed.response ?? parsed.delta ?? "");
    } catch (error) {
      if (error instanceof Error) throw error;
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    events.forEach(consumeEvent);
    if (done) break;
  }
  if (buffer.trim()) consumeEvent(buffer);
  if (/<!doctype html|<html\b/i.test(output)) {
    throw new Error(output.match(/service has been suspended/i)
      ? "The generation API is suspended by its hosting provider. Please contact the site owner; this does not indicate that your AI token quota is exhausted."
      : "The generation API returned a web page instead of generated files. Please check the API deployment and URL.");
  }
  if (!output.trim()) throw new Error("The server completed without returning generated files.");
  return { response: output };
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
