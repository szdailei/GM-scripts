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

  let options;
  if (endpoint.indexOf('anshuge') !== -1) {
    options = {
      selectorOfWait: '#contents',
      contentId: 'contents',
      prefixOfBookPath: 'files/article/html',
    };
  } else if (endpoint.indexOf('69shu') !== -1) {
    options = {
      selectorOfWait: '#txtright',
      contentClass: 'txtnav',
      prefixOfBookPath: 'book',
    };
  } else if (endpoint.indexOf('5dscw') !== -1) {
    options = {
      selectorOfWait: '#content',
      contentId: 'content',
      prefixOfBookPath: 'book',
    };
  } else {
    console.log('The site is not supported');
    process.exit(1);
  }

  const userHomeDir = os.homedir();
  const outputDir = `${userHomeDir}/Downloads/Novel/`;

  const { novelName, html } = await evalNovel(endpoint, options);
  const outputFile = `${join(outputDir, novelName)}.html`;
  await fs.promises.writeFile(outputFile, html);
}

main();
