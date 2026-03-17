import { defineConfig } from 'vitest/config'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Check if Foundry is available for integration tests
function isFoundryAvailable () {
  // Check FOUNDRY_PATH env var
  if (process.env.FOUNDRY_PATH) {
    return fs.existsSync(path.join(process.env.FOUNDRY_PATH, 'common'))
  }
  // Check .foundry-dev/ in project root
  if (fs.existsSync(path.join(import.meta.dirname, '.foundry-dev', 'common'))) {
    return true
  }
  // Check known local paths
  const knownPaths = [
    path.join(os.homedir(), 'Applications', 'foundry-13'),
    path.join(os.homedir(), 'Applications', 'foundryvtt'),
    '/Applications/FoundryVTT',
    path.join(os.homedir(), 'foundryvtt'),
    path.join(os.homedir(), '.local', 'share', 'FoundryVTT'),
    '/opt/foundryvtt'
  ]
  return knownPaths.some(p => fs.existsSync(path.join(p, 'common')))
}

const foundryAvailable = isFoundryAvailable()
if (!foundryAvailable) {
  console.log('[vitest] Foundry VTT not found — skipping integration tests')
  console.log('[vitest] Run "npm run setup:foundry" to enable them')
}

const projects = [
  // Existing mock-based unit tests (always run)
  {
    test: {
      name: 'unit',
      include: ['module/__tests__/**/*.test.js'],
      exclude: ['**/node_modules/**', '**/browser-tests/**']
    }
  }
]

// Only include integration tests if Foundry is available
if (foundryAvailable) {
  projects.push({
    test: {
      name: 'integration',
      include: ['module/__integration__/**/*.test.js'],
      setupFiles: ['module/__integration__/setup-foundry.js']
    }
  })
}

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/browser-tests/**'
    ],
    projects
  }
})
