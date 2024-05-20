import fs from "fs";

const inputSubtitleFile = "input.vtt";
const outputSubtitleFile = "output.vtt";
const ADJUST_SECONDS = 35;

function convertMilliSecondsToTimeStamp(milliSeconds) {
  const totalSeconds = milliSeconds / 1000;

  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds - hours * 3600) / 60);
  let seconds = totalSeconds - hours * 3600 - minutes * 60;

  if (hours < 10) {
    hours = "0" + hours;
  }
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }

  const timeStamp = `${hours}:${minutes}:${seconds}`;
  return timeStamp;
}

function adjustTimeStamp(timeStamp) {
  const fields = timeStamp.split(".");
  const milliSecondStr = fields[1];

  const hourAndMinAndSencondFields = fields[0].split(":");

  const hours = parseInt(hourAndMinAndSencondFields[0], 10);
  const mins = parseInt(hourAndMinAndSencondFields[1], 10);
  const seconds = parseInt(hourAndMinAndSencondFields[2], 10);

  const origDate = new Date(70, 0, 1, hours, mins, seconds);
  const diffDate = new Date(70, 0, 1, 0, 0, ADJUST_SECONDS);

  const newMilliSecond = Math.abs(origDate - diffDate);

  const adjustedTimeStamp = `${convertMilliSecondsToTimeStamp(
    newMilliSecond
  )}.${milliSecondStr}`;

  return adjustedTimeStamp;
}

function parseTimeStamp(line) {
  const fields = line.split("-->");

  const startTime = adjustTimeStamp(fields[0].trim());
  const endTime = adjustTimeStamp(fields[1].trim());
  return { startTime, endTime };
}

async function adjust() {
  const subtitle = await fs.promises.readFile(inputSubtitleFile, "utf8");
  const lines = subtitle.split("\n");

  let output = "";
  output += `${lines[0]}\n\n`;

  const length = lines.length;
  for (let i = 2; i < length; i += 3) {
    const { startTime, endTime } = parseTimeStamp(lines[i]);
    const newTimeStampLine = `${startTime} --> ${endTime}`;
    output += `${newTimeStampLine}\n${lines[i + 1]}\n\n`;
  }

  await fs.promises.writeFile(outputSubtitleFile, output);
}

adjust();
