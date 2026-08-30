import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import registrationRouter from "./routes/registration";
import verificationRouter from "./routes/verification";
import contactRouter from "./routes/contact";
import uploadRouter from "./routes/upload";

// Render sets the PORT env var for web services
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "110mb" }));

// ─── API routes ──────────────────────────────────────────────────────
app.use("/api/registrations", registrationRouter);
app.use("/api/verify", verificationRouter);
app.use("/api/contact", contactRouter);
app.use("/api/upload", uploadRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 Handler for API routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// ─── Serve uploaded files ─────────────────────────────────────────────
const uploadsPath = path.resolve(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsPath));

// ─── Frontend Static Files (Production) ──────────────────────────────
// This allows a single Render server to host both the API and the React App
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));

// Catch-all route to serve index.html for React Router
app.use((req, res, next) => {
  if (req.method === "GET") {
    res.sendFile(path.resolve(distPath, "index.html"));
  } else {
    next();
  }
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[error] ${req.method} ${req.path}:`, err.message || err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`[server] App (API + Web) running on port ${PORT}`);

  // ─── Render Keep-Alive (Heartbeat) ──────────────────────────────────
  // Pings the external URL every 14 mins to prevent free tier from sleeping
  let EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
  if (EXTERNAL_URL) {
    // Normalize URL (remove trailing slash)
    if (EXTERNAL_URL.endsWith("/")) EXTERNAL_URL = EXTERNAL_URL.slice(0, -1);
    
    console.log(`[heartbeat] Initializing keep-alive for ${EXTERNAL_URL}`);
    setInterval(async () => {
      try {
        const url = `${EXTERNAL_URL}/api/health`;
        const response = await fetch(url);
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
           const data = await response.json();
           console.log(`[heartbeat] Ping ${url} -> Status: ${data.status}`);
        } else {
           const text = await response.text();
           console.error(`[heartbeat] Ping failed. Expected JSON, got ${contentType}. Body snippet: ${text.slice(0, 100)}`);
        }
      } catch (error) {
        console.error(`[heartbeat] Ping failed:`, error instanceof Error ? error.message : error);
      }
    }, 14 * 60 * 1000); // 14 minutes
  } else {
    console.log(`[heartbeat] RENDER_EXTERNAL_URL not found, skip-pinging.`);
  }
});
