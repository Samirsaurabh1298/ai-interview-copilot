import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});

