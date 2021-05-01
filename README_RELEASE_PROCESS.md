When you are about to do a release, and not before:

For automated release process:
1. Commit `version.txt` File with new release version number (no 'v')
1. GitHub Action will automatically create a draft release.
1. Edit draft release notes and title.
1. Publish Draft Release.
1. Update Foundry Django with new release.

For manual release process:
1. Merge in all changes to main
1. Update system.json to change the version number at the top
1. Update system.json to change the zipfile path at the bottom (you have to guess the path, because you haven't created release yet)
1. Update system.json to change the manifest path at the bottom (you have to guess the path, because you haven't created release yet)
1. Create a release in Github with release notes
1. Update Foundry Django with new release
