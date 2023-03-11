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
  LOADED_TAG: '#div_baocuo',
  outputDir: '/home/dailei/Downloads/Novel/',
};

function help() {
  const HELP = `Usage: download-all.mjs endpoint

  endpoint: https://www.69shu.com/.../the_first_chapter_of_novel
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
    return nextPageButton.href;
  });
  return href;
}

async function getContent(page) {
  return page.evaluate(() => {
    const txtnavElement = document.getElementsByClassName('txtnav')[0];
    const childNodes = txtnavElement.childNodes;
    let content = '';

    for (let i = 0, { length } = childNodes; i < length; i += 1) {
      const childNode = childNodes[i];
      if (childNode.nodeName === '#text') {
        const value = childNode.nodeValue.trim();
        if (value.length > 0) {
          content += `${value}\n\n`;
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
  const title = wholeTitle.split('-')[0];
  const outputFile = `${join(defaultEnv.outputDir, title)}.txt`;

  let content = await getContent(page);

  let href = await getNextPageRef(page);
  while (href.indexOf('.htm') === -1) {
    await page.goto(href);
    content += await getContent(page);
    href = await getNextPageRef(page);
  }

  await fs.promises.writeFile(outputFile, content);
  await browser.close();
}

main();
