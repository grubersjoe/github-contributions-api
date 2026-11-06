import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/github.test.ts'],
    reporters: 'verbose',
    retry: 2, // GitHub can be slow or throttle temporarily
    silent: true,
    testTimeout: 10000,
  },
})
