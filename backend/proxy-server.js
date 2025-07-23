require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

// Allow all origins for local dev. For production, restrict to your extension's origin.
app.use(cors({ origin: "*", credentials: false }));

function logQuestion(provider, question) {
  /*
    const now = new Date();
    const timestamp = now.toISOString().replace("T", " ").substring(0, 19);
    console.log(`[${provider}] [${timestamp}] Question:`, question);
    */
  console.log("question asked");
}

// Proxy for Anthropic Claude
app.post("/api/anthropic", async (req, res) => {
  const lastUserMsg = Array.isArray(req.body.messages)
    ? req.body.messages.filter((m) => m.role === "user").slice(-1)[0]?.content
    : undefined;
  logQuestion("Claude", lastUserMsg || req.body.prompt || "[unknown]");
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: "Anthropic API key not set in .env" });
  }
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
    });
  }
});

// Proxy for OpenAI
app.post("/api/openai", async (req, res) => {
  const lastUserMsg = Array.isArray(req.body.messages)
    ? req.body.messages.filter((m) => m.role === "user").slice(-1)[0]?.content
    : undefined;
  logQuestion("OpenAI", lastUserMsg || req.body.prompt || "[unknown]");
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: "OpenAI API key not set in .env" });
  }
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
    });
  }
});

// Proxy for Gemini (Google)
app.post("/api/gemini", async (req, res) => {
  let lastUserMsg = undefined;
  if (Array.isArray(req.body.contents)) {
    const last = req.body.contents.slice(-1)[0];
    if (last && Array.isArray(last.parts) && last.parts[0]) {
      lastUserMsg = last.parts[0].text;
    }
  }
  logQuestion("Gemini", lastUserMsg || req.body.prompt || "[unknown]");
  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({ error: "Gemini API key not set in .env" });
  }
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
    });
  }
});

// Proxy for Grok
app.post("/api/grok", async (req, res) => {
  const lastUserMsg = Array.isArray(req.body.messages)
    ? req.body.messages.filter((m) => m.role === "user").slice(-1)[0]?.content
    : undefined;
  logQuestion("Grok", lastUserMsg || req.body.prompt || "[unknown]");
  if (!process.env.GROK_API_KEY) {
    return res.status(400).json({ error: "Grok API key not set in .env" });
  }
  try {
    const response = await axios.post(
      "https://api.grok.com/v1/chat/completions",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
    });
  }
});

// Ping endpoints for connection status
app.get("/api/openai/ping", (req, res) => {
  if (process.env.OPENAI_API_KEY) return res.sendStatus(200);
  res.sendStatus(400);
});
app.get("/api/anthropic/ping", (req, res) => {
  if (process.env.ANTHROPIC_API_KEY) return res.sendStatus(200);
  res.sendStatus(400);
});
app.get("/api/gemini/ping", (req, res) => {
  if (process.env.GEMINI_API_KEY) return res.sendStatus(200);
  res.sendStatus(400);
});
app.get("/api/grok/ping", (req, res) => {
  if (process.env.GROK_API_KEY) return res.sendStatus(200);
  res.sendStatus(400);
});

// Add more providers as needed...

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
