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

  return Array.from(actionMatches, (match): ParsedAction | null => {
    const attributes = match[1];
    const content = match[2].trim();

    const typeMatch = attributes.match(/type="([^"]+)"/);
    const filePathMatch = attributes.match(/filePath="([^"]+)"/);

    if (typeMatch?.[1] !== "file" && typeMatch?.[1] !== "shell") {
      return null;
    }

    return {
      type: typeMatch[1],
      filePath: filePathMatch?.[1],
      content,
    };
  }).filter((action): action is ParsedAction => action !== null);
}
