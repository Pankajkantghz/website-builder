import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import chatRouter from "./routes/chat.js";
import templateRouter from "./routes/template.js";

const app = express();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "256kb" }));

const requestsByIp = new Map<string, { count: number; resetAt: number }>();
function limitRequests(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  let window = requestsByIp.get(ip);
  if (!window || window.resetAt <= now) {
    if (requestsByIp.size >= 2_000) {
      for (const [key, value] of requestsByIp) {
        if (value.resetAt <= now) requestsByIp.delete(key);
      }
      if (requestsByIp.size >= 2_000) {
        const oldestIp = requestsByIp.keys().next().value;
        if (oldestIp) requestsByIp.delete(oldestIp);
      }
    }
    window = { count: 0, resetAt: now + 60_000 };
    requestsByIp.set(ip, window);
  }
  if (window.count >= 20) {
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((window.resetAt - now) / 1000))),
    );
    res
      .status(429)
      .json({
        code: "RATE_LIMITED",
        message: "Too many requests. Try again in a minute.",
      });
    return;
  }
  window.count += 1;
  next();
}

app.use(["/template", "/chat"], limitRequests);
app.use("/template", templateRouter);
app.use("/chat", chatRouter);

app.use((_req, res) => {
  res.status(404).json({ code: "NOT_FOUND", message: "API route not found." });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  const value = error as { status?: number; type?: string; message?: string };
  if (value?.message === "Origin not allowed by CORS") {
    res
      .status(403)
      .json({
        code: "ORIGIN_NOT_ALLOWED",
        message: "This website origin is not allowed.",
      });
    return;
  }
  if (value?.type === "entity.too.large") {
    res
      .status(413)
      .json({
        code: "REQUEST_TOO_LARGE",
        message: "Request body is too large.",
      });
    return;
  }
  if (value?.type === "entity.parse.failed") {
    res
      .status(400)
      .json({
        code: "INVALID_JSON",
        message: "Request body must contain valid JSON.",
      });
    return;
  }
  console.error("Request failed:", error);
  res.status(value?.status && value.status < 500 ? value.status : 500).json({
    code: "INTERNAL_ERROR",
    message: "The server could not complete the request.",
  });
});

app.listen(Number(process.env.PORT || 3000), () => {
  console.log(`Server running at http://localhost:${process.env.PORT || 3000}`);
});
