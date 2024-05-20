import puppeteer from 'puppeteer-core';
import { assert } from 'puppeteer-core';

const defaultEnv = {
  PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
  viewPort: {
    width: 1920,
    height: 1080,
  },
};

async function getNextPageRefInfo(page) {
  const result = await page.evaluate(() => {
    const aLinks = document.getElementsByTagName('a');
    const { length } = aLinks;
    let nextPageRefInfo = {};
    for (let i = 0; i < length; i += 1) {
      const aLink = aLinks[i];
      txt = aLink.text;
      if (txt.indexOf('下一页') !== -1) {
        nextPageRefInfo = { nextPageRef: aLink.href, isNextPageExist: true };
        return JSON.stringify(nextPageRefInfo);
      } else if (txt.indexOf('下一章') !== -1) {
        nextPageRefInfo = { nextPageRef: aLink.href, isNextPageExist: false };
        return JSON.stringify(nextPageRefInfo);
      }
    }
    return JSON.stringify(nextPageRefInfo);
  });

  const obj = JSON.parse(result);
  return obj;
}

async function getNovelName(page) {
  const title = await page.title();
  let pureTitle = '';
  const { length } = title;
  for (let i = 0; i < length; i += 1) {
    const char = title[i];
    if (char === ' ' || char === '-' || char === '_' || char === ',') {
      break;
    }
    pureTitle += char;
  }
  const fields = pureTitle.split('最新章节')
  return fields[0];
}

async function getChapterHeader(page) {
  return page.evaluate(() => {
    const headerElements = document.getElementsByTagName('h1');
    const { length } = headerElements;
    let headerElement = headerElements[length - 1]
    if (!headerElement) return '';

    return headerElement.textContent.trim();
  });
}

async function getContentNodeInfo(page) {
  const result = await page.evaluate(() => {
    let largestTxtNode = null;
    let largestTxtCount = 0;

    function traverseNodesByDepthFirst(currentNode) {
      const { childNodes } = currentNode;
      if (!childNodes) return;

      const { length } = childNodes;
      for (let i = 0; i < length; i += 1) {
        const child = childNodes[i];
        const { nodeName, nodeValue } = child;
        if (nodeName === 'SCRIPT') continue;

        if (nodeName === '#text') {
          if (nodeValue.length > largestTxtCount) {
            largestTxtNode = child;
            largestTxtCount = nodeValue.length;
          }
          continue;
        }

        traverseNodesByDepthFirst(child);
      }
    }

    function findParent(currentNode) {
      const currentParent = currentNode.parentNode;
      if (currentParent.nodeName !== 'P') {
        return currentParent;
      }

      const contentNode = findParent(currentParent);
      return contentNode;
    }

    function checkMultiPages() {
      const aLinks = document.getElementsByTagName('a');
      const { length } = aLinks;
      for (let i = 0; i < length; i += 1) {
        const aLink = aLinks[i];
        txt = aLink.text;
        if (txt.indexOf('下一页') !== -1 && aLinks[i - 2].text.indexOf('上一章') !== -1) {
          return true;
        }
      }
      return false;
    }

    traverseNodesByDepthFirst(document.body);
    if (!largestTxtNode) return null;

    const contentNode = findParent(largestTxtNode);

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
      let contentNode;

      const id = arg1;
      const className = arg2;
      if (id) {
        contentNode = document.getElementById(id);
      } else {
        contentNode = document.getElementsByClassName(className)[0];
      }
      if (!contentNode) return null;

      const childNodes = contentNode.childNodes;
      let txt = '';

      let isFirstLine = true;
      const { length } = childNodes;

      for (let i = 0; i < length; i += 1) {
        const childNode = childNodes[i];
        if (childNode.nodeName === '#text') {
          const value = childNode.nodeValue.trim();
          if (value.length > 0) {
            if (!(isFirstLine && value[0] === '第' && value.indexOf('章') !== -1) && value.indexOf('(本章完)') === -1) {
              txt += `${value}\n<br>`;
              isFirstLine = false;
            }
          }
        } else if (childNode.nodeName === 'P') {
          txt += `${childNode.textContent}\n<br>`;
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
    const { length } = aLinks;
    for (let i = 0; i < length; i += 1) {
      const aLink = aLinks[i];
      txt = aLink.text.trim();
      if (txt === '目录' || txt === '书页' || txt === '章节目录' || txt === '书 页' || txt === '章节列表' || txt.indexOf('返回目录') !== -1) {
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
    grid-template-columns: 1fr 1fr 1fr;
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
  <a class="url" target="_blank" href="${indexPageUrlWithTextFragment}">${novelName}</a>
  <div id="catalog" class="catalog">
`;

  return start;
}

async function evalNovel(endpoint) {
  const browser = await puppeteer.launch({
    executablePath: defaultEnv.PUPPETEER_EXECUTABLE_PATH,
    headless: 'new',
    defaultViewport: defaultEnv.viewPort,
  });

  const page = await browser.newPage();
  await page.goto(endpoint);
  const novelName = await getNovelName(page);
  const indexPageUrl = await getIndexPageUrl(page);

  const contentNodeInfo = await getContentNodeInfo(page);

  if (!contentNodeInfo) {
    console.log(`\n\n${endpoint} 网址没有正文，无法开始下载`);
    process.exit(1);
  }

  const { id, className, isMultiPagesInOneChapter } = contentNodeInfo;

  const selectorOfContent = id ? `#${id}` : `.${className}`;

  console.log(
    `NovelName: ${novelName}\nIndexPageUrl: ${indexPageUrl}\nselectorOfWait: ${selectorOfContent}\nisMultiPagesInOneChapter: ${isMultiPagesInOneChapter}`
  );

  let catalog = '';
  let index = 0;
  let content = '';
  let chapterHeader = '';
  let txt = '';

  for (; ;) {
    const origTxt = await getContent(page, id, className);
    if (!origTxt) {
      console.log(`\n\n${page.url} 网址没有正文，提前结束下载`);
      break;
    }

    txt += origTxt;

    const nextPageRefInfo = await getNextPageRefInfo(page);
    const { nextPageRef, isNextPageExist } = nextPageRefInfo;
    const isChapterFinished = !isMultiPagesInOneChapter || !isNextPageExist;
    const isLastChapter = !nextPageRef || nextPageRef === indexPageUrl;

    if (isChapterFinished || isLastChapter) {
      chapterHeader = await getChapterHeader(page);
      console.log(chapterHeader);
      catalog += `    <div><a id="anchor_catalog_${index}" href="#anchor_${index}">${chapterHeader}</a></div>\n`;
      content += `  <div id="anchor_${index}" class="header">\n    <div class="chapter_title"> ${chapterHeader}</div>\n`;

      let pre = '';
      if (index !== 0) {
        pre += `    <a href="#anchor_${index - 1}">上一章</a>\n`;
      }
      let next = '';
      if (nextPageRef) {
        next = `    <a href="#anchor_${index + 1}">下一章</a>\n`;
      }
      next += '  </div>';
      content += `${pre}    <a href="#anchor_catalog_${index}">返回目录</a>\n${next}\n`;
      index += 1;

      content += `  <div class="content">${txt}  </div>\n`;

      txt = '';
    }

    if (isLastChapter) {
      console.log(`\n\n《${novelName}》下载完成`);
      break;
    }

    try {
      await page.goto(nextPageRef);
      await page.waitForSelector(selectorOfContent, {
        timeout: 5000,
      });
    } catch (error) {
      console.log(`${error.message}\n\n《${novelName}》下载了部分章节`);
      break;
    }
  }

  const indexPageUrlWithTextFragment = `${indexPageUrl}#:~:text=${chapterHeader}`;

  catalog += '  </div>\n\n';
  const end = `
</body>
</html>
`;
  const start = createStartOfHtml(indexPageUrlWithTextFragment, novelName);
  const html = start + catalog + content + end;

  await browser.close();
  return { novelName, html };
}

export default evalNovel;
