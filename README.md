# Memingo IDE

**Memingo IDE** is a desktop code editor for the [Memingo programming language](https://github.com/Reaccionador2Jeje/Memingo). It is built with Electron and targets Windows, Linux and macOS desktop computers.

## Current features

- Dark desktop workspace.
- Open a project folder and browse nested `.mgo` / `.mgoa` files in the explorer.
- Basic Memingo syntax highlighting for comments, strings, keywords, values and numbers.
- Open and save `.mgo` and `.mgoa` source files.
- Create a new Memingo source file from a starter template.
- Line numbers, tab indentation, synchronized highlighting and unsaved-change indicator.
- Run the current file through the official Memingo CLI.
- Integrated output console and process stop control.
- Keyboard shortcuts: `Ctrl + S`, `Ctrl + O`, and `Ctrl + Enter`.

## Requirements

- Node.js 20 or newer.
- npm.
- The Memingo runtime installed and available as `memingo` in PATH (needed to run programs).

Install the language runtime from [Reaccionador2Jeje/Memingo](https://github.com/Reaccionador2Jeje/Memingo).

## Start developing

```bash
git clone https://github.com/Reaccionador2Jeje/Memingo-IDE.git
cd Memingo-IDE
npm install
npm start
```

## Build installers

Run the build on the operating system you want to package:

```bash
npm run dist
```

- Linux: AppImage and DEB
- Windows: NSIS installer
- macOS: DMG

## How code execution works

The IDE launches the official runtime using the equivalent of:

```bash
memingo run /path/to/program.mgo
```

The runtime output is streamed into the IDE console.

## Security

The renderer runs with context isolation, sandboxing and Node integration disabled. File operations and process execution are handled by the Electron main process through a small preload API.

## License

BSL License.
