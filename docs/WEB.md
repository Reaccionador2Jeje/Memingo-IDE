# Memingo IDE Web

Memingo IDE Web serves the lightweight browser editor included in `mobile/` using Node.js built-in modules. It does not require code-server, Electron, a cloud account, or a third-party web server.

## Requirements

- Node.js 20 or newer
- The Memingo IDE repository

## Start the web editor

From the Memingo IDE repository:

```bash
npm install
npm run web
```

Open **http://127.0.0.1:3000** in your browser. Stop the server with Ctrl+C. Choose another local port with:

```bash
npm run web -- --port 8080
```

The server binds only to loopback addresses. It intentionally rejects public interfaces such as `0.0.0.0`; this first web edition is for local-device access and does not include remote-user authentication.

## Use it through the Memingo CLI

Link the IDE command once from the repository:

```bash
npm install
npm link
```

Then, when the Memingo runtime is installed and both commands are on PATH:

```bash
memingo ide
memingo ide --port 8080
```

The CLI delegates to `memingo-ide-web`. If it is not found, install/link the IDE package and make sure its npm global bin directory is on PATH.

## Scope and limitations

This web entry point serves the mobile/browser editor (tabs, local drafts, editing tools and offline Memingo language intelligence). Browser file access is handled by the browser's file picker and local storage; it does not expose arbitrary files on the host computer. The full Electron desktop features—native terminal, Git operations, agent processes and Python stdio LSP management—remain desktop-only.

The web server serves only files inside the packaged `mobile/` directory, accepts GET and HEAD requests, applies a restrictive content security policy, disables caching, and rejects path traversal and non-loopback binding.
