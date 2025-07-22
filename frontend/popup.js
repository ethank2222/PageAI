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

// Remove all API key variables from the client

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
        ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const currentUrl = tab.url;
            const currentTitle =
                tab.title || extractTitle(pageHtml) || "(No title)";
            const indexedMsg = {
                role: "system",
                type: "page-indexed-link",
                content: "Page indexed successfully!",
                url: currentUrl,
                title: currentTitle,
            };
            const hasUserOrBot = conversation.some(
                (m) => m.role === "user" || m.role === "bot"
            );
            let newConversation = conversation;
            if (hasUserOrBot) {
                // Remove the indexed message if present
                if (
                    conversation.length &&
                    conversation[0].type === "page-indexed-link"
                ) {
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
            .filter(
                ([key, val]) => key.startsWith("pageAI_") && val && val.pageHtml
            )
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

            // Remove external link button/icon
            // (No button appended)

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

// Helper to get page HTML, with auto-injection fallback
function getPageHtmlWithInjection(tabId, callback) {
    ext.tabs.sendMessage(tabId, { type: "GET_PAGE_HTML" }, (response) => {
        if (
            chrome.runtime &&
            chrome.runtime.lastError &&
            chrome.runtime.lastError.message.includes(
                "Could not establish connection"
            )
        ) {
            // Try to inject content.js, then retry
            if (chrome.scripting && chrome.scripting.executeScript) {
                chrome.scripting.executeScript(
                    {
                        target: { tabId },
                        files: ["content.js"],
                    },
                    () => {
                        // Retry after injection
                        ext.tabs.sendMessage(
                            tabId,
                            { type: "GET_PAGE_HTML" },
                            (response2) => {
                                if (
                                    chrome.runtime &&
                                    chrome.runtime.lastError
                                ) {
                                    console.error(
                                        "Retry after injection failed:",
                                        chrome.runtime.lastError.message
                                    );
                                    callback(
                                        null,
                                        chrome.runtime.lastError.message
                                    );
                                } else {
                                    callback(response2, null);
                                }
                            }
                        );
                    }
                );
            } else {
                console.error(
                    "chrome.scripting.executeScript not available or not permitted."
                );
                callback(null, chrome.runtime.lastError.message);
            }
        } else if (chrome.runtime && chrome.runtime.lastError) {
            console.error(
                "Other runtime error:",
                chrome.runtime.lastError.message
            );
            callback(null, chrome.runtime.lastError.message);
        } else {
            callback(response, null);
        }
    });
}

// On popup open, always show the indexed message at the top if there are no user or bot messages
function ensureIndexedMessage(cb) {
    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        const currentUrl = tab.url;
        const currentTitle =
            tab.title || extractTitle(pageHtml) || "(No title)";
        const indexedMsg = {
            role: "system",
            type: "page-indexed-link",
            content: "Page indexed successfully!",
            url: currentUrl,
            title: currentTitle,
        };
        // Check if any user or bot messages exist
        const hasUserOrBot = conversation.some(
            (m) => m.role === "user" || m.role === "bot"
        );
        if (hasUserOrBot) {
            // Remove the indexed message if present
            if (
                conversation.length &&
                conversation[0].type === "page-indexed-link"
            ) {
                conversation = conversation.slice(1);
            }
        } else {
            if (
                !conversation.length ||
                conversation[0].type !== "page-indexed-link"
            ) {
                conversation = [indexedMsg, ...conversation];
            } else {
                // Update the link if the URL/title changed
                conversation[0] = indexedMsg;
            }
        }
        if (cb) cb();
    });
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
            if (
                e.key === "Escape" &&
                !sidebar.classList.contains("collapsed")
            ) {
                sidebar.classList.add("collapsed");
                sidebarToggle.focus();
            }
        });
    }

    // Get current tab and page info
    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        currentTabId = tab.id;
        pageKey = "pageAI_" + (tab.url || "").split("#")[0];
        // Inject content.js only when popup is opened
        if (chrome.scripting && chrome.scripting.executeScript) {
            chrome.scripting.executeScript(
                {
                    target: { tabId: currentTabId },
                    files: ["content.js"],
                },
                () => {
                    // Now send the message to get page HTML
                    ext.tabs.sendMessage(
                        currentTabId,
                        { type: "GET_PAGE_HTML" },
                        (response) => {
                            const statusDiv =
                                document.getElementById("index-status");
                            if (chrome.runtime && chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError.message);
                                if (statusDiv) {
                                    statusDiv.textContent =
                                        "Could not connect to content script. This extension only works on normal web pages. It cannot access Chrome system pages, the Web Store, or some special pages.";
                                    statusDiv.style.display = "block";
                                    indexStatusShown = true;
                                }
                                return;
                            }
                            pageHtml =
                                response && response.html ? response.html : "";
                            loadPageData(() => {
                                chatInput && chatInput.focus();
                            });
                            if (statusDiv) {
                                if (pageHtml) {
                                    statusDiv.textContent =
                                        "Page indexed successfully!";
                                    statusDiv.style.display = "block";
                                    indexStatusShown = true;
                                } else {
                                    statusDiv.textContent =
                                        "Failed to index page.";
                                    statusDiv.style.display = "block";
                                    indexStatusShown = true;
                                }
                            }
                        }
                    );
                }
            );
        }
    });

    // Handle sending a message
    // Extract only content, title, and alt tags from HTML
    function extractRelevantContent(html) {
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Get <title>
        let title = doc.querySelector("title")?.innerText || "";

        // Remove scripts, styles, meta, link, noscript, iframe, and head
        const removeTags = [
            "script",
            "style",
            "meta",
            "link",
            "noscript",
            "iframe",
            "head",
        ];
        removeTags.forEach((tag) => {
            doc.querySelectorAll(tag).forEach((el) => el.remove());
        });

        // Get all alt attributes
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
            if (
                style &&
                (style.display === "none" || style.visibility === "hidden")
            )
                return "";
            let text = "";
            for (let child of node.childNodes) {
                text += getVisibleText(child);
            }
            return text;
        }
        let bodyText = getVisibleText(doc.body || doc);

        // Combine all
        let result = "";
        if (title) result += `Title: ${title}\n`;
        if (alts.length) result += `Alt tags: ${alts.join(" | ")}\n`;
        result += bodyText.trim();
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
        const histories = await new Promise((resolve) =>
            loadAllHistories(resolve)
        );
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
            endpoint = "http://localhost:3001/api/openai";
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
            endpoint = "http://localhost:3001/api/grok";
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
            endpoint = "http://localhost:3001/api/gemini";
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
            endpoint = "http://localhost:3001/api/anthropic";
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
        return `You are an expert on the following HTML page. By default, answer questions using only the information in the page. If the user's question clearly requests outside information, research, or a comparison to outside info, you may use your own knowledge or research, but always try as hard as possible to relate your answer to the page content.\n\nPAGE CONTENT:\n${pageContent}`;
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

    const connectionStatusDot = document.getElementById(
        "connection-status-dot"
    );
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
            endpoint = "http://localhost:3001/api/openai/ping";
        else if (selectedProvider === "claude")
            endpoint = "http://localhost:3001/api/anthropic/ping";
        else if (selectedProvider === "gemini")
            endpoint = "http://localhost:3001/api/gemini/ping";
        else if (selectedProvider === "grok")
            endpoint = "http://localhost:3001/api/grok/ping";

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
