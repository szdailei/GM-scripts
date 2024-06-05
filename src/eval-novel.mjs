/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
import os from 'os';
import fs from 'fs';
import inquirer from 'inquirer';
import puppeteer from 'puppeteer-core';

const defaultEnv = {
  PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
  viewPort: {
    width: 1920,
    height: 1080,
  },
};

async function hasVerificationCode(page) {
  const result = await page.evaluate(() => {
    const inputs = document.getElementsByTagName('input');
    for (let i = 0, { length } = inputs; i < length; i += 1) {
      const input = inputs[i];
      const placeholder = input.getAttribute('placeholder');
      if (placeholder && placeholder.indexOf('验证码') !== -1) {
        return true;
      }
    }
    return false;
  });

  return result;
}

async function submitVerificationCode(page, verificationCode) {
  await page.evaluate((arg1) => {
    const inputs = document.getElementsByTagName('input');
    let foundInput = false;
    for (let i = 0, { length } = inputs; i < length; i += 1) {
      const input = inputs[i];
      const placeholder = input.getAttribute('placeholder');
      if (placeholder && placeholder.indexOf('验证码') !== -1) {
        input.value = arg1;
        foundInput = true;
      }
      if (foundInput && input.type === 'submit') {
        input.click();
        return;
      }
    }
  }, verificationCode);
}

async function getBase64StrOfVerficationCodeImage(page) {
  const result = await page.evaluate(() => {
    function createBase64Png(img) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');

      const base64Str = dataURL.replace('data:image/png;base64,', '');
      const urlsafeBase64Str = base64Str.replace(/\+/g, '-');
      return urlsafeBase64Str.replace(/\//g, '_');
    }

    const images = document.getElementsByTagName('img');
    for (let i = 0, { length } = images; i < length; i += 1) {
      const image = images[i];
      const { nextSibling } = image;
      if (nextSibling && nextSibling.nodeName === '#text' && nextSibling.nodeValue.indexOf('刷新') !== -1) {
        return createBase64Png(image);
      }
    }
    return null;
  });

  return result;
}

async function getNextPageRefInfo(page) {
  const result = await page.evaluate(() => {
    const aLinks = document.getElementsByTagName('a');
    const { length } = aLinks;
    const nextPageRefInfo = {};
    for (let i = 0; i < length; i += 1) {
      const aLink = aLinks[i];
      const txt = aLink.text;
      if (txt.indexOf('下一页') !== -1) {
        nextPageRefInfo.nextPageRef = aLink.href;
      }
      if (txt.indexOf('下一章') !== -1 || txt.indexOf('下一篇') !== -1) {
        nextPageRefInfo.nextChapterRef = aLink.href;
      }
    }
    return JSON.stringify(nextPageRefInfo);
  });

  const obj = JSON.parse(result);
  return obj;
}

async function getNovelNameByIndexPageUrl(page) {
  const fullTitle = await page.title();
  let realTitle = '';
  const { length } = fullTitle;
  for (let i = 0; i < length; i += 1) {
    const char = fullTitle[i];
    if (char === ' ' || char === '-' || char === '_' || char === ',' || char === '(') {
      break;
    }
    realTitle += char;
  }

  if (realTitle.indexOf('全文') !== -1) [realTitle] = realTitle.split('全文');
  if (realTitle.indexOf('最新章节') !== -1) [realTitle] = realTitle.split('最新章节');
  if (realTitle.indexOf('目录') !== -1) [realTitle] = realTitle.split('目录');

  return realTitle;
}

async function getIndexPageLinks(page) {
  const result = await page.evaluate(() => {
    const aLinks = document.getElementsByTagName('a');
    const indexPageLinks = [];
    const { length } = aLinks;
    for (let i = 0; i < length; i += 1) {
      const aLink = aLinks[i];
      const indexPageLink = { href: aLink.href, text: aLink.textContent };
      indexPageLinks.push(indexPageLink);
    }
    return JSON.stringify(indexPageLinks);
  });

  const obj = JSON.parse(result);
  return obj;
}

function getChapterHeaderByIndexPageLinks(chapterUrl, indexPageLinks) {
  const { length } = indexPageLinks;
  for (let i = 0; i < length; i += 1) {
    const indexPageLink = indexPageLinks[i];
    if (indexPageLink.href === chapterUrl) {
      return indexPageLink.text;
    }
  }
  return null;
}

async function getContentNodeInfo(page) {
  const result = await page.evaluate(() => {
    let largestTxtNode;
    let largestTxtCount = 0;

    function traverseNodesByDepthFirst(currentNode) {
      const { childNodes } = currentNode;
      if (!childNodes) return;

      const { length } = childNodes;
      for (let i = 0; i < length; i += 1) {
        const child = childNodes[i];

        const { nodeName, children } = child;
        const txtCount = child.textContent.length;
        if (
          nodeName !== 'SCRIPT' &&
          nodeName !== 'HEADER' &&
          nodeName !== 'FOOTER' &&
          children &&
          txtCount > largestTxtCount
        ) {
          const childrenLength = children.length;
          for (let j = 0; j < childrenLength; j += 1) {
            // Because ads may has long text, so only text with one or more blank lines are considered novel text
            if (children[j].tagName === 'BR') {
              largestTxtNode = child;
              largestTxtCount = txtCount;
              break;
            }
          }
          if (child !== largestTxtNode) {
            traverseNodesByDepthFirst(child);
          }
        }
      }
    }

    function checkMultiPages() {
      const aLinks = document.getElementsByTagName('a');
      const { length } = aLinks;
      let hasPrePageLink = false;
      let hasNextPageLink = false;
      for (let i = 0; i < length; i += 1) {
        const aLink = aLinks[i];
        const txt = aLink.text;
        if (txt.indexOf('上一页') !== -1) {
          hasPrePageLink = true;
        } else if (txt.indexOf('下一页') !== -1) {
          hasNextPageLink = true;
        }
      }
      const isMultiPages = hasNextPageLink && !hasPrePageLink;
      return isMultiPages;
    }

    traverseNodesByDepthFirst(document.body);
    if (!largestTxtNode) return null;

    const contentNode = largestTxtNode;

    const isMultiPagesInOneChapter = checkMultiPages();

    const contentNodeInfo = {
      id: contentNode.id,
      className: contentNode.className,
      isMultiPagesInOneChapter,
    };
    return JSON.stringify(contentNodeInfo);
  });

  if (!result) return null;

  const obj = JSON.parse(result);
  return obj;
}

async function getContent(page, id, className) {
  const result = await page.evaluate(
    (arg1, arg2) => {
      function isNumeric(str) {
        return /^\d+$/.test(str);
      }

      let contentNode;

      if (arg1) {
        contentNode = document.getElementById(arg1);
      } else {
        const theFirstClassName = arg2.split(' ')[0];
        [contentNode] = document.getElementsByClassName(theFirstClassName);
      }
      if (!contentNode) return null;

      const { childNodes } = contentNode;
      let txt = '';

      let isFirstLine = true;
      const { length } = childNodes;

      for (let i = 0; i < length; i += 1) {
        const childNode = childNodes[i];
        if (childNode.nodeName === '#text') {
          const value = childNode.nodeValue.trim();
          if (value.length > 0) {
            if (
              !(isFirstLine && value[0] === '第' && value.indexOf('章') !== -1) &&
              value.indexOf('(本章完)') === -1 &&
              value.indexOf('本章未完，请点击下一页') === -1 &&
              value.indexOf('看完记得收藏【') === -1
            ) {
              const theFirst = value.split('。。')[0];
              if (!isNumeric(theFirst)) {
                txt += `${value}\n<br>`;
                isFirstLine = false;
              }
            }
          }
        }
      }

      return txt;
    },
    id,
    className
  );

  return result;
}

async function getIndexPageUrl(page) {
  const result = await page.evaluate(() => {
    const aLinks = document.getElementsByTagName('a');

    for (let i = 0, { length } = aLinks; i < length; i += 1) {
      const aLink = aLinks[i];
      const txt = aLink.text.trim();
      if (txt.indexOf('目录') !== -1 || txt.indexOf('章节') !== -1) {
        return aLink.href;
      }
    }
    return null;
  });

  return result;
}

function createStartOfHtml(indexPageUrlWithTextFragment, novelName) {
  const start = `<!DOCTYPE html>
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
    grid-template-columns:1fr 1fr 1fr;
  }
  .header {
    display:grid;
    grid-template-columns:auto auto auto auto;
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
  <div class="url"><a target="_blank" href="${indexPageUrlWithTextFragment}">${novelName}</a></div>
  <div id="catalog" class="catalog">
`;

  return start;
}

async function evalNovel(endpoint) {
  const browser = await puppeteer.launch({
    executablePath: defaultEnv.PUPPETEER_EXECUTABLE_PATH,
    headless: 'new',
    defaultViewport: defaultEnv.viewPort,
    args: ['--proxy-server=localhost:7890'],
  });

  const page = await browser.newPage();
  await page.goto(endpoint, { timeout: 5000, waitUntil: 'load' });

  if (hasVerificationCode(page)) {
    const base64Str = await getBase64StrOfVerficationCodeImage(page);
    console.log('有验证码，退出');
    const userHomeDir = os.homedir();
    fs.writeFileSync(`${userHomeDir}/verification_code.png`, base64Str, 'base64');

    const questions = [
      {
        type: 'input',
        name: 'name',
        message: '请输入验证码?',
      },
    ];
    const answers = await inquirer.prompt(questions);
    await submitVerificationCode(page, answers.name);
    await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });

    const result = await page.evaluate(() => {
      const body = document.getElementsByTagName('body')[0];
      return body.innerHTML;
    });
    console.log('body.innerHTML', result);
  }

  const indexPageUrl = await getIndexPageUrl(page);
  if (!indexPageUrl) {
    console.log(`\n没有在 ${endpoint} 里面发现目录，退出`);
    process.exit(1);
  }
  await page.goto(indexPageUrl);
  const novelName = await getNovelNameByIndexPageUrl(page);
  const indexPageLinks = await getIndexPageLinks(page);

  await page.goto(endpoint);
  const contentNodeInfo = await getContentNodeInfo(page);

  if (!contentNodeInfo) {
    console.log(`\n没有在 ${endpoint} 里面发现正文，退出`);
    process.exit(1);
  }

  const { id, className, isMultiPagesInOneChapter } = contentNodeInfo;

  let selectorOfContent;
  if (id) {
    selectorOfContent = `#${id}`;
  } else {
    const theFirstClassName = className.split(' ')[0];
    selectorOfContent = `.${theFirstClassName}`;
  }

  console.log(
    `NovelName: ${novelName}\nIndexPageUrl: ${indexPageUrl}\nselectorOfWait: ${selectorOfContent}\nisMultiPagesInOneChapter: ${isMultiPagesInOneChapter}`
  );

  let catalog = '';
  let index = 0;
  let content = '';
  let chapterHeader;
  let txt = '';

  for (;;) {
    if (!chapterHeader) {
      chapterHeader = getChapterHeaderByIndexPageLinks(page.url().split('?')[0], indexPageLinks);
      if (!chapterHeader) {
        console.log(`\n\nIndexPage没有 ${page.url()} 的链接，退出`);
        break;
      }
      console.log(chapterHeader);
    }

    const origTxt = await getContent(page, id, className);
    if (!origTxt) {
      console.log(`\n\n${page.url()} 网址没有正文，提前结束下载`);
      break;
    }

    txt += origTxt;

    const nextPageRefInfo = await getNextPageRefInfo(page);
    const { nextPageRef, nextChapterRef } = nextPageRefInfo;
    const isChapterFinished = !isMultiPagesInOneChapter || (!nextPageRef && nextChapterRef);
    const isLastChapter = !nextChapterRef || nextChapterRef === indexPageUrl || !nextChapterRef.startsWith('http');

    if (isChapterFinished || isLastChapter) {
      catalog += `    <div><a id="anchor_catalog_${index}" href="#anchor_${index}">${chapterHeader}</a></div>\n`;
      content += `  <div id="anchor_${index}" class="header">\n    <div class="chapter_title"> ${chapterHeader}</div>\n`;
      chapterHeader = null;

      let pre = '';
      if (index !== 0) {
        pre += `    <div><a href="#anchor_${index - 1}">上一章</a></div>\n`;
      }
      let next = '';
      if (nextChapterRef) {
        next = `    <div><a href="#anchor_${index + 1}">下一章</a></div>\n`;
      }
      next += '  </div>';
      content += `${pre}    <div><a href="#anchor_catalog_${index}">返回目录</a></div>\n${next}\n`;
      index += 1;

      content += `  <div class="content">${txt}  </div>\n`;

      txt = '';
    }

    if (isLastChapter) {
      console.log(`\n\n《${novelName}》下载完成`);
      break;
    }

    try {
      if (nextPageRef) {
        await page.goto(nextPageRef);
      } else {
        await page.goto(nextChapterRef);
      }
      await page.waitForSelector(selectorOfContent, {
        timeout: 5000,
      });
    } catch (error) {
      console.log(`${error.message}\n\n《${novelName}》下载了部分章节`);
      break;
    }
  }

  catalog += '  </div>\n\n';
  const end = `
</body>
</html>
`;
  const start = createStartOfHtml(indexPageUrl, novelName);
  const html = start + catalog + content + end;

  await browser.close();
  return { novelName, html };
}

export default evalNovel;
