import { useCallback, useEffect, useRef, useState } from "react";
import type { BuildStep, ChatMessage, FileItem, ParsedAction } from "../types";
import {
  getGenerationErrorMessage,
  logGenerationError,
  sendChatMessage,
} from "../services/api";
import {
  applyFileAction,
  findFile,
  normalizeFileTree,
} from "../utils/fileTree";
import { parseXml } from "../utils/parseXml";
import type { AIModelId } from "../constants/models";

const STORAGE_KEY = "bolt-builder-state";
const MAX_PROMPT_CHARACTERS = 6_000;

interface SavedBuilderState {
  files: FileItem[];
  buildSteps: BuildStep[];
  selectedFile: FileItem | null;
  messages: ChatMessage[];
}

function readSavedState(): SavedBuilderState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw) as Partial<SavedBuilderState>;
    return {
      files: Array.isArray(saved.files) ? normalizeFileTree(saved.files) : [],
      buildSteps: Array.isArray(saved.buildSteps) ? saved.buildSteps : [],
      selectedFile: saved.selectedFile ?? null,
      messages: Array.isArray(saved.messages)
        ? saved.messages.filter(
            (message): message is ChatMessage =>
              message &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

function toBuildSteps(actions: ParsedAction[]): BuildStep[] {
  return actions.map((action, index) => ({
    id: Date.now() + index,
    title:
      action.type === "file"
        ? `Update ${action.filePath}`
        : `Command requested: ${action.content}`,
    status: action.type === "file" ? "completed" : "skipped",
  }));
}

function countFiles(items: FileItem[]): number {
  return items.reduce(
    (count, item) =>
      count + (item.type === "file" ? 1 : countFiles(item.children ?? [])),
    0,
  );
}

export function useBuilder(initialPrompt: string) {
  const [saved] = useState(readSavedState);
  const [files, setFiles] = useState<FileItem[]>(saved?.files ?? []);
  const filesRef = useRef(files);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const lastSavedPrompt = [...(saved?.messages ?? [])]
      .reverse()
      .find((message) => message.role === "user")?.content;
    const prompt = lastSavedPrompt ?? initialPrompt.trim();
    return prompt ? [{ role: "user", content: prompt }] : [];
  });
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>(
    saved?.buildSteps ?? [],
  );
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(() =>
    saved?.selectedFile
      ? findFile(saved.files, (file) => file.path === saved.selectedFile?.path)
      : null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ files, buildSteps, selectedFile, messages }),
      );
    } catch {
      // Storage can be unavailable or full; the current in-memory workspace still works.
    }
  }, [files, buildSteps, selectedFile, messages]);

  const handleGenerate = useCallback(
    async (
      followup?: string,
      _model: AIModelId = "openai/gpt-oss-20b",
    ): Promise<boolean> => {
      const nextPrompt = followup?.trim();
      if (isGenerating || (!messages.length && !nextPrompt)) return false;

      const prompt =
        nextPrompt ??
        [...messages].reverse().find((message) => message.role === "user")
          ?.content;
      if (!prompt) return false;
      if (prompt.length > MAX_PROMPT_CHARACTERS) {
        console.error(
          "[Website Builder] Prompt exceeds the supported input size",
          {
            characters: prompt.length,
            limit: MAX_PROMPT_CHARACTERS,
          },
        );
        setGenerationError(
          "That prompt is too long for the free AI model. Keep it under 6,000 characters and try again.",
        );
        return false;
      }
      const conversation = [
        {
          role: "user" as const,
          content: prompt,
        },
      ];
      setIsGenerating(true);
      setGenerationError("");
      try {
        const response = await sendChatMessage(conversation);
        const nextActions = parseXml(response.response);
        const nextFiles = nextActions.reduce(applyFileAction, [] as FileItem[]);

        if (!nextFiles.length) {
          throw new Error("The response did not contain any files.");
        }

        const appFile =
          findFile(nextFiles, (file) => /^(app|main)\.(tsx?|jsx?)$/i.test(file.name)) ??
          findFile(nextFiles, () => true);
        filesRef.current = nextFiles;
        setFiles(nextFiles);
        setMessages([{ role: "user", content: prompt }]);
        setBuildSteps(toBuildSteps(nextActions));
        if (appFile) setSelectedFile(appFile);
        return true;
      } catch (error) {
        logGenerationError(error);
        setGenerationError(getGenerationErrorMessage(error));
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, messages],
  );

  const updateFileContent = useCallback((path: string, content: string) => {
    let updatedFile: FileItem | null = null;
    const updateTree = (items: FileItem[]): FileItem[] =>
      items.map((item) => {
        if (item.type === "file" && item.path === path) {
          updatedFile = { ...item, content };
          return updatedFile;
        }
        if (item.type === "folder") {
          return { ...item, children: updateTree(item.children ?? []) };
        }
        return item;
      });

    const nextFiles = updateTree(filesRef.current);
    if (!updatedFile) return;
    filesRef.current = nextFiles;
    setFiles(nextFiles);
    setSelectedFile(updatedFile);
  }, []);

  return {
    files,
    fileCount: countFiles(files),
    selectedFile,
    setSelectedFile,
    updateFileContent,
    buildSteps,
    isGenerating,
    generationError,
    handleGenerate,
  };
}
