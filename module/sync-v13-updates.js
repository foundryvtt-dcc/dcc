#!/usr/bin/env node

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, copyFileSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))

const MODULES_DIR = '/Users/timwhite/FoundryVTT/Data/modules'
const SOURCE_DIR = join(__dirname, '..')
const ORG_NAME = 'foundryvtt-dcc'
const BRANCH_NAME = 'feature/v13'
const COMMIT_MESSAGE = 'v13 upgrade'

// Files to copy
const FILES_TO_COPY = [
  'templates/dialog-welcome.html',
  'module/welcomeDialog.js'
]

async function getOrgRepos () {
  console.log(`Fetching repositories from ${ORG_NAME} organization...`)
  try {
    const { stdout } = await execAsync(`gh repo list ${ORG_NAME} --limit 1000 --json name,sshUrl`)
    return JSON.parse(stdout)
  } catch (error) {
    console.error('Error fetching repositories:', error)
    throw error
  }
}

async function hasRequiredFiles (repoPath) {
  const moduleJsonPath = join(repoPath, 'module.json')
  const welcomeHtmlPath = join(repoPath, 'templates/dialog-welcome.html')
  return existsSync(moduleJsonPath) && existsSync(welcomeHtmlPath)
}

async function checkModuleJsonExists (repoName) {
  try {
    // Check if module.json exists in the repository
    const { stdout } = await execAsync(
      `gh api repos/${ORG_NAME}/${repoName}/contents/module.json --jq '.name'`
    )
    return stdout.trim() === 'module.json'
  } catch {
    return false
  }
}

async function isGitRepo (path) {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: path })
    return true
  } catch {
    return false
  }
}

async function checkExistingPR (repoName) {
  try {
    // Check for existing PRs with the v13 branch
    const { stdout } = await execAsync(
      `gh pr list --repo ${ORG_NAME}/${repoName} --head ${BRANCH_NAME} --json number,title,state`,
      { cwd: MODULES_DIR }
    )
    const prs = JSON.parse(stdout)

    // Check if there's an open PR
    const openPR = prs.find(pr => pr.state === 'OPEN')
    if (openPR) {
      console.log(`PR already exists for ${repoName}: #${openPR.number} - ${openPR.title}`)
      return true
    }

    return false
  } catch (error) {
    console.error(`Error checking PRs for ${repoName}:`, error.message)
    return false
  }
}

async function createPullRequest (repoName) {
  try {
    console.log(`Creating pull request for ${repoName}...`)
    const { stdout } = await execAsync(
      `gh pr create --repo ${ORG_NAME}/${repoName} --title "v13 Upgrade" --body "FoundryVTT Version 13 Upgrade" --head ${BRANCH_NAME} --base main`,
      { cwd: join(MODULES_DIR, repoName) }
    )
    console.log(`✓ Pull request created for ${repoName}: ${stdout.trim()}`)
  } catch (error) {
    // Try with master branch if main fails
    try {
      const { stdout } = await execAsync(
        `gh pr create --repo ${ORG_NAME}/${repoName} --title "v13 Upgrade" --body "FoundryVTT Version 13 Upgrade" --head ${BRANCH_NAME} --base master`,
        { cwd: join(MODULES_DIR, repoName) }
      )
      console.log(`✓ Pull request created for ${repoName}: ${stdout.trim()}`)
    } catch (error2) {
      console.error(`Error creating PR for ${repoName}:`, error2.message)
    }
  }
}

async function cloneOrUpdateRepo (repo) {
  const repoPath = join(MODULES_DIR, repo.name)

  if (existsSync(repoPath)) {
    // Check if it's a valid git repository
    if (await isGitRepo(repoPath)) {
      console.log(`Updating existing repository: ${repo.name}`)
      try {
        await execAsync('git checkout main || git checkout master', { cwd: repoPath })
        await execAsync('git pull', { cwd: repoPath })
      } catch (error) {
        console.error(`Error updating ${repo.name}:`, error.message)
        return null
      }
    } else {
      console.log(`Directory exists but is not a git repo: ${repo.name}. Removing and cloning fresh...`)
      rmSync(repoPath, { recursive: true, force: true })
      try {
        await execAsync(`git clone --progress ${repo.sshUrl} ${repoPath}`)
      } catch (error) {
        console.error(`Error cloning ${repo.name}:`, error.message)
        return null
      }
    }
  } else {
    console.log(`Cloning repository: ${repo.name}`)
    try {
      await execAsync(`git clone --progress ${repo.sshUrl} ${repoPath}`)
    } catch (error) {
      console.error(`Error cloning ${repo.name}:`, error.message)
      return null
    }
  }

  return repoPath
}

async function createBranchAndCopyFiles (repoPath, repoName) {
  try {
    // Check if branch already exists
    const { stdout: branches } = await execAsync('git branch -a', { cwd: repoPath })
    const branchExists = branches.includes(BRANCH_NAME)

    if (branchExists) {
      console.log(`Branch ${BRANCH_NAME} already exists in ${repoName}, checking out...`)
      await execAsync(`git checkout ${BRANCH_NAME}`, { cwd: repoPath })
      await execAsync('git pull origin ' + BRANCH_NAME, { cwd: repoPath }).catch(() => {
        console.log(`No remote branch ${BRANCH_NAME} to pull from`)
      })
    } else {
      console.log(`Creating branch ${BRANCH_NAME} in ${repoName}...`)
      await execAsync(`git checkout -b ${BRANCH_NAME}`, { cwd: repoPath })
    }

    // Copy files
    let filesChanged = false
    for (const file of FILES_TO_COPY) {
      const sourcePath = join(SOURCE_DIR, file)
      const destPath = join(repoPath, file)

      if (existsSync(sourcePath)) {
        // Check if files are different
        let isDifferent = true
        if (existsSync(destPath)) {
          const sourceContent = readFileSync(sourcePath, 'utf8')
          const destContent = readFileSync(destPath, 'utf8')
          isDifferent = sourceContent !== destContent
        }

        if (isDifferent) {
          console.log(`Copying ${file} to ${repoName}...`)
          copyFileSync(sourcePath, destPath)
          await execAsync(`git add ${file}`, { cwd: repoPath })
          filesChanged = true
        } else {
          console.log(`${file} is already up to date in ${repoName}`)
        }
      } else {
        console.warn(`Source file not found: ${sourcePath}`)
      }
    }

    // Update lang/en.json file
    const langFilePath = join(repoPath, 'lang/en.json')
    if (existsSync(langFilePath)) {
      console.log(`Checking lang/en.json in ${repoName}...`)
      let langContent = readFileSync(langFilePath, 'utf8')
      let langUpdated = false
      let changesApplied = []
      
      // Replace DoNotShow with ShowWelcomeDialogLabel
      if (langContent.includes('"DoNotShow": "Do not show this message on startup"')) {
        langContent = langContent.replace(
          '"DoNotShow": "Do not show this message on startup"',
          '"ShowWelcomeDialogLabel": "Show this message on startup"'
        )
        langUpdated = true
        changesApplied.push('DoNotShow → ShowWelcomeDialogLabel')
      }
      
      // Replace DoNotShowHint with ShowWelcomeDialogHint
      if (langContent.includes('"DoNotShowHint": "Do not show this welcome dialog again until it is re-enabled in the Module Settings dialog."')) {
        langContent = langContent.replace(
          '"DoNotShowHint": "Do not show this welcome dialog again until it is re-enabled in the Module Settings dialog."',
          '"ShowWelcomeDialogHint": "Show this welcome dialog again until it is re-enabled in the Module Settings dialog."'
        )
        langUpdated = true
        changesApplied.push('DoNotShowHint → ShowWelcomeDialogHint')
      }
      
      // Replace h2 tags with h3 tags
      if (langContent.includes('<h2>') || langContent.includes('</h2>')) {
        langContent = langContent.replace(/<h2>/g, '<h3>')
        langContent = langContent.replace(/<\/h2>/g, '</h3>')
        langUpdated = true
        changesApplied.push('h2 tags → h3 tags')
      }
      
      if (langUpdated) {
        console.log(`✓ Updated lang/en.json in ${repoName}:`)
        changesApplied.forEach(change => console.log(`  - ${change}`))
        writeFileSync(langFilePath, langContent, 'utf8')
        await execAsync('git add lang/en.json', { cwd: repoPath })
        filesChanged = true
      } else {
        console.log(`lang/en.json is already up to date in ${repoName}`)
      }
    } else {
      console.log(`No lang/en.json file found in ${repoName}`)
    }

    // Update module.json to change maximum version from 12 to 13
    const moduleJsonPath = join(repoPath, 'module.json')
    if (existsSync(moduleJsonPath)) {
      const moduleContent = readFileSync(moduleJsonPath, 'utf8')
      const updatedContent = moduleContent.replace(/"maximum":\s*"12"/, '"maximum": "13"')

      if (moduleContent !== updatedContent) {
        console.log(`Updating module.json maximum version to 13 in ${repoName}...`)
        writeFileSync(moduleJsonPath, updatedContent, 'utf8')
        await execAsync('git add module.json', { cwd: repoPath })
        filesChanged = true
      } else {
        console.log(`module.json maximum version already set to 13 in ${repoName}`)
      }
    }

    // Commit and push if there are changes
    if (filesChanged) {
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: repoPath })
      if (status.trim()) {
        console.log(`Committing changes in ${repoName}...`)
        await execAsync(`git commit -m "${COMMIT_MESSAGE}"`, { cwd: repoPath })
        console.log(`Pushing changes to origin/${BRANCH_NAME}...`)
        await execAsync(`git push -u origin ${BRANCH_NAME}`, { cwd: repoPath })
        console.log(`✓ Successfully updated ${repoName}`)

        // Check if PR already exists, create if not
        const prExists = await checkExistingPR(repoName)
        if (!prExists) {
          await createPullRequest(repoName)
        }
      }
    } else {
      console.log(`No changes needed in ${repoName}`)
    }
  } catch (error) {
    console.error(`Error processing ${repoName}:`, error.message)
  }
}

async function main () {
  try {
    // Check if gh CLI is installed
    try {
      await execAsync('gh --version')
    } catch {
      console.error('GitHub CLI (gh) is not installed. Please install it first.')
      console.error('Visit: https://cli.github.com/')
      process.exit(1)
    }

    // Check if user is authenticated
    try {
      await execAsync('gh auth status')
    } catch {
      console.error('Not authenticated with GitHub CLI. Please run: gh auth login')
      process.exit(1)
    }

    // Get all repos from the organization
    const repos = await getOrgRepos()
    console.log(`Found ${repos.length} repositories in ${ORG_NAME} organization\n`)

    // Process each repository
    for (const repo of repos) {
      console.log(`\n--- Processing ${repo.name} ---`)
      
      // Check if module.json exists before cloning
      const hasModuleJson = await checkModuleJsonExists(repo.name)
      if (!hasModuleJson) {
        console.log(`Skipping ${repo.name} - no module.json found`)
        continue
      }
      
      const repoPath = await cloneOrUpdateRepo(repo)

      if (repoPath && await hasRequiredFiles(repoPath)) {
        await createBranchAndCopyFiles(repoPath, repo.name)
      } else if (repoPath) {
        console.log(`Skipping ${repo.name} - missing required files`)
      }
    }

    console.log('\n✓ All repositories processed!')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
main()
