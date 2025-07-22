// Cross-browser API wrapper
const ext = typeof browser !== "undefined" ? browser : chrome;

// Listen for requests from the extension to get the page HTML
ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_PAGE_HTML") {
    sendResponse({ html: document.documentElement.outerHTML });
  }
  // Return true to indicate async response if needed
  return false;
});
