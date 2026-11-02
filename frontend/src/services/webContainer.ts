import { WebContainer } from "@webcontainer/api";

let bootPromise: Promise<WebContainer> | null = null;

export function getWebContainer(): Promise<WebContainer> {
  if (!bootPromise) {
    bootPromise = WebContainer.boot({
      coep: "require-corp",
      forwardPreviewErrors: "exceptions-only",
    }).catch((error: unknown) => {
      bootPromise = null;
      throw error;
    });
  }
  return bootPromise;
}
