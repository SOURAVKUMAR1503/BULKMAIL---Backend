
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// MongoDB connection
let dbConnectionPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!dbConnectionPromise) {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_URI environment variable is missing");
    }

    dbConnectionPromise = mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
    }).catch((error) => {
      dbConnectionPromise = null;
      throw error;
    });
  }

  await dbConnectionPromise;
}

// Credentials collection
const credentials = mongoose.model(
  "credentials",
  new mongoose.Schema(
    {
      user: String,
      pass: String,
    },
    { strict: false }
  ),
  "bulkmail"
);

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BulkMail backend is running",
  });
});

// Send emails
app.post("/sendemail", async (req, res) => {
  try {
    const { msg, emailList } = req.body;

    if (typeof msg !== "string" || !msg.trim()) {
      return res.status(400).json({
        success: false,
        error: "Email message is required",
      });
    }

    if (
      !Array.isArray(emailList) ||
      emailList.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "A non-empty email list is required",
      });
    }

    // Prevent accidental huge requests
    if (emailList.length > 100) {
      return res.status(400).json({
        success: false,
        error: "Please send a maximum of 100 emails per request",
      });
    }

    const validEmails = emailList.every(
      (email) =>
        typeof email === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    );

    if (!validEmails) {
      return res.status(400).json({
        success: false,
        error: "One or more email addresses are invalid",
      });
    }

    await connectDB();

    const account = await credentials.findOne().lean();

    if (!account || !account.user || !account.pass) {
      return res.status(500).json({
        success: false,
        error: "Email credentials are missing in the database",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });

    const results = [];

    // Send sequentially to avoid overwhelming the SMTP service
    for (const email of [...new Set(emailList.map((e) => e.trim()))]) {
      try {
        await transporter.sendMail({
          from: account.user,
          to: email,
          subject: "A message from BulkMail",
          text: msg,
        });

        results.push({ email, success: true });
      } catch (error) {
        console.error("Email send failed:", email, error.message);
        results.push({ email, success: false });
      }
    }

    await transporter.close();

    const sent = results.filter((item) => item.success).length;
    const failed = results.length - sent;

    return res.status(200).json({
      success: failed === 0,
      message: `Sent: ${sent}, Failed: ${failed}`,
      sent,
      failed,
    });
  } catch (error) {
    console.error("BulkMail backend error:", error);

    return res.status(500).json({
      success: false,
      error: "Backend failed to process the email request",
    });
  }
});

// Export the Express app for Vercel
module.exports = app;

// Run a local server only when running outside Vercel
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`BulkMail backend running on port ${PORT}`);
  });
}

module.exports = app;
