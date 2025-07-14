const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

let userKnowledge = ""; // Memory-stored knowledge

// File Upload Route
app.post("/train", upload.single("file"), (req, res) => {
  const filePath = req.file.path;

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    userKnowledge = fileContent;
    fs.unlinkSync(filePath); // Clean up uploaded file

    console.log("✅ Training data uploaded.");
    res.json({ message: "Chatbot trained successfully with your data!" });
  } catch (error) {
    console.error("❌ Training upload error:", error.message);
    res.status(500).json({ message: "Training failed." });
  }
});

// Chat Endpoint
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  const systemPrompt = `
You are MJCET AI Assistant. You must answer queries only related to Muffakham Jah College of Engineering and Technology (MJCET), Hyderabad.

Here is the training data provided by the user:
${userKnowledge || "No training data uploaded yet."}

Guidelines:
- Respond concisely (1–4 sentences).
- Do not make up information.
- If you don't know the answer from above, say "I'm not sure based on current data."
`.trim();

  try {
    const response = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      {
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = response.data.choices?.[0]?.message?.content || "🤖 No response.";
    res.json({ reply });
  } catch (err) {
    console.error("API Error:", err.message);
    res.status(500).json({ reply: "⚠️ Error getting response from AI." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
