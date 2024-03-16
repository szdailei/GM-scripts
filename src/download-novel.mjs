#!/usr/bin/env node
/* eslint-disable no-await-in-loop */

import fs from 'fs';
import { join } from 'path';
import evalNovel from './eval-novel.mjs';

const outputDir = '/home/dailei/Downloads/Novel/';

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
      textOfNextChapterButton: '下一页',
      delimiterInTitle: ' ',
      prefixOfBookPath: 'files/article/html',
    };
  } else if (endpoint.indexOf('69shu') !== -1) {
    options = {
      selectorOfWait: '#txtright',
      contentClass: 'txtnav',
      textOfNextChapterButton: '下一章',
      delimiterInTitle: '-',
      prefixOfBookPath: 'book',
    };
  } else {
    console.log('The site is not supported');
    process.exit(1);
  }

  const { novelName, html } = await evalNovel(endpoint, options);
  const outputFile = `${join(outputDir, novelName)}.html`;
  await fs.promises.writeFile(outputFile, html);
}

main();
