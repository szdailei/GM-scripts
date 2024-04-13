#!/usr/bin/env node
/* eslint-disable no-await-in-loop */

import fs from 'fs';
import os from 'os';
import { join } from 'path';
import evalNovel from './eval-novel.mjs';

function help() {
  const HELP = 'Usage: download-novel.mjs http://novel_site/.../the_start_chapter.html';
  console.log(HELP);
}

async function main() {
  const { argv } = process;
  if (argv.length !== 3) {
    help();
    process.exit(0);
  }

  const endpoint = argv[2];

  const userHomeDir = os.homedir();
  const outputDir = `${userHomeDir}/Downloads/Novel/`;

  const { novelName, html } = await evalNovel(endpoint);
  const outputFile = `${join(outputDir, novelName)}.html`;
  await fs.promises.writeFile(outputFile, html);
}

main();
