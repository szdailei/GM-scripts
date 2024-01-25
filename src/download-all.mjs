#!/usr/bin/env node
/* eslint-disable no-await-in-loop */

import fs from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer-core';

const defaultEnv = {
  PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
  PROXY: 'http://localhost:7890',
  viewPort: {
    width: 1920,
    height: 1080,
  },
  LOADED_TAG: '#contents',
  outputDir: '/home/dailei/Downloads/Novel/',
};

function help() {
  const HELP = `Usage: download-all.mjs endpoint

  endpoint: http://www.anshuge.com/files/article/html/122/122042/46619954.html
  `;
  console.log(HELP);
}

async function waitForDone(page) {
  const maxTimeout = 5000;
  await page.waitForSelector(defaultEnv.LOADED_TAG, {
    timeout: maxTimeout,
  });
}

async function createPageByUrl(browser, url) {
  const page = await browser.newPage();
  await page.goto(url);
  await waitForDone(page);
  return page;
}

async function getNextPageRef(page) {
  const nextPageRef = await page.evaluate(() => {
    function getNextPageButton(doc) {
      const aLinks = doc.getElementsByTagName('a');
      let nextPageButton;
      for (let i = 0, { length } = aLinks; i < length; i += 1) {
        const aLink = aLinks[i];
        if (aLink.textContent === '下一页') {
          nextPageButton = aLink;
        }
      }
      return nextPageButton;
    }

    const nextPageButton = getNextPageButton(document);
    if (nextPageButton) {
      return nextPageButton.href;
    }
    return null;
  });
  return nextPageRef;
}

async function getNovelName(page) {
  const title = await page.title();
  return title.split(' ')[0];
}

async function getChapterHeader(page) {
  return page.evaluate(() => {
    const headerElement = document.getElementsByTagName('h1')[0];
    if (!headerElement) return '';

    return headerElement.textContent.trim();
  });
}

async function getContent(page) {
  return page.evaluate(() => {
    const { textContent } = document.getElementById('contents');
    const lines = textContent.split('\n\n');
    const { length } = lines;
    let txt = '';
    for (let i = 0; i < length; i += 1) {
      const line = lines[i].trim();
      if (line.length !== 0) {
        txt += `${line}\n<br>`;
      }
    }
    return txt;
  });
}

async function main() {
  const { argv } = process;
  if (argv.length !== 3) {
    help();
    process.exit(0);
  }

  const endpoint = argv[2];

  const browser = await puppeteer.launch({
    executablePath: defaultEnv.PUPPETEER_EXECUTABLE_PATH,
    args: [`--proxy-server=${defaultEnv.PROXY}`, '--no-sandbox', '--disabled-setupid-sandbox'],
    headless: true,
    defaultViewport: defaultEnv.viewPort,
  });

  const page = await createPageByUrl(browser, endpoint);
  const fileName = await getNovelName(page);
  const outputFile = `${join(defaultEnv.outputDir, fileName)}.html`;

  let begin = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>本地文件 - ${fileName}</title>
  <style>
  .catalog {
    display:grid;
    grid-template-columns: auto auto auto;
  }
  .content {
    font-weight:700;
    font-size:24px;
  }
  </style>
</head>

<body>
  <a href="${endpoint}">${fileName} 网络链接</a>
  <div id="catalog" class="catalog">
`;
  let index = 0;
  let content = '';

  let nextPageRef = await getNextPageRef(page);
  for (;;) {
    const chapterHeader = await getChapterHeader(page);
    begin += `    <a href="#anchor_${index}">${chapterHeader}</a>\n`;
    content += `  <h2 id="anchor_${index}">${chapterHeader}</h2><a href="#catalog">返回目录</a>\n`;
    index += 1;

    const txt = await getContent(page);
    content += `  <div class="content">${txt}</div>`;

    nextPageRef = await getNextPageRef(page);
    if (nextPageRef && nextPageRef.indexOf('index.html') === -1) {
      await page.goto(nextPageRef);
    } else {
      break;
    }
  }

  begin += '  </div>\n';

  const end = `
</body>
</html>
`;
  const html = begin + content + end;
  await fs.promises.writeFile(outputFile, html);
  await browser.close();
}

main();
