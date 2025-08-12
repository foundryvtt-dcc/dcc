#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Get all keys from a JSON object (nested)
 */
function getAllKeys(obj, prefix = '') {
  const keys = new Set();
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.add(fullKey);
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const nestedKey of getAllKeys(value, fullKey)) {
        keys.add(nestedKey);
      }
    }
  }
  
  return keys;
}

/**
 * Check if lang/en.json was modified in this PR
 */
function isEnglishTranslationModified() {
  try {
    // Get the diff for lang/en.json
    const diff = execSync('git diff origin/main HEAD -- lang/en.json', { encoding: 'utf8' });
    return diff.trim().length > 0;
  } catch (error) {
    console.log('Could not determine if lang/en.json was modified, proceeding with check...');
    return true;
  }
}

/**
 * Get the keys that were added or modified in lang/en.json
 */
function getModifiedKeys() {
  try {
    // Get the current en.json
    const currentEnJson = JSON.parse(fs.readFileSync('lang/en.json', 'utf8'));
    const currentKeys = getAllKeys(currentEnJson);
    
    // Get the original en.json from main branch
    let originalKeys;
    try {
      const originalEnJson = JSON.parse(execSync('git show origin/main:lang/en.json', { encoding: 'utf8' }));
      originalKeys = getAllKeys(originalEnJson);
    } catch (error) {
      // If we can't get the original, check all keys
      console.log('Could not get original lang/en.json, checking all keys...');
      return currentKeys;
    }
    
    // Find added or modified keys
    const modifiedKeys = new Set();
    
    // Check for new keys
    for (const key of currentKeys) {
      if (!originalKeys.has(key)) {
        modifiedKeys.add(key);
      }
    }
    
    // Check for changed values
    try {
      const diff = execSync('git diff origin/main HEAD -- lang/en.json', { encoding: 'utf8' });
      const lines = diff.split('\n');
      
      for (const line of lines) {
        // Look for lines that start with + or - and contain JSON keys
        if (line.startsWith('+') || line.startsWith('-')) {
          const match = line.match(/[+-]\s*"([^"]+)":/);
          if (match) {
            const key = match[1];
            if (currentKeys.has(key)) {
              modifiedKeys.add(key);
            }
          }
        }
      }
    } catch (error) {
      console.log('Could not parse diff, checking all current keys...');
      return currentKeys;
    }
    
    return modifiedKeys;
  } catch (error) {
    console.error('Error getting modified keys:', error.message);
    process.exit(1);
  }
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Checking translation completeness...');
  
  // Check if en.json was modified
  if (!isEnglishTranslationModified()) {
    console.log('✅ lang/en.json was not modified in this PR. Skipping translation check.');
    return;
  }
  
  console.log('📝 lang/en.json was modified. Checking other language files...');
  
  // Get all language files
  const langDir = 'lang';
  const langFiles = fs.readdirSync(langDir)
    .filter(file => file.endsWith('.json') && file !== 'en.json')
    .map(file => path.join(langDir, file));
  
  if (langFiles.length === 0) {
    console.log('ℹ️ No other language files found. Translation check complete.');
    return;
  }
  
  // Get the English translation keys
  const enJson = JSON.parse(fs.readFileSync('lang/en.json', 'utf8'));
  const enKeys = getAllKeys(enJson);
  
  // Get modified/added keys
  const modifiedKeys = getModifiedKeys();
  console.log(`🔄 Found ${modifiedKeys.size} modified/added keys in lang/en.json`);
  
  if (modifiedKeys.size === 0) {
    console.log('✅ No keys were modified or added. Translation check complete.');
    return;
  }
  
  let hasErrors = false;
  const errors = [];
  
  // Check each language file
  for (const langFile of langFiles) {
    console.log(`\n🌍 Checking ${langFile}...`);
    
    try {
      const langJson = JSON.parse(fs.readFileSync(langFile, 'utf8'));
      const langKeys = getAllKeys(langJson);
      
      const missingKeys = [];
      
      // Check if all modified keys exist in this language file
      for (const key of modifiedKeys) {
        if (!langKeys.has(key)) {
          missingKeys.push(key);
        }
      }
      
      if (missingKeys.length > 0) {
        hasErrors = true;
        const error = `❌ ${langFile} is missing ${missingKeys.length} key(s): ${missingKeys.join(', ')}`;
        console.log(error);
        errors.push(error);
      } else {
        console.log(`✅ ${langFile} has all required keys`);
      }
      
    } catch (error) {
      hasErrors = true;
      const errorMsg = `❌ Error reading ${langFile}: ${error.message}`;
      console.log(errorMsg);
      errors.push(errorMsg);
    }
  }
  
  if (hasErrors) {
    console.log('\n🚨 Translation validation failed!');
    console.log('\nSummary of errors:');
    for (const error of errors) {
      console.log(error);
    }
    console.log('\n💡 Please update all language files with the new/modified keys from lang/en.json');
    process.exit(1);
  } else {
    console.log('\n✅ All translation files are up to date!');
  }
}

// Run the script
main();