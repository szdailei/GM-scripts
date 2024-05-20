import * as fs from "fs"
import { musicFiles } from "./music-files.mjs"

addAuthor()
/**
require running in music directory
ensure  add author name in filenames
*/
async function addAuthor() {
  const rootDir = "/home/dailei/flac-files"
  let files = await musicFiles(rootDir)
  console.log("All music files in the directory are:\r\n", files)

  const length = files.length
  for (let i = 0; i < length; i++) {
    const musicFile = files[i]
    const newName = "试音 - " + musicFile
    fs.rename(musicFile, newName, function (err) {
      if (err) {
        throw err
      }
      console.log('rename '+musicFile+' to '+newName)
    } )
  }
}
