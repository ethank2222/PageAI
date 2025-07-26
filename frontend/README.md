# PageAI Frontend

A Chrome extension that brings AI chat to every web page, allowing you to ask questions about the current page's content.

## 🔒 **SECURITY & PRIVACY**

This extension is designed with **maximum privacy and security** in mind. No sensitive data is ever read, stored, or transmitted.

### **Privacy Protection Measures**

#### **1. Content Script Security**

- **No Form Data**: All input fields, textareas, and forms are completely removed
- **No Passwords**: Password fields and related elements are stripped
- **No Personal Data**: Email addresses, phone numbers, SSNs, credit cards are sanitized
- **No Scripts**: All JavaScript and executable content is removed
- **No Hidden Data**: Comments, meta tags, and hidden attributes are stripped

#### **2. Data Sanitization**

The extension automatically removes or replaces sensitive information:

- **Emails**: `user@example.com` → `[EMAIL]`
- **Phone Numbers**: `555-123-4567` → `[PHONE]`
- **Credit Cards**: `1234-5678-9012-3456` → `[CREDIT_CARD]`
- **SSNs**: `123-45-6789` → `[SSN]`
- **IP Addresses**: `192.168.1.1` → `[IP_ADDRESS]`
- **Long Numbers**: `1234567890` → `[NUMBER]`

#### **3. Backend Security**

- **Domain Blocking**: Local networks and sensitive domains are blocked
- **URL Sanitization**: Only domain names are logged, never full URLs
- **Content Validation**: Only HTML content is processed
- **Request Limits**: Timeouts and redirect limits prevent abuse

#### **4. What Gets Removed**

- ✅ All form inputs and their values
- ✅ Password fields and authentication data
- ✅ Personal information (emails, phones, SSNs)
- ✅ Financial data (credit cards, account numbers)
- ✅ JavaScript and executable code
- ✅ Hidden comments and metadata
- ✅ Sensitive attributes (data-_, aria-_)
- ✅ Local network access

#### **5. What Gets Preserved**

- ✅ Page titles and headings
- ✅ Main content text
- ✅ Image alt text
- ✅ Lists and structured content
- ✅ Public information only

### **Security Guarantees**

1. **No Sensitive Data Access**: The extension cannot read passwords, forms, or personal data
2. **No Data Storage**: Sensitive information is never stored locally or remotely
3. **No Network Access**: Local networks and private domains are blocked
4. **No Script Execution**: All executable code is removed before processing
5. **No Logging**: Full URLs are never logged, only domain names

## Absolute Minimal Permission Design

The extension has been optimized to use the absolute minimum permissions possible:

### Required Permissions (2 total - the minimum possible)

- **`storage`** - Used for saving conversation history and page data per URL
- **`activeTab`** - Used to access the current tab when popup is opened (more privacy-friendly than `tabs`)

### Why This Approach is Optimal

1. **`activeTab` vs `tabs`**: `activeTab` only grants access to the current tab when the user explicitly opens the popup, making it much more privacy-friendly
2. **Automatic Injection**: Content scripts are automatically injected via manifest declaration, no scripting permission needed
3. **Absolute Minimum**: Only 2 permissions total - the absolute minimum required for this functionality
4. **User Control**: Users know exactly when the extension accesses their current tab
5. **Chrome Best Practices**: Follows Chrome's recommended permission model perfectly

## Benefits of This Design

1. **Maximum Privacy**: Extension only accesses the current tab when popup is opened
2. **Minimal Permissions**: Only 2 required permissions - the absolute minimum possible
3. **Better Performance**: Content scripts are injected efficiently via manifest
4. **Clear Intent**: Users understand exactly when and why the extension needs access
5. **Chrome Best Practices**: Follows Chrome's recommended permission model
6. **No Dynamic Injection**: No need for scripting permission, more secure

## Robust Page Content Fetching

The extension uses a multi-layered approach to ensure it can always access page content:

### Primary Method: Content Scripts

- Content scripts are automatically injected on all web pages
- Direct access to page DOM and HTML content
- Fastest and most reliable method
- **Retry mechanism**: 3 attempts with increasing delays
- **Security**: All sensitive data is removed before processing

### Fallback Method: Backend Fetching

- If content scripts fail (e.g., on restricted pages), the extension falls back to backend fetching
- Backend makes HTTP requests to fetch page content
- Works on pages where content scripts can't access content
- Supports both production and local development backends
- **URL validation**: Ensures only valid HTTP/HTTPS URLs are processed
- **Content type checking**: Verifies responses are HTML content
- **Security**: Comprehensive sanitization on backend

### Final Fallback: Basic Page Info

- If all other methods fail, uses basic tab information (title, URL)
- Ensures the extension always provides some context
- User can still ask questions about the page title and URL

### How Fallback Works

1. **Try Content Script**: First attempts to get content via injected content script (3 retries)
2. **Backend Fallback**: If content script fails, sends URL to backend for fetching
3. **Content Processing**: Backend fetches page, extracts relevant content, and returns it
4. **Basic Info Fallback**: If backend fails, uses tab title and URL
5. **Seamless Experience**: User sees clear status messages for each method

## Testing the Extension

### Test Scenarios

#### ✅ **Normal Web Pages**

- **Test**: Visit any regular website (e.g., news sites, blogs)
- **Expected**: "Page indexed successfully!"
- **Method**: Content script

#### ✅ **Restricted Pages**

- **Test**: Visit pages with strict CSP or CORS policies
- **Expected**: "Page indexed successfully! (via backend)"
- **Method**: Backend fetching

#### ✅ **Chrome System Pages**

- **Test**: Visit `chrome://extensions/` or `chrome://settings/`
- **Expected**: "Limited page access - using basic page info"
- **Method**: Basic page info fallback

#### ✅ **PDF or Non-HTML Pages**

- **Test**: Visit pages that return non-HTML content
- **Expected**: Backend error handling with clear message
- **Method**: Backend with content type validation

#### ✅ **Slow Loading Pages**

- **Test**: Visit pages that take time to load
- **Expected**: Content script waits for page to load
- **Method**: Content script with load event handling

#### ✅ **Security Test - Forms**

- **Test**: Visit pages with login forms, payment forms
- **Expected**: All form data is removed, only public content remains
- **Method**: Content sanitization

### Debug Information

The extension provides detailed console logging:

- Content script loading and message handling
- Retry attempts and timing
- Backend request attempts and responses
- Error details and fallback methods

## Building the Extension

### Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm install
npm run build
```

### Loading in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `frontend` folder
4. The extension will be installed with minimal permissions

## How It Works

1. **Content Script Injection**: Content scripts are automatically injected on all web pages via manifest declaration
2. **Popup Opens**: When user clicks the extension icon, `activeTab` permission grants access to current tab
3. **Page Content**: Extension extracts HTML content from the current page via message passing
4. **Fallback Fetching**: If content script fails, backend fetches page content via HTTP
5. **Storage**: Conversation history is saved per page using the storage API
6. **Clean Exit**: When popup closes, no ongoing access to the page

## File Structure

- `manifest.json` - Extension configuration with absolute minimal permissions
- `popup.html/js/css` - Extension popup interface
- `content.js` - Content script automatically injected via manifest
- `background.js` - Service worker for message handling
- `webpack.config.js` - Build configuration for dependencies

## Backend Integration

The extension integrates with the backend server for:

- **Page Content Fetching**: Fallback method when content scripts fail
- **AI Provider Proxies**: Secure API calls to OpenAI, Claude, Gemini, and Grok
- **Connection Status**: Real-time status checking for AI providers

### Backend Endpoints Used

- `POST /api/fetch-page` - Fetch page content from URL
- `POST /api/openai` - OpenAI API proxy
- `POST /api/anthropic` - Claude API proxy
- `POST /api/gemini` - Gemini API proxy
- `POST /api/grok` - Grok API proxy

## Permission Explanation

- **`storage`**: Essential for saving chat history per page
- **`activeTab`**: Required to access the current tab's content when popup opens

This is the absolute minimum set of permissions that allows the extension to function while maintaining user privacy and following Chrome's security model. It's impossible to reduce permissions further while maintaining the core functionality.
