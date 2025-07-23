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
// Docs: https://ai.google.dev/gemini-api/docs/text-generation
app.post("/api/gemini", async (req, res) => {
  let lastUserMsg = undefined;
  let contents = req.body.contents;
  // If not provided, try to build from prompt
  if (!contents && req.body.prompt) {
    contents = [
      {
        parts: [{ text: req.body.prompt }],
      },
    ];
  }
  if (Array.isArray(contents)) {
    const last = contents.slice(-1)[0];
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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        contents: contents,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
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

app.post("/api/grok", async (req, res) => {
  // Validate API key
  if (!process.env.GROK_API_KEY) {
    return res
      .status(400)
      .json({ error: "xAI API key not set in environment variables" });
  }

  // Validate request body
  const { messages, prompt } = req.body;
  let requestMessages = [];

  if (Array.isArray(messages) && messages.length > 0) {
    // Ensure messages are valid and contain at least one user message
    const validMessages = messages.filter(
      (m) => typeof m === "object" && m.role && typeof m.content === "string"
    );
    if (validMessages.length === 0) {
      return res.status(400).json({ error: "No valid messages provided" });
    }
    requestMessages = validMessages;
  } else if (typeof prompt === "string" && prompt.trim()) {
    // Fallback to prompt if messages are not provided
    requestMessages = [{ role: "user", content: prompt.trim() }];
  } else {
    return res
      .status(400)
      .json({ error: "Either 'messages' or 'prompt' must be provided" });
  }

  // Log the last user message (sanitize to prevent log injection)
  const lastUserMsg =
    requestMessages.filter((m) => m.role === "user").slice(-1)[0]?.content ||
    "[unknown]";
  console.log(`Grok Question: ${lastUserMsg.replace(/[\n\r\t]/g, " ")}`); // Basic sanitization

  try {
    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions", // Official xAI API endpoint
      {
        model: "grok-3", // Use the correct model name (verify with xAI docs)
        messages: requestMessages,
        // Optional parameters (adjust as needed)
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        },
        timeout: 30000, // Add timeout to prevent hanging
      }
    );

    // Return the API response
    res.json(response.data);
  } catch (err) {
    console.error("Grok API error:", err.message);
    if (err.response) {
      // Handle HTTP errors
      res.status(err.response.status).json({
        error: err.response.data?.error || "Grok API request failed",
      });
    } else if (err.code === "ECONNABORTED") {
      // Handle timeout
      res.status(504).json({ error: "Request to Grok API timed out" });
    } else {
      // Handle other errors (network, parsing, etc.)
      res.status(500).json({ error: "Internal server error" });
    }
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
