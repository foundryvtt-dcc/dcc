## Work process

1) Clone module GitHub Repo into your FoundryVTT modules folder
2) Run `npm install` from this module folder
3) Run `npm run todb` from this module folder to compile the JSON into the FoundryVTT database files
4) Start FoundryVTT
5) Create new world
6) Go into New World and enable this module and the DCC Core Book module
7) Use the "import content" button from the dialog for this module to import the content (or import from the compendium)
8) Make changes in Foundry as normal
9) Unlock this module's compendium
10) Open this module's Adventure
11) Right-click on adventure in the compendium dialog and select "Rebuild Adventure"
12) Drag all folders for this module (from Scenes, Actors, Items, Journals, Tables) onto the Rebuild Adventure Dialog
13) Click "Rebuild Adventure"
14) Exit the world
15) Quit FoundryVTT
16) Run `npm run tojson` from this module folder to update the JSON of the Adventure
17) Commit and push changes to GitHub


The Release process that creates GitHub Releases runs `todb` before packaging the release.