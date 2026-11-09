import test from "node:test";
import assert from "node:assert/strict";
import { createWebServer } from "../scripts/web-server.mjs";

async function withServer(run) {
  const server = createWebServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("serves the IDE entry page from localhost", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(await response.text(), /Memingo IDE Mobile/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });
});

test("serves local language intelligence assets", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/memingo-lsp.js");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /MemingoMobileLSP/);
  });
});

test("rejects methods other than GET and HEAD", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/", { method: "POST" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
  });
});

test("does not allow binding to a public interface", () => {
  assert.throws(() => createWebServer({ host: "0.0.0.0" }), /localhost/);
});

import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

test("npm executable keeps the Node server running in the foreground", async () => {
  const entry = fileURLToPath(new URL("../bin/memingo-ide-web.mjs", import.meta.url));
  const child = spawn(process.execPath, [entry, "--port", "0"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("server did not become ready")), 5000);
    child.stdout.on("data", chunk => {
      output += chunk.toString();
      if (output.includes("Presiona Ctrl+C")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error("server exited before becoming ready (code " + code + ")"));
    });
  });
  try {
    await ready;
    assert.equal(child.exitCode, null);
    assert.match(output, /http:\/\/127\.0\.0\.1:/);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }
});
