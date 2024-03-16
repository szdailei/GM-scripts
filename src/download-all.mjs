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
    const contents = document.getElementById('contents');
    if (!contents) return '';

    const { textContent } = contents;
    const lines = textContent.split('\n\n');
    let txt = '';
    for (let i = 0, { length } = lines; i < length; i += 1) {
      const line = lines[i].trim();
      if (line.length !== 0) {
        txt += `${line}\n<br>`;
      }
    }
    return txt;
  });
}

function getIndexPageUrl(endpoint) {
  const fields = endpoint.split('/');
  let indexPageUrl = fields[0];
  for (let i = 1, { length } = fields; i < length - 1; i += 1) {
    indexPageUrl += `/${fields[i]}`;
  }
  indexPageUrl += `/index.html`;
  return indexPageUrl;
}

async function main() {
  const { argv } = process;
  if (argv.length !== 3) {
    help();
    process.exit(0);
  }

  const endpoint = argv[2];
  const indexPageUrl = getIndexPageUrl(endpoint);

  const browser = await puppeteer.launch({
    executablePath: defaultEnv.PUPPETEER_EXECUTABLE_PATH,
    //    args: [`--proxy-server=${defaultEnv.PROXY}`, '--no-sandbox', '--disabled-setupid-sandbox'],
    args: ['--no-sandbox', '--disabled-setupid-sandbox'],
    headless: true,
    defaultViewport: defaultEnv.viewPort,
  });

  const page = await createPageByUrl(browser, endpoint);
  const novelName = await getNovelName(page);
  const outputFile = `${join(defaultEnv.outputDir, novelName)}.html`;

  let begin = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>本地 - ${novelName}</title>
  <style>
  .url {
    display:block;
    text-align:center;
  }
  .catalog {
    display:grid;
    grid-template-columns: auto auto auto;
  }
  .header {
    display:grid;
    grid-template-columns: auto auto auto auto;
    align-items:center;
    font-weight:700;
    font-size:20px;
  }
  .chapter_title {
    font-size:28px;
  }
  .content {
    font-weight:700;
    font-size:24px;
  }
  </style>
</head>

<body>
  <a class="url" target="_blank" href="${indexPageUrl}">${novelName} 主页</a>
  <div id="catalog" class="catalog">
`;
  let index = 0;
  let content = '';
  let chapterHeader = ''
  let atLast = false;

  for (;;) {
    chapterHeader = await getChapterHeader(page);
    begin += `    <a id="anchor_catalog_${index}" href="#anchor_${index}">${chapterHeader}</a>\n`;
    content += `  <div id="anchor_${index}" class="header">\n    <div class="chapter_title"> ${chapterHeader}</div>\n`;

    const txt = await getContent(page);
    const nextPageRef = await getNextPageRef(page);
    if (nextPageRef.indexOf('index.html') !== -1) {
      atLast = true;
    }

    let pre = '';
    if (index !== 0) {
      pre += `    <a href="#anchor_${index - 1}">上一章</a>\n`;
    }
    let next = '';
    if (!atLast) {
      next = `    <a href="#anchor_${index + 1}">下一章</a>\n`;
    }
    next += '  </div>';
    content += `${pre}    <a href="#anchor_catalog_${index}">返回目录</a>\n${next}\n`;
    index += 1;

    content += `  <div class="content">${txt}\n  </div>\n`;

    if (atLast) {
      break;
    }
    await page.goto(nextPageRef);
  }

  const indexPageUrlWithTextFragment = `${indexPageUrl}#:~:text=${chapterHeader}`
  begin += '  </div>\n';
  begin += `  <a class="url" target="_blank" href="${indexPageUrlWithTextFragment}">${novelName} 最后章节</a>\n`

  const end = `
</body>
</html>
`;
  const html = begin + content + end;
  await fs.promises.writeFile(outputFile, html);
  await browser.close();
}

main();
