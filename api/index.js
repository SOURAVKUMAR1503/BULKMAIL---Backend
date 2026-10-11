const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// MongoDB connection
let dbConnectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!dbConnectionPromise) {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_URI environment variable is missing");
    }

    dbConnectionPromise = mongoose
      .connect(mongoURI, {
        serverSelectionTimeoutMS: 10000,
      })
      .catch((error) => {
        dbConnectionPromise = null;
        throw error;
      });
  }

  await dbConnectionPromise;
}

// MongoDB credentials collection
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

// Backend health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BulkMail backend is running",
  });
});

// Send emails
app.post("/sendemail", async (req, res) => {
  let transporter;

  try {
    const { msg, emailList } = req.body || {};

    if (typeof msg !== "string" || !msg.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please enter an email message",
      });
    }

    if (!Array.isArray(emailList) || emailList.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide email addresses",
      });
    }

    if (emailList.length > 100) {
      return res.status(400).json({
        success: false,
        error: "Maximum 100 email addresses per request",
      });
    }

    const uniqueEmails = [
      ...new Set(emailList.map((email) =>
        typeof email === "string" ? email.trim() : ""
      )),
    ];

    const invalidEmail = uniqueEmails.some(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );

    if (invalidEmail) {
      return res.status(400).json({
        success: false,
        error: "One or more email addresses are invalid",
      });
    }

    // Connect to MongoDB
    await connectDB();

    const account = await credentials.findOne().lean();

    if (!account?.user || !account?.pass) {
      return res.status(500).json({
        success: false,
        error: "Email credentials are missing in MongoDB",
      });
    }

    // Create Gmail transporter
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });

    let sent = 0;
    let failed = 0;

    // Send emails one at a time
    for (const email of uniqueEmails) {
      try {
        await transporter.sendMail({
          from: account.user,
          to: email,
          subject: "A message from BulkMail",
          text: msg.trim(),
        });

        sent++;
      } catch (error) {
        failed++;
        console.error(
          "Email send failed:",
          email,
          error.message
        );
      }
    }

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
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
});

// Export Express app for Vercel
module.exports = app;

// Local development only
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`BulkMail backend running on port ${PORT}`);
  });
}
