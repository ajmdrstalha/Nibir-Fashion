"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = require("node:fs");
const node_child_process_1 = require("node:child_process");
let backendProcess = null;
const gotSingleInstanceLock = electron_1.app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", () => {
        const [mainWindow] = electron_1.BrowserWindow.getAllWindows();
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
function firstExistingPath(candidates) {
    return candidates.find((candidate) => (0, node_fs_1.existsSync)(candidate));
}
function logStartupError(message) {
    const logPath = node_path_1.default.join(electron_1.app.getPath("userData"), "startup-error.log");
    (0, node_fs_1.appendFileSync)(logPath, `${new Date().toISOString()} ${message}\n`, { encoding: "utf8" });
}
function startBackend() {
    const packagedEntry = firstExistingPath([
        node_path_1.default.resolve(process.resourcesPath, "packaged", "api-server", "index.mjs"),
        node_path_1.default.resolve(electron_1.app.getAppPath(), "packaged", "api-server", "index.mjs"),
        node_path_1.default.resolve(electron_1.app.getAppPath(), "api-server", "dist", "index.mjs"),
        node_path_1.default.resolve(electron_1.app.getAppPath(), "artifacts", "api-server", "dist", "index.mjs"),
    ]);
    const unpackedEntry = firstExistingPath([
        node_path_1.default.resolve(process.resourcesPath, "app.asar.unpacked", "packaged", "api-server", "index.mjs"),
        node_path_1.default.resolve(process.resourcesPath, "app.asar.unpacked", "api-server", "dist", "index.mjs"),
        node_path_1.default.resolve(process.resourcesPath, "app.asar.unpacked", "artifacts", "api-server", "dist", "index.mjs"),
    ]);
    const devEntry = node_path_1.default.resolve(__dirname, "..", "..", "api-server", "dist", "index.mjs");
    const backendEntry = electron_1.app.isPackaged
        ? (packagedEntry ?? unpackedEntry)
        : devEntry;
    if (!backendEntry) {
        logStartupError("Unable to locate the packaged backend entry point.");
        return;
    }
    const userDataDir = electron_1.app.getPath("userData");
    const dbPath = node_path_1.default.join(userDataDir, "nibir-fashion.sqlite");
    const backendLogPath = node_path_1.default.join(userDataDir, "backend-error.log");
    const packagedNodeModules = node_path_1.default.resolve(electron_1.app.getAppPath(), "node_modules");
    const nodePath = process.env.NODE_PATH
        ? `${packagedNodeModules}${node_path_1.default.delimiter}${process.env.NODE_PATH}`
        : packagedNodeModules;
    backendProcess = (0, node_child_process_1.spawn)(process.execPath, [backendEntry], {
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
        (0, node_fs_1.appendFileSync)(backendLogPath, String(chunk), { encoding: "utf8" });
    });
    backendProcess.on("exit", (code, signal) => {
        if (code !== 0) {
            (0, node_fs_1.appendFileSync)(backendLogPath, `Backend exited with code=${String(code)} signal=${String(signal)}\n`, { encoding: "utf8" });
        }
    });
    backendProcess.on("error", (err) => {
        (0, node_fs_1.writeFileSync)(backendLogPath, String(err), { encoding: "utf8" });
    });
}
function createMainWindow() {
    const win = new electron_1.BrowserWindow({
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
    const logPath = node_path_1.default.join(electron_1.app.getPath("userData"), "frontend-error.log");
    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        (0, node_fs_1.writeFileSync)(logPath, `did-fail-load\ncode=${errorCode}\ndescription=${errorDescription}\nurl=${validatedURL}\n`, { encoding: "utf8" });
    });
    win.webContents.on("render-process-gone", (_event, details) => {
        (0, node_fs_1.writeFileSync)(logPath, `render-process-gone\nreason=${details.reason}\nexitCode=${details.exitCode}\n`, { encoding: "utf8" });
    });
    if (electron_1.app.isPackaged) {
        const entry = firstExistingPath([
            node_path_1.default.resolve(process.resourcesPath, "packaged", "nibir-fashion", "index.html"),
            node_path_1.default.resolve(electron_1.app.getAppPath(), "packaged", "nibir-fashion", "index.html"),
            node_path_1.default.resolve(electron_1.app.getAppPath(), "nibir-fashion", "dist", "public", "index.html"),
            node_path_1.default.resolve(electron_1.app.getAppPath(), "artifacts", "nibir-fashion", "dist", "public", "index.html"),
        ]);
        if (!entry) {
            const errorPath = node_path_1.default.join(electron_1.app.getPath("userData"), "frontend-load-error.log");
            (0, node_fs_1.writeFileSync)(errorPath, "Unable to locate packaged frontend index.html", { encoding: "utf8" });
            void win.loadURL("data:text/html,<h2>Frontend files not found</h2><p>Check frontend-load-error.log</p>");
            return;
        }
        void win.loadFile(entry).catch((err) => {
            const errorPath = node_path_1.default.join(electron_1.app.getPath("userData"), "frontend-load-error.log");
            (0, node_fs_1.writeFileSync)(errorPath, String(err), { encoding: "utf8" });
        });
    }
    else {
        void win.loadURL("http://localhost:5173/");
    }
    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
        if (level >= 2) {
            (0, node_fs_1.writeFileSync)(logPath, `console-message\nlevel=${level}\nmessage=${message}\nline=${line}\nsource=${sourceId}\n`, { encoding: "utf8" });
        }
    });
}
electron_1.app.whenReady().then(() => {
    startBackend();
    createMainWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
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
electron_1.app.on("window-all-closed", () => {
    if (backendProcess && !backendProcess.killed) {
        backendProcess.kill();
        backendProcess = null;
    }
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
