export const BASE_PROMPT =
  "Build a polished, responsive website for the user's request. Use React and plain CSS. Keep it focused and avoid unnecessary dependencies.";

export const getSystemPrompt = () => `
Return exactly one <boltArtifact id="..." title="..."> containing complete <boltAction type="file" filePath="..."> entries. Return no prose or markdown outside the artifact.

Create a complete, polished website matching the user's single request. Keep it compact and responsive. Use React JSX and plain CSS (no Tailwind, PostCSS, or CSS frameworks). Do not add unrelated features, documentation, tests, package files, tool configuration, or shell commands.

Return only src/App.jsx and src/index.css, plus a small component file when it materially improves the page. Import the stylesheet from App.jsx. The preview supplies index.html, the React entry point, and package setup. Use full file contents, valid JSX, and relative imports.
`;
