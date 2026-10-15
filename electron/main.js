const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');

const logDir = path.join(process.env.APPDATA || process.cwd(), 'OptimaGodown');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'app.log');
function logMsg(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) {}
  console.log(...args);
}

logMsg('=== Application Launch (Supabase Cloud Edition) ===');

// Ensure single instance lock so multiple launches don't conflict
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logMsg('Another instance is already running; focusing it and exiting secondary instance.');
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let serverProcess = null;
let currentPort = 8080;

app.on('second-instance', () => {
  logMsg('Second instance detected — restoring and focusing main window.');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function getAvailablePort(startPort = 8080) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      resolve(getAvailablePort(startPort + 1));
    });
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function findServerScript() {
  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked/artifacts/api-server/dist/index.mjs'),
    path.join(__dirname, '../artifacts/api-server/dist/index.mjs').replace('app.asar', 'app.asar.unpacked'),
    path.join(__dirname, '../artifacts/api-server/dist/index.mjs'),
    path.join(process.resourcesPath, 'app/artifacts/api-server/dist/index.mjs'),
    path.join(process.resourcesPath, 'artifacts/api-server/dist/index.mjs'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) {}
  }
  return candidates[0];
}

function findStaticDir() {
  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked/artifacts/billing-app/dist/public'),
    path.join(__dirname, '../artifacts/billing-app/dist/public').replace('app.asar', 'app.asar.unpacked'),
    path.join(process.resourcesPath, 'app/artifacts/billing-app/dist/public'),
    path.join(__dirname, '../artifacts/billing-app/dist/public'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) {}
  }
  return path.join(__dirname, '../artifacts/billing-app/dist/public');
}

function startServer(port) {
  const serverScript = findServerScript();
  const staticDir = findStaticDir();
  logMsg(`Server script path: ${serverScript}`);
  logMsg(`Static dir path: ${staticDir}`);

  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres.qqfvfizhzfkthhlqrahv:JukxPJpwCyyUruXm@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
    DB_SSL: process.env.DB_SSL || "true",
    DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED || "false",
    SESSION_SECRET: process.env.SESSION_SECRET || "optima-godown-billing-secret-key-12345",
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    NODE_ENV: 'production',
    ELECTRON_APP_DATA: 'true',
    COOKIE_SECURE: 'false',
    STATIC_DIR: staticDir,
  };

  serverProcess = fork(serverScript, [], {
    env,
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data) => {
    logMsg(`[API-SERVER]: ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    logMsg(`[API-SERVER-ERR]: ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code, signal) => {
    logMsg(`API Server process exited with code ${code}, signal ${signal}`);
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
        setTimeout(check, 300);
      }
    };

    check();
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Aloha Crystal World - Inventory & Billing',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function killServer() {
  if (serverProcess) {
    try {
      if (process.platform === 'win32' && serverProcess.pid) {
        require('child_process').execSync(`taskkill /pid ${serverProcess.pid} /T /F`);
      } else {
        serverProcess.kill('SIGKILL');
      }
    } catch (e) {}
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    currentPort = await getAvailablePort(8080);
    logMsg(`Selected port: ${currentPort}`);
    startServer(currentPort);
    logMsg(`Waiting for server at http://127.0.0.1:${currentPort}/api/healthz...`);
    await waitForServer(`http://127.0.0.1:${currentPort}/api/healthz`, 25000);
    logMsg('Server is responding! Creating main window...');
    createWindow(currentPort);
  } catch (err) {
    logMsg(`Startup failed: ${err.message}`);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to launch Supabase Cloud Database service.\n\nError: ${err.message}`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(currentPort);
    }
  });
});

app.on('window-all-closed', () => {
  killServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  killServer();
});
