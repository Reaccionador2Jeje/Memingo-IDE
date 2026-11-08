# Memingo IDE

**Memingo IDE** is a desktop code editor for the [Memingo programming language](https://github.com/Reaccionador2Jeje/Memingo). It is built with Electron and targets Windows, Linux and macOS desktop computers.

## Current features

- Dark desktop workspace.
- Open a project folder and browse nested Memingo files and common text/source formats (JavaScript, TypeScript, HTML, CSS, Python, JSON, Markdown, etc.).
- Basic Memingo syntax highlighting for comments, strings, keywords, values and numbers.
- Multiple open files with independent tabs and unsaved-change indicators.
- Keyword and built-in function suggestions while typing (`Ctrl + Space` opens suggestions manually).
- Basic editor diagnostics for unmatched brackets and unclosed strings.
- Open and save `.mgo`, `.mgoa` and supported text/source files from the project explorer.
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


### Gestor de ramas y conflictos

- Consulta las ramas locales y reconoce la rama actual.
- Crea ramas nuevas y cambia de rama cuando el árbol de trabajo está limpio.
- Fusiona otra rama en la actual con confirmación previa. Si Git detecta conflictos, la operación queda pendiente para resolverlos.
- La sección **Conflictos** permite abrir cada archivo en un editor, guardar la resolución y marcarlo como resuelto (git add). También permite cancelar una fusión pendiente con `git merge --abort`.
- Los nombres de rama se validan con `git check-ref-format`; las operaciones usan argumentos separados y no ejecutan shell.


### Gestor de ramas y conflictos

- Consulta las ramas locales y reconoce la rama actual.
- Crea ramas nuevas y cambia de rama cuando el árbol de trabajo está limpio.
- Fusiona otra rama en la actual con confirmación previa. Si Git detecta conflictos, la operación queda pendiente para resolverlos.
- La sección **Conflictos** permite abrir cada archivo en un editor, guardar la resolución y marcarlo como resuelto (git add). También permite cancelar una fusión pendiente con `git merge --abort`.
- Los nombres de rama se validan con `git check-ref-format`; las operaciones usan argumentos separados y no ejecutan shell.


### Agentes de programación de código abierto

Memingo IDE incluye un panel de agentes con dos motores de código abierto seleccionables: **OpenCode** (MIT) y **Goose** (Apache-2.0). Ambos ofrecen tres perfiles de trabajo pensados para principiantes:

- **Planificador:** analiza la idea y prepara instrucciones sin editar archivos.
- **Constructor:** crea y modifica archivos; las acciones protegidas requieren aprobación.
- **Revisor:** analiza el proyecto y explica posibles errores y mejoras sin editar.

#### Arquitectura extensible de agentes

Los motores y perfiles se declaran en `src/agents/registry.js`. Los contratos de transporte se definen en `src/agents/adapter-contract.js`, que declara las operaciones admitidas por HTTP y ACP (`connect`, `send`, `permission`, `stop` y `disconnect`). El proceso principal comprueba que cada operación esté permitida por el protocolo del motor antes de ejecutarla. La interfaz consulta ambos registros y solo muestra motores cuyo protocolo tiene un adaptador declarado; nunca puede proporcionar un ejecutable o comando arbitrario.

Para incorporar otro motor:
1. Añade sus metadatos y un ID fijo a `AGENT_ENGINES`.
2. Implementa su adaptador en el proceso principal (conectar, enviar, detener, desconectar y normalizar eventos/permisos).
3. Implementa el adaptador de transporte respetando el contrato de operaciones y normaliza eventos y permisos.
4. Registra el protocolo si es nuevo y añade pruebas del contrato, del transporte y de permisos antes de habilitarlo en una versión publicada.

El contrato actual declara adaptadores HTTP y ACP. Añadir un protocolo al contrato o una entrada al registro por sí solo no integra un motor: también necesita una implementación de transporte funcional. No se cargan plugins ejecutables de terceros ni comandos externos desde la interfaz. Las pruebas `tests/agent-adapters.test.js` verifican las operaciones permitidas y el rechazo de protocolos y acciones desconocidos.

#### Requisitos del agente

- El motor elegido instalado y disponible en PATH: `opencode` para OpenCode o `goose` para Goose.
- Un proveedor/modelo configurado dentro del motor elegido. Goose admite varios proveedores y modelos locales; Memingo IDE no incluye ni descarga modelos y no solicita claves API.
- Abrir una carpeta de proyecto antes de conectar.

Instala [OpenCode](https://github.com/anomalyco/opencode) desde su [documentación](https://opencode.ai/docs/) o [Goose](https://github.com/aaif-goose/goose) siguiendo su [guía oficial](https://goose-docs.ai/docs/quickstart/).

OpenCode se inicia como servidor local autenticado en `127.0.0.1` y usa `.opencode/opencode.json` con permisos conservadores. Goose se inicia como proceso local `goose acp` mediante el protocolo ACP, en modo `approve`, y usa el directorio del proyecto como carpeta de trabajo. Las solicitudes ACP muestran las opciones de permiso de una sola vez; Memingo no ofrece aprobaciones permanentes. Goose se ejecuta con los permisos del usuario del sistema y ACP no es un sandbox: el directorio de trabajo por sí solo no impide que una herramienta acceda a otras rutas. Revisa siempre las rutas, comandos y detalles de cada acción antes de aprobar. Los perfiles son instrucciones para el modelo, no límites de seguridad por sí mismos.

Las aprobaciones se muestran en el panel del agente. **Permitir una vez** no guarda una autorización permanente; **Rechazar** niega la acción. El perfil Constructor puede modificar el proyecto, así que revisa cada solicitud. No apruebes comandos o accesos que no entiendas. Al finalizar una tarea, el explorador y los archivos abiertos sin cambios pendientes se actualizan. OpenCode usa licencia MIT y Goose Apache-2.0. Las licencias y condiciones del modelo conectado son independientes; algunos proveedores requieren cuenta o pueden generar costes. Puedes configurar modelos locales compatibles en el motor correspondiente; Memingo IDE no descarga modelos automáticamente.

## Integración continua

GitHub Actions valida automáticamente cada cambio enviado a `main` y cada pull request dirigido a esa rama. El flujo `.github/workflows/ci.yml` instala las dependencias con Node.js 22 y ejecuta:

- `npm run check`: comprueba la sintaxis de los archivos JavaScript del IDE y sus pruebas.
- `npm test`: ejecuta las pruebas automatizadas del registro de motores y perfiles de agentes.

También puedes iniciar la validación manualmente desde la pestaña **Actions** de GitHub mediante `Memingo IDE CI`.


## Compatibilidad multilenguaje

Memingo IDE incorpora un catálogo extensible de más de 80 lenguajes y familias de formatos, con más de 100 extensiones reconocidas. Incluye, entre otros:

- **Web:** HTML, CSS, SCSS, JavaScript, TypeScript, JSX, TSX, Vue, Svelte y Astro.
- **General y backend:** Python, Java, Kotlin, C, C++, C#, Go, Rust, Ruby, PHP, Swift, Dart, Lua, Perl, R y Julia.
- **Sistemas y scripting:** Shell, PowerShell, Batch, Assembly, Zig, Nim, Haskell, Elixir, Erlang y más.
- **Videojuegos y gráficos:** GDScript, Godot Shader, GML, GLSL, HLSL y CUDA.
- **Datos y configuración:** JSON, JSON5, JSONC, YAML, TOML, INI, XML, CSV, GraphQL, Protocol Buffers, SQL y Terraform.
- **Documentación y otros:** Markdown, MDX, reStructuredText, LaTeX, Diff, logs y texto plano.

El catálogo se centraliza en `src/languages/registry.js`. El explorador y el diálogo de apertura usan las extensiones registradas; el editor detecta el lenguaje de la pestaña activa, muestra un selector manual para corregir extensiones ambiguas o elegir texto plano y aplica resaltado de sintaxis general. La selección manual se conserva mientras la pestaña permanezca abierta. Las sugerencias de autocompletado propias de Memingo solo aparecen en archivos `.mgo` y `.mgoa`.

**Alcance importante:** esta etapa habilita reconocimiento, apertura, edición, guardado y resaltado básico para los formatos registrados. No equivale todavía a soporte completo de cada ecosistema: los servidores de lenguaje (LSP), autocompletado inteligente, depuradores, formateadores, compiladores y ejecución se deben integrar por lenguaje y requieren sus herramientas externas. Los botones Ejecutar, Comprobar, Formatear y Depurar siguen reservados al runtime Memingo; otros archivos no se enviarán accidentalmente a ese runtime.

Para añadir un lenguaje, registra su ID, nombre, extensiones y familia de sintaxis en `src/languages/registry.js`, y añade casos a `tests/language-registry.test.js`.
