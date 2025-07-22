// Cross-browser API wrapper
const ext = typeof browser !== "undefined" ? browser : chrome;

const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const container = document.getElementById("chatbot-container");

let currentTabId = null;
let pageKey = null;
let pageHtml = null;
let conversation = [];
let isLoading = false;
let indexStatusShown = false;

const apiKey = "YOUR_API_KEY";
let apiKeyName = "";
const openaiKey = "";
const geminiKey = "";
const grokKey = "";
const anthropicKey = "";

// (const openaiKey = ...; const geminiKey = ...; etc.)

// DYNAMICALLY SELECT THE FIRST AVAILABLE KEY
(function setApiKeyFromInjected() {
  if (
    typeof openaiKey !== "undefined" &&
    openaiKey &&
    openaiKey.trim() !== ""
  ) {
    window.apiKey = openaiKey;
    window.apiKeyName = "openai";
  } else if (
    typeof geminiKey !== "undefined" &&
    geminiKey &&
    geminiKey.trim() !== ""
  ) {
    window.apiKey = geminiKey;
    window.apiKeyName = "gemini";
  } else if (
    typeof grokKey !== "undefined" &&
    grokKey &&
    grokKey.trim() !== ""
  ) {
    window.apiKey = grokKey;
    window.apiKeyName = "grok";
  } else if (
    typeof anthropicKey !== "undefined" &&
    anthropicKey &&
    anthropicKey.trim() !== ""
  ) {
    window.apiKey = anthropicKey;
    window.apiKeyName = "claude";
  } else {
    window.apiKey = "YOUR_API_KEY";
    window.apiKeyName = "";
  }
})();

// Set connection status dot and label
(function setConnectionStatus() {
  const dot = document.getElementById("connection-status-dot");
  const label = document.getElementById("connection-status-label");
  if (!dot || !label) return;
  if (window.apiKey && window.apiKey !== "YOUR_API_KEY") {
    dot.classList.remove("disconnected");
    dot.classList.add("connected");
    let provider = window.apiKeyName
      ? window.apiKeyName.charAt(0).toUpperCase() + window.apiKeyName.slice(1)
      : "Connected";
    label.textContent = provider;
  } else {
    dot.classList.remove("connected");
    dot.classList.add("disconnected");
    label.textContent = "Disconnected";
  }
})();

// Helper: Render chat messages
function renderMessages() {
  chatMessages.innerHTML = "";
  conversation.forEach((msg) => {
    const div = document.createElement("div");
    div.className = "message " + msg.role;
    div.textContent = msg.content;
    chatMessages.appendChild(div);
  });
  if (isLoading) {
    const spinner = document.createElement("div");
    spinner.className = "message bot";
    spinner.innerHTML =
      '<span class="spinner" aria-label="Loading" role="status"></span>';
    chatMessages.appendChild(spinner);
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper: Save conversation
function saveConversation() {
  if (pageKey) {
    ext.storage.local.set({ [pageKey]: conversation });
  }
}

// Helper: Load conversation
function loadConversation(cb) {
  if (pageKey) {
    ext.storage.local.get([pageKey], (result) => {
      conversation = result[pageKey] || [];
      renderMessages();
      if (cb) cb();
    });
  }
}

// Get current tab and page info
ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  currentTabId = tab.id;
  pageKey = "pageAI_" + (tab.url || "").split("#")[0];
  // Get page HTML from content script
  ext.tabs.sendMessage(currentTabId, { type: "GET_PAGE_HTML" }, (response) => {
    pageHtml = response && response.html ? response.html : "";
    loadConversation(() => {
      chatInput.focus();
    });
    // Show index status
    const statusDiv = document.getElementById("index-status");
    if (pageHtml) {
      statusDiv.textContent = "Page indexed successfully!";
      statusDiv.style.display = "block";
      indexStatusShown = true;
    } else {
      statusDiv.textContent = "Failed to index page.";
      statusDiv.style.display = "block";
      indexStatusShown = true;
    }
  });
});

// Handle sending a message
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (indexStatusShown) {
    const statusDiv = document.getElementById("index-status");
    statusDiv.style.display = "none";
    indexStatusShown = false;
  }
  const question = chatInput.value.trim();
  if (!question) return;
  conversation.push({ role: "user", content: question });
  isLoading = true;
  renderMessages();
  saveConversation();
  chatInput.value = "";
  chatInput.focus();
  // Call AI API
  try {
    const answer = await askChatAPI(question, pageHtml);
    conversation.push({ role: "bot", content: answer });
    isLoading = false;
    renderMessages();
    saveConversation();
  } catch (err) {
    isLoading = false;
    renderMessages();
    showError("Error: " + err.message);
    saveConversation();
  }
});

// Keyboard accessibility: ESC to close, focus trap
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    container.style.display = "none";
  } else if (e.key === "Tab") {
    // Focus trap
    const focusable = container.querySelectorAll(
      'button, [tabindex]:not([tabindex="-1"]), input'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }
});

// Reopen if hidden
if (container.style.display === "none") {
  container.style.display = "flex";
}

// Error display
function showError(msg) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "message bot error";
  errorDiv.setAttribute("role", "alert");
  errorDiv.setAttribute("aria-live", "assertive");
  errorDiv.textContent = msg;
  chatMessages.appendChild(errorDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add event listeners for clear buttons
document.getElementById("clear-page-btn").addEventListener("click", () => {
  if (confirm("Clear chat for this page?")) {
    conversation = [];
    saveConversation();
    renderMessages();
  }
});
document.getElementById("clear-all-btn").addEventListener("click", () => {
  if (confirm("Clear ALL chats? This cannot be undone.")) {
    ext.storage.local.clear(() => {
      conversation = [];
      renderMessages();
    });
  }
});

// Chat API call (supports OpenAI, Grok, Gemini, Claude)
async function askChatAPI(question, html) {
  if (!window.apiKey || window.apiKey === "YOUR_API_KEY") {
    throw new Error(
      "API key not set. Please create api_key.json with your provider's key."
    );
  }

  // Detect provider by key name (from inject_api_key.js logic)
  let provider = "openai";
  if (typeof window.apiKeyName !== "undefined") {
    provider = window.apiKeyName.toLowerCase();
  }

  let endpoint = "";
  let headers = {};
  let body = {};
  let model = "";

  if (provider.includes("openai")) {
    endpoint = "https://api.openai.com/v1/chat/completions";
    headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + window.apiKey,
    };
    model = "gpt-3.5-turbo";
    const systemPrompt = `You are an expert on the following HTML page. Answer questions using only the information in the page.\n\nPAGE HTML:\n${html.substring(
      0,
      12000
    )}`;
    const filtered = conversation.filter(
      (m) => m.role === "user" || m.role === "bot"
    );
    const mapped = filtered.map((m) => ({
      role: m.role === "bot" ? "assistant" : m.role,
      content: m.content,
    }));
    const maxHistory = 10;
    const trimmed = mapped.slice(-maxHistory);
    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmed,
      { role: "user", content: question },
    ];
    body = {
      model,
      messages,
      max_tokens: 512,
      temperature: 0.2,
    };
  } else if (provider.includes("grok")) {
    endpoint = "https://api.grok.com/v1/chat/completions";
    headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + window.apiKey,
    };
    model = "grok-1";
    const systemPrompt = `You are an expert on the following HTML page. Answer questions using only the information in the page.\n\nPAGE HTML:\n${html.substring(
      0,
      12000
    )}`;
    const filtered = conversation.filter(
      (m) => m.role === "user" || m.role === "bot"
    );
    const mapped = filtered.map((m) => ({
      role: m.role === "bot" ? "assistant" : m.role,
      content: m.content,
    }));
    const maxHistory = 10;
    const trimmed = mapped.slice(-maxHistory);
    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmed,
      { role: "user", content: question },
    ];
    body = {
      model,
      messages,
      max_tokens: 512,
      temperature: 0.2,
    };
  } else if (provider.includes("gemini")) {
    endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
      window.apiKey;
    headers = {
      "Content-Type": "application/json",
    };
    const context = `You are an expert on the following HTML page. Answer questions using only the information in the page.\n\nPAGE HTML:\n${html.substring(
      0,
      12000
    )}`;
    const filtered = conversation.filter(
      (m) => m.role === "user" || m.role === "bot"
    );
    const history = filtered.map((m) => ({
      role: m.role === "bot" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const contents = [
      ...history,
      { role: "user", parts: [{ text: context + "\n\n" + question }] },
    ];
    body = {
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    };
  } else if (provider.includes("claude")) {
    endpoint = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": window.apiKey,
      "anthropic-version": "2023-06-01",
    };
    const context = `You are an expert on the following HTML page. Answer questions using only the information in the page.\n\nPAGE HTML:\n${html.substring(
      0,
      12000
    )}`;
    const filtered = conversation.filter(
      (m) => m.role === "user" || m.role === "bot"
    );
    const history = filtered.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.content,
    }));
    const messages = [
      { role: "user", content: context },
      ...history,
      { role: "user", content: question },
    ];
    body = {
      model: "claude-3-opus-20240229",
      max_tokens: 512,
      temperature: 0.2,
      messages,
    };
  } else {
    // Example for a generic provider (user should edit as needed)
    endpoint = "https://your-ai-provider.com/v1/chat";
    headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + window.apiKey,
    };
    body = {
      prompt: question,
      context: html,
      // Add other fields as required by your provider
    };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("API error");
  const data = await res.json();

  if (provider.includes("openai") || provider.includes("grok")) {
    return data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
      ? data.choices[0].message.content.trim()
      : "No answer.";
  } else if (provider.includes("gemini")) {
    return data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text
      ? data.candidates[0].content.parts[0].text.trim()
      : "No answer.";
  } else if (provider.includes("claude")) {
    return data.content &&
      Array.isArray(data.content) &&
      data.content.length > 0 &&
      typeof data.content[0].text === "string"
      ? data.content[0].text.trim()
      : "No answer.";
  } else {
    // Example: adjust this to match your provider's response format
    return data.answer || data.result || "No answer.";
  }
}
