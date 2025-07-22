const fs = require("fs");

const keyFile = "api_key.json";
const popupFile = "popup.js";

if (!fs.existsSync(keyFile)) {
  console.error(
    'api_key.json not found. Please create it with your API key (e.g. { "openai": "sk-...", "gemini": "", "grok": "", "anthropic": "" }).'
  );
  process.exit(1);
}

const keyData = JSON.parse(fs.readFileSync(keyFile, "utf8"));
const expectedKeys = ["openai", "gemini", "grok", "anthropic"];

let popup = fs.readFileSync(popupFile, "utf8");

// Remove any existing provider-specific key assignments and related comments
const providerKeyRegex =
  /const (openaiKey|geminiKey|grokKey|anthropicKey)\s*=\s*(["'`]).*?\2;\n?/g;
popup = popup.replace(providerKeyRegex, "");
const providerCommentRegex =
  /\/\/\s*PROVIDER KEYS WILL BE INJECTED HERE BY inject_api_key\.js\n?/g;
popup = popup.replace(providerCommentRegex, "");
const providerExampleCommentRegex =
  /\/\/\s*\(const openaiKey = \.\.\.\.\; const geminiKey = \.\.\.\.\; etc\.\)\n?/g;
popup = popup.replace(providerExampleCommentRegex, "");

// Prepare new key assignments
let newKeyLines = "";
for (const key of expectedKeys) {
  const value = keyData[key] && keyData[key].trim() !== "" ? keyData[key] : "";
  newKeyLines += `const ${key}Key = "${value}";\n`;
}

// Insert after let apiKeyName = ...;
const apiKeyNameLineRegex = /(let apiKeyName\s*=\s*(["'`]).*?\2;\n?)/;
if (!apiKeyNameLineRegex.test(popup)) {
  console.error("Could not find apiKeyName assignment in popup.js");
  process.exit(1);
}
popup = popup.replace(apiKeyNameLineRegex, `$1${newKeyLines}`);

fs.writeFileSync(popupFile, popup, "utf8");
console.log(`All provider keys injected into popup.js`);
