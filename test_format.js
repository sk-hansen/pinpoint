// Self-check for the Markdown formatter. Run: node test_format.js
const assert = require("assert");
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/format.js", "utf8"));

const a = {
  selector: "div#app > p.intro",
  comment: "Make this text 12px",
  html: "<p class=\"intro\">Hi</p>",
  url: "http://localhost:5173/",
  viewport: { w: 974, h: 598 },
  dpr: 2,
  position: { x: 24, y: 184 },
  size: { w: 672, h: 40 },
  source: "src/App.tsx:12",
};

const md = efFormatAll([a, { ...a, comment: "", source: null }], "Feedback");
assert(md.startsWith("# Feedback\n"));
assert(md.includes("## 1. `div#app > p.intro`"));
assert(md.includes("Make this text 12px"));
assert(md.includes("- **Source:** `src/App.tsx:12`"));
assert(md.includes("## 2. `div#app > p.intro`"));
assert(md.includes("```html"));
assert(md.includes("- **Viewport:** 974\u00d7598"));
// second annotation has no source line
assert.strictEqual(md.split("**Source:**").length, 2);
console.log("ok");
