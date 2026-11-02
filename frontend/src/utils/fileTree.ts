import type { FileItem, ParsedAction } from "../types";

const unsupportedBrandIcons: Record<string, string> = {
  Facebook: "Globe",
  Github: "Code",
  GitHub: "Code",
  Instagram: "Camera",
  Linkedin: "Briefcase",
  LinkedIn: "Briefcase",
  Twitter: "MessageCircle",
  YouTube: "Play",
  Youtube: "Play",
  Pinterest: "Pin",
  TikTok: "Music",
  WhatsApp: "MessageCircle",
  Discord: "Gamepad2",
  Reddit: "MessageCircle",
  Telegram: "Send",
};

export function normalizeGeneratedContent(content: string): string {
  const normalized = content
    .replace(/^\s*```(?:[\w.+-]+)?\s*\n([\s\S]*?)\n```\s*$/, "$1")
    .replace(/\*\*(["'`])([\s\S]*?)\1\*\*/g, "$1$2$1");

  return normalized.replace(
    /import\s*\{([^}]+)\}\s*from\s*(["'])lucide-react\2/g,
    (_statement, imports: string, quote: string) => {
      const fixedImports = imports.split(",").map((entry) => {
        const trimmed = entry.trim();
        const [imported, local] = trimmed.split(/\s+as\s+/);
        const replacement = unsupportedBrandIcons[imported];
        if (!replacement) return trimmed;
        return `${replacement} as ${local ?? imported}`;
      });
      return `import { ${fixedImports.join(", ")} } from ${quote}lucide-react${quote}`;
    },
  );
}

export function normalizeFileTree(files: FileItem[]): FileItem[] {
  return files.map((item) =>
    item.type === "file"
      ? { ...item, content: normalizeGeneratedContent(item.content ?? "") }
      : { ...item, children: normalizeFileTree(item.children ?? []) },
  );
}

export function applyFileAction(
  files: FileItem[],
  action: ParsedAction,
): FileItem[] {
  if (action.type !== "file" || !action.filePath) return files;

  if (action.filePath.includes("\\")) return files;
  const parts = action.filePath.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    return files;
  }

  function updateLevel(items: FileItem[], depth: number): FileItem[] {
    const name = parts[depth];
    const path = `/${parts.slice(0, depth + 1).join("/")}`;
    const isFile = depth === parts.length - 1;
    const existing = items.find((item) => item.name === name);

    const updated: FileItem = isFile
      ? { name, type: "file", path, content: normalizeGeneratedContent(action.content) }
      : {
          name,
          type: "folder",
          path,
          children: updateLevel(existing?.children ?? [], depth + 1),
        };

    return existing
      ? items.map((item) => (item.name === name ? updated : item))
      : [...items, updated];
  }

  return updateLevel(files, 0);
}

export function findFile(
  files: FileItem[],
  predicate: (file: FileItem) => boolean,
): FileItem | null {
  for (const item of files) {
    if (item.type === "file" && predicate(item)) return item;
    if (item.children) {
      const match = findFile(item.children, predicate);
      if (match) return match;
    }
  }
  return null;
}
