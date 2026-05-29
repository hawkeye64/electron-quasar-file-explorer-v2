import { defineConfig } from "@quasar/app-vite";

const devBundledElectronDeps = new Set(["fs-extra", "mime"]);

function bundleElectronDepsForDev(cfg: { external?: unknown }, dev: boolean) {
  if (dev !== true || Array.isArray(cfg.external) !== true) {
    return;
  }

  cfg.external = cfg.external.filter((dependency) => {
    return typeof dependency !== "string" || devBundledElectronDeps.has(dependency) !== true;
  });
}

export default defineConfig((ctx) => {
  return {
    boot: [],
    css: ["app.sass"],

    extras: ["roboto-font", "material-icons"],

    build: {
      target: {
        browser: ["es2022", "firefox115", "chrome115", "safari14"],
        node: "node24",
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
      port: 8080,
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

      extendElectronMainConf(cfg) {
        bundleElectronDepsForDev(cfg, ctx.dev === true);
      },

      extendElectronPreloadConf(cfg) {
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
        },
        win: {
          target: "nsis",
        },
      },
    },
  };
});
