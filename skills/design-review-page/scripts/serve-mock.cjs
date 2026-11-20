#!/usr/bin/env node
// Serves a built review page for local testing, wrapped the way the artifact viewer wraps it, with
// mock-claude.js standing in for window.claude (db + user). Never test against the live comment store.
//
//   node serve-mock.cjs <folder with index.html> [--port 18765]
//
// Run it in the background, test with mock-flow-test.js through the Playwright MCP, then stop it.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (!args[0]) { console.error("Usage: node serve-mock.cjs <folder> [--port 18765]"); process.exit(1); }
const root = path.resolve(args[0]);
const portFlag = args.indexOf("--port");
const port = portFlag > -1 ? Number(args[portFlag + 1]) : 18765;
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".js": "application/javascript", ".css": "text/css" };
const head = "<!doctype html><html><head><meta charset=utf8><meta name=viewport content=\"width=device-width,initial-scale=1,viewport-fit=cover\">" +
  "<style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]{display:none!important}</style>" +
  "<script src=\"/__mock-claude.js\"></script></head><body>";

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/" || url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(head + fs.readFileSync(path.join(root, "index.html"), "utf8") + "</body></html>");
    return;
  }
  if (url === "/__mock-claude.js") {
    res.writeHead(200, { "content-type": "application/javascript", "cache-control": "no-store" });
    res.end(fs.readFileSync(path.join(__dirname, "mock-claude.js")));
    return;
  }
  const file = path.join(root, url);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
}).listen(port, "127.0.0.1", () => console.log("Review page on http://127.0.0.1:" + port + "/ (mock store, sessionStorage)"));
