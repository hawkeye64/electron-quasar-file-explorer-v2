const devBundledElectronDeps = new Set(["mime"]);

interface ElectronBuildConfig {
  external?: unknown;
}

interface QuasarConfigContext {
  dev: boolean;
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
        bundleElectronDepsForDev(cfg, ctx.dev === true);
      },

      extendElectronPreloadConf(cfg: ElectronBuildConfig) {
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
