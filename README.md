# PageAI Chatbot Chrome Extension

PageAI Chatbot is a Chrome extension that brings ChatGPT to every web page, allowing you to ask questions about the current page's content. The chatbot reads the full HTML of the page and provides expert answers, with conversation history saved per page.

## Features

- ChatGPT-powered chatbot for any web page
- Reads and understands the full HTML of the current page
- Sleek, modern popup UI
- Conversation history saved per page
- Works on all HTML pages
- Secure: No data is stored outside your browser

## Setup

1. Clone or download this repository.
2. [Get an OpenAI API key](https://platform.openai.com/account/api-keys) and replace `YOUR_OPENAI_API_KEY` in `popup.js` with your key.
3. Build or download the icon set (see below).
4. Go to `chrome://extensions` in Chrome, enable Developer Mode, and click "Load unpacked". Select this folder.

## Permissions

- `storage`: To save conversation history per page
- `scripting` and `host_permissions`: To access page content

## Security

- Your API key is stored locally and never sent to third parties except OpenAI.
- All conversations are stored only in your browser.

## Icons

Add your own icons as `icon16.png`, `icon32.png`, `icon48.png`, and `icon128.png` in the root directory for a professional look.

## API Key Management (Local Development)

1. Create a file named `openai_api_key.json` in the root directory (see `openai_api_key.json.example`):
   ```json
   { "apiKey": "sk-..." }
   ```
2. Make sure `openai_api_key.json` is in your `.gitignore` (already set).
3. Run the following command before building or loading the extension:
   ```sh
   node inject_api_key.js
   ```
   This will inject your API key into `popup.js` for local use.

**Never commit your real API key to version control!**

## License

MIT
