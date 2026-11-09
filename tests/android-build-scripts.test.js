"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Android build scripts are present and referenced by npm scripts", () => {
  for (const file of ["build-android.mjs", "set-android-version.mjs", "configure-android-signing.mjs"]) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", "scripts", file)), file);
  }
  const pkg = require("../package.json");
  assert.match(pkg.scripts["android:debug"], /build-android\.mjs/);
  assert.match(pkg.scripts["android:release"], /build-android\.mjs/);
});

test("Android Gradle tasks run from the native Android project root", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "build-android.mjs"), "utf8");
  assert.match(script, /path\.join\(root, "android"\)\);/);
});
