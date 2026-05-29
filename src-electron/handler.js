import { app, ipcMain, shell } from "electron";
import os from "node:os";
import path from "node:path";
import { pathExists, readFileSync } from "fs-extra";
import mime from "mime";

import walkFolders from "./walkFolders.js";
import windowsDrives from "./getWindowsDrives.js";

// Every channel registered here is exposed through electron-preload.js. Keeping
// filesystem work in the main process lets the renderer stay sandbox-friendly.
export function useHandler() {
  ipcMain.handle("myShell:walkFolders", async (_event, requestedPath) => {
    const folders = [];
    for (const fileInfo of walkFolders(requestedPath)) {
      if (fileInfo.isDir && !fileInfo.error) {
        // QTree treats children: [] as "expandable"; the renderer lazy-loads
        // the actual children only when the user opens that branch.
        fileInfo.children = [];
      }
      folders.push(fileInfo);
    }
    return folders;
  });

  ipcMain.handle("myShell:windowsDrives", async () => {
    return new Promise((resolve, reject) => {
      const localDrives = [];
      windowsDrives((error, drives) => {
        if (!error) {
          localDrives.splice(0, localDrives.length, ...drives);
          resolve(localDrives);
        } else {
          console.error(error);
          reject(error);
        }
      });
    });
  });

  ipcMain.handle("myShell:shortcutFolders", async () => {
    // app.getPath normalizes common OS folders across Windows, macOS, and Linux.
    const home = app.getPath("home");
    const desktop = app.getPath("desktop");
    const document = app.getPath("documents");
    const download = app.getPath("downloads");
    const picture = app.getPath("pictures");
    const audio = app.getPath("music");
    const video = app.getPath("videos");

    const shortcuts = {
      home,
      desktop,
      document,
      download,
      picture,
      audio,
      video,
    };

    return shortcuts;
  });

  ipcMain.handle("myShell:sep", async () => {
    return path.sep;
  });

  ipcMain.handle("myShell:platform", async () => {
    return os.platform();
  });

  ipcMain.handle("myShell:pathExists", async (_event, requestedPath) => {
    return await pathExists(requestedPath);
  });

  ipcMain.handle("myShell:openFile", async (_event, requestedPath) => {
    // Delegate opening to the operating system's default application.
    return await shell.openPath(requestedPath);
  });

  ipcMain.handle("myShell:readFile", async (_event, requestedPath) => {
    // Used by the renderer to create image thumbnails from local files.
    return readFileSync(requestedPath);
  });

  ipcMain.handle("myShell:getMimeType", async (_event, requestedPath) => {
    return mime.getType(requestedPath);
  });
}
