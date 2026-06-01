import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const devBundledElectronDeps = new Set(["mime"]);

interface ElectronBuildConfig {
  external?: unknown;
  resolve?: {
    alias?: Record<string, string>;
  };
}

interface QuasarConfigContext {
  dev: boolean;
}

function toPosixPath(filePath: string) {
  return filePath.replaceAll("\\", "/");
}

function patchElectronRuntimeAliasesForWindows(cfg: ElectronBuildConfig) {
  if (process.platform !== "win32") {
    return;
  }

  const appViteDir = dirname(require.resolve("@quasar/app-vite/package.json"));

  cfg.resolve ??= {};

  // Temporary diagnostic for app-vite beta.35 Windows Electron builds.
  // Linux/macOS keep using the intended package export resolution path.
  const runtimeAliases = {
    "#q-app/electron/main": toPosixPath(join(appViteDir, "exports/electron/main-runtime.js")),
    "#q-app/electron/preload": toPosixPath(join(appViteDir, "exports/electron/preload-runtime.js")),
  };

  // Rolldown resolves aliases in declaration order, so the specific Electron
  // aliases must be listed before the broader default "#q-app" alias.
  cfg.resolve.alias = {
    ...runtimeAliases,
    ...cfg.resolve.alias,
  };
}

function bundleElectronDepsForDev(cfg: ElectronBuildConfig, dev: boolean) {
  // Dev main/preload output runs from .quasar, so bundle src-electron deps that
  // would otherwise resolve only from src-electron/node_modules.
  if (dev !== true || Array.isArray(cfg.external) !== true) {
    return;
  }

  cfg.external = cfg.external.filter((dependency) => {
    return typeof dependency !== "string" || devBundledElectronDeps.has(dependency) !== true;
  });
}

export default function (ctx: QuasarConfigContext) {
  return {
    boot: [],
    css: ["app.sass"],

    extras: ["roboto-font", "material-icons"],

    build: {
      target: {
        browser: ["es2022", "firefox115", "chrome115", "safari14"],
        node: "node24",
      },

      typescript: {
        strict: true,
        vueShim: true,
      },

      vueRouterMode: "hash",

      vitePlugins: [
        [
          "vite-plugin-checker",
          {
            vueTsc: true,
          },
          { server: false },
        ],
      ],
    },

    devServer: {
      open: true,
    },

    framework: {
      config: {},
      plugins: [],
    },

    animations: [],

    sourceFiles: {
      electronMain: "src-electron/electron-main",
    },

    electron: {
      preloadScripts: ["electron-preload"],
      inspectPort: 5858,
      bundler: "builder",

      extendElectronMainConf(cfg: ElectronBuildConfig) {
        patchElectronRuntimeAliasesForWindows(cfg);
        bundleElectronDepsForDev(cfg, ctx.dev === true);
      },

      extendElectronPreloadConf(cfg: ElectronBuildConfig) {
        patchElectronRuntimeAliasesForWindows(cfg);
        bundleElectronDepsForDev(cfg, ctx.dev === true);
      },

      builder: {
        appId: "electron-quasar-file-explorer-v2",
        electronVersion: "42.3.0",
        productName: "File Explorer",
        linux: {
          category: "Utility",
          target: "AppImage",
        },
        mac: {
          target: "default",
          // This sample app is intended for learning and CI validation, not
          // signed distribution. Disable auto-signing so macOS builds are repeatable.
          identity: null,
        },
        win: {
          target: "nsis",
        },
      },
    },
  };
}
