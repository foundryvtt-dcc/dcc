---
name: merge-v14
description: Merge main into feature/v14 branch with V14 compatibility validation
---

# Merge Main into V14 Branch

Merges the latest changes from main into the feature/v14 branch and validates V14 compatibility.

## 1. Fetch and Checkout

```bash
git fetch origin
git checkout feature/v14
git pull origin feature/v14
```

If `feature/v14` doesn't exist locally:
```bash
git checkout -b feature/v14 origin/feature/v14
```

## 2. Merge Main

```bash
git merge origin/main
```

### If Conflicts Occur

1. List conflicted files: `git diff --name-only --diff-filter=U`
2. For each conflicted file:
   - Read the file to understand the conflict
   - Resolve keeping V14-compatible changes (prefer feature/v14 side for V14 patterns)
   - Stage the resolved file: `git add <file>`
3. After all conflicts resolved: `git commit -m "Merge main into feature/v14"`

### Conflict Resolution Guidelines

- **Data model files** (`module/data/*.js`): Keep V14 TypeDataModel patterns
- **template.json**: Should not exist in V14 branch; if conflict involves it, prefer deletion
- **system.json**: Keep V14's `documentTypes` field; merge other changes
- **Active Effects code**: Keep V14 patterns (no legacyTransferral)

## 3. Validate V14 Compatibility

After merge, check for V14 breaking change patterns in any new/modified files.

### Check Files Changed from Main

```bash
git diff origin/feature/v14~1..HEAD --name-only | grep -E '\.(js|mjs)$'
```

### Validation Checks

Run these searches on changed JavaScript files. Flag any findings for review.

#### 3.1 Legacy template.json References

```bash
# template.json should not exist
ls template.json 2>/dev/null && echo "WARNING: template.json exists - should be removed for V14"
```

#### 3.2 Legacy Transferral

```bash
# Should be set to false, not true
grep -r "legacyTransferral.*=.*true" module/ && echo "ERROR: legacyTransferral must be false"
```

#### 3.3 DataModel Operation Keys (Deprecated)

```bash
# Search for deprecated -=/== in updateSource
grep -rE "updateSource.*'-=" module/
grep -rE "updateSource.*'==" module/
```

#### 3.4 rollMode References

Check for `rollMode` usage that may need updates for V14 rename:

```bash
grep -rn "rollMode" module/ --include="*.js"
```

Note: V14 may rename rollMode to mode/visibility. Document any usage for future updates.

#### 3.5 Null Safety for game.activeTool

```bash
# If used, should have null check
grep -rn "game\.activeTool" module/ --include="*.js"
grep -rn "SceneControls.*tool" module/ --include="*.js"
```

#### 3.6 parseHTML Undefined Checks

```bash
# Should check for null, not undefined
grep -rn "parseHTML" module/ --include="*.js"
```

#### 3.7 TinyMCE References

```bash
# Should not exist in V14
grep -rn "TinyMCE\|tinymce" module/ --include="*.js"
grep -rn "foundry\.prosemirror\.defaultPlugins" module/ --include="*.js"
```

#### 3.8 Deprecated Class References

```bash
grep -rn "RegionPolygonTree\|RegionShape" module/ --include="*.js"
```

## 4. Run Tests

```bash
npm test
```

All tests must pass before completing the merge.

## 5. Lint and Format

```bash
npm run format
```

## 6. Report Results

Provide a summary:

1. **Merge Status**: Clean merge or conflicts resolved
2. **Files Changed**: List of files brought in from main
3. **V14 Compatibility Issues**: Any patterns found that need attention
4. **Test Results**: Pass/fail status
5. **Recommended Actions**: Any follow-up work needed

## Reference Documentation

The following docs in `docs/dev/v14/` define V14 compatibility requirements:

- `BREAKING_CHANGES.md` - V14 breaking changes and deprecated APIs
- `CHECKLIST.md` - Migration checklist with completion status
- `DATA_MODELS.md` - TypeDataModel migration (template.json replacement)
- `ACTIVE_EFFECTS.md` - Active Effects V2 changes

## Important Notes

- Never force push to feature/v14
- If significant conflicts exist, ask user before resolving
- V14 branch may have intentional differences from main (e.g., no template.json)
- Report any new code from main that uses deprecated V14 patterns