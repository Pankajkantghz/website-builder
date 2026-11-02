import { useState } from "react";
import type { FileItem } from "../types";

interface FileExplorerProps {
  files: FileItem[];
  onFileSelect: (file: FileItem) => void;
  selectedFilePath: string | null;
}

interface FileNodeProps {
  item: FileItem;
  onFileSelect: (file: FileItem) => void;
  selectedFilePath: string | null;
}

function FileNode({ item, onFileSelect, selectedFilePath }: FileNodeProps) {
  const [expansion, setExpansion] = useState<{
    selectedFilePath: string | null;
    expanded: boolean;
  } | null>(null);
  const isFolder = item.type === "folder";
  const isSelected = !isFolder && selectedFilePath === item.path;
  const isExpanded = expansion?.selectedFilePath === selectedFilePath
    ? expansion.expanded
    : isFolder && Boolean(selectedFilePath?.startsWith(`${item.path}/`));

  function handleClick() {
    if (isFolder) {
      setExpansion({ selectedFilePath, expanded: !isExpanded });
    } else {
      onFileSelect(item);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-current={isSelected ? "page" : undefined}
        className={`flex w-full items-center gap-2 rounded p-2 text-left text-sm text-gray-200 ${
          isSelected ? "bg-blue-600" : "hover:bg-gray-800"
        }`}
      >
        <span aria-hidden="true">{isFolder ? (isExpanded ? "▼" : "▶") : "📄"}</span>
        {isFolder && <span aria-hidden="true">📁</span>}
        <span>{item.name}</span>
      </button>

      {isFolder && isExpanded && item.children && (
        <div className="ml-5">
          {item.children.map((child) => (
            <FileNode
              key={child.path}
              item={child}
              onFileSelect={onFileSelect}
              selectedFilePath={selectedFilePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const FileExplorer = ({ files, onFileSelect, selectedFilePath }: FileExplorerProps) => {
  return (
    <nav aria-label="Generated files">
      <h2 className="mb-4 text-sm font-semibold text-gray-200">File Explorer</h2>
      <ul className="space-y-1">
        {files.map((file) => (
          <li key={file.path}>
            <FileNode item={file} onFileSelect={onFileSelect} selectedFilePath={selectedFilePath} />
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default FileExplorer;
