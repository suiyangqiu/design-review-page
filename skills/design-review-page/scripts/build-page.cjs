#!/usr/bin/env node
// Builds a design review page: review.json + ../assets/review-page.html -> index.html, and checks the content first.
//
//   node build-page.cjs <path/to/review.json> [--out <folder>]
//
// Each figure's "src" is a path relative to review.json's folder (for example "shots/01-home.png"). The built
// page refers to the same relative paths, and with --out the screenshots are copied there too, so the out
// folder is exactly what gets published: index.html as the page, every src as a supporting file.
// Width and height are read from each PNG and filled in when missing; a mismatch is an error.
// Exit code 1 on any error. Warnings (house style) are printed but do not stop the build.
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith("--")) {
  console.error("Usage: node build-page.cjs <path/to/review.json> [--out <folder>]");
  process.exit(1);
}
const jsonPath = path.resolve(args[0]);
const outFlag = args.indexOf("--out");
if (outFlag > -1 && (!args[outFlag + 1] || args[outFlag + 1].startsWith("--"))) {
  console.error("Usage: node build-page.cjs <path/to/review.json> [--out <folder>]");
  process.exit(1);
}
const srcDir = path.dirname(jsonPath);
const outDir = outFlag > -1 ? path.resolve(args[outFlag + 1]) : srcDir;
const templatePath = path.join(__dirname, "..", "assets", "review-page.html");

const errors = [];
const warnings = [];
let data;
try {
  data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
} catch (e) {
  console.error("Cannot read " + jsonPath + ": " + e.message);
  process.exit(1);
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const IMAGE = /\.(png|jpe?g|webp)$/i;
const DASHES = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");

function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.toString("ascii", 1, 4) === "PNG") return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  return null; // JPEG and WebP sizes are not read: give width and height in review.json
}

// ---- page-level fields
if (!data.title || typeof data.title !== "string") errors.push("title is missing (the artifact's name: two to four words, kept the same on every republish)");
else if (data.title.trim().split(/\s+/).length > 5) warnings.push("title has more than five words; it is the gallery name, so aim for two to four");
if (!data.heading) warnings.push("heading is missing; the page will say \"Design review\"");
if (!data.owner) warnings.push("owner is missing; the read-only notice will say \"ask the page owner for Contributor access\"");
if (!Array.isArray(data.sections) || !data.sections.length) errors.push("sections is empty");
if (data.jiraBase != null && !/^https?:\/\/\S+$/.test(String(data.jiraBase))) errors.push("jiraBase must be an http or https URL that ticket keys are appended to: " + JSON.stringify(data.jiraBase));
else if (data.jiraBase == null && (data.sections || []).some(s => s && s.ticket)) warnings.push("sections have tickets but jiraBase is missing; ticket keys will show as plain text, not links");
if (data.locale != null) {
  try { new Intl.DateTimeFormat(String(data.locale)); } catch (e) { errors.push("locale is not a valid locale tag (like en-US or en-AU): " + JSON.stringify(data.locale)); }
}

// ---- sections and figures
const keys = new Set();
const ids = new Set();
const files = [];
(data.sections || []).forEach((s, si) => {
  const where = "sections[" + si + "]";
  if (!s || typeof s !== "object") { errors.push(where + " is not an object"); return; }
  if (!SLUG.test(s.key || "")) errors.push(where + ".key must be a lowercase slug (letters, digits, hyphens): " + JSON.stringify(s.key));
  else if (s.key === "general") errors.push(where + ".key \"general\" is reserved for General feedback");
  else if (keys.has(s.key)) errors.push(where + ".key " + s.key + " is used twice");
  keys.add(s.key);
  if (!s.name) errors.push(where + ".name is missing");
  if (s.ticket && !/^[A-Z][A-Z0-9]*-\d+$/.test(s.ticket)) errors.push(where + ".ticket should be a ticket key like ABC-123: " + JSON.stringify(s.ticket));
  if (!Array.isArray(s.figures)) s.figures = [];
  if (!s.figures.length) warnings.push(where + " (" + s.key + ") has no figures; it will only take notes");
  s.figures.forEach((f, fi) => {
    const fw = where + ".figures[" + fi + "]";
    if (!SLUG.test(f.id || "")) errors.push(fw + ".id must be a lowercase slug: " + JSON.stringify(f.id));
    else if (ids.has(f.id)) errors.push(fw + ".id " + f.id + " is used twice (ids are unique across the page)");
    ids.add(f.id);
    for (const k of ["title", "alt", "caption"]) if (!f[k]) errors.push(fw + "." + k + " is missing");
    if (!f.src || typeof f.src !== "string") { errors.push(fw + ".src is missing"); return; }
    if (path.isAbsolute(f.src) || f.src.split(/[\\/]/).includes("..")) { errors.push(fw + ".src must be relative to review.json and stay inside its folder: " + f.src); return; }
    if (!IMAGE.test(f.src)) errors.push(fw + ".src must be a .png, .jpg or .webp: " + f.src);
    f.src = f.src.split(path.sep).join("/");
    const file = path.join(srcDir, f.src);
    if (!fs.existsSync(file)) { errors.push(fw + ".src not found: " + file); return; }
    const size = imageSize(file);
    if (size) {
      if (f.width == null && f.height == null) { f.width = size.width; f.height = size.height; }
      else if (f.width !== size.width || f.height !== size.height) errors.push(fw + " says " + f.width + "x" + f.height + " but " + f.src + " is " + size.width + "x" + size.height);
    } else if (!f.width || !f.height) errors.push(fw + " needs width and height (only PNG sizes are read automatically)");
    files.push(f.src);
  });
});

// ---- what reviewers are asked to verify or decide: [lead or null, text, optional figure ids on this page]
(data.sections || []).forEach((s, si) => {
  if (!s || s.asks == null) return;
  const where = "sections[" + si + "].asks";
  if (!Array.isArray(s.asks)) { errors.push(where + " must be a list of [lead, text, figure ids] items"); return; }
  s.asks.forEach((a, ai) => {
    const at = where + "[" + ai + "]";
    if (!Array.isArray(a) || a.length < 2 || a.length > 3) { errors.push(at + " must be [lead or null, text] or [lead or null, text, [figure ids]]"); return; }
    if (a[0] != null && typeof a[0] !== "string") errors.push(at + "[0] (the lead) must be text or null");
    if (!a[1] || typeof a[1] !== "string") errors.push(at + "[1] (the text) is missing");
    if (a[2] != null) {
      if (!Array.isArray(a[2])) errors.push(at + "[2] must be a list of figure ids");
      else a[2].forEach(id => { if (!ids.has(id)) errors.push(at + " points at figure " + JSON.stringify(id) + ", which is not on the page"); });
    }
  });
});

// ---- house style: no en or em dashes in anything readers see
(function scan(v, at) {
  if (typeof v === "string") { if (DASHES.test(v)) warnings.push(at + " contains an en or em dash; use a hyphen, comma, colon or a new sentence"); }
  else if (Array.isArray(v)) v.forEach((x, i) => scan(x, at + "[" + i + "]"));
  else if (v && typeof v === "object") Object.keys(v).forEach(k => scan(v[k], at ? at + "." + k : k));
})(data, "");

const template = fs.readFileSync(templatePath, "utf8");
for (const p of ["__TITLE__", "__REVIEW_JSON__"]) {
  if (template.split(p).length !== 2) errors.push("template " + templatePath + " must contain " + p + " exactly once");
}

warnings.forEach(w => console.log("warning: " + w));
if (errors.length) {
  errors.forEach(e => console.error("error: " + e));
  process.exit(1);
}

// ---- build. "<" in the JSON is written as its JSON escape, so no text in it can close the script element.
// The escape is assembled from two pieces because some editing tools turn a written-out escape into the character.
const LT = "\\" + "u003c";
const json = JSON.stringify(data).replace(/</g, LT);
const title = data.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const html = template.replace("__TITLE__", () => title).replace("__REVIEW_JSON__", () => json);

fs.mkdirSync(outDir, { recursive: true });
if (outDir !== srcDir) {
  for (const f of files) {
    const dest = path.join(outDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(srcDir, f), dest);
  }
}
const outFile = path.join(outDir, "index.html");
fs.writeFileSync(outFile, html);

const figureCount = data.sections.reduce((n, s) => n + s.figures.length, 0);
console.log("Built " + outFile + " (" + Math.round(html.length / 1024) + " KB): " + data.sections.length + " sections, " + figureCount + " figures.");
console.log("Publish with file_path " + outFile + " and root " + outDir + ", files:");
console.log(JSON.stringify(Array.from(new Set(files)).map(p => ({ path: p }))));
