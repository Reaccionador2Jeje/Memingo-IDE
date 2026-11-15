const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "mobile", "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "mobile", "mobile.js"), "utf8");

test("mobile workbench exposes editor, tools and account navigation", () => {
  for (const view of ["editor", "tools", "account"]) {
    assert.match(html, new RegExp('data-mobile-view="' + view + '"'));
    assert.match(html, new RegExp('data-mobile-tab="' + view + '"'));
  }
});

test("mobile workbench preserves core editor and OIDC element IDs", () => {
  for (const id of [
    "editor", "gutter", "tabs", "fileName", "language", "newFile", "openFile",
    "saveFile", "exportFile", "completeButton", "infoButton", "findButton",
    "replaceButton", "checkButton", "suggestButton", "accountSignIn",
    "accountSignOut", "accountStatus"
  ]) assert.match(html, new RegExp('id="' + id + '"'));
});

test("mobile navigation updates view visibility and active tab", () => {
  assert.match(js, /function setMobileView\(viewName\)/);
  assert.match(js, /data-mobile-view/);
  assert.match(js, /data-mobile-tab/);
});
