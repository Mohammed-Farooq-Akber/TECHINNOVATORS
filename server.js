const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

let userKnowledge = ""; // Aggregated knowledge from all uploaded files

// 🧠 Helper to extract text from uploaded files
async function extractTextFromFile(filePath, mimetype) {
  if (mimetype === "text/plain") {
    return fs.readFileSync(filePath, "utf-8");
  } else if (mimetype === "application/pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    return ""; // Unsupported type
  }
}

// 📌 Multiple Uploads + Format Support
app.post("/train", upload.array("files", 5), async (req, res) => {
  try {
    let combinedContent = "";
    for (const file of req.files) {
      const content = await extractTextFromFile(file.path, file.mimetype);
      combinedContent += `\n\n${content}`;
      fs.unlinkSync(file.path); // Clean up
    }
    userKnowledge = combinedContent.trim();
    console.log("✅ Training data uploaded and merged.");
    res.json({ message: "Chatbot trained with uploaded data (PDF/DOCX/TXT)!" });
  } catch (error) {
    console.error("❌ Training error:", error.message);
    res.status(500).json({ message: "Training failed." });
  }
});

// 💬 Chat Endpoint
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  const systemPrompt = `
You are MJCET AI Assistant. Your job is to answer questions **only related to Muffakham Jah College of Engineering and Technology (MJCET), Hyderabad**, using the uploaded training data or known facts.

Here is the uploaded training data:
${userKnowledge || "No custom training data provided yet."}

Rules:
- Be direct, brief, and on-point.
- Limit responses to 1–3 sentences.
- Only answer based on the uploaded or known data. If not found, say "I'm not sure based on current data."
- Do NOT copy long paragraphs.
- Rephrase program descriptions in concise bullet-like formats.

Example:
Q: "What is the intake for CS&AI?"  
A: "The CS&AI program at MJCET has an intake of 60 students."

Q: "When was the CS&AI course started?"  
A: "The CS&AI course began in 2023 at MJCET."

Q: "Tell me about the labs in CS&AI."  
A: "The course includes labs like Programming, Data Science, OS, and Networks for hands-on learning."

Begin with a brief greeting only if the user says "hi" or "hello".
`.trim();

  try {
    const response = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      {
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 200,
        temperature: 0.5
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
