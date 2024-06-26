#!/usr/bin/env node

import fs from "fs";
import os from 'os';
import { join } from 'path';

function help() {
  const HELP = 'Usage: novel-to-html.mjs novel.txt';
  console.log(HELP);
}

function main() {
  const { argv } = process;
  if (argv.length !== 3) {
    help();
    process.exit(1);
  }

  const inputFileName = argv[2];
  const novelName = inputFileName.split('.txt')[0]

  const userHomeDir = os.homedir();
  const outputDir = `${userHomeDir}/Downloads/Novel/`;
  const outputFileName = `${join(outputDir, novelName)}.html`;

  let html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${novelName}</title>
  <style>
  .content {
    font-weight:700;
    font-size:24px;
  }
  </style>
</head>

<body>
  <div class="content">
`

  const novel = fs.readFileSync(inputFileName, "utf8");
  const lines = novel.split("\n");

  const { length } = lines;
  for (let i = 0; i < length; i += 1) {
    const line = lines[i]
    html += `${line}\n<br>`;
  }

  html += `  </div>
</body>
</html>`

  fs.writeFileSync(outputFileName, html);
}

main();
