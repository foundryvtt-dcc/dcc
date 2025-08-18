#!/usr/bin/env node

/**
 * Language File Comparison Utility
 *
 * Compares language files to find missing keys between a reference file and target files.
 * Useful for ensuring all language files have the same keys as the reference (usually en.json).
 *
 * Usage:
 *   node module/compare-lang-files.js <reference-file> <target-file1> [target-file2] [...]
 *   node module/compare-lang-files.js lang/en.json lang/de.json lang/es.json
 *
 * Output:
 *   - Lists keys that exist in reference but are missing from each target file
 *   - Shows the English values for easy translation reference
 */

import fs from 'fs'
import path from 'path'

function loadJsonFile (filePath) {
  try {
    const fullPath = path.resolve(filePath)
    const content = fs.readFileSync(fullPath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message)
    process.exit(1)
  }
}

function extractKeys (obj, prefix = '') {
  const keys = new Set()

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    keys.add(fullKey)

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedKeys = extractKeys(value, fullKey)
      nestedKeys.forEach(k => keys.add(k))
    }
  }

  return keys
}

function getValueByPath (obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function compareLanguageFiles (referenceFile, targetFiles) {
  console.log(`Comparing language files with reference: ${referenceFile}\n`)

  const reference = loadJsonFile(referenceFile)
  const referenceKeys = extractKeys(reference)

  console.log(`Reference file has ${referenceKeys.size} keys\n`)

  for (const targetFile of targetFiles) {
    console.log(`=== Comparing ${targetFile} ===`)

    const target = loadJsonFile(targetFile)
    const targetKeys = extractKeys(target)

    const missingKeys = [...referenceKeys].filter(key => !targetKeys.has(key))
    const extraKeys = [...targetKeys].filter(key => !referenceKeys.has(key))

    console.log(`Target file has ${targetKeys.size} keys`)
    console.log(`Missing keys: ${missingKeys.length}`)
    console.log(`Extra keys: ${extraKeys.length}`)

    if (missingKeys.length > 0) {
      console.log('\nMissing keys (need translation):')
      missingKeys.forEach(key => {
        const value = getValueByPath(reference, key)
        console.log(`  "${key}": "${value}"`)
      })
    }

    if (extraKeys.length > 0) {
      console.log('\nExtra keys (not in reference):')
      extraKeys.forEach(key => {
        const value = getValueByPath(target, key)
        console.log(`  "${key}": "${value}"`)
      })
    }

    if (missingKeys.length === 0 && extraKeys.length === 0) {
      console.log('✅ Perfect match with reference file!')
    }

    console.log('\n' + '='.repeat(50) + '\n')
  }
}

function main () {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error('Usage: node compare-lang-files.js <reference-file> <target-file1> [target-file2] [...]')
    console.error('Example: node compare-lang-files.js lang/en.json lang/de.json lang/es.json')
    process.exit(1)
  }

  const [referenceFile, ...targetFiles] = args

  if (!fs.existsSync(referenceFile)) {
    console.error(`Reference file not found: ${referenceFile}`)
    process.exit(1)
  }

  for (const targetFile of targetFiles) {
    if (!fs.existsSync(targetFile)) {
      console.error(`Target file not found: ${targetFile}`)
      process.exit(1)
    }
  }

  compareLanguageFiles(referenceFile, targetFiles)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { compareLanguageFiles, extractKeys, getValueByPath }
