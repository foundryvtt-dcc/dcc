When you are about to do a release, and not before:

1. Merge in all changes to master
2. Update system.json to change the version number at the top
3. Update system.json to change the zipfile path at the bottom (you have to guess the path, because you haven't created release yet)
4. Create a release in Github with release notes
5. Update Foundry Django with new release
