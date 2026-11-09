import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const release = process.argv.includes("--release");
const isWindows = process.platform === "win32";
const npx = isWindows ? "npx.cmd" : "npx";
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: isWindows });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!fs.existsSync(path.join(root, "android"))) run(npx, ["cap", "add", "android"]);
run(npx, ["cap", "sync", "android"]);
run(process.execPath, ["scripts/set-android-version.mjs"]);
if (release) run(process.execPath, ["scripts/configure-android-signing.mjs"]);
const gradle = path.join(root, "android", isWindows ? "gradlew.bat" : "gradlew");
if (!fs.existsSync(gradle)) throw new Error("No se encontró el Gradle Wrapper de Android.");
if (!isWindows) fs.chmodSync(gradle, 0o755);
run(gradle, release ? ["assembleRelease", "bundleRelease"] : ["assembleDebug"]);
console.log(release ? "APK/AAB release creados en android/app/build/outputs/." : "APK debug creado en android/app/build/outputs/apk/debug/.");
