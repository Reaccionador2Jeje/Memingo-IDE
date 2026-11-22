# Memingo Android Native in Memingo Studio

A3 adds the Android project workflow to the Electron desktop workbench. It uses the existing Memingo runtime as the source of truth: the IDE calls the supported `memingo android` CLI actions rather than parsing or generating Android application code itself.

## Project detection

When a project folder is opened, the desktop IDE reads the existing `memingo.toml` manifest and detects the optional `[android]` section. The Explorer shows an **ANDROID NATIVO** card with the configured application ID and SDK range.

For projects without Android configuration, the card offers **Configurar Android**. This invokes:

```bash
memingo android init <project-directory>
```

## Available actions

| Studio action | Runtime/device action |
| --- | --- |
| Comprobar | `memingo android check <project-directory>` |
| Generar código | `memingo android generate <project-directory>` |
| Compilar APK | `memingo android build <project-directory>` |
| Instalar y ejecutar | Build if the debug APK is missing, then install and launch with ADB |

After a successful action, Studio refreshes the project manifest and Explorer tree. Build output is streamed to the integrated Console. A successful build reports the exact debug APK path.

## Device deployment

The run action looks for the generated debug APK at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

It then runs `adb devices`, selects the first device in the `device` state, installs the APK with `adb install -r`, and launches the generated `.MainActivity`.

Requirements:
- Memingo runtime installed and available as `memingo` on PATH.
- The runtime version must provide `memingo android init/check/generate/build`.
- Java, Gradle and Android SDK configured for the runtime build command.
- Android Platform Tools (`adb`) on PATH for device deployment.
- A connected and authorized Android device or running emulator for **Instalar y ejecutar**.

If ADB is missing or no device is authorized, Studio reports a clear error and does not claim that the application was installed.

## Security and boundaries

- Android CLI actions are allowlisted: `init`, `check`, `generate`, and `build`.
- Processes are launched with `spawn` argument arrays, `shell: false`, and the opened project as their working directory.
- ADB receives fixed argument arrays. No command text from the renderer is executed as a shell command.
- The runtime remains responsible for validating the project and generating Kotlin/Gradle files.
- The IDE does not embed an Android SDK, download build dependencies, or create signing credentials.
- This A3 workflow is desktop-only. The Capacitor mobile editor remains a separate lightweight editing experience.

## Scope still outside A3

A3 does not add device selection UI, logcat, live debugging, release signing, AAB publishing, or remote builds. Those can be considered after the basic project-to-device loop is validated.
