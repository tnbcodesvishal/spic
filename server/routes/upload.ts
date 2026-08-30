import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.VERCEL
  ? "/tmp"
  : path.resolve(__dirname, "../../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err: any) {
    console.warn("[upload] Could not create UPLOAD_DIR:", err.message);
  }
}

const router = Router();

// Multer: store file on disk
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".ppt" || ext === ".pptx") {
      cb(null, true);
    } else {
      cb(new Error("Only .ppt and .pptx files are accepted."));
    }
  },
});

// ─── Upload PPT file ──────────────────────────────────────────────────
router.post("/ppt", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  try {
    const host = req.headers.host || "localhost:3001";
    const protocol = req.protocol || "http";
    let publicUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    // Upload to Google Drive via Webhook
    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbxvOswFrS4wNLjRdlYaCAQ-2btQcXH8dQLBa6gPGD0nqHJmlNawsDNFrk2cDrzfy2nk0A/exec";
    const filePath = path.resolve(UPLOAD_DIR, req.file.filename);

    if (webhookUrl) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const base64Data = fileBuffer.toString("base64");

        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_drive",
            fileName: req.file.originalname,
            mimeType: req.file.mimetype || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            fileData: base64Data,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (data && data.url) {
          publicUrl = data.url;
          console.log(`[upload] ✅ PPT uploaded directly to Google Drive: ${publicUrl}`);
          // Remove local file to save Render disk space
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      } catch (driveErr: any) {
        console.error("[upload] Google Drive webhook upload failed, using local URL:", driveErr.message);
      }
    }

    console.log(`[upload] PPT saved: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`[upload] Link returned: ${publicUrl}`);

    res.json({ url: publicUrl });
  } catch (err: any) {
    console.error("[upload] Failed:", err.message);
    res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

export default router;
