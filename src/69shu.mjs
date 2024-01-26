#!/usr/bin/env node

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
  LOADED_TAG: '#txtright',
  outputDir: '/home/dailei/Downloads/Novel/',
};

function help() {
  const HELP = `Usage: download-all.mjs endpoint

  endpoint: https://www.69xinshu.com/.../the_first_chapter_of_novel
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
  const href = await page.evaluate(() => {
    function getNextPageButton(doc) {
      const aLinks = doc.getElementsByTagName('a');
      let nextPageButton;
      for (let i = 0, { length } = aLinks; i < length; i += 1) {
        const aLink = aLinks[i];
        if (aLink.textContent === '下一章') {
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
  return href;
}

async function getTitle(page) {
  return page.evaluate(() => {
    const titleElement = document.getElementsByTagName('h1')[0];
    if (!titleElement) return '';

    return titleElement.textContent.trim();
  });
}

async function getContent(page) {
  return page.evaluate(() => {
    const txtnavElement = document.getElementsByClassName('txtnav')[0];
    if (!txtnavElement) return '';

    const childNodes = txtnavElement.childNodes;
    let content = '';

    let isFirstLine = true;
    for (let i = 0, { length } = childNodes; i < length; i += 1) {
      const childNode = childNodes[i];
      if (childNode.nodeName === '#text') {
        const value = childNode.nodeValue.trim();
        if (value.length > 0) {
          if (!(isFirstLine && value[0] === '第' && value.indexOf('章') !== -1) && value.indexOf('(本章完)') === -1) {
            content += `${value}\n\n`;
            isFirstLine = false;
          }
        }
      }
    }
    return content;
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
  const wholeTitle = await page.title();
  const fileName = wholeTitle.split('-')[0];
  const outputFile = `${join(defaultEnv.outputDir, fileName)}.txt`;

  let title = await getTitle(page);
  let content = `${title}\n\n`;
  content += await getContent(page);

  let href = await getNextPageRef(page);
  while (href && href.indexOf('.htm') === -1) {
    await page.goto(href);
    title = await getTitle(page);
    content += `${title}\n\n`;
    content += await getContent(page);
    href = await getNextPageRef(page);
  }

  await fs.promises.writeFile(outputFile, content);
  await browser.close();
}

main();