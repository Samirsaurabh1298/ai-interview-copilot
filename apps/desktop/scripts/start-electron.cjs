const { spawn } = require("node:child_process");
const electronPath = require("electron");

// Ensure ELECTRON_RUN_AS_NODE is stripped so Electron runs in GUI app mode
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ["."], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  windowsHide: false,
});

child.on("close", (code) => {
  process.exit(code || 0);
});

child.on("error", (err) => {
  console.error("Failed to start Electron child process:", err);
  process.exit(1);
});
