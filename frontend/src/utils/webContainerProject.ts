import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import type { FileItem } from "../types";
import { normalizeGeneratedContent } from "./fileTree";

/** Flattens the UI file tree into safe project-relative file paths. */
export function collectProjectFiles(
  items: FileItem[],
  output = new Map<string, string>(),
): Map<string, string> {
  for (const item of items) {
    if (item.type === "file") {
      const path = item.path.split("/").filter(Boolean);
      if (
        path.length &&
        !item.path.includes("\\") &&
        !path.some((part) => part === "." || part === "..")
      ) {
        output.set(path.join("/"), normalizeGeneratedContent(item.content ?? ""));
      }
    } else if (item.children) {
      collectProjectFiles(item.children, output);
    }
  }
  return output;
}

function inferDependencies(files: Map<string, string>): Record<string, string> {
  const dependencies: Record<string, string> = {};
  const importPattern = /(?:from\s*|import\s*\()\s*["']([^"']+)["']/g;

  for (const [path, contents] of files) {
    if (!/\.[cm]?[jt]sx?$/.test(path)) continue;

    for (const [, specifier] of contents.matchAll(importPattern)) {
      if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:")) continue;
      const packageName = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0];

      if (packageName && !["react", "react-dom"].includes(packageName)) {
        dependencies[packageName] = "latest";
      }
    }
  }

  return dependencies;
}

function createPackageJson(files: Map<string, string>): string {
  let packageJson: Record<string, unknown> = {};
  try {
    const contents = files.get("package.json");
    if (contents) packageJson = JSON.parse(contents);
  } catch {
    packageJson = {};
  }

  const scripts = (packageJson.scripts as Record<string, string> | undefined) ?? {};
  const dependencies = (packageJson.dependencies as Record<string, string> | undefined) ?? {};
  const devDependencies = (packageJson.devDependencies as Record<string, string> | undefined) ?? {};
  const usesTailwind = [...files].some(
    ([path, contents]) => path.endsWith(".css") && /@tailwind\s/.test(contents),
  );

  return JSON.stringify(
    {
      ...packageJson,
      type: packageJson.type ?? "module",
      scripts: { ...scripts, dev: scripts.dev ?? "vite --host 0.0.0.0" },
      dependencies: {
        react: dependencies.react ?? "latest",
        "react-dom": dependencies["react-dom"] ?? "latest",
        "lucide-react": dependencies["lucide-react"] ?? "latest",
        ...inferDependencies(files),
        ...dependencies,
      },
      devDependencies: {
        vite: devDependencies.vite ?? "latest",
        "@vitejs/plugin-react": devDependencies["@vitejs/plugin-react"] ?? "latest",
        ...(usesTailwind
          ? {
              tailwindcss: devDependencies.tailwindcss ?? "^3.4.19",
              postcss: devDependencies.postcss ?? "^8.5.32",
              autoprefixer: devDependencies.autoprefixer ?? "^10.6.2",
            }
          : {}),
        ...devDependencies,
      },
    },
    null,
    2,
  );
}

/** Adds the minimum files needed to start a generated React app in Vite. */
function addEntryFiles(files: Map<string, string>): void {
  if (!files.has("index.html")) {
    files.set(
      "index.html",
      `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Website Preview</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    );
  }

  if (!files.has("src/main.tsx") && files.has("src/App.tsx")) {
    const stylesheetImport = files.has("src/index.css") ? "import './index.css';\n" : "";
    files.set(
      "src/main.tsx",
      `import React from 'react';\nimport { createRoot } from 'react-dom/client';\n${stylesheetImport}import App from './App';\ncreateRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);`,
    );
  }

  const usesTailwind = [...files].some(
    ([path, contents]) => path.endsWith(".css") && /@tailwind\s/.test(contents),
  );
  if (usesTailwind && !files.has("postcss.config.js")) {
    files.set("postcss.config.js", `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`);
  }
  if (usesTailwind && !files.has("tailwind.config.js")) {
    files.set("tailwind.config.js", `export default { content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] };`);
  }
}

function resolveLocalImport(importerPath: string, specifier: string): string | null {
  if (!specifier.startsWith(".") || specifier.includes("\\")) return null;

  const cleanSpecifier = specifier.split(/[?#]/, 1)[0] ?? "";
  if (!cleanSpecifier) return null;

  const parts = importerPath.split("/").slice(0, -1);
  for (const part of cleanSpecifier.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join("/");
}

/** Creates empty files for omitted local stylesheets so Vite can resolve generated imports. */
function addMissingStylesheets(files: Map<string, string>): void {
  const stylesheetExtension = /\.(?:css|scss|sass|less|styl)$/i;
  const jsImportPattern = /\b(?:import|export)\s+(?:(?:[^"'();]*?)\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImportPattern = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  const cssImportPattern = /@import\s+(?:url\(\s*)?["']?([^"'()\s;]+)["']?\s*\)?/g;

  for (const [importerPath, contents] of files) {
    const isStylesheet = stylesheetExtension.test(importerPath);
    const patterns = isStylesheet
      ? [cssImportPattern]
      : /\.[cm]?[jt]sx?$/i.test(importerPath)
        ? [jsImportPattern, dynamicImportPattern]
        : [];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of contents.matchAll(pattern)) {
        const specifier = match[1];
        if (!specifier || !stylesheetExtension.test(specifier.split(/[?#]/, 1)[0] ?? "")) continue;

        const targetPath = resolveLocalImport(importerPath, specifier);
        if (targetPath && !files.has(targetPath)) {
          files.set(targetPath, "/* Generated placeholder: imported stylesheet was not provided. */\n");
        }
      }
    }
  }
}

function toFileSystemTree(files: Map<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [path, contents] of files) {
    const parts = path.split("/");
    const filename = parts.pop();
    if (!filename) continue;

    let current = tree;
    for (const part of parts) {
      const entry = current[part];
      if (!entry || !("directory" in entry)) current[part] = { directory: {} };
      current = (current[part] as { directory: FileSystemTree }).directory;
    }
    current[filename] = { file: { contents } };
  }

  return tree;
}

export function createProjectTree(items: FileItem[]): FileSystemTree {
  const files = collectProjectFiles(items);
  files.set("package.json", createPackageJson(files));
  addEntryFiles(files);
  addMissingStylesheets(files);
  return toFileSystemTree(files);
}

export async function writeProjectTree(
  container: WebContainer,
  tree: FileSystemTree,
  parent = "",
): Promise<void> {
  for (const [name, node] of Object.entries(tree)) {
    const path = [parent, name].filter(Boolean).join("/");
    if ("directory" in node) {
      await container.fs.mkdir(`/${path}`, { recursive: true });
      await writeProjectTree(container, node.directory, path);
    } else if ("file" in node && "contents" in node.file) {
      await container.fs.writeFile(`/${path}`, node.file.contents);
    }
  }
}

export async function installDependencies(container: WebContainer): Promise<number> {
  const process = await container.spawn("npm", ["install"]);
  void process.output.pipeTo(new WritableStream({ write() {} }));
  return process.exit;
}
