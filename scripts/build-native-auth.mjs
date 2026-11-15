import { build } from "esbuild";
import path from "node:path";

const root = process.cwd();
await build({
  entryPoints: [path.join(root, "mobile/native-auth-entry.js")],
  outfile: path.join(root, "mobile/native-auth.bundle.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
});
console.log("Puente nativo de autenticación Android preparado.");
