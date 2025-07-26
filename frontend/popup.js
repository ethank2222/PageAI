// Cross-browser API wrapper
const ext = typeof browser !== "undefined" ? browser : chrome;

// DOM references for new layout
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const historyList = document.getElementById("history-list");
const historyInsights = document.getElementById("history-insights");
const chatHeader = document.getElementById("chat-header");
const chatHeaderActions = document.getElementById("chat-header-actions");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const indexStatus = document.getElementById("index-status");
const container = document.getElementById("main-area");
const historyBtn = document.getElementById("history-btn");
const clearPageBtn = document.getElementById("clear-page-btn");
const clearAllBtn = document.getElementById("clear-all-btn");
const sendBtn = document.getElementById("send-btn");

import { marked } from "marked";
import DOMPurify from "dompurify";

let currentTabId = null;
let pageKey = null;
let pageHtml = null;
let conversation = [];
let isLoading = false;
let indexStatusShown = false;

// Helper: Render chat messages
function renderMessages() {
  chatMessages.innerHTML = "";
  // If the first message is a special 'page indexed' message, render as a link
  if (
    conversation.length > 0 &&
    conversation[0].role === "system" &&
    conversation[0].type === "page-indexed-link"
  ) {
    const div = document.createElement("div");
    div.className = "message system";
    const a = document.createElement("a");
    a.href = conversation[0].url;
    a.target = "_blank";
    a.textContent = conversation[0].content;
    a.style.color = "#000000";
    a.style.textDecoration = "underline";
    div.appendChild(a);
    chatMessages.appendChild(div);
    // Render the rest of the messages (skip the first)
    conversation.slice(1).forEach((msg) => {
      const div = document.createElement("div");
      div.className = "message " + msg.role;
      if (msg.role === "bot") {
        // Render markdown for bot responses, sanitized
        const rawHtml = marked.parse(msg.content);
        div.innerHTML = DOMPurify.sanitize(rawHtml);
      } else {
        div.textContent = msg.content;
      }
      chatMessages.appendChild(div);
    });
  } else {
    conversation.forEach((msg) => {
      const div = document.createElement("div");
      div.className = "message " + msg.role;
      if (msg.role === "bot") {
        // Render markdown for bot responses, sanitized
        const rawHtml = marked.parse(msg.content);
        div.innerHTML = DOMPurify.sanitize(rawHtml);
      } else {
        div.textContent = msg.content;
      }
      chatMessages.appendChild(div);
    });
  }
  if (isLoading) {
    const spinner = document.createElement("div");
    spinner.className = "message bot";
    spinner.innerHTML =
      '<span class="spinner" aria-label="Loading" role="status"></span>';
    chatMessages.appendChild(spinner);
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper: Save conversation and page content for this page
function savePageData() {
  if (pageKey && pageHtml) {
    // Ensure the first message is the page indexed link only if no user/bot messages exist
    const indexedMsg = {
      role: "system",
      type: "page-indexed-link",
      content: "Page indexed successfully!",
      url: pageKey.replace(/^pageAI_/, ""),
      title: extractTitle(pageHtml) || "(No title)",
    };
    const hasUserOrBot = conversation.some(
      (m) => m.role === "user" || m.role === "bot"
    );
    let newConversation = conversation;
    if (hasUserOrBot) {
      // Remove the indexed message if present
      if (conversation.length && conversation[0].type === "page-indexed-link") {
        newConversation = conversation.slice(1);
      }
    } else {
      if (
        !conversation.length ||
        conversation[0].type !== "page-indexed-link"
      ) {
        newConversation = [indexedMsg, ...conversation];
      } else {
        // Update the link if the URL/title changed
        newConversation = [...conversation];
        newConversation[0] = indexedMsg;
      }
    }
    ext.storage.local.set({
      [pageKey]: { conversation: newConversation, pageHtml },
    });
  }
}

// Helper: Load conversation and page content for this page
function loadPageData(cb) {
  if (pageKey) {
    ext.storage.local.get([pageKey], (result) => {
      const data = result[pageKey] || {};
      conversation = data.conversation || [];
      pageHtml = data.pageHtml || pageHtml;
      renderMessages();
      if (cb) cb();
    });
  }
}

// Helper: Load all page histories
function loadAllHistories(cb) {
  ext.storage.local.get(null, (items) => {
    const histories = Object.entries(items)
      .filter(([key, val]) => key.startsWith("pageAI_") && val && val.pageHtml)
      .map(([key, val]) => ({
        key,
        title: extractTitle(val.pageHtml),
        conversation: val.conversation || [],
        pageHtml: val.pageHtml,
      }));
    if (cb) cb(histories);
  });
}

// Extract title from HTML
function extractTitle(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.querySelector("title")?.innerText || "(No title)";
  } catch {
    return "(No title)";
  }
}

// Populate history sidebar
function renderHistorySidebar() {
  loadAllHistories((histories) => {
    historyList.innerHTML = "";
    histories.forEach((h, idx) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.justifyContent = "space-between";
      li.style.alignItems = "center";

      // Title span
      const titleSpan = document.createElement("span");
      titleSpan.textContent = h.title;
      titleSpan.style.flex = "1";
      li.appendChild(titleSpan);

      // Unified click handler for the whole row
      li.onclick = (e) => {
        // Open the page in a new tab
        let url = h.key.replace(/^pageAI_/, "");
        window.open(url, "_blank");
        // Load the conversation in the extension
        pageKey = h.key;
        conversation = h.conversation;
        pageHtml = h.pageHtml;
        renderMessages();
        renderInsights(h);
        // Highlight selected
        Array.from(historyList.children).forEach((el) =>
          el.classList.remove("active")
        );
        li.classList.add("active");
      };
      historyList.appendChild(li);
    });
  });
}

// Render insights for a page
function renderInsights(history) {
  if (!history) {
    historyInsights.textContent = "";
    return;
  }
  // Example: show number of messages and a summary
  const numMsgs = history.conversation.length;
  historyInsights.innerHTML = `<b>Messages:</b> ${numMsgs}<br/><b>Title:</b> ${history.title}`;
}

// Show history sidebar on load
renderHistorySidebar();

// Function to get page HTML with backend fallback
async function getPageHtml() {
  try {
    // Get the active tab
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab.id;
    pageKey = "pageAI_" + (tab.url || "").split("#")[0];

    const statusDiv = document.getElementById("index-status");

    // Try content script first with retry mechanism
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`Content script retry attempt ${attempt}...`);
          if (statusDiv) {
            statusDiv.textContent = `Retrying content script (attempt ${attempt}/3)...`;
          }
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }

        const response = await ext.tabs.sendMessage(tab.id, {
          type: "GET_PAGE_HTML",
        });

        if (response && response.html) {
          pageHtml = response.html;
          if (statusDiv) {
            statusDiv.textContent = "Page indexed successfully!";
            statusDiv.style.display = "block";
            indexStatusShown = true;
          }
          loadPageData(() => {
            chatInput && chatInput.focus();
          });
          return;
        } else if (response && response.error) {
          console.log("Content script returned error:", response.error);
          throw new Error(response.error);
        }
      } catch (contentScriptError) {
        console.log(
          `Content script attempt ${attempt} failed:`,
          contentScriptError.message
        );
        if (attempt === 3) {
          console.log(
            "All content script attempts failed, trying backend fallback..."
          );
        }
      }
    }

    // Fallback: Use backend to fetch page content
    if (statusDiv) {
      statusDiv.textContent = "Fetching page content via backend...";
      statusDiv.style.display = "block";
      indexStatusShown = true;
    }

    // Try production backend first, then local development backend
    let backendResponse;
    try {
      backendResponse = await fetch(
        "https://pageai-production.up.railway.app/api/fetch-page",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: tab.url }),
        }
      );
    } catch (productionError) {
      console.log("Production backend failed, trying local backend...");
      try {
        backendResponse = await fetch("http://localhost:3001/api/fetch-page", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: tab.url }),
        });
      } catch (localError) {
        console.error("Both production and local backends failed");
        throw new Error("Backend unavailable");
      }
    }

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      if (data.success && data.html) {
        pageHtml = data.html;
        if (statusDiv) {
          statusDiv.textContent = "Page indexed successfully! (via backend)";
          statusDiv.style.display = "block";
          indexStatusShown = true;
        }
        loadPageData(() => {
          chatInput && chatInput.focus();
        });
        return;
      } else if (data.error) {
        throw new Error(data.error);
      }
    } else {
      const errorText = await backendResponse.text();
      throw new Error(
        `Backend error: ${backendResponse.status} - ${errorText}`
      );
    }

    throw new Error("Both content script and backend failed");
  } catch (error) {
    console.error("Error getting page HTML:", error);
    const statusDiv = document.getElementById("index-status");

    // Final fallback: Create basic page info from tab data
    if (tab && tab.title && tab.url) {
      pageHtml = `# Page Title\n${tab.title}\n\n## URL\n${tab.url}\n\n## Note\nThis page content could not be fully accessed. You can ask general questions about the page title and URL, but detailed content analysis may not be available.`;

      if (statusDiv) {
        statusDiv.textContent = "Limited page access - using basic page info";
        statusDiv.style.display = "block";
        indexStatusShown = true;
      }

      loadPageData(() => {
        chatInput && chatInput.focus();
      });
      return;
    }

    if (statusDiv) {
      statusDiv.textContent =
        "Could not access page content. This extension only works on normal web pages.";
      statusDiv.style.display = "block";
      indexStatusShown = true;
    }
  }
}

// On popup open, always show the indexed message at the top if there are no user or bot messages
function ensureIndexedMessage(cb) {
  const indexedMsg = {
    role: "system",
    type: "page-indexed-link",
    content: "Page indexed successfully!",
    url: pageKey ? pageKey.replace(/^pageAI_/, "") : "",
    title: extractTitle(pageHtml) || "(No title)",
  };
  // Check if any user or bot messages exist
  const hasUserOrBot = conversation.some(
    (m) => m.role === "user" || m.role === "bot"
  );
  if (hasUserOrBot) {
    // Remove the indexed message if present
    if (conversation.length && conversation[0].type === "page-indexed-link") {
      conversation = conversation.slice(1);
    }
  } else {
    if (!conversation.length || conversation[0].type !== "page-indexed-link") {
      conversation = [indexedMsg, ...conversation];
    } else {
      // Update the link if the URL/title changed
      conversation[0] = indexedMsg;
    }
  }
  if (cb) cb();
}

// Helper: Remove the indexed message if any user or bot messages exist
function removeIndexedMessageIfNeeded() {
  if (conversation.length && conversation[0].type === "page-indexed-link") {
    const hasUserOrBot = conversation.some(
      (m) => m.role === "user" || m.role === "bot"
    );
    if (hasUserOrBot) {
      conversation = conversation.slice(1);
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Sidebar toggle logic
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  // Collapse sidebar when clicking outside (on small screens)
  if (sidebar) {
    document.addEventListener("click", (e) => {
      if (
        sidebar &&
        sidebarToggle &&
        !sidebar.contains(e.target) &&
        !sidebarToggle.contains(e.target) &&
        !sidebar.classList.contains("collapsed")
      ) {
        sidebar.classList.add("collapsed");
      }
    });
  }

  // Keyboard accessibility: ESC to close sidebar
  if (sidebar) {
    sidebar.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sidebar.classList.contains("collapsed")) {
        sidebar.classList.add("collapsed");
        sidebarToggle.focus();
      }
    });
  }

  // Initialize by getting page HTML
  getPageHtml();

  // Handle sending a message
  // Extract only content, title, and alt tags from HTML with security measures
  function extractRelevantContent(html) {
    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Get <title>
    let title = doc.querySelector("title")?.innerText || "";

    // SECURITY: Remove all sensitive elements and attributes
    const sensitiveSelectors = [
      "input",
      "textarea",
      "select",
      "form",
      "script",
      "style",
      "meta",
      "link",
      "noscript",
      "iframe",
      "head",
      "object",
      "embed",
      "applet",
      "[data-*]",
      "[aria-*]",
      '[class*="password"]',
      '[class*="email"]',
      '[class*="phone"]',
      '[class*="credit"]',
      '[class*="card"]',
      '[class*="ssn"]',
      '[class*="social"]',
      '[class*="account"]',
      '[class*="user"]',
      '[class*="login"]',
      '[class*="secret"]',
      '[class*="private"]',
      '[class*="personal"]',
      '[class*="confidential"]',
      '[id*="password"]',
      '[id*="email"]',
      '[id*="phone"]',
      '[id*="credit"]',
      '[id*="card"]',
      '[id*="ssn"]',
      '[id*="social"]',
      '[id*="account"]',
      '[id*="user"]',
      '[id*="login"]',
      '[id*="secret"]',
      '[id*="private"]',
      '[id*="personal"]',
      '[id*="confidential"]',
    ];

    // Remove all sensitive elements
    sensitiveSelectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // SECURITY: Remove all comments
    const walker = document.createTreeWalker(
      doc,
      NodeFilter.SHOW_COMMENT,
      null,
      false
    );
    const commentsToRemove = [];
    let comment;
    while ((comment = walker.nextNode())) {
      commentsToRemove.push(comment);
    }
    commentsToRemove.forEach((comment) => comment.remove());

    // SECURITY: Remove all sensitive attributes from remaining elements
    const allElements = doc.querySelectorAll("*");
    allElements.forEach((el) => {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i];
        if (
          attr.name.startsWith("data-") ||
          attr.name.startsWith("aria-") ||
          attr.name.includes("password") ||
          attr.name.includes("email") ||
          attr.name.includes("phone") ||
          attr.name.includes("credit") ||
          attr.name.includes("card") ||
          attr.name.includes("ssn") ||
          attr.name.includes("social") ||
          attr.name.includes("account") ||
          attr.name.includes("user") ||
          attr.name.includes("login") ||
          attr.name.includes("secret") ||
          attr.name.includes("private") ||
          attr.name.includes("personal") ||
          attr.name.includes("confidential")
        ) {
          el.removeAttribute(attr.name);
        }
      }
    });

    // Extract headings for better structure
    const headings = Array.from(
      doc.querySelectorAll("h1, h2, h3, h4, h5, h6")
    ).map((heading) => {
      const level = parseInt(heading.tagName.charAt(1));
      return { level, text: heading.innerText.trim() };
    });

    // Extract lists for better structure
    const lists = Array.from(doc.querySelectorAll("ul, ol")).map((list) => {
      return Array.from(list.querySelectorAll("li")).map((item) =>
        item.innerText.trim()
      );
    });

    // Get all alt attributes (safe to keep)
    let alts = Array.from(doc.querySelectorAll("[alt]"))
      .map((el) => el.getAttribute("alt"))
      .filter(Boolean);

    // Get visible text content (excluding hidden elements)
    function getVisibleText(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const style = window.getComputedStyle
        ? window.getComputedStyle(node)
        : null;
      if (style && (style.display === "none" || style.visibility === "hidden"))
        return "";
      let text = "";
      for (let child of node.childNodes) {
        text += getVisibleText(child);
      }
      return text;
    }
    let bodyText = getVisibleText(doc.body || doc);

    // SECURITY: Additional text sanitization
    bodyText = bodyText
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        "[EMAIL]"
      ) // Remove emails
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]") // Remove SSNs
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CREDIT_CARD]") // Remove credit cards
      .replace(/\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[PHONE]") // Remove phone numbers
      .replace(/\b\d{10,}\b/g, "[NUMBER]") // Remove long numbers
      .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[IBAN]") // Remove IBANs
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP_ADDRESS]"); // Remove IP addresses

    // Combine all with better structure
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

    result += `## Main Content\n${bodyText.trim()}`;
    return result;
  }

  // In chatForm submit handler, preprocess pageHtml before sending to askChatAPI
  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      // Prevent submission if tool is disconnected
      if (sendBtn && sendBtn.disabled) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      if (indexStatusShown) {
        const statusDiv = document.getElementById("index-status");
        statusDiv.style.display = "none";
        indexStatusShown = false;
      }
      const question = chatInput.value.trim();
      if (!question) return;
      conversation.push({ role: "user", content: question });
      removeIndexedMessageIfNeeded();
      isLoading = true;
      renderMessages();
      savePageData();
      chatInput.value = "";
      chatInput.focus();
      // Call AI API
      try {
        const filteredHtml = extractRelevantContent(pageHtml);
        const answer = await askChatAPI(question, filteredHtml);
        conversation.push({ role: "bot", content: answer });
        removeIndexedMessageIfNeeded();
        isLoading = false;
        renderMessages();
        savePageData();
      } catch (err) {
        isLoading = false;
        renderMessages();
        showError("Error: " + err.message);
        savePageData();
      }
    });
  }

  // Keyboard accessibility: ESC to close, focus trap
  if (container) {
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
  }

  // Reopen if hidden
  if (container && container.style.display === "none") {
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

  // Modified askChatAPI to support cross-page context
  async function askChatAPI(question, html) {
    // Detect provider by key name (from inject_api_key.js logic)
    let provider = selectedProvider;
    if (typeof window.apiKeyName !== "undefined") {
      provider = window.apiKeyName.toLowerCase();
    }

    // Load all histories for cross-tab context
    const histories = await new Promise((resolve) => loadAllHistories(resolve));
    let referenced = null; // findReferencedPage(question, histories); // Removed as per edit hint
    let crossPageContent = "";
    if (referenced && referenced.pageHtml) {
      crossPageContent =
        `\n\n---\nReferenced Page (${referenced.title}):\n` +
        extractRelevantContent(referenced.pageHtml);
    }

    let endpoint = "";
    let headers = {};
    let body = {};
    let model = "";

    if (provider.includes("openai")) {
      endpoint = "https://pageai-production.up.railway.app/api/openai";
      headers = { "Content-Type": "application/json" };
      model = "gpt-3.5-turbo";
      const systemPrompt = buildSystemPrompt(html + crossPageContent);
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
      endpoint = "https://pageai-production.up.railway.app/api/grok";
      headers = { "Content-Type": "application/json" };
      model = "grok-1";
      const systemPrompt = buildSystemPrompt(html + crossPageContent);
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
      endpoint = "https://pageai-production.up.railway.app/api/gemini";
      headers = { "Content-Type": "application/json" };
      const context = buildSystemPrompt(html + crossPageContent);
      const filtered = conversation.filter(
        (m) => m.role === "user" || m.role === "bot"
      );
      const history = filtered.map((m) => ({
        role: m.role === "bot" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const contents = [
        ...history,
        {
          role: "user",
          parts: [{ text: context + "\n\n" + question }],
        },
      ];
      body = {
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      };
    } else if (provider.includes("claude")) {
      endpoint = "https://pageai-production.up.railway.app/api/anthropic";
      headers = { "Content-Type": "application/json" };
      const context = buildSystemPrompt(html + crossPageContent);
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
        context: html + crossPageContent,
        // Add other fields as required by your provider
      };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errorText = await res.text();
      throw new Error("API error: " + errorText);
    }
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

  function buildSystemPrompt(pageContent) {
    return `You are an expert on the following HTML page. By default, answer questions using only the information in the page. If the user's question clearly requests outside information, research, or a comparison to outside info, you may use your own knowledge or research, but always try as hard as possible to relate your answer to the page content.

IMPORTANT: Always format your responses using proper markdown formatting to make them clear, readable, and well-structured. Use:

- **Headers** (# ## ###) to organize different sections
- **Bold text** (**text**) for emphasis and key points
- **Bullet points** (- or *) for lists and key takeaways
- **Numbered lists** (1. 2. 3.) for step-by-step instructions
- **Code blocks** (\`\`\`language) for code examples, commands, or technical content
- **Inline code** (\`code\`) for technical terms, file names, or short code snippets
- **Blockquotes** (> text) for important notes or warnings
- **Tables** for comparing information or data
- **Links** ([text](url)) when referencing external resources
- **Horizontal rules** (---) to separate sections

**Response Guidelines:**
- Start with a brief summary or overview
- Use headers to break up different topics or sections
- Include bullet points for key information, features, or takeaways
- Use numbered lists for step-by-step processes or instructions
- Highlight important terms or concepts in **bold**
- Use code formatting for technical terms, commands, or file names
- Include blockquotes for important notes, warnings, or quotes
- End with a conclusion or summary when appropriate

Structure your responses logically with clear sections, use headers to break up long answers, and make sure the formatting enhances readability.

PAGE CONTENT:
${pageContent}`;
  }

  // Provider selection logic
  const providerSelect = document.getElementById("provider-select");
  let selectedProvider = localStorage.getItem("selectedProvider") || "openai";
  if (providerSelect) {
    providerSelect.value = selectedProvider;
    providerSelect.addEventListener("change", function () {
      selectedProvider = providerSelect.value;
      localStorage.setItem("selectedProvider", selectedProvider);
    });
  }

  const connectionStatusDot = document.getElementById("connection-status-dot");
  const connectionStatusLabel = document.getElementById(
    "connection-status-label"
  );

  function getProviderLabel(provider) {
    if (provider === "openai") return "OpenAI";
    if (provider === "claude") return "Claude";
    if (provider === "gemini") return "Gemini";
    if (provider === "grok") return "Grok";
    return "";
  }

  // Function to check connection to the selected provider
  async function checkConnectionStatus() {
    let endpoint = "";
    if (selectedProvider === "openai")
      endpoint = "https://pageai-production.up.railway.app/api/openai/ping";
    else if (selectedProvider === "claude")
      endpoint = "https://pageai-production.up.railway.app/api/anthropic/ping";
    else if (selectedProvider === "gemini")
      endpoint = "https://pageai-production.up.railway.app/api/gemini/ping";
    else if (selectedProvider === "grok")
      endpoint = "https://pageai-production.up.railway.app/api/grok/ping";

    let ok = false;
    try {
      const res = await fetch(endpoint, { method: "GET" });
      ok = res.ok;
    } catch (e) {
      ok = false;
    }
    if (connectionStatusDot && connectionStatusLabel) {
      const label = getProviderLabel(selectedProvider);
      if (ok) {
        connectionStatusDot.classList.remove("disconnected");
        connectionStatusDot.classList.add("connected");
        connectionStatusLabel.textContent = label + " (Connected)";
        if (sendBtn) sendBtn.disabled = false;
      } else {
        connectionStatusDot.classList.remove("connected");
        connectionStatusDot.classList.add("disconnected");
        connectionStatusLabel.textContent = label + " (Disconnected)";
        if (sendBtn) sendBtn.disabled = true;
      }
    }
  }

  // Run on load
  checkConnectionStatus();

  // Run when provider changes
  if (providerSelect) {
    providerSelect.addEventListener("change", function () {
      selectedProvider = providerSelect.value;
      localStorage.setItem("selectedProvider", selectedProvider);
      checkConnectionStatus();
    });
  }

  // Create and insert sidebar overlay for click-outside-to-close
  let sidebarOverlay = document.getElementById("sidebar-overlay");
  if (!sidebarOverlay) {
    sidebarOverlay = document.createElement("div");
    sidebarOverlay.id = "sidebar-overlay";
    document.body.appendChild(sidebarOverlay);
  }

  // Show/hide sidebar and overlay when history icon is clicked
  if (historyBtn && sidebar && sidebarOverlay) {
    historyBtn.addEventListener("click", () => {
      if (sidebar.style.display === "block") {
        sidebar.style.display = "none";
        sidebarOverlay.style.display = "none";
      } else {
        sidebar.style.display = "block";
        sidebarOverlay.style.display = "block";
      }
    });
    // Close sidebar when clicking the overlay
    sidebarOverlay.addEventListener("click", () => {
      sidebar.style.display = "none";
      sidebarOverlay.style.display = "none";
    });
  }

  // Clear conversation (only clears current chat visually)
  if (clearPageBtn) {
    clearPageBtn.addEventListener("click", () => {
      if (confirm("Clear conversation for this page?")) {
        conversation = [];
        renderMessages();
      }
    });
  }

  // Clear all history (sidebar button)
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      if (confirm("Clear ALL history? This cannot be undone.")) {
        ext.storage.local.clear(() => {
          conversation = [];
          renderMessages();
          renderHistorySidebar();
        });
      }
    });
  }

  ensureIndexedMessage(() => {
    renderMessages();
  });
});
