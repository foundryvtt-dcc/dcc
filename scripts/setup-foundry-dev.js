#!/usr/bin/env node
/**
 * Setup script for Foundry VTT integration tests
 *
 * Populates .foundry-dev/ with Foundry's common/ modules needed for testing.
 * Similar to how Playwright installs browsers into the project.
 *
 * Usage:
 *   node scripts/setup-foundry-dev.js                    # Auto-detect from known paths
 *   node scripts/setup-foundry-dev.js --source ~/path    # Copy from specific install
 *   node scripts/setup-foundry-dev.js --download         # Download from foundryvtt.com
 *
 * Resolution order for auto-detect:
 *   1. FOUNDRY_PATH environment variable
 *   2. .foundry-dev/ already populated
 *   3. Known local install paths (~/Applications/foundry-*)
 *
 * Download auth (same approach as felddy/foundryvtt-docker):
 *   - FOUNDRY_RELEASE_URL: presigned URL from your Purchased Licenses page
 *   - FOUNDRY_USERNAME + FOUNDRY_PASSWORD: website credentials (cookie-based auth)
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..')
const FOUNDRY_DEV_DIR = path.join(PROJECT_ROOT, '.foundry-dev')
const VERSION_FILE = path.join(FOUNDRY_DEV_DIR, '.foundry-version')

// What we copy from a Foundry install - common/ layer plus client/dice for dice engine
const REQUIRED_DIRS = ['common']

// Optional directories to copy when present (v14+)
const OPTIONAL_DIRS = ['client/dice', 'common/primitives']

// Default Foundry build to download (latest stable v13)
const DEFAULT_BUILD = '351'

// Known local install paths to search (in order of preference)
const KNOWN_PATHS = [
  // Explicitly set env var
  process.env.FOUNDRY_PATH,
  // macOS locations (v14 preferred over v13)
  path.join(os.homedir(), 'Applications', 'foundry-14'),
  path.join(os.homedir(), 'Applications', 'foundry-13'),
  path.join(os.homedir(), 'Applications', 'foundryvtt'),
  '/Applications/FoundryVTT',
  // Linux locations
  path.join(os.homedir(), 'foundryvtt'),
  path.join(os.homedir(), '.local', 'share', 'FoundryVTT'),
  '/opt/foundryvtt',
  // Windows-ish (WSL) locations
  path.join(os.homedir(), 'AppData', 'Local', 'FoundryVTT')
].filter(Boolean)

const BASE_URL = 'https://foundryvtt.com'

// ============================================================================
// Argument parsing
// ============================================================================

function parseArgs () {
  const args = process.argv.slice(2)
  const options = { source: null, download: false, help: false, force: false, build: DEFAULT_BUILD }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
      case '-s':
        options.source = args[++i]
        break
      case '--download':
      case '-d':
        options.download = true
        break
      case '--build':
      case '-b':
        options.build = args[++i]
        break
      case '--force':
      case '-f':
        options.force = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
    }
  }
  return options
}

function printHelp () {
  console.log(`
Setup Foundry VTT for integration tests

Populates .foundry-dev/ with Foundry's common/ modules, similar to how
Playwright installs browsers. Only the common/ layer is needed (~1.5 MB).

Usage:
  node scripts/setup-foundry-dev.js [options]

Options:
  --source, -s <path>  Copy from a specific Foundry VTT installation
  --download, -d       Download from foundryvtt.com
  --build, -b <num>    Foundry build number to download (default: ${DEFAULT_BUILD})
  --force, -f          Overwrite existing .foundry-dev/ directory
  --help, -h           Show this help

Environment variables:
  FOUNDRY_PATH          Path to a Foundry VTT installation (highest priority)
  FOUNDRY_RELEASE_URL   Presigned download URL from your Purchased Licenses page
  FOUNDRY_USERNAME      foundryvtt.com username (for --download with credentials)
  FOUNDRY_PASSWORD      foundryvtt.com password (for --download with credentials)

Auto-detect searches these paths (in order):
  $FOUNDRY_PATH
  ~/Applications/foundry-14
  ~/Applications/foundry-13
  ~/Applications/foundryvtt
  /Applications/FoundryVTT
  ~/foundryvtt
  ~/.local/share/FoundryVTT
  /opt/foundryvtt

Examples:
  # Auto-detect from known local install
  node scripts/setup-foundry-dev.js

  # Copy from specific install
  node scripts/setup-foundry-dev.js --source ~/Applications/foundry-13

  # Download with presigned URL (from foundryvtt.com Purchased Licenses)
  FOUNDRY_RELEASE_URL="https://..." node scripts/setup-foundry-dev.js --download

  # Download with credentials
  FOUNDRY_USERNAME=me FOUNDRY_PASSWORD=pw node scripts/setup-foundry-dev.js --download

  # Download specific build
  node scripts/setup-foundry-dev.js --download --build 351
`)
}

// ============================================================================
// Foundry detection helpers
// ============================================================================

function getFoundryVersion (foundryPath) {
  const pkgPath = path.join(foundryPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  return {
    version: pkg.version,
    generation: pkg.release?.generation,
    build: pkg.release?.build
  }
}

function findFoundryInstall () {
  for (const searchPath of KNOWN_PATHS) {
    const commonDir = path.join(searchPath, 'common')
    if (fs.existsSync(commonDir)) {
      const version = getFoundryVersion(searchPath)
      if (version) {
        return { path: searchPath, version }
      }
    }
  }
  return null
}

// ============================================================================
// File system helpers
// ============================================================================

function copyDirectory (src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function countFiles (dir) {
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name))
    } else {
      count++
    }
  }
  return count
}

function getDirSize (dir) {
  let size = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      size += getDirSize(fullPath)
    } else {
      size += fs.statSync(fullPath).size
    }
  }
  return size
}

function formatSize (bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================================
// Copy from local install
// ============================================================================

function copyFromInstall (foundryPath) {
  const version = getFoundryVersion(foundryPath)
  if (!version) {
    console.error(`Error: Could not read Foundry version from ${foundryPath}/package.json`)
    process.exit(1)
  }

  console.log(`Found Foundry VTT v${version.version} at ${foundryPath}`)

  for (const dir of REQUIRED_DIRS) {
    const src = path.join(foundryPath, dir)
    const dest = path.join(FOUNDRY_DEV_DIR, dir)

    if (!fs.existsSync(src)) {
      console.error(`Error: Required directory not found: ${src}`)
      process.exit(1)
    }

    console.log(`  Copying ${dir}/...`)
    copyDirectory(src, dest)
  }

  // Copy optional directories when present
  for (const dir of OPTIONAL_DIRS) {
    const src = path.join(foundryPath, dir)
    if (fs.existsSync(src)) {
      const dest = path.join(FOUNDRY_DEV_DIR, dir)
      console.log(`  Copying ${dir}/...`)
      copyDirectory(src, dest)
    }
  }

  // Also copy package.json for version tracking
  fs.copyFileSync(
    path.join(foundryPath, 'package.json'),
    path.join(FOUNDRY_DEV_DIR, 'package.json')
  )

  // If client/dice was copied, pre-compile the PEG grammar
  const grammarPath = path.join(FOUNDRY_DEV_DIR, 'client', 'dice', 'grammar.pegjs')
  if (fs.existsSync(grammarPath)) {
    compilePegGrammar(foundryPath, grammarPath)
  }

  // Write version marker
  fs.writeFileSync(VERSION_FILE, JSON.stringify(version, null, 2) + '\n')

  const fileCount = countFiles(FOUNDRY_DEV_DIR)
  const size = getDirSize(FOUNDRY_DEV_DIR)
  console.log(`\nDone! Copied ${fileCount} files (${formatSize(size)}) to .foundry-dev/`)
  console.log(`Foundry version: v${version.version} (gen ${version.generation}, build ${version.build})`)
}

// ============================================================================
// PEG grammar compilation
// ============================================================================

function compilePegGrammar (foundryPath, grammarPath) {
  console.log('  Compiling PEG grammar...')

  // Use peggy from Foundry's own node_modules (run in-place to resolve its dependencies)
  const peggyPath = path.join(foundryPath, 'node_modules', 'peggy', 'lib', 'peg.js')
  if (!fs.existsSync(peggyPath)) {
    console.warn('  Warning: peggy not found in Foundry node_modules, skipping grammar compilation')
    return
  }

  const outputPath = grammarPath.replace('grammar.pegjs', 'grammar.compiled.mjs')

  try {
    // Run the compilation from the Foundry install dir so peggy can find its own dependencies
    const compileScript = `
      import peggy from '${peggyPath.replace(/\\/g, '/')}';
      import fs from 'node:fs';
      const grammar = fs.readFileSync('${grammarPath.replace(/\\/g, '/')}', 'utf-8');
      const parser = peggy.generate(grammar, { output: 'source', format: 'es' });
      fs.writeFileSync('${outputPath.replace(/\\/g, '/')}', parser);
    `

    execSync(`node --input-type=module -e "${compileScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      stdio: 'pipe',
      cwd: foundryPath
    })

    // The compiled grammar exports { parse } as a named export, but _module.mjs
    // expects a default import. Add a default export wrapper.
    const compiledPath = path.join(FOUNDRY_DEV_DIR, 'client', 'dice', 'grammar.compiled.mjs')
    let compiledContent = fs.readFileSync(compiledPath, 'utf-8')
    compiledContent += '\nexport default { parse: peg$parse };\n'
    fs.writeFileSync(compiledPath, compiledContent)

    // Patch _module.mjs to import compiled grammar instead of .pegjs
    const modulePath = path.join(FOUNDRY_DEV_DIR, 'client', 'dice', '_module.mjs')
    let moduleContent = fs.readFileSync(modulePath, 'utf-8')
    moduleContent = moduleContent.replace(
      'import Parser from "./grammar.pegjs"',
      'import Parser from "./grammar.compiled.mjs"'
    )
    fs.writeFileSync(modulePath, moduleContent)

    console.log('  PEG grammar compiled successfully')
  } catch (err) {
    console.warn(`  Warning: PEG grammar compilation failed: ${err.message}`)
    console.warn('  Dice engine will not be available in integration tests')
  }
}

// ============================================================================
// Download from foundryvtt.com
// Follows the same auth flow as felddy/foundryvtt-docker:
//   1. Presigned URL (FOUNDRY_RELEASE_URL) — simplest, no auth needed
//   2. Cookie-based website login → fetch presigned URL → download
// ============================================================================

async function downloadFoundry (build) {
  let downloadUrl = process.env.FOUNDRY_RELEASE_URL

  if (!downloadUrl) {
    // Need to authenticate and get a presigned URL
    downloadUrl = await getPresignedUrl(build)
  } else {
    console.log('Using presigned URL from FOUNDRY_RELEASE_URL')
  }

  console.log('Downloading Foundry VTT...')

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-'))
  try {
    const zipPath = path.join(tmpDir, 'foundryvtt.zip')

    const zipResponse = await fetch(downloadUrl, { redirect: 'follow' })
    if (!zipResponse.ok) {
      console.error(`Download failed: ${zipResponse.status} ${zipResponse.statusText}`)
      process.exit(1)
    }

    const buffer = Buffer.from(await zipResponse.arrayBuffer())
    fs.writeFileSync(zipPath, buffer)
    console.log(`Downloaded ${formatSize(buffer.length)}`)

    // Extract common/, client/dice/, and package.json
    console.log('Extracting modules...')
    const extractDir = path.join(tmpDir, 'extracted')
    fs.mkdirSync(extractDir, { recursive: true })

    execSync(`unzip -q "${zipPath}" "common/*" "client/dice/*" "package.json" -d "${extractDir}"`, {
      stdio: 'pipe'
    })

    copyFromInstall(extractDir)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * Authenticate with foundryvtt.com and get a presigned download URL.
 * Uses the website cookie-based auth flow (same as felddy/foundryvtt-docker).
 */
async function getPresignedUrl (build) {
  const username = process.env.FOUNDRY_USERNAME
  const password = process.env.FOUNDRY_PASSWORD

  if (!username || !password) {
    console.error('Error: --download requires authentication.')
    console.error('')
    console.error('Provide one of:')
    console.error('  FOUNDRY_RELEASE_URL  - presigned URL from Purchased Licenses page')
    console.error('  FOUNDRY_USERNAME + FOUNDRY_PASSWORD - website credentials')
    process.exit(1)
  }

  // Step 1: Get CSRF token from the login page
  console.log('Fetching CSRF token...')
  const pageResponse = await fetch(BASE_URL, { redirect: 'follow' })
  if (!pageResponse.ok) {
    console.error(`Failed to fetch login page: ${pageResponse.status}`)
    process.exit(1)
  }

  const pageText = await pageResponse.text()
  const csrfMatch = pageText.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)
  if (!csrfMatch) {
    console.error('Could not find CSRF token on login page')
    process.exit(1)
  }
  const csrfToken = csrfMatch[1]

  // Extract csrf cookie from response
  const cookies = pageResponse.headers.getSetCookie?.() || []
  const csrfCookie = cookies.find(c => c.startsWith('csrftoken='))

  // Step 2: Login with credentials
  console.log(`Logging in as ${username}...`)
  const loginBody = new URLSearchParams({
    csrfmiddlewaretoken: csrfToken,
    username,
    password,
    next: '/'
  })

  // Build cookie header
  const cookieHeader = csrfCookie ? csrfCookie.split(';')[0] : ''

  const loginResponse = await fetch(`${BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: BASE_URL,
      Cookie: cookieHeader
    },
    body: loginBody.toString(),
    redirect: 'manual' // Login redirects on success
  })

  // Get session cookie from login response
  const loginCookies = loginResponse.headers.getSetCookie?.() || []
  const sessionCookie = loginCookies.find(c => c.startsWith('sessionid='))

  if (!sessionCookie) {
    console.error('Login failed - no session cookie received. Check your credentials.')
    process.exit(1)
  }

  console.log('Authenticated successfully')

  // Step 3: Get the presigned download URL
  console.log(`Fetching download URL for build ${build}...`)
  const allCookies = [sessionCookie.split(';')[0], cookieHeader].filter(Boolean).join('; ')

  const releaseUrl = `${BASE_URL}/releases/download?build=${build}&platform=node&response_type=json`
  const releaseResponse = await fetch(releaseUrl, {
    headers: {
      Referer: BASE_URL,
      Cookie: allCookies
    }
  })

  if (!releaseResponse.ok) {
    console.error(`Failed to get download URL: ${releaseResponse.status} ${releaseResponse.statusText}`)
    process.exit(1)
  }

  const releaseData = await releaseResponse.json()
  if (!releaseData.url) {
    console.error('No download URL in response')
    process.exit(1)
  }

  return releaseData.url
}

// ============================================================================
// Main
// ============================================================================

const options = parseArgs()

if (options.help) {
  printHelp()
  process.exit(0)
}

// Check if already set up
if (fs.existsSync(VERSION_FILE) && !options.force) {
  const existing = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'))
  console.log(`.foundry-dev/ already exists (v${existing.version})`)
  console.log('Use --force to overwrite.')
  process.exit(0)
}

// Clean existing
if (fs.existsSync(FOUNDRY_DEV_DIR)) {
  fs.rmSync(FOUNDRY_DEV_DIR, { recursive: true, force: true })
}
fs.mkdirSync(FOUNDRY_DEV_DIR, { recursive: true })

if (options.download) {
  await downloadFoundry(options.build)
} else {
  const source = options.source
    ? { path: options.source, version: getFoundryVersion(options.source) }
    : findFoundryInstall()

  if (!source) {
    console.error('Could not find a Foundry VTT installation.')
    console.error('')
    console.error('Options:')
    console.error('  1. Set FOUNDRY_PATH environment variable')
    console.error('  2. Use --source <path> to specify location')
    console.error('  3. Use --download to fetch from foundryvtt.com')
    console.error('')
    console.error('Searched paths:')
    for (const p of KNOWN_PATHS) {
      console.error(`  ${p}`)
    }
    process.exit(1)
  }

  copyFromInstall(source.path)
}

console.log('\nIntegration tests are ready: npm run test:integration')
