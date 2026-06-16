import { app, BrowserWindow } from "electron";
import path from "node:path";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";

let backendProcess: ChildProcess | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [mainWindow] = BrowserWindow.getAllWindows();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function firstExistingPath(candidates: string[]) {
  return candidates.find((candidate) => existsSync(candidate));
}

function logStartupError(message: string) {
  const logPath = path.join(app.getPath("userData"), "startup-error.log");
  appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, { encoding: "utf8" });
}

function startBackend() {
  const packagedEntry = firstExistingPath([
    path.resolve(process.resourcesPath, "packaged", "api-server", "index.mjs"),
    path.resolve(app.getAppPath(), "packaged", "api-server", "index.mjs"),
    path.resolve(app.getAppPath(), "api-server", "dist", "index.mjs"),
    path.resolve(app.getAppPath(), "artifacts", "api-server", "dist", "index.mjs"),
  ]);
  const unpackedEntry = firstExistingPath([
    path.resolve(process.resourcesPath, "app.asar.unpacked", "packaged", "api-server", "index.mjs"),
    path.resolve(process.resourcesPath, "app.asar.unpacked", "api-server", "dist", "index.mjs"),
    path.resolve(process.resourcesPath, "app.asar.unpacked", "artifacts", "api-server", "dist", "index.mjs"),
  ]);
  const devEntry = path.resolve(__dirname, "..", "..", "api-server", "dist", "index.mjs");

  const backendEntry = app.isPackaged
    ? (packagedEntry ?? unpackedEntry)
    : devEntry;

  if (!backendEntry) {
    logStartupError("Unable to locate the packaged backend entry point.");
    return;
  }

  const userDataDir = app.getPath("userData");
  const dbPath = path.join(userDataDir, "nibir-fashion.sqlite");
  const backendLogPath = path.join(userDataDir, "backend-error.log");
  const packagedNodeModules = path.resolve(app.getAppPath(), "node_modules");
  const nodePath = process.env.NODE_PATH
    ? `${packagedNodeModules}${path.delimiter}${process.env.NODE_PATH}`
    : packagedNodeModules;

  backendProcess = spawn(process.execPath, [backendEntry], {
    stdio: ["ignore", "ignore", "pipe"],
    detached: false,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: "3001",
      SQLITE_DB_PATH: dbPath,
      NODE_PATH: nodePath,
    },
  });

  backendProcess.stderr?.on("data", (chunk) => {
    appendFileSync(backendLogPath, String(chunk), { encoding: "utf8" });
  });

  backendProcess.on("exit", (code, signal) => {
    if (code !== 0) {
      appendFileSync(
        backendLogPath,
        `Backend exited with code=${String(code)} signal=${String(signal)}\n`,
        { encoding: "utf8" },
      );
    }
  });

  backendProcess.on("error", (err) => {
    writeFileSync(backendLogPath, String(err), { encoding: "utf8" });
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const logPath = path.join(app.getPath("userData"), "frontend-error.log");

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    writeFileSync(
      logPath,
      `did-fail-load\ncode=${errorCode}\ndescription=${errorDescription}\nurl=${validatedURL}\n`,
      { encoding: "utf8" },
    );
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    writeFileSync(
      logPath,
      `render-process-gone\nreason=${details.reason}\nexitCode=${details.exitCode}\n`,
      { encoding: "utf8" },
    );
  });

  if (app.isPackaged) {
    const entry = firstExistingPath([
      path.resolve(process.resourcesPath, "packaged", "nibir-fashion", "index.html"),
      path.resolve(app.getAppPath(), "packaged", "nibir-fashion", "index.html"),
      path.resolve(app.getAppPath(), "nibir-fashion", "dist", "public", "index.html"),
      path.resolve(app.getAppPath(), "artifacts", "nibir-fashion", "dist", "public", "index.html"),
    ]);

    if (!entry) {
      const errorPath = path.join(app.getPath("userData"), "frontend-load-error.log");
      writeFileSync(errorPath, "Unable to locate packaged frontend index.html", { encoding: "utf8" });
      void win.loadURL("data:text/html,<h2>Frontend files not found</h2><p>Check frontend-load-error.log</p>");
      return;
    }

    void win.loadFile(entry).catch((err) => {
      const errorPath = path.join(app.getPath("userData"), "frontend-load-error.log");
      writeFileSync(errorPath, String(err), { encoding: "utf8" });
    });
  } else {
    void win.loadURL("http://localhost:5173/");
  }

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      writeFileSync(
        logPath,
        `console-message\nlevel=${level}\nmessage=${message}\nline=${line}\nsource=${sourceId}\n`,
        { encoding: "utf8" },
      );
    }
  });
}

app.whenReady().then(() => {
  startBackend();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}).catch((err) => {
  logStartupError(`app.whenReady failed: ${String(err)}`);
});

process.on("uncaughtException", (err) => {
  logStartupError(`uncaughtException: ${String(err)}`);
});

process.on("unhandledRejection", (reason) => {
  logStartupError(`unhandledRejection: ${String(reason)}`);
});

app.on("window-all-closed", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
