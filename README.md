# Memingo IDE

**Memingo IDE** is a desktop code editor for the [Memingo programming language](https://github.com/Reaccionador2Jeje/Memingo). It is built with Electron and targets Windows, Linux and macOS desktop computers.

## Current features

- Dark desktop workspace.
- Open a project folder and browse nested `.mgo` / `.mgoa` files in the explorer.
- Basic Memingo syntax highlighting for comments, strings, keywords, values and numbers.
- Multiple open files with independent tabs and unsaved-change indicators.
- Keyword and built-in function suggestions while typing (`Ctrl + Space` opens suggestions manually).
- Basic editor diagnostics for unmatched brackets and unclosed strings.
- Open and save `.mgo` and `.mgoa` source files.
- Create a new Memingo source file from a starter template.
- Line numbers, tab indentation, synchronized highlighting and unsaved-change indicator.
- Run the current file through the official Memingo CLI.
- Integrated output console and process stop control.
- Keyboard shortcuts: `Ctrl + S`, `Ctrl + O`, `Ctrl + Enter`, and `Ctrl + Space`.

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


## Herramientas del runtime desde el IDE

- **Comprobar** ejecuta `memingo check <archivo.mgo>` y muestra los diagnósticos del parser oficial.
- **Formatear** ejecuta `memingo fmt <archivo.mgo>`, actualiza el archivo guardado y sincroniza el editor.
- Ambas herramientas requieren el runtime Memingo instalado y disponible en `PATH`.
- El panel PROBLEMAS conserva el análisis rápido local de delimitadores; **Comprobar** es la validación real del runtime.


## Reconocimiento de proyectos

Al abrir una carpeta, Memingo IDE busca `memingo.toml` en la raíz y muestra el nombre, versión, archivo principal y cantidad de dependencias declaradas. Si el archivo principal existe, puedes abrirlo desde la tarjeta del proyecto. Si no hay manifest, la carpeta sigue disponible como espacio de trabajo normal.

La lectura del manifest está limitada a 64 KB y la ruta del archivo principal se comprueba para que permanezca dentro de la carpeta del proyecto.


## Terminal integrada

La terminal acepta únicamente comandos incorporados y acciones del runtime Memingo: help, clear, pwd, ls, memingo run, memingo check y memingo fmt. Los tres comandos del runtime trabajan sobre el archivo activo. No se ejecutan comandos arbitrarios del sistema ni se usa un shell, para reducir riesgos de ejecución accidental.


## Depurador

El botón **Depurar** ejecuta el comando `memingo debug` del runtime y muestra una traza por sentencia, con número de línea, tipo de sentencia y variables visibles. Haz clic en los números del margen del editor para marcar o quitar breakpoints; las líneas marcadas se destacan en la traza. Esta primera versión recopila la ejecución completa y señala los breakpoints, pero todavía no pausa el programa para avanzar manualmente.


## Git y GitHub integrados

El panel **Control de versiones** trabaja sobre la carpeta de proyecto abierta e incluye:
- Estado (git status), cambios (git diff), historial reciente y rama actual.
- Inicializar un repositorio local, preparar los cambios (git add -A) y crear commits con mensaje.
- Sincronizar con el remoto configurado mediante git pull --ff-only y git push.
- Comprobar la sesión de GitHub CLI (gh auth status), consultar el repositorio remoto (gh repo view) y publicar el proyecto como repositorio **privado** en GitHub (gh repo create).

Requiere **Git** instalado y disponible en PATH. Las funciones de GitHub requieren además **GitHub CLI (gh)** instalado y autenticado previamente con gh auth login. La IDE no solicita ni almacena contraseñas o tokens. Pull y Push solo se ejecutan cuando pulsas sus botones. No se permite introducir comandos de terminal arbitrarios.


### Panel Source Control

El panel de control de versiones también muestra los archivos modificados y sin seguimiento mediante `git status --porcelain`. Puedes actualizar la lista, abrir las diferencias de un archivo y preparar o quitar del staging cada archivo individualmente. El visor combina las diferencias preparadas y las que siguen en el directorio de trabajo. Las rutas se validan para impedir que las operaciones por archivo salgan de la carpeta del proyecto.

Esta vista se actualiza al abrir un proyecto y después de inicializar, preparar, confirmar o sincronizar cambios.


### Historial visual de Git

El panel muestra hasta 30 commits recientes con hash corto, autor, fecha y mensaje. Al seleccionar uno, consulta su resumen y lista de archivos modificados. Puedes seleccionar un archivo para ver el diff correspondiente a ese commit en el visor. Las consultas usan hashes completos validados y argumentos Git separados (sin shell).
