import { useCallback, useEffect, useRef, useState } from "react";
import type { BuildStep, ChatMessage, FileItem, ParsedAction } from "../types";
import { getGenerationErrorMessage, sendChatMessage } from "../services/api";
import {
  applyFileAction,
  findFile,
  normalizeFileTree,
} from "../utils/fileTree";
import { parseXml } from "../utils/parseXml";
import type { AIModelId } from "../constants/models";

const STORAGE_KEY = "bolt-builder-state";

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

export function useBuilder(initialPrompts: string[], initialPrompt: string) {
  const [saved] = useState(readSavedState);
  const [files, setFiles] = useState<FileItem[]>(saved?.files ?? []);
  const filesRef = useRef(files);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    saved?.messages.length
      ? saved.messages
      : [
          ...initialPrompts.map((content) => ({
            role: "user" as const,
            content,
          })),
          ...(initialPrompt.trim()
            ? [{ role: "user" as const, content: initialPrompt.trim() }]
            : []),
        ],
  );
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
      model: AIModelId = "openai/gpt-oss-120b",
    ): Promise<boolean> => {
      const nextPrompt = followup?.trim();
      if (isGenerating || (!messages.length && !nextPrompt)) return false;

      const conversation = nextPrompt
        ? [...messages, { role: "user" as const, content: nextPrompt }]
        : messages;

      setIsGenerating(true);
      setGenerationError("");
      try {
        const response = await sendChatMessage(conversation, model);
        const nextActions = parseXml(response.response);
        const nextFiles = nextActions.reduce(applyFileAction, filesRef.current);

        if (!nextFiles.length) {
          throw new Error("The response did not contain any files.");
        }

        const appFile = findFile(
          nextFiles,
          (file) => file.name.toLowerCase() === "app.tsx",
        );
        filesRef.current = nextFiles;
        setFiles(nextFiles);
        setMessages([
          ...conversation,
          { role: "assistant", content: response.response },
        ]);
        setBuildSteps(toBuildSteps(nextActions));
        if (appFile) setSelectedFile(appFile);
        return true;
      } catch (error) {
        setGenerationError(getGenerationErrorMessage(error));
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, messages],
  );

  return {
    files,
    fileCount: countFiles(files),
    selectedFile,
    setSelectedFile,
    buildSteps,
    isGenerating,
    generationError,
    handleGenerate,
  };
}
