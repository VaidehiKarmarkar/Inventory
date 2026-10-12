const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

let mainWindow = null;
let serverProcess = null;
const PORT = 8080;

function findServerScript() {
  const candidates = [
    path.join(__dirname, '../artifacts/api-server/dist/index.mjs'),
    path.join(process.resourcesPath, 'app/artifacts/api-server/dist/index.mjs'),
    path.join(process.resourcesPath, 'artifacts/api-server/dist/index.mjs'),
  ];
  for (const candidate of candidates) {
    try {
      if (require('fs').existsSync(candidate)) {
        return candidate;
      }
    } catch (e) {}
  }
  return candidates[0];
}

function startServer() {
  const serverScript = findServerScript();
  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'production',
    ELECTRON_APP_DATA: 'true',
    COOKIE_SECURE: 'false',
  };

  serverProcess = fork(serverScript, [], {
    env,
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`[API-SERVER]: ${data}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`[API-SERVER-ERR]: ${data}`);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`API Server process exited with code ${code}, signal ${signal}`);
  });
}

function waitForServer(url, timeoutMs = 25000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', () => {
        retry();
      });
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Server failed to start within ${timeoutMs}ms`));
      } else {
        setTimeout(check, 400);
      }
    };

    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'OptimaGodown - Inventory & Billing',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startServer();
  try {
    await waitForServer(`http://127.0.0.1:${PORT}/api/healthz`, 25000);
  } catch (err) {
    console.error("Waiting for server failed:", err);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {}
  }
});
