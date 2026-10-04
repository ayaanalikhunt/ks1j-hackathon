import { defineConfig } from "vitest/config";

// The rules suite and the lifecycle suite share one emulator, so run the files one at a time.
export default defineConfig({ test: { fileParallelism: false, testTimeout: 30000, hookTimeout: 30000 } });
