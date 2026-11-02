import { Router } from "express";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { getSystemPrompt } from "../prompt.js";
import {
  generateWithFallback,
  isQuotaOrRateLimitError,
} from "../services/modelFallback.js";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const { messages, model } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ message: "Messages are required" });
      return;
    }
    if (
      messages.length > 80 ||
      !messages.every(
        (message) =>
          message &&
          typeof message === "object" &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string",
      )
    ) {
      res
        .status(400)
        .json({
          message:
            "Messages must contain up to 80 user or assistant text messages.",
        });
      return;
    }
    const totalMessageCharacters = messages.reduce(
      (total: number, message: { content: string }) => total + message.content.length,
      0,
    );
    if (totalMessageCharacters > 100_000) {
      res.status(413).json({ message: "Conversation content must be 100,000 characters or fewer." });
      return;
    }

    const { text } = await generateWithFallback(
      (modelId) =>
        generateText({
          model: groq(modelId),
          messages,
          system: getSystemPrompt(),
          maxOutputTokens: modelId === "allam-2-7b" ? 4096 : 8000,
        }),
      model,
    );

    if (!text.includes("<boltArtifact")) {
      console.error("Invalid AI response:", text);
      res
        .status(502)
        .json({ message: "AI returned an invalid website artifact" });
      return;
    }
    res.json({ response: text });
  } catch (error) {
    console.error(
      "Chat error:",
      error instanceof Error ? error.message : error,
    );
    if (isQuotaOrRateLimitError(error)) {
      res.status(429).json({
        code: "MODEL_QUOTA_EXHAUSTED",
        message:
          "All available AI models have reached their token quota or rate limit.",
      });
      return;
    }
    res.status(500).json({ message: "Failed to generate response" });
  }
});

export default router;
