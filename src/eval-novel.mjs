import puppeteer from 'puppeteer-core';
import { assert } from 'puppeteer-core';

const defaultEnv = {
  PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
  PROXY: 'http://localhost:7890',
  viewPort: {
    width: 1920,
    height: 1080,
  },
};

async function getNextPageRef(page) {
  const result = await page.evaluate(() => {
    const aLinks = document.getElementsByTagName('a');
    const { length } = aLinks;
    for (let i = 0; i < length; i += 1) {
      const aLink = aLinks[i];
      txt = aLink.text.trim();
      if (txt.indexOf('下一页') !== -1 || txt.indexOf('下一章') !== -1) {
        return aLink.href;
      }
    }
    return null;
  });

  return result;
}

async function getNovelName(page) {
  const title = await page.title();
  let pureTitle = '';
  const { length } = title;
  for (let i = 0; i < length; i += 1) {
    const char = title[i];
    if (char === ' ' || char === '-' || char === '_' || char === ',') {
      return pureTitle;
    }
    pureTitle += char;
  }
  return title;
}

async function getChapterHeader(page) {
  return page.evaluate(() => {
    const headerElement = document.getElementsByTagName('h1')[0];
    if (!headerElement) return '';

    return headerElement.textContent.trim();
  });
}

async function getContentNodeInfo(page) {
  const result = await page.evaluate(() => {
    let maxContentNode = null;
    let largestTxtCount = 0;
    let contentNode = null;

    function traverseNodesByDepthFirst(currentNode) {
      const { childNodes } = currentNode;
      if (!childNodes) return;

      const { length } = childNodes;
      for (let i = 0; i < length; i += 1) {
        const child = childNodes[i];
        if (child.nodeName === '#text' && child.nodeValue.length > largestTxtCount) {
          maxContentNode = child;
          largestTxtCount = maxContentNode.nodeValue.length;
        } else if (child.nodeName !== 'SCRIPT') {
          traverseNodesByDepthFirst(child);
        }
      }
    }

    function traverseNodesByParent(currentNode) {
      const currentParent = currentNode.parentNode;
      if (currentParent.nodeName !== 'P') {
        contentNode = currentParent;
        return;
      } else {
        traverseNodesByParent(currentParent);
      }
    }

    traverseNodesByDepthFirst(document.body);
    if (!maxContentNode) return null;

    traverseNodesByParent(maxContentNode);
    const contentNodeInfo = { id: contentNode.id, className: contentNode.className };
    return JSON.stringify(contentNodeInfo);
  });

  const obj = JSON.parse(result);
  return obj;
}

async function getContent(page, contentNodeInfo) {
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
    contentNodeInfo.id,
    contentNodeInfo.className
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
      if (txt === '目录' || txt === '书页' || txt === '章节目录' || txt === '书 页' || txt.indexOf('返回目录') !== -1) {
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
  <a class="url" target="_blank" href="${indexPageUrlWithTextFragment}">${novelName} 主页</a>
  <div id="catalog" class="catalog">
`;

  return start;
}

async function evalNovel(endpoint) {
  const browser = await puppeteer.launch({
    executablePath: defaultEnv.PUPPETEER_EXECUTABLE_PATH,
    args: [`--proxy-server=${defaultEnv.PROXY}`, '--no-sandbox', '--disabled-setupid-sandbox'],
    // args: ['--no-sandbox', '--disabled-setupid-sandbox'],
    headless: 'new',
    defaultViewport: defaultEnv.viewPort,
  });

  const page = await browser.newPage();
  await page.goto(endpoint);
  const novelName = await getNovelName(page);
  const indexPageUrl = await getIndexPageUrl(page);

  const contentNodeInfo = await getContentNodeInfo(page);

  const { id, className } = contentNodeInfo;
  let selectorOfWait;
  if (id) {
    selectorOfWait = `#${id}`;
  } else {
    selectorOfWait = `.${className}`;
  }
  console.log(
    `NovelName: ${novelName}\nIndexPageUrl: ${indexPageUrl}\nContentNodeId: ${id}\nContentNodeClassName: ${className}`
  );
  console.log('selectorOfWait', selectorOfWait);

  let catalog = '';
  let index = 0;
  let content = '';
  let chapterHeader = '';

  for (;;) {
    const txt = await getContent(page, contentNodeInfo);
    if (!txt) {
      console.log('No content. Break');
      break;
    }

    chapterHeader = await getChapterHeader(page);
    console.log(chapterHeader);
    catalog += `    <div><a id="anchor_catalog_${index}" href="#anchor_${index}">${chapterHeader}</a></div>\n`;
    content += `  <div id="anchor_${index}" class="header">\n    <div class="chapter_title"> ${chapterHeader}</div>\n`;

    const nextPageRef = await getNextPageRef(page);

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
    content += `  <div class="content">${txt}  </div>`;

    index += 1;

    if (!nextPageRef || nextPageRef === indexPageUrl) {
      console.log('\n                  下载完成');
      break;
    }

    try {
      await page.goto(nextPageRef);
      await page.waitForSelector(selectorOfWait, {
        timeout: 5000,
      });
    } catch (error) {
      console.log(`${error.message}\n下载了部分章节`);
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
