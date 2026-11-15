const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const build = manifest.build;

test("Windows ships a guided NSIS EXE installer", () => {
  assert.deepEqual(build.win.target.map(item => item.target), ["nsis"]);
  assert.equal(build.nsis.oneClick, false);
  assert.equal(build.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(build.nsis.createDesktopShortcut, true);
  assert.equal(build.nsis.createStartMenuShortcut, true);
  assert.equal(build.nsis.license, "LICENSE");
});

test("macOS ships a universal DMG with Applications shortcut", () => {
  assert.deepEqual(build.mac.target.map(item => item.target), ["dmg"]);
  assert.equal(build.mac.target[0].arch[0], "universal");
  assert.ok(build.dmg.contents.some(item => item.type === "link" && item.path === "/Applications"));
});

test("Linux ships a DEB package", () => {
  assert.deepEqual(build.linux.target.map(item => item.target), ["deb"]);
});

test("platform scripts request only the intended installer formats", () => {
  assert.match(manifest.scripts["dist:win"], /--win nsis/);
  assert.match(manifest.scripts["dist:mac"], /--mac dmg/);
  assert.match(manifest.scripts["dist:linux"], /--linux deb/);
});
