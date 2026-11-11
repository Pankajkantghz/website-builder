import express, { type Router } from "express";

import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { BASE_PROMPT, getSystemPrompt } from "../prompts.js";
import { MODEL } from "../constants.js";
import { sendError } from "../errors.js";

const router: Router = express.Router();

router.post("/", async (req, res) => {
  const input = req.body?.messages;
  if (!Array.isArray(input) || input.length === 0 || input.length > 80) {
    res.status(400).json({
      code: "INVALID_MESSAGES",
      message: "Provide between 1 and 80 messages.",
    });
    return;
  }

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const message of input) {
    if (
      !message ||
      typeof message !== "object" ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      res.status(400).json({
        code: "INVALID_MESSAGE",
        message:
          "Each message needs a user or assistant role and non-empty text.",
      });
      return;
    }
    messages.push({ role: message.role, content: message.content });
  }
  if (
    messages.reduce((total, message) => total + message.content.length, 0) >
    100_000
  ) {
    console.error(
      "[API] Chat request exceeded the 100,000 character input limit.",
    );
    res.status(413).json({
      code: "CONVERSATION_TOO_LARGE",
      message: "Conversation content must be 100,000 characters or fewer.",
    });
    return;
  }

  try {
    const response = await generateText({
      model: groq(MODEL),
      messages,
      system: `${BASE_PROMPT}\n${getSystemPrompt()}`,
      maxOutputTokens: 8_000,
    });
    if (
      !/<boltArtifact\b/.test(response.text) ||
      !/<boltAction\b/.test(response.text)
    ) {
      res.status(502).json({
        code: "INVALID_AI_RESPONSE",
        message:
          "The AI model returned an incomplete project response. Please try again.",
      });
      return;
    }
    res.json({ response: response.text });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
