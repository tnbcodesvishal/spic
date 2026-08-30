import "dotenv/config";
import express from "express";
import cors from "cors";
import registrationRouter from "../server/routes/registration";
import verificationRouter from "../server/routes/verification";
import contactRouter from "../server/routes/contact";
import uploadRouter from "../server/routes/upload";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "110mb" }));

app.use("/api/registrations", registrationRouter);
app.use("/api/verify", verificationRouter);
app.use("/api/contact", contactRouter);
app.use("/api/upload", uploadRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler to prevent FUNCTION_INVOCATION_FAILED
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[vercel api error]", err.message || err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

export default app;
