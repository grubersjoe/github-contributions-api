import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: 'verbose',
    silent: true,
    testTimeout: 5000,
  },
})
