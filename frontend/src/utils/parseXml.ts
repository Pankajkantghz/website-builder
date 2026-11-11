import type { ParsedAction } from "../types";

export function parseXml(xml: string): ParsedAction[] {
  const artifactMatch = xml.match(
    /<boltArtifact[\s\S]*?<\/boltArtifact>/,
  );

  if (!artifactMatch) {
    throw new Error("No boltArtifact found in AI response");
  }

  const artifact = artifactMatch[0];

  const actionMatches = artifact.matchAll(
    /<boltAction\b([^>]*)>([\s\S]*?)<\/boltAction>/g,
  );

  const generatedEnvironmentFiles = new Set([
    "package.json",
    "index.html",
    "vite.config.js",
    "vite.config.ts",
    "tailwind.config.js",
    "tailwind.config.cjs",
    "tailwind.config.mjs",
    "postcss.config.js",
    "postcss.config.cjs",
    "postcss.config.mjs",
  ]);

  return Array.from(actionMatches, (match): ParsedAction | null => {
    const attributes = match[1];
    const content = match[2].trim();

    const typeMatch = attributes.match(/type="([^"]+)"/);
    const filePathMatch = attributes.match(/filePath="([^"]+)"/);

    // Shell commands do not run in the browser preview. Ignore them instead of
    // presenting skipped commands as build steps.
    if (typeMatch?.[1] !== "file") {
      return null;
    }

    const filePath = filePathMatch?.[1]?.replace(/^\/+/, "");
    if (!filePath || generatedEnvironmentFiles.has(filePath)) return null;

    return {
      type: typeMatch[1],
      filePath,
      content,
    };
  }).filter((action): action is ParsedAction => action !== null);
}
