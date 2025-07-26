// Cross-browser API wrapper
const ext = typeof browser !== "undefined" ? browser : chrome;

// Only run on valid web pages (not chrome://, chrome-extension://, etc.)
if (
  window.location.protocol === "http:" ||
  window.location.protocol === "https:"
) {
  console.log("PageAI content script loaded on:", window.location.href);

  // SECURITY: Function to safely extract page content without sensitive data
  function extractSafeContent() {
    try {
      // Create a clone of the document to avoid modifying the original
      const docClone = document.cloneNode(true);

      // SECURITY: Remove all sensitive elements and attributes
      const sensitiveSelectors = [
        'input[type="password"]',
        'input[type="email"]',
        'input[type="tel"]',
        'input[type="number"]',
        'input[type="creditcard"]',
        'input[type="card"]',
        'input[name*="password"]',
        'input[name*="email"]',
        'input[name*="phone"]',
        'input[name*="credit"]',
        'input[name*="card"]',
        'input[name*="ssn"]',
        'input[name*="social"]',
        'input[name*="account"]',
        'input[name*="user"]',
        'input[name*="login"]',
        'input[name*="secret"]',
        'input[name*="private"]',
        'input[name*="personal"]',
        'input[name*="confidential"]',
        'textarea[name*="password"]',
        'textarea[name*="email"]',
        'textarea[name*="phone"]',
        'textarea[name*="credit"]',
        'textarea[name*="card"]',
        'textarea[name*="ssn"]',
        'textarea[name*="social"]',
        'textarea[name*="account"]',
        'textarea[name*="user"]',
        'textarea[name*="login"]',
        'textarea[name*="secret"]',
        'textarea[name*="private"]',
        'textarea[name*="personal"]',
        'textarea[name*="confidential"]',
        "script",
        "style",
        "noscript",
        "iframe",
        "object",
        "embed",
        "applet",
        "form",
        'meta[name*="password"]',
        'meta[name*="email"]',
        'meta[name*="phone"]',
        'meta[name*="credit"]',
        'meta[name*="card"]',
        'meta[name*="ssn"]',
        'meta[name*="social"]',
        'meta[name*="account"]',
        'meta[name*="user"]',
        'meta[name*="login"]',
        'meta[name*="secret"]',
        'meta[name*="private"]',
        'meta[name*="personal"]',
        'meta[name*="confidential"]',
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
        const elements = docClone.querySelectorAll(selector);
        elements.forEach((el) => el.remove());
      });

      // SECURITY: Remove all input values and sensitive attributes
      const allInputs = docClone.querySelectorAll("input, textarea, select");
      allInputs.forEach((input) => {
        // Remove sensitive attributes
        const sensitiveAttrs = ["value", "placeholder"];
        sensitiveAttrs.forEach((attr) => {
          if (input.hasAttribute(attr)) {
            input.removeAttribute(attr);
          }
        });
        // Replace with safe placeholder
        input.setAttribute("value", "[INPUT_FIELD]");
        input.setAttribute("placeholder", "[INPUT_FIELD]");
      });

      // SECURITY: Remove all comments that might contain sensitive data
      const walker = document.createTreeWalker(
        docClone,
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

      // SECURITY: Remove all data attributes
      const allElements = docClone.querySelectorAll("*");
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

      // Return only the safe content
      return docClone.documentElement.outerHTML;
    } catch (error) {
      console.error("Error extracting safe content:", error);
      // Fallback: return only basic page info
      return `<html><head><title>${
        document.title || "Page"
      }</title></head><body><h1>${document.title || "Page"}</h1></body></html>`;
    }
  }

  // Listen for requests from the extension to get the page HTML
  ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("PageAI content script received message:", request);

    if (request.type === "GET_PAGE_HTML") {
      try {
        // Wait for page to be fully loaded if needed
        if (document.readyState !== "complete") {
          console.log("Page not fully loaded, waiting...");
          window.addEventListener("load", () => {
            const safeHtml = extractSafeContent();
            console.log(
              "PageAI sending safe HTML after load, length:",
              safeHtml.length
            );
            sendResponse({ html: safeHtml });
          });
          return true; // Keep message channel open
        }

        const safeHtml = extractSafeContent();
        console.log("PageAI sending safe HTML, length:", safeHtml.length);
        sendResponse({ html: safeHtml });
      } catch (error) {
        console.error("Error getting page HTML:", error);
        sendResponse({ error: error.message });
      }
    }
    // Return true to indicate async response if needed
    return false;
  });
} else {
  console.log("PageAI content script skipped on:", window.location.protocol);
}
