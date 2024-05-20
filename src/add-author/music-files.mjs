import fs from "fs"

/**
require rootDir
ensure  return music files in rootDir. no parse subDir
*/
export async function musicFiles(rootDir) {
  let musicFiles = []

  await setFilesArray(rootDir)
  return musicFiles

  /**
    require rootDir
    ensure set array of files
  */
  async function setFilesArray(rootDir) {
    const dirents = await fs.promises.readdir(rootDir, { withFileTypes: true })
    await Promise.all(
      dirents.map(async dirent => {
        const name = dirent.name
        if (dirent.isFile() === false) return
        if (isMusic(name) === false) return

        musicFiles.push(name)
      })
    )
  }
}

function musicFileSuffix() {
  return "flac"
}

/*
require filename
ensure return true for *.music, return false for others
example return true for 'main.music', false for 'music' or 'main.mp3'
*/
function isMusic(file) {
  const names = file.split(".")
  const length = names.length
  if (length <= 1) return false // return false for 'music'
  if (names[length - 1] == musicFileSuffix()) return true
  return false
}
