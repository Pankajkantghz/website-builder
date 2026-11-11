import {
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowRight, Code2, Layers3, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/button";
import { DEFAULT_AI_MODEL } from "../constants/models";

const examples = [
  "A calm, modern portfolio for a product designer",
  "A warm landing page for a neighborhood coffee shop",
  "A dashboard for tracking personal finances",
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  function submitPrompt() {
    const request = prompt.trim();
    if (!request || isGenerating) return;
    setIsGenerating(true);
    sessionStorage.removeItem("bolt-builder-state");
    navigate("/builder", {
      state: { prompt: request, model: DEFAULT_AI_MODEL },
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submitPrompt();
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080d18] px-5 py-12 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_55%)]"
      />
      <div className="relative w-full max-w-4xl">
        <header className="mb-16 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/10 text-blue-300">
            <Sparkles size={19} />
          </div>
          <div>
            <p className="font-semibold tracking-tight">Website Builder</p>
            <p className="text-xs text-slate-500">AI website studio</p>
          </div>
        </header>

        <section className="mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
            Describe it. Build it. Refine it.
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            What do you want
            <br className="hidden sm:block" /> to make today?
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
            Start with an idea. Get a working website, its source files, and a
            live preview you can keep refining.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-9 rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl shadow-blue-950/20 ring-1 ring-white/[0.03] transition focus-within:border-blue-400/40"
          >
            <label htmlFor="website-prompt" className="sr-only">
              Describe your website
            </label>
            <textarea
              id="website-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A polished website for…"
              rows={4}
              className="w-full resize-none bg-transparent px-3 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-500"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-2 pt-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="basis-full text-xs leading-5 text-amber-200/70 sm:basis-auto">
                  Powered by GPT-OSS 20B for fast generation.
                </span>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  ⌘/Ctrl + Enter to build
                </span>
              </div>
              <Button
                type="submit"
                disabled={!prompt.trim() || isGenerating}
                className="rounded-xl px-5"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-pulse">Building</span>
                    <span aria-hidden="true">…</span>
                  </>
                ) : (
                  <>
                    Build website <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </div>
          </form>
          <div className="mt-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              Need a starting point?
            </p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-2 text-left text-xs text-slate-300 transition hover:border-blue-300/30 hover:bg-blue-300/5 hover:text-white"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-16 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
            <Feature
              icon={<Sparkles size={16} />}
              title="Start from a prompt"
              description="Describe the experience you have in mind."
            />
            <Feature
              icon={<Layers3 size={16} />}
              title="One prompt per build"
              description="Start a fresh website with a focused prompt."
            />
            <Feature
              icon={<Code2 size={16} />}
              title="See the real code"
              description="Explore files alongside your live site."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-blue-300">{icon}</span>
      <div>
        <h2 className="text-sm font-medium text-slate-200">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
