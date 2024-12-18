import { extractPack } from '@foundryvtt/foundryvtt-cli'
import fs from 'fs'

const moduleFile = fs.readFileSync('system.json', 'utf8')
const data = JSON.parse(moduleFile)
const packs = data.packs || []

for (const pack of packs) {
  const packName = pack.name
  console.log(packName)
  if (packName) {
    await extractPack(`packs/${packName}`, `packs/${packName}/src`)
    console.log(`Extracted pack ${packName} to JSON.`)
  }
}
