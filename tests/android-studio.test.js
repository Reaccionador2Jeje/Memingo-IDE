const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const root = require("node:path").join(__dirname, "..");
const main = fs.readFileSync(require("node:path").join(root, "src/main.js"), "utf8");
const preload = fs.readFileSync(require("node:path").join(root, "src/preload.js"), "utf8");
const renderer = fs.readFileSync(require("node:path").join(root, "src/renderer.js"), "utf8");
const styles = fs.readFileSync(require("node:path").join(root, "src/styles.css"), "utf8");

test("Studio detects and displays Android configuration from memingo.toml", () => {
  assert.match(main, /android:\s*sections\.android\s*\?/);
  assert.match(main, /applicationId:\s*String\(sections\.android\.application_id/);
  assert.match(renderer, /function renderAndroidCard\(manifest\)/);
  assert.match(renderer, /ANDROID NATIVO/);
  assert.match(renderer, /Configurar Android/);
});

test("Studio exposes only the supported Android CLI actions", () => {
  assert.match(main, /new Set\(\["init", "check", "generate", "build"\]\)/);
  assert.match(main, /ipcMain\.handle\("android:action"/);
  assert.match(preload, /androidAction: action => ipcRenderer\.invoke\("android:action"/);
});

test("Android commands run with argument arrays and without a shell", () => {
  assert.match(main, /spawn\(executable, args,\s*\{\s*cwd, windowsHide: true, shell: false/);
  assert.match(main, /\["android", action, root\]/);
});

test("Android run installs and launches only the generated project APK", () => {
  assert.match(main, /app-debug\.apk/);
  assert.match(main, /\["-s", serial, "install", "-r", apk\]/);
  assert.match(main, /"shell", "am", "start"/);
  assert.match(main, /No hay ningún dispositivo o emulador Android conectado/);
});

test("Android workflow streams build output into the Studio console", () => {
  assert.match(main, /event\.sender\.send\("android:output"/);
  assert.match(preload, /onAndroidOutput: callback/);
  assert.match(renderer, /onAndroidOutput\(data => log/);
  assert.match(renderer, /APK generado:/);
});

test("Android project controls use the existing workbench visual system", () => {
  assert.match(styles, /\.android-project-card/);
  assert.match(styles, /\.android-project-actions/);
  assert.match(renderer, /Compilar APK/);
  assert.match(renderer, /Instalar y ejecutar/);
});
