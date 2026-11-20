# Memingo IDE — Ecosystem Integration

Status: planning document; it does not imply additional IDE functionality has been implemented.

## Runtime boundary
The IDE should invoke the installed Memingo CLI through a controlled process adapter and use the documented LSP interface for editor intelligence. Keep runtime discovery separate from editor UI code.

## Requirements
- Detect whether the configured Memingo executable exists.
- Display detected version and a useful error if missing or incompatible.
- Avoid silently installing or updating runtimes.
- Pass file paths as process arguments, not shell-concatenated strings.
- Show process exit status and bounded output.
- Keep project files within the selected workspace unless the user chooses otherwise.

## Compatibility checks
- Test the minimum supported Memingo release and the currently pinned release.
- Add smoke tests for run, format and LSP startup.
- Document Node.js/Electron requirements separately from Memingo runtime requirements.
- Keep Windows, Linux and macOS behavior explicit.

## Next tasks
1. Document supported runtime versions.
2. Add a runtime-detection test matrix.
3. Add a small fixture project for editor smoke tests.
4. Record unsupported language features in the UI.