When you are about to do a release, and not before:

For automated release process:
1. Ensure you run `npm run tojson' to copy the data out of levelDB files and into JSON, since LevelDB files are not checked in
1. Merge all changes into main
1. Commit `version.txt` File with new release version number in it (no 'v')
1. GitHub Action will automatically create a draft release
1. Edit draft release notes and title
1. Publish the release

For manual release process:
1. Ensure you run `npm run tojson' to copy the data out of levelDB files and into JSON, since LevelDB files are not checked in
1. Merge in all changes to main
1. Update system.json to change the version number at the top
1. Update system.json to change the zipfile path at the bottom (you have to guess the path, because you haven't created release yet)
1. Update system.json to change the manifest path at the bottom (you have to guess the path, because you haven't created release yet)
1. Create a release in Github with new version number
1. Go through commits since last release and use them to create release notes
1. Publish the release
1. Update Foundry admin with new release paths for both download and manifest
