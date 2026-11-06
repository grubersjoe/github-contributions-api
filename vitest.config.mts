import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/app.test.ts'],
    reporters: 'verbose',
    silent: true,
    testTimeout: 5000,
  },
})
