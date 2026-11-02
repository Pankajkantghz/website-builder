import cors from "cors";
import express from "express";
import chatRouter from "./routes/chat.js";
import templateRouter from "./routes/template.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "256kb" }));

// A small per-process guard against accidental or abusive request bursts.
// For multi-instance deployments, use a shared store (for example Redis).
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestsByIp = new Map<string, { count: number; resetAt: number }>();

app.use((req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  let bucket = requestsByIp.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    requestsByIp.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ message: "Too many requests. Please wait a minute and try again." });
    return;
  }
  next();
});

// Expire idle client entries so the map stays bounded over time.
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of requestsByIp) {
    if (bucket.resetAt <= now) requestsByIp.delete(ip);
  }
}, WINDOW_MS).unref();
app.use(chatRouter, templateRouter);

export default app;
