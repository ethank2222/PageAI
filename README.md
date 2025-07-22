# PageAI Chatbot Browser Extension

PageAI Chatbot is a browser extension (Chrome & Firefox) that brings AI chat to every web page, allowing you to ask questions about the current page's content. The chatbot reads the full HTML of the page and provides expert answers, with conversation history saved per page.

## Features

- AI-powered chatbot for any web page (works with OpenAI and other providers)
- Reads and understands the full HTML of the current page
- Sleek, modern popup UI
- Conversation history saved per page
- Works on all HTML pages
- Secure: No data is stored outside your browser
- Works in both Chrome and Firefox

## Setup

1. Clone or download this repository.
2. Create a file named `api_key.json` in the root directory (see below for format).
3. Build or download the icon set (see below).
4. **Inject your API keys:**
   ```sh
   node inject_api_key.js
   ```
   This will inject your API keys into `popup.js` for local use. **You must re-run this command any time you change `api_key.json` or update `popup.js`.**
5. Load the extension:
   - **Chrome**: Go to `chrome://extensions`, enable Developer Mode, and click "Load unpacked". Select this folder.
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on...", and select `manifest.json` in this folder.
6. **Reload the extension in your browser** after running the injection script to ensure the latest keys are used.

## API Key Management

1. Create a file named `api_key.json` in the root directory:
   ```json
   {
     "openai": "sk-...",
     "gemini": "",
     "grok": "",
     "anthropic": ""
   }
   ```
   - You can provide one or more keys. The extension will use the first non-empty key in the order: openai, gemini, grok, anthropic.
   - For OpenAI, use your OpenAI key. For other providers, use their key and update the endpoint in `popup.js` if needed.
2. Make sure `api_key.json` is in your `.gitignore` (already set).

**Never commit your real API key to version control!**

## Troubleshooting

### Why does the extension show as "Disconnected"?

- The extension will show as "Disconnected" (red dot) if no valid API key is injected into `popup.js`.
- **To fix:**
  1. Make sure your `api_key.json` contains at least one valid, non-empty key (e.g., your OpenAI key).
  2. Run:
     ```sh
     node inject_api_key.js
     ```
  3. Check that the top of `popup.js` now contains lines like:
     ```js
     const openaiKey = "sk-...";
     const geminiKey = "";
     // ...
     ```
  4. Reload the extension in your browser.
- If you change `api_key.json` or update `popup.js`, **always re-run the injection script and reload the extension**.

### Other Issues

- If you see errors about missing keys or "API key not set", repeat the steps above.
- If you have multiple keys, the extension will use the first available one in the order: openai, gemini, grok, anthropic.

## Permissions

- `storage`: To save conversation history per page
- `host_permissions`: To access page content

## Security

- Your API key is stored locally and never sent to third parties except your AI provider.
- All conversations are stored only in your browser.

## Icons

Add your own icons as `icon16.png`, `icon32.png`, `icon48.png`, and `icon128.png` in the root directory for a professional look.

## License

MIT
