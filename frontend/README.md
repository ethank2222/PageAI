# PageAI Extension

PageAI is a browser extension that brings AI chat to every web page, allowing you to ask questions about the current page's content. It supports OpenAI, Anthropic (Claude), Gemini, and Grok via a secure backend proxy.

## Features

-   Chat with LLMs about any web page
-   Supports OpenAI, Claude, Gemini, and Grok
-   Conversation and page history
-   Modern, professional UI
-   Secure: API keys are never exposed to the client

## Setup Instructions

### 1. Clone the Repository

```
git clone https://github.com/yourusername/PageAI.git
cd PageAI
```

### 2. Set Up the Backend Proxy

#### a. Install dependencies

```
npm install
```

#### b. Create a `.env` file in the project root:

```
OPENAI_API_KEY=sk-...
GROK_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
GEMINI_API_KEY=...
PORT=3001
```

#### c. Start the proxy server

```
node proxy-server.js
```

-   The proxy will run on `http://localhost:3001` by default.
-   **All API keys must be set in the `.env` file.**
-   The extension will communicate only with the proxy endpoints (never directly with LLM providers).

### 3. Load the Extension in Your Browser

1. Open Chrome or Firefox and go to the Extensions page.
2. Enable "Developer mode" (Chrome) or "Debug Add-ons" (Firefox).
3. Click "Load unpacked" (Chrome) or "Load Temporary Add-on" (Firefox).
4. Select the `PageAI` directory.

### 4. Usage

-   Click the PageAI icon to open the popup.
-   Use the chat interface to ask questions about the current page.
-   All LLM requests are routed securely through your backend proxy.

### 5. Deployment (Optional)

-   Deploy your proxy server to a cloud provider (Render, Vercel, Heroku, etc.).
-   Update the endpoints in `popup.js` to use your deployed proxy URL instead of `localhost`.
-   Never expose your API keys in the extension or client code.

## Security Notes

-   **Never commit your `.env` file or API keys to version control.**
-   The extension is designed to keep all secrets on the backend.

## License

MIT
