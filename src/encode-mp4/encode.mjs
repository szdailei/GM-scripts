import * as childProcess from "child_process"
import * as path from "path"
import { videoSubtitleFiles } from "./video-subtitle-files.mjs"

encode()
/**
require running in video directory and there is a 'finished' subDir
ensure  burn subtitle file into videos
*/
async function encode() {
  const rootDir = "\\CleanCodeBootCamp\\Course\\Doing\\OK\\"
  const outputDir = rootDir + "finished\\"

  let files = await videoSubtitleFiles(rootDir)
  console.log("All video and subtitle files in the directory are:\r\n", files)

  //  ffmpeg -y -i "example.mp4" -vf subtitles="example.srt:force_style='FontName=思源宋体,Fontsize=20,PrimaryColour=&Hffffff&,BackColour=&H000000&,Shadow=0.5'" -codec:a copy ..\finished\example.mp4
  const COMMAND = "/ffmpeg/bin/ffmpeg"

  const options_1 = " -y -i "
  const options_2 = " -vf subtitles="
  const options_3 =
    ":force_style='FontName=思源宋体,Fontsize=20,PrimaryColour=&Hffffff&,BackColour=&H000000&,Shadow=0.5"
  const options_4 = " -codec:a copy "

  const length = files.videoFiles.length
  for (let i = 0; i < length; i++) {
    const videoFile = files.videoFiles[i]
    const subtitleFile = files.subtitleFiles[i]
    const outputFile = outputDir + files.videoFiles[i]
    childProcess.execSync(
      COMMAND +
        options_1 +
        '"' +
        videoFile +
        '"' +
        options_2 +
        '"' +
        subtitleFile +
        options_3 +
        "'" +
        '"' +
        options_4 +
        ' "' +
        outputFile +
        '"'
    )
  }
}
