import Editor from "@monaco-editor/react";
import type { FileItem } from "../types";

interface CodeEditorProps {
  file: FileItem | null;
}

const CodeEditor = ({ file }: CodeEditorProps) => {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-gray-300">
        Select a file to view its contents
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      theme="vs-dark"
      value={file.content ?? ""}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
      }}
    />
  );
};

export default CodeEditor;
