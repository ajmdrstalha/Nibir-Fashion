# Desktop Build

This package creates a Windows installer (`Setup.exe`) that bundles:

- API server (`artifacts/api-server`)
- Web UI (`artifacts/nibir-fashion`)
- Electron shell
- Local SQLite data file under the user's app data directory

## Build installer

```powershell
pnpm --filter @workspace/desktop-shell dist
```

Installer output will be under `artifacts/desktop-shell/dist/`.
