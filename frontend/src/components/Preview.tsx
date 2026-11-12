import { useEffect, useRef, useState } from "react";
import type { PreviewMessage, WebContainer } from "@webcontainer/api";
import type { FileItem } from "../types";
import { getWebContainer } from "../services/webContainer";
import {
  createProjectFiles,
  createProjectTree,
  getProjectDependencySignature,
  installDependencies,
} from "../utils/webContainerProject";
import Button from "./ui/button";

type PreviewStatus = "waiting" | "installing" | "starting" | "ready" | "error";

async function startDevServer(container: WebContainer): Promise<string> {
  let unsubscribe = () => {};
  let settled = false;
  let rejectReady: (error: Error) => void = () => {};
  const ready = new Promise<string>((resolve, reject) => {
    rejectReady = reject;
    unsubscribe = container.on("server-ready", (_port, url) => {
      settled = true;
      unsubscribe();
      resolve(url);
    });
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error("The website server did not start within 30 seconds."));
    }, 30_000);
  });

  try {
    const process = await container.spawn("npm", ["run", "dev", "--", "--host", "0.0.0.0"]);
    void process.exit.then((code) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      rejectReady(new Error(`The website server stopped before it became ready (exit ${code}).`));
    });
    return await ready;
  } catch (error) {
    unsubscribe();
    throw error;
  }
}

interface PreviewProps {
  files: FileItem[];
}

export default function Preview({ files }: PreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>("waiting");
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const containerRef = useRef<WebContainer | null>(null);
  const latestFiles = useRef(files);
  const previousFiles = useRef(files);
  const fileCache = useRef(new Map<string, string>());
  const installedDependencies = useRef("");
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const previewErrorUnsubscribe = useRef<(() => void) | null>(null);

  function refreshPreview() {
    if (!previewUrl) return;
    setError("");
    setStatus("ready");
    setPreviewUrl((url) => `${url.split("?")[0]}?refresh=${Date.now()}`);
  }

  useEffect(() => {
    latestFiles.current = files;
    const filesChanged = previousFiles.current !== files;
    previousFiles.current = files;
    if (filesChanged && previewUrl && status === "error") {
      setError("");
      setStatus("ready");
    }
  }, [files, previewUrl, status]);

  useEffect(() => () => previewErrorUnsubscribe.current?.(), []);

  useEffect(() => {
    if (!files.length || containerRef.current) return;
    let cancelled = false;

    async function startPreview() {
      try {
        if (!globalThis.crossOriginIsolated) {
          throw new Error(
            "This page was opened without the required COOP/COEP headers, so WebContainer preview cannot start. Stop the frontend server, restart it from the frontend folder with `npm run dev`, then open the Vite URL it prints (usually http://localhost:5173) in a fresh tab. If you are using a deployed site or a proxy, configure it to pass through Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp.",
          );
        }
        setStatus("installing");
        const container = await getWebContainer();
        if (cancelled) return;
        containerRef.current = container;
        previewErrorUnsubscribe.current = container.on(
          "preview-message",
          (message: PreviewMessage) => {
            const messageText =
              "message" in message
                ? message.message
                : message.args.map(String).join(" ");
            if (!messageText) return;
            setError(messageText);
            setStatus("error");
          },
        );
        const initialFiles = createProjectFiles(latestFiles.current);
        // WebContainer.mount writes files but does not remove files from a
        // previous project, so clear competing config formats first.
        for (const path of [
          "tailwind.config.js",
          "tailwind.config.mjs",
          "tailwind.config.ts",
          "postcss.config.js",
          "postcss.config.mjs",
          "postcss.config.ts",
        ]) {
          await container.fs.rm(`/${path}`, { force: true });
        }
        await container.mount(createProjectTree(latestFiles.current));
        fileCache.current = initialFiles;

        const install = await installDependencies(container);
        if (install.exitCode !== 0)
          throw new Error(
            `Dependency installation failed.${install.output ? `\n${install.output}` : " Check the generated package.json and try again."}`,
          );
        installedDependencies.current = getProjectDependencySignature(latestFiles.current);
        if (cancelled) return;
        setStatus("starting");
        const url = await startDevServer(container);
        if (cancelled) return;
        setPreviewUrl(url);
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not start the live preview.",
        );
        setStatus("error");
      }
    }

    void startPreview();
    return () => {
      cancelled = true;
    };
  }, [files.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || status !== "ready") return;
    const nextFiles = createProjectFiles(files);
    const nextDependencySignature = getProjectDependencySignature(files);
    const dependenciesChanged =
      nextDependencySignature !== installedDependencies.current;
    writeQueue.current = writeQueue.current
      .then(async () => {
        for (const path of fileCache.current.keys()) {
          if (nextFiles.has(path)) continue;
          await container.fs.rm(`/${path}`, { force: true });
          fileCache.current.delete(path);
        }
        for (const [path, contents] of nextFiles) {
          if (fileCache.current.get(path) === contents) continue;
          const parent = path.split("/").slice(0, -1).join("/");
          if (parent)
            await container.fs.mkdir(`/${parent}`, { recursive: true });
          await container.fs.writeFile(`/${path}`, contents);
          fileCache.current.set(path, contents);
        }
        if (dependenciesChanged) {
          setStatus("installing");
          const install = await installDependencies(container);
          if (install.exitCode !== 0) {
            throw new Error(
              `Dependency installation failed.${install.output ? `\n${install.output}` : " Check the generated package.json and try again."}`,
            );
          }
          installedDependencies.current = nextDependencySignature;
          setStatus("ready");
        }
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not update the live preview.",
        );
        setStatus("error");
      });
  }, [files, status]);

  const statusLabel: Record<PreviewStatus, string> = {
    waiting: "Waiting for generated files",
    installing: "Installing project dependencies…",
    starting: "Starting your website…",
    ready: "Live preview",
    error: "Preview unavailable",
  };

  return (
    <div className="flex h-full min-h-96 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <span
            className={`h-2 w-2 rounded-full ${status === "ready" ? "bg-emerald-400" : status === "error" ? "bg-red-400" : "animate-pulse bg-blue-400"}`}
          />
          {statusLabel[status]}
        </div>
        {previewUrl && (
          <Button size="sm" variant="secondary" onClick={refreshPreview}>
            Refresh
          </Button>
        )}
      </div>
      {previewUrl ? (
        <div className="relative min-h-0 flex-1 bg-white">
          <iframe
            title="Generated website preview"
            src={previewUrl}
            allow="cross-origin-isolated"
            className="h-full w-full bg-white"
          />
          {status === "error" && error && (
            <div
              role="alert"
              className="absolute inset-x-3 top-3 rounded-xl border border-red-400/30 bg-slate-950/95 p-4 text-sm text-red-200 shadow-xl backdrop-blur"
            >
              <div className="mb-1 font-semibold">Preview error</div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-red-200/90">
                {error}
              </pre>
              <p className="mt-2 text-xs text-slate-400">
                Fix the file in Code, or refresh the preview after updating it.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <p
            className={`max-w-lg text-sm leading-6 ${status === "error" ? "text-red-300" : "text-slate-400"}`}
          >
            {status === "error"
              ? error
              : files.length
                ? statusLabel[status]
                : "Generate a website to see it running here."}
          </p>
        </div>
      )}
    </div>
  );
}
