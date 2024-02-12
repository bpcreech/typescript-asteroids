import { resolve } from "path";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import eslint from "vite-plugin-eslint";

const config = {
  base: "./",
  plugins: [
    checker({
      // e.g. use TypeScript check
      typescript: true,
    }),
    eslint(),
  ],
};

const libMode = JSON.parse(process.env.LIB_MODE || "false");
if (libMode) {
  config.build = {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/game.ts"),
      name: "ts-asteroids",
      // the proper extensions will be added
      fileName: "ts-asteroids",
    },
  };
}

export default defineConfig(config);
