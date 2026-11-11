# ⚡ Website Builder

### Describe a website. Generate it. Refine it.

An AI-assisted website builder built with React, TypeScript, Express, Groq, and WebContainers. Enter a prompt, inspect the generated project files, view the site in a live browser preview, and request follow-up changes.

---

## ✨ Features

- Use Groq's `openai/gpt-oss-20b` model for fast generation.
- Generate project files from a natural-language prompt.
- Refine the project with follow-up prompts.
- Browse generated files and inspect them in the code editor.
- Run supported generated projects in a WebContainer preview.
- Sync file edits to the running preview and reinstall dependencies when imports change.
- Preserve generated files, build steps, selected file, and latest prompt in the current browser tab session.

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
  ├── Home: prompt entry
  ├── Builder: build steps, files, code editor, preview
  ├── API client ───────────────► POST /chat
  └── WebContainer: generated project runtime
                                       │
                                       ▼
                              Groq model service
```

### Backend Structure

| Path | Responsibility |
|---|---|
| `backend/src/index.ts` | Configures Express, CORS, request limits, and starts the server. |
| `backend/src/routes/template.ts` | Validates template requests and selects a starter. |
| `backend/src/routes/chat.ts` | Validates chat requests and generates project changes. |
| `backend/src/errors.ts` | Maps Groq errors to consistent API responses. |
| `backend/src/prompts.ts` | Defines the system prompt used for website generation. |
| `backend/src/constants.ts` | Defines workspace and formatting constants for prompts. |
| `backend/src/stripindents.ts` | Removes indentation from prompt template strings. |
| `backend/src/defaults/` | Starter prompts used by template selection. |

### Request Flow

1. The home page opens the builder with the prompt.
2. The first build sends the prompt to `POST /chat`; refinements send the new instruction and a size-limited snapshot of current project files to the same route.
3. The backend returns project file actions, which the frontend parses into the file tree.
4. The preview mounts the files in a WebContainer, installs dependencies, and starts the generated development server.
5. Code edits and generated file changes sync to the running preview.

The backend also exposes `POST /template` for optional starter selection; the current frontend does not call it.

---

## 🤖 Model

The backend uses `openai/gpt-oss-20b` for template selection and website generation. If Groq reports a quota or rate-limit error, the backend returns HTTP `429` with code `MODEL_QUOTA_EXHAUSTED`.

> **Response quality:** This project uses a free model. Responses can be inaccurate or incomplete. Review generated code, and ask the builder to refine or continue a response when needed.

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
│   │   ├── index.ts
│   │   ├── errors.ts
│   │   ├── prompts.ts
│   │   ├── constants.ts
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

The frontend calls `https://website-builder-dp0j.onrender.com` by default. Set `VITE_API_URL` in the frontend build environment to override it.

API errors include a short `code` and user-facing `message` so the frontend can show a useful error.

### `POST /template`

Request:

```json
{
  "prompt": "A portfolio for a product designer"
}
```

Returns the prompts used to initialize a builder session. The backend uses the configured model.

### `POST /chat`

Request:

```json
{
  "messages": [
    { "role": "user", "content": "Create a responsive landing page" }
  ]
}
```

Returns the generated response containing the project file actions. The frontend applies those actions to the current project tree.

---

## ⚙️ Getting Started

### Prerequisites

- Node.js 22 or newer and npm
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
- The frontend API URL defaults to the deployed Render backend; set `VITE_API_URL` to use a different backend.
- The backend CORS policy defaults to `http://localhost:5173`; configure `CORS_ORIGINS` as a comma-separated list of allowed origins in deployment.
- The backend allows 20 requests per IP per minute, limits template prompts to 20,000 characters, chat content to 100,000 characters, and JSON bodies to 256 KB. The in-memory rate limiter is per process; multi-instance deployments should use a shared rate-limit store.
- The backend listens on port `3000` in `backend/src/index.ts`.
- The Vite configuration sets COOP/COEP headers required by WebContainers. A deployed frontend host must provide compatible cross-origin isolation headers.
- Generated projects run in a browser-based Node.js environment; packages that need native binaries may not work.
- Preview **Refresh** reloads the current iframe. Dependency installation happens when the preview starts and again when generated dependencies change.
- Builder files, build steps, selected file, and latest prompt are saved in `sessionStorage` for the current browser tab session.
- There is no database-backed project storage, authentication, or cross-device project sync.

---

## 📄 License

No license is specified yet. Add a `LICENSE` file to define how this project may be used, modified, and distributed.
# website-builder
# website-builder
