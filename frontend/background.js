// Cross-browser API wrapper
const ext = typeof browser !== "undefined" ? browser : chrome;

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PAGE_HTML") {
    ext.tabs.sendMessage(
      message.tabId,
      { type: "GET_PAGE_HTML" },
      (response) => {
        sendResponse(response);
      }
    );
    return true; // Keep the message channel open for async response
  }
});
