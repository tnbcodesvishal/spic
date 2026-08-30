import { Router, type Request, type Response } from "express";
import { sendContactEmail } from "../services/email";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { name, email, concern } = req.body;

  if (!name || !email || !concern) {
    res.status(400).json({ error: "Name, Email, and Concern are required." });
    return;
  }

  const result = await sendContactEmail({ name, email, concern });

  if (result.success) {
    res.json({ message: "Inquiry sent successfully. We will get back to you soon!" });
  } else {
    res.status(500).json({ error: "Failed to send inquiry.", detail: result.error });
  }
});

export default router;
