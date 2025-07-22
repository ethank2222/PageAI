const path = require("path");

module.exports = {
    mode: "production",
    entry: "./popup.js",
    output: {
        filename: "popup.bundle.js",
        path: path.resolve(__dirname, "dist"),
        clean: true,
    },
    resolve: {
        extensions: [".js"],
    },
    target: "web",
};
