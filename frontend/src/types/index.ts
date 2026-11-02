export interface FileItem {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileItem[];
}

export interface TemplateResponse {
  prompts: string[];
  uiPrompts: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  response: string;
}

export interface ParsedAction {
  type: "file" | "shell";
  filePath?: string;
  content: string;
}
export interface BuildStep {
  id: number;
  title: string;
  status: "pending" | "in-progress" | "completed" | "failed" | "skipped";
}
