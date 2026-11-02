const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "www");
const files = [
  "index.html",
  "styles.css",
  "theme.css",
  "category-manager.js",
  "account-manager.js",
  "constants.js",
  "state.js",
  "storage.js",
  "backup.js",
  "helpers.js",
  "render.js",
  "account-activity.js",
  "events.js",
  "pwa.js",
  "service-worker.js",
  "manifest.webmanifest"
];

fs.mkdirSync(output, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

const iconDirectory = path.join(output, "icons");
fs.mkdirSync(iconDirectory, { recursive: true });
fs.copyFileSync(path.join(root, "icons", "ledger.svg"), path.join(iconDirectory, "ledger.svg"));
