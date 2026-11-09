#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, realpath, stat } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(here, "../mobile");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function isLoopback(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function createWebServer({ root = DEFAULT_ROOT, host = "127.0.0.1" } = {}) {
  if (!isLoopback(host)) {
    throw new Error("Memingo IDE Web solo puede enlazarse a localhost por ahora.");
  }

  const server = http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    if (pathname.includes("\\0") || pathname.includes("\\\\")) {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }
    if (pathname === "/") pathname = "/index.html";
    const rootPath = path.resolve(root);
    const candidate = path.resolve(rootPath, "." + pathname);
    if (candidate !== rootPath && !candidate.startsWith(rootPath + path.sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const realRoot = await realpath(rootPath);
      const realFile = await realpath(candidate);
      if (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const details = await stat(realFile);
      if (!details.isFile() || details.size > 10 * 1024 * 1024) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      const body = request.method === "HEAD" ? null : await readFile(realFile);
      response.writeHead(200, {
        "Content-Type": MIME[path.extname(realFile).toLowerCase()] || "application/octet-stream",
        "Content-Length": details.size,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });
      response.end(body);
    } catch (error) {
      const missing = error && (error.code === "ENOENT" || error.code === "ENOTDIR");
      response.writeHead(missing ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(missing ? "Not found" : "Internal server error");
    }
  });

  return server;
}

function parseArgs(argv) {
  const options = { host: "127.0.0.1", port: 3000 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--host") options.host = argv[++index] || "";
    else if (argument === "--port") options.port = Number(argv[++index]);
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error("Opción desconocida: " + argument);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error("El puerto debe ser un número entre 0 y 65535.");
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Uso: memingo-ide-web [--host 127.0.0.1] [--port 3000]");
    return;
  }
  const server = createWebServer(options);
  server.on("error", error => {
    console.error("Memingo IDE Web:", error.message);
    process.exitCode = 1;
  });
  server.listen(options.port, options.host, () => {
    const address = server.address();
    console.log("Memingo IDE Web está listo:");
    console.log("  http://127.0.0.1:" + address.port);
    console.log("  Presiona Ctrl+C para detener el servidor.");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error("Memingo IDE Web:", error.message);
    process.exitCode = 1;
  });
}
