import type { BuildStep } from "../types";
import { useState, type FormEvent } from "react";
import Button from "./ui/button";
import { AI_MODELS, type AIModelId } from "../constants/models";

interface BuildStepsPanelProps {
  steps: BuildStep[];
  isGenerating: boolean;
  error: string;
  onGenerate: () => void;
  onFollowup: (prompt: string, model: AIModelId) => Promise<boolean> | boolean;
  model: AIModelId;
  onModelChange: (model: AIModelId) => void;
}

export default function BuildStepsPanel({
  steps,
  isGenerating,
  error,
  onGenerate,
  onFollowup,
  model,
  onModelChange,
}: BuildStepsPanelProps) {
  const [followup, setFollowup] = useState("");

  async function submitFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = followup.trim();
    if (!trimmed || isGenerating) return;
    const submitted = await onFollowup(trimmed, model);
    if (submitted) setFollowup("");
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-xl shadow-black/10">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Build Steps</h2>
            <p className="mt-1 text-xs text-gray-400">
              {steps.length} actions generated
            </p>
          </div>
          <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400">
            AI Build
          </span>
        </div>

        <label className="mb-4 block text-xs font-medium text-slate-300">
          Model for this build
          <select
            value={model}
            onChange={(event) => onModelChange(event.target.value as AIModelId)}
            disabled={isGenerating}
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-400/50 disabled:opacity-60"
          >
            {AI_MODELS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-normal text-slate-500">
            If its quota is used up, the next available model is tried.
          </span>
        </label>

        <p
          role="note"
          className="mb-4 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs leading-5 text-amber-100/80"
        >
          Free models can vary in quality and may sometimes return incomplete
          responses. If that happens, ask for the response to continue or try
          again.
        </p>

        {steps.length === 0 && (
          <Button
            onClick={onGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating
              ? "Generating website…"
              : error
                ? "Try generation again"
                : "✦ Generate Website"}
          </Button>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm leading-5 text-red-300">
            {error}
          </p>
        )}

        <ol className="mt-5 space-y-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="flex items-start gap-3 rounded-xl border border-white/5 bg-slate-950/60 p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-800 text-xs text-gray-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-xs leading-5 text-gray-200">
                  {step.title}
                </p>
                <p
                  className={`mt-2 text-[11px] capitalize ${step.status === "completed" ? "text-emerald-400" : step.status === "skipped" ? "text-amber-400" : step.status === "failed" ? "text-red-400" : "text-gray-500"}`}
                >
                  {step.status === "skipped"
                    ? "not run in browser"
                    : step.status}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={submitFollowup} className="border-t border-white/10 p-4">
        <label
          htmlFor="followup-prompt"
          className="mb-2 block text-xs font-medium text-slate-300"
        >
          Refine your website
        </label>
        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-slate-950 p-2 focus-within:border-blue-400/60">
          <textarea
            id="followup-prompt"
            value={followup}
            onChange={(event) => setFollowup(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Make the header sticky…"
            rows={2}
            className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!followup.trim() || isGenerating}
          >
            Send
          </Button>
        </div>
      </form>
    </aside>
  );
}
