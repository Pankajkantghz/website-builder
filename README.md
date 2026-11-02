# ⚡ Website Builder

### Describe a website. Generate it. Refine it.

An AI-assisted website builder built with React, TypeScript, Express, Groq, and WebContainers. Enter a prompt, inspect the generated project files, view the site in a live browser preview, and request follow-up changes.

---

## ✨ Features

- Choose a Groq text-generation model before building.
- Automatically try the other configured models if the selected model hits a quota or rate limit.
- Generate project files from a natural-language prompt.
- Refine the project with follow-up prompts.
- Browse generated files and inspect them in the code editor.
- Run supported generated projects in a WebContainer preview.
- Sync file edits to the running preview and reload it without reinstalling dependencies.
- Preserve generated files, build steps, selected file, and conversation in the current browser tab session.

---

## 🛠️ Technology Stack

| Area | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router |
| Styling | Tailwind CSS |
| Code editor | Monaco Editor |
| In-browser runtime | WebContainers |
| Backend | Node.js, TypeScript, Express 5 |
| AI | Vercel AI SDK, Groq |
| Icons | Lucide React |

---

## 🏗️ System Architecture

```text
Browser
  ├── Home: prompt and model selection
  ├── Builder: build steps, files, code editor, preview
  ├── API client ───────────────► Express routes
  └── WebContainer: generated project runtime
                                    │
                                    ├── /template ─► classify prompt and return starter prompts
                                    └── /chat ─────► generate or update project files
                                                         │
                                                         ▼
                                              Groq model fallback service
```

### Backend Structure

| Path | Responsibility |
|---|---|
| `backend/src/index.ts` | Loads environment variables and starts the HTTP server. |
| `backend/src/app.ts` | Configures Express, CORS, JSON parsing, and routes. |
| `backend/src/routes/template.ts` | Validates template requests, selects a starter, and handles model errors. |
| `backend/src/routes/chat.ts` | Validates chat requests and returns generated project changes. |
| `backend/src/services/modelFallback.ts` | Tries configured Groq models and detects quota or rate-limit errors. |
| `backend/src/defaults/` | Starter prompts used by template selection. |
| `backend/src/prompt.ts` | Instructions for generating and updating projects. |

### Request Flow

1. The home page sends the prompt and selected model to `POST /template`.
2. The backend classifies the request and returns starter prompts.
3. The builder sends the prompt history and selected model to `POST /chat`.
4. The backend parses the model response into project file actions on the frontend.
5. The preview mounts the files in a WebContainer, installs dependencies, and starts the generated development server.
6. Follow-up prompts send the conversation and selected model to `/chat`; file changes sync to the running preview.

---

## 🤖 Model Selection and Quota Fallback

The model selector appears on the home page and in the builder panel. The selected model is tried first. If Groq returns a quota or rate-limit error, the backend tries the remaining configured models in order, wrapping around to earlier models if needed.

Configured models:

1. `openai/gpt-oss-120b`
2. `openai/gpt-oss-20b`
3. `qwen/qwen3.8-27b`
4. `allam-2-7b`

The model list is in `backend/src/services/modelFallback.ts`; the frontend selector labels are in `frontend/src/constants/models.ts`. If all models are quota-limited, the backend returns HTTP `429` with code `MODEL_QUOTA_EXHAUSTED`, and the UI tells the user the available model tokens have run out. Fallback cannot bypass account-level quotas.

> **Response quality:** This project uses free model availability. Response quality can vary, and a model may occasionally return a low-quality or incomplete result. If that happens, ask the builder to continue the response or try the request again with another model.

---

## 📂 Project Structure

```text
bolt-app/
├── backend/
│   ├── src/
│   │   ├── defaults/
│   │   ├── routes/
│   │   │   ├── chat.ts
│   │   │   └── template.ts
│   │   ├── services/
│   │   │   └── modelFallback.ts
│   │   ├── app.ts
│   │   ├── constants.ts
│   │   ├── index.ts
│   │   ├── prompt.ts
│   │   └── stripindents.ts
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── constants/models.ts
    │   ├── hooks/useBuilder.ts
    │   ├── pages/
    │   ├── services/
    │   ├── utils/
    │   └── types/
    └── package.json
```

---

## 🔌 API

The frontend calls the backend at `http://localhost:3000` by default. Set `VITE_API_URL` in the frontend build environment to the deployed backend URL.

### `POST /template`

Request:

```json
{
  "prompt": "A portfolio for a product designer",
  "model": "openai/gpt-oss-120b"
}
```

Returns the prompts used to initialize a builder session. The `model` field is optional; the backend defaults to the configured model order.

### `POST /chat`

Request:

```json
{
  "messages": [
    { "role": "user", "content": "Create a responsive landing page" }
  ],
  "model": "openai/gpt-oss-120b"
}
```

Returns the generated response containing the project file actions. The frontend applies those actions to the current project tree.

---

## ⚙️ Getting Started

### Prerequisites

- Node.js and npm
- A Groq API key
- A browser supported by WebContainers

### 1. Configure and start the backend

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key
```

Then run:

```bash
cd backend
npm install
npm run dev
```

The backend compiles TypeScript and starts at `http://localhost:3000`.

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

---

## 🔐 Configuration and Runtime Notes

- The backend reads `GROQ_API_KEY` from `backend/.env`. Keep it out of frontend variables and source control.
- The frontend API URL defaults to `http://localhost:3000`; configure `VITE_API_URL` for a deployed backend.
- The backend CORS policy defaults to `http://localhost:5173`; configure `CORS_ORIGINS` as a comma-separated list of allowed origins in deployment.
- The backend limits requests to 20 per IP per minute, template prompts to 20,000 characters, and chat history to 100,000 total characters. The in-memory rate limiter is per process; multi-instance deployments should use a shared rate-limit store.
- The backend listens on port `3000` in `backend/src/index.ts`.
- The Vite configuration sets COOP/COEP headers required by WebContainers. A deployed frontend host must provide compatible cross-origin isolation headers.
- Generated projects run in a browser-based Node.js environment; packages that need native binaries may not work.
- Preview **Refresh** reloads the current iframe. It does not reinstall dependencies. Dependency installation happens when the preview runtime starts.
- Builder files, build steps, selected file, and conversation are saved in `sessionStorage` for the current browser tab session.
- There is no database-backed project storage, authentication, or cross-device project sync.

---

## 📄 License

No license is specified yet. Add a `LICENSE` file to define how this project may be used, modified, and distributed.
