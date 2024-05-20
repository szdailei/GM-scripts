import fs from "fs"

/**
require rootDir, and all video files must have related subtitle files
ensure  return video files and subtitle files in rootDir. no parse subDir
*/
export async function videoSubtitleFiles(rootDir) {
  let videoFiles = [],
    subtitleFiles = []

  await setFilesArray(rootDir)
  const files = {
    videoFiles: videoFiles,
    subtitleFiles: subtitleFiles
  }
  return files

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
        if (isVideo(name) === false) return

        videoFiles.push(name)
        subtitleFiles.push(getSubtitleByVideo(name))
      })
    )
  }
}

function videoFileSuffix() {
  return "mp4"
}

function subtitleFileSuffix() {
  return "srt"
}

/*
require filename
ensure return true for *.mp4, return false for others
example return true for 'main.mp4', false for 'mp4' or 'main.srt'
*/
function isVideo(file) {
  const names = file.split(".")
  const length = names.length
  if (length <= 1) return false // return false for 'mp4'
  if (names[length - 1] == videoFileSuffix()) return true
  return false
}

/*
require videoFilename
ensure return related subtitle filename
example return 'main.srt' for'main.mp4'
*/
function getSubtitleByVideo(videoFile) {
  const names = videoFile.split(".")
  const length = names.length
  names[length - 1] = subtitleFileSuffix()

  let subtitleFile = names[0]
  for (let i = 1; i < length; i++) {
    subtitleFile += "." + names[i]
  }
  return subtitleFile
}
