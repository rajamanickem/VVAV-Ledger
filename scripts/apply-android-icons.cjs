// The android/ folder is git-ignored, so launcher icons are kept in android-icons/
// and copied into the generated Android project after every sync.
const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "..", "android-icons");
const target = path.join(__dirname, "..", "android", "app", "src", "main", "res");

if (!fs.existsSync(target)) {
  console.log("android/ not found, skipping icon copy");
  process.exit(0);
}

fs.cpSync(source, target, { recursive: true, force: true });
console.log("Android launcher icons applied");
