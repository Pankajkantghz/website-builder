import { Router } from "express";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { BASE_PROMPT } from "../prompt.js";
import { basePrompt as nodeBasePrompt } from "../defaults/node.js";
import { basePrompt as reactBasePrompt } from "../defaults/react.js";
import {
  generateWithFallback,
  isQuotaOrRateLimitError,
} from "../services/modelFallback.js";

const router = Router();

router.post("/template", async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ message: "Prompt is required" });
      return;
    }
    if (prompt.length > 20_000) {
      res.status(413).json({ message: "Prompt must be 20,000 characters or fewer." });
      return;
    }

    const { text } = await generateWithFallback(
      (modelId) =>
        generateText({
          model: groq(modelId),
          prompt,
          system:
            "Return either node or react based on what you think this project should be. Only return a single word: node or react. Do not return anything extra.",
          temperature: 0,
          maxOutputTokens: 256,
        }),
      model,
    );

    const answer = text.trim().toLowerCase();
    const starter =
      answer === "node"
        ? nodeBasePrompt
        : answer === "react"
          ? reactBasePrompt
          : null;
    if (!starter) {
      res
        .status(422)
        .json({ message: "Could not determine project type", answer });
      return;
    }

    res.json({
      prompts: [
        BASE_PROMPT,
        `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${starter}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
      ],
      uiPrompts: [starter],
    });
  } catch (error) {
    console.error("Template error:", error);
    if (isQuotaOrRateLimitError(error)) {
      res.status(429).json({
        code: "MODEL_QUOTA_EXHAUSTED",
        message:
          "All available AI models have reached their token quota or rate limit.",
      });
      return;
    }
    res.status(500).json({ message: "Failed to select project template" });
  }
});

export default router;
