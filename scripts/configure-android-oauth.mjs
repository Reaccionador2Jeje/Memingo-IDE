import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function configureManifest(manifest) {
  const activityPattern = /<activity\b(?=[^>]*\bandroid:name="(?:\.MainActivity|[^"]*MainActivity)")(?:"[^"]*"|'[^']*'|[^>])*>[\s\S]*?<\/activity>/;
  const match = manifest.match(activityPattern);
  if (!match) throw new Error("No se encontró la actividad MainActivity en AndroidManifest.xml.");

  const activity = match[0];
  if (activity.includes('android:scheme="dev.atdev.memingoide"')) return manifest;

  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="dev.atdev.memingoide" android:host="oauth" android:path="/callback" />
            </intent-filter>`;
  const updatedActivity = activity.replace(/<\/activity>$/, `${filter}\n        </activity>`);
  return manifest.replace(activity, updatedActivity);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const manifestPath = path.join(
    process.cwd(),
    "android",
    "app",
    "src",
    "main",
    "AndroidManifest.xml",
  );
  if (!fs.existsSync(manifestPath)) {
    throw new Error("No se encontró AndroidManifest.xml. Ejecuta primero npx cap add android.");
  }
  const original = fs.readFileSync(manifestPath, "utf8");
  const updated = configureManifest(original);
  if (updated !== original) {
    fs.writeFileSync(manifestPath, updated, "utf8");
    console.log("Callback OIDC de Memingo registrado en AndroidManifest.xml.");
  } else {
    console.log("Callback OIDC de Memingo ya estaba registrado.");
  }
}
