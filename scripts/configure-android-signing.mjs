import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const android = path.join(root, "android");
const app = path.join(android, "app");
const gradle = path.join(app, "build.gradle");
const encoded = process.env.ANDROID_KEYSTORE_BASE64;
const password = process.env.ANDROID_KEYSTORE_PASSWORD || process.env.MEMINGO_ANDROID_KEYSTORE_PASSWORD;
const alias = process.env.ANDROID_KEY_ALIAS || process.env.MEMINGO_ANDROID_KEY_ALIAS;
const keyPassword = process.env.ANDROID_KEY_PASSWORD || process.env.MEMINGO_ANDROID_KEY_PASSWORD;
if (!encoded || !password || !alias || !keyPassword) {
  throw new Error("Faltan ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS o ANDROID_KEY_PASSWORD.");
}
if (!fs.existsSync(gradle)) throw new Error("No existe android/app/build.gradle.");
const keystore = path.join(app, "memingo-release.keystore");
fs.writeFileSync(keystore, Buffer.from(encoded.replace(/\s/g, ""), "base64"), { mode: 0o600 });
let source = fs.readFileSync(gradle, "utf8");
if (!source.includes("signingConfigs {")) {
  source = source.replace(/\n\s*buildTypes\s*\{/, `
    signingConfigs {
        release {
            storeFile file("memingo-release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }

    buildTypes {
`);
}
source = source.replace(/(buildTypes\\s*\\{[\\s\\S]*?release\\s*\\{)/, "$1\\n            signingConfig signingConfigs.release");
fs.writeFileSync(gradle, source);
console.log("Android release signing configured.");
