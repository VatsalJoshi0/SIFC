import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    fileParallelism: false,
    server: {
      deps: {
        inline: true
      }
    }
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@vai/shared": path.resolve(__dirname, "./packages/shared/src")
    }
  }
});
