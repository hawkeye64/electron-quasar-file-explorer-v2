import { spawn } from "node:child_process";

const env = { ...process.env };

// Quasar launches the Electron binary; if this leaks in from a parent shell,
// Electron behaves like plain Node and its app/browser APIs are empty.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn("quasar", ["dev", "-m", "electron"], {
  env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
