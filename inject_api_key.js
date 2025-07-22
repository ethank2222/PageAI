const fs = require("fs");

const keyFile = "openai_api_key.json";
const popupFile = "popup.js";

if (!fs.existsSync(keyFile)) {
  console.error(
    "openai_api_key.json not found. Please create it with your API key."
  );
  process.exit(1);
}

const { apiKey } = JSON.parse(fs.readFileSync(keyFile, "utf8"));
if (!apiKey) {
  console.error("API key missing in openai_api_key.json");
  process.exit(1);
}

let popup = fs.readFileSync(popupFile, "utf8");

// Replace the apiKey assignment line
const apiKeyRegex = /const apiKey\s*=\s*(["'`]).*?\1;/;
const newLine = `const apiKey = "${apiKey}";`;
if (!apiKeyRegex.test(popup)) {
  console.error("Could not find apiKey assignment in popup.js");
  process.exit(1);
}

popup = popup.replace(apiKeyRegex, newLine);
fs.writeFileSync(popupFile, popup, "utf8");
console.log("API key injected into popup.js");
