import Editor from "@monaco-editor/react";
import type { FileItem } from "../types";

interface CodeEditorProps {
  file: FileItem | null;
  onChange: (path: string, content: string) => void;
}

const CodeEditor = ({ file, onChange }: CodeEditorProps) => {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-gray-300">
        Select a file to view its contents
      </div>
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const language =
    extension === "tsx" ? "typescript" :
    extension === "ts" ? "typescript" :
    extension === "jsx" ? "javascript" :
    extension === "js" ? "javascript" :
    extension === "json" ? "json" :
    extension === "css" ? "css" :
    extension === "html" ? "html" :
    extension === "md" ? "markdown" : "plaintext";

  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      value={file.content ?? ""}
      options={{
        readOnly: false,
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
      }}
      onChange={(content) => {
        if (content !== undefined) onChange(file.path, content);
      }}
    />
  );
};

export default CodeEditor;
