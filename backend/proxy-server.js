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

// New endpoint to fetch page HTML content
app.post("/api/fetch-page", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // SECURITY: Validate URL format and block sensitive domains
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return res
        .status(400)
        .json({ error: "Only HTTP and HTTPS URLs are supported" });
    }

    // SECURITY: Block sensitive domains and local networks
    const blockedDomains = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "192.168.",
      "10.",
      "172.16.",
      "172.17.",
      "172.18.",
      "172.19.",
      "172.20.",
      "172.21.",
      "172.22.",
      "172.23.",
      "172.24.",
      "172.25.",
      "172.26.",
      "172.27.",
      "172.28.",
      "172.29.",
      "172.30.",
      "172.31.",
      "chrome://",
      "chrome-extension://",
      "moz-extension://",
      "file://",
      "ftp://",
      "sftp://",
    ];

    const hostname = urlObj.hostname.toLowerCase();
    for (const blocked of blockedDomains) {
      if (hostname.includes(blocked) || hostname.startsWith(blocked)) {
        return res
          .status(400)
          .json({ error: "Access to this domain is not allowed" });
      }
    }
  } catch (urlError) {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  try {
    // SECURITY: Log only domain, not full URL
    const urlObj = new URL(url);
    console.log(`Fetching page content from domain: ${urlObj.hostname}`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 15000, // 15 second timeout
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Accept 2xx and 3xx status codes
      },
    });

    // Check if response is HTML
    const contentType = response.headers["content-type"] || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return res.status(400).json({
        error: "URL does not return HTML content",
        contentType: contentType,
      });
    }

    // Extract relevant content from HTML
    const html = response.data;

    // SECURITY: Remove all sensitive content before processing
    let sanitizedHtml = html
      // Remove all script tags and their content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Remove all style tags and their content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      // Remove all noscript tags and their content
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      // Remove all iframe tags and their content
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
      // Remove all object tags and their content
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
      // Remove all embed tags and their content
      .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, "")
      // Remove all applet tags and their content
      .replace(/<applet[^>]*>[\s\S]*?<\/applet>/gi, "")
      // Remove all form tags and their content
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, "")
      // Remove all input tags
      .replace(/<input[^>]*>/gi, "")
      // Remove all textarea tags and their content
      .replace(/<textarea[^>]*>[\s\S]*?<\/textarea>/gi, "")
      // Remove all select tags and their content
      .replace(/<select[^>]*>[\s\S]*?<\/select>/gi, "")
      // Remove all meta tags
      .replace(/<meta[^>]*>/gi, "")
      // Remove all link tags
      .replace(/<link[^>]*>/gi, "")
      // Remove all data-* attributes
      .replace(/\sdata-[^=]*="[^"]*"/gi, "")
      // Remove all aria-* attributes
      .replace(/\saria-[^=]*="[^"]*"/gi, "")
      // Remove all comments
      .replace(/<!--[\s\S]*?-->/g, "");

    // SECURITY: Remove sensitive patterns from text content
    sanitizedHtml = sanitizedHtml
      // Remove email addresses
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        "[EMAIL]"
      )
      // Remove SSNs
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
      // Remove credit card numbers
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CREDIT_CARD]")
      // Remove phone numbers
      .replace(/\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[PHONE]")
      // Remove long numbers
      .replace(/\b\d{10,}\b/g, "[NUMBER]")
      // Remove IBANs
      .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[IBAN]")
      // Remove IP addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP_ADDRESS]");

    // Basic content extraction (similar to frontend logic)
    const titleMatch = sanitizedHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Remove script and style tags (already done, but double-check)
    let content = sanitizedHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "");

    // Extract headings for better structure
    const headingMatches =
      content.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi) || [];
    const headings = headingMatches.map((heading) => {
      const level = heading.match(/<h([1-6])/i)[1];
      const text = heading
        .replace(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i, "$1")
        .trim();
      return { level: parseInt(level), text };
    });

    // Extract lists for better structure
    const listMatches = content.match(/<[uo]l[^>]*>[\s\S]*?<\/[uo]l>/gi) || [];
    const lists = listMatches.map((list) => {
      const items = list.match(/<li[^>]*>([^<]+)<\/li>/gi) || [];
      return items.map((item) =>
        item.replace(/<li[^>]*>([^<]+)<\/li>/i, "$1").trim()
      );
    });

    // Extract alt attributes
    const altMatches = content.match(/alt="([^"]*)"/gi) || [];
    const alts = altMatches
      .map((alt) => alt.replace(/alt="([^"]*)"/i, "$1"))
      .filter(Boolean);

    // Extract visible text content
    const textContent = content
      .replace(/<[^>]+>/g, " ") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Combine all content with better structure
    let result = "";
    if (title) result += `# Page Title\n${title}\n\n`;

    if (headings.length > 0) {
      result += `## Page Structure\n`;
      headings.forEach((heading) => {
        const prefix = "#".repeat(heading.level);
        result += `${prefix} ${heading.text}\n`;
      });
      result += "\n";
    }

    if (lists.length > 0) {
      result += `## Lists Found\n`;
      lists.forEach((list, index) => {
        result += `### List ${index + 1}\n`;
        list.forEach((item) => {
          result += `- ${item}\n`;
        });
        result += "\n";
      });
    }

    if (alts.length) {
      result += `## Image Alt Text\n${alts.join(" | ")}\n\n`;
    }

    result += `## Main Content\n${textContent}`;

    res.json({
      html: result,
      originalUrl: url,
      title: title,
      success: true,
    });
  } catch (error) {
    console.error(
      `Error fetching page from domain ${urlObj?.hostname || "unknown"}:`,
      error.message
    );

    let errorMessage = "Failed to fetch page";
    if (error.code === "ECONNABORTED") {
      errorMessage = "Request timed out";
    } else if (error.response) {
      errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
    } else if (error.code === "ENOTFOUND") {
      errorMessage = "Domain not found";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "Connection refused";
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({
      error: errorMessage,
      url: url,
      success: false,
    });
  }
});

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
