// Cross-browser API wrapper
const ext = typeof browser !== "undefined" ? browser : chrome;

const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const closeBtn = document.getElementById("close-btn");
const container = document.getElementById("chatbot-container");

let currentTabId = null;
let pageKey = null;
let pageHtml = null;
let conversation = [];
let isLoading = false;
let indexStatusShown = false;

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
  // Call ChatGPT API
  try {
    const answer = await askChatGPT(question, pageHtml);
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

// Close button
closeBtn.addEventListener("click", closeChat);

// Keyboard accessibility: ESC to close, focus trap
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeChat();
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

function closeChat() {
  container.style.display = "none";
}

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

// ChatGPT API call (replace with your API key and endpoint)
async function askChatGPT(question, html) {
  // Replace with your OpenAI API key
  const apiKey =
    "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";
  if (!apiKey || apiKey === "YOUR_OPENAI_API_KEY") {
    throw new Error(
      "OpenAI API key not set. Please edit popup.js and add your key."
    );
  }
  const endpoint = "https://api.openai.com/v1/chat/completions";
  const systemPrompt = `You are an expert on the following HTML page. Answer questions using only the information in the page.\n\nPAGE HTML:\n${html.substring(
    0,
    12000
  )}`;

  // Build messages array: system + conversation (excluding 'Thinking...')
  const filtered = conversation.filter(
    (m) => m.role === "user" || m.role === "bot"
  );
  // Map 'bot' to 'assistant' for OpenAI
  const mapped = filtered.map((m) => ({
    role: m.role === "bot" ? "assistant" : m.role,
    content: m.content,
  }));
  // Only keep the last N messages to avoid 400 error (token limit)
  const maxHistory = 10;
  const trimmed = mapped.slice(-maxHistory);
  const messages = [
    { role: "system", content: systemPrompt },
    ...trimmed,
    { role: "user", content: question },
  ];

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 512,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error("API error");
  const data = await res.json();
  return data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
    ? data.choices[0].message.content.trim()
    : "No answer.";
}
