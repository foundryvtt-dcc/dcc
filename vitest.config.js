import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/browser-tests/**'
    ],
    projects: [
      // Existing mock-based unit tests (unchanged)
      {
        test: {
          name: 'unit',
          include: ['module/__tests__/**/*.test.js'],
          exclude: ['**/node_modules/**', '**/browser-tests/**']
        }
      },
      // Integration tests using real Foundry common/ modules
      {
        test: {
          name: 'integration',
          include: ['module/__integration__/**/*.test.js'],
          setupFiles: ['module/__integration__/setup-foundry.js']
        }
      }
    ]
  }
})
