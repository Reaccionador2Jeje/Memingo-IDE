import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gradle = path.join(root, "android", "app", "build.gradle");
if (!fs.existsSync(gradle)) {
  console.error("No existe android/app/build.gradle. Ejecuta primero npx cap add android.");
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const versionCode = Number(process.env.ANDROID_VERSION_CODE || String(pkg.version).split(".").reduce((n, part, i) => n + Number(part || 0) * [10000, 100, 1][i], 0));
if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error("ANDROID_VERSION_CODE debe ser un entero positivo.");
let source = fs.readFileSync(gradle, "utf8");
if (!/versionCode\s+\d+/.test(source) || !/versionName\s+["'][^"']+["']/.test(source)) {
  throw new Error("No se encontraron versionCode/versionName en build.gradle.");
}
source = source.replace(/versionCode\s+\d+/, "versionCode " + versionCode);
source = source.replace(/versionName\s+["'][^"']+["']/, 'versionName "' + pkg.version + '"');
fs.writeFileSync(gradle, source);
console.log("Android version set to " + pkg.version + " (" + versionCode + ").");
