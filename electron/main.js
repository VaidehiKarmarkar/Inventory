const { app, BrowserWindow } = require("electron");

// Set default environment variables for packaged desktop app
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.qqfvfizhzfkthhlqrahv:JukxPJpwCyyUruXm@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
process.env.DB_SSL = process.env.DB_SSL || "true";
process.env.DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED || "false";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "optima-godown-billing-secret-key-12345";
process.env.PORT = process.env.PORT || "8080";

// Start Express Node Server
require("../artifacts/api-server/dist/index.mjs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL("http://localhost:8080");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
