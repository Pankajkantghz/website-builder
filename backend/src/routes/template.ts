import { Router } from "express";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { BASE_PROMPT } from "../prompts.js";
import { MODEL } from "../constants.js";
import { basePrompt as nodeBasePrompt } from "../defaults/node.js";
import { basePrompt as reactBasePrompt } from "../defaults/react.js";
import { sendError } from "../errors.js";

const router = Router();

router.post("/", async (req, res) => {
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ code: "PROMPT_REQUIRED", message: "A non-empty prompt is required." });
    return;
  }
  if (prompt.length > 20_000) {
    res.status(413).json({ code: "PROMPT_TOO_LARGE", message: "Prompt must be 20,000 characters or fewer." });
    return;
  }

  try {
    const response = await generateText({
      model: groq(MODEL),
      prompt: prompt.trim(),
      system: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra.",
      temperature: 0,
      maxOutputTokens: 200,
    });
    const answer = response.text.trim().toLowerCase().match(/\b(node|react)\b/)?.[1];
    const starter = answer === "node" ? nodeBasePrompt : answer === "react" ? reactBasePrompt : null;
    if (!starter) {
      res.status(502).json({ code: "INVALID_PROJECT_TYPE", message: "The AI model returned an invalid project type. Please try again." });
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
    sendError(res, error);
  }
});

export default router;
