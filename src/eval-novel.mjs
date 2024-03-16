import puppeteer from 'puppeteer-core';

const defaultEnv = {
  PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
  PROXY: 'http://localhost:7890',
  viewPort: {
    width: 1920,
    height: 1080,
  },
};

async function waitForDone(page, options) {
  const maxTimeout = 5000;
  await page.waitForSelector(options.selectorOfWait, {
    timeout: maxTimeout,
  });
}

async function createPageByUrl(browser, url, options) {
  const page = await browser.newPage();
  await page.goto(url);

  await waitForDone(page, options);
  return page;
}

async function getNextPageRef(page, options) {
  const nextPageRef = await page.evaluate((arg1) => {
    function getNextPageButton(doc) {
      const aLinks = doc.getElementsByTagName('a');
      let nextPageButton;
      for (let i = 0, { length } = aLinks; i < length; i += 1) {
        const aLink = aLinks[i];
        if (aLink.textContent === arg1.textOfNextChapterButton) {
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
  }, options);
  return nextPageRef;
}

async function getNovelName(page, options) {
  const title = await page.title();
  return title.split(options.delimiterInTitle)[0];
}

async function getChapterHeader(page) {
  return page.evaluate(() => {
    const headerElement = document.getElementsByTagName('h1')[0];
    if (!headerElement) return '';

    return headerElement.textContent.trim();
  });
}

async function getContent(page, options) {
  return page.evaluate((arg1) => {
    let contentElement;
    if (arg1.contentId) {
      contentElement = document.getElementById(arg1.contentId);
    } else {
      contentElement = document.getElementsByClassName(arg1.contentClass)[0];
    }

    if (!contentElement) return null;

    const childNodes = contentElement.childNodes;
    let txt = '';

    let isFirstLine = true;
    const { length } = childNodes;

    for (let i = 0; i < length; i += 1) {
      const childNode = childNodes[i];
      if (childNode.nodeName === '#text') {
        const value = childNode.nodeValue.trim();
        if (value.length > 0) {
          if (!(isFirstLine && value[0] === '第' && value.indexOf('章') !== -1) && value.indexOf('(本章完)') === -1) {
            txt += `${value}\n\n`;
            isFirstLine = false;
          }
        }
      }
    }

    return txt;
  }, options);
}

function getIndexPageUrl(endpoint, options) {
  const url = new URL(endpoint);

  const fields = url.pathname.split('/');
  let bookPath = '';
  const { length } = fields;
  for (let i = 0; i < length - 1; i += 1) {
    const field = fields[i];
    if (Number(field)) {
      bookPath += `${field}/`;
    }
  }

  let indexPageUrl = `${url.origin}/${options.prefixOfBookPath}/${bookPath}`;
  return indexPageUrl;
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
  <a class="url" target="_blank" href="${indexPageUrlWithTextFragment}">${novelName} 主页</a>
  <div id="catalog" class="catalog">
`;

  return start;
}

async function evalNovel(endpoint, options) {
  const indexPageUrl = getIndexPageUrl(endpoint, options);

  const browser = await puppeteer.launch({
    executablePath: defaultEnv.PUPPETEER_EXECUTABLE_PATH,
    args: [`--proxy-server=${defaultEnv.PROXY}`, '--no-sandbox', '--disabled-setupid-sandbox'],
    headless: 'new',
    defaultViewport: defaultEnv.viewPort,
  });

  const page = await createPageByUrl(browser, endpoint, options);
  const novelName = await getNovelName(page, options);

  let catalog = '';
  let index = 0;
  let content = '';
  let chapterHeader = '';

  for (;;) {
    const txt = await getContent(page, options);
    if (!txt) {
      break;
    }

    chapterHeader = await getChapterHeader(page);
    catalog += `    <a id="anchor_catalog_${index}" href="#anchor_${index}">${chapterHeader}</a>\n`;
    content += `  <div id="anchor_${index}" class="header">\n    <div class="chapter_title"> ${chapterHeader}</div>\n`;

    const nextPageRef = await getNextPageRef(page, options);

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
    content += `  <div class="content">${txt}\n  </div>\n`;

    index += 1;

    if (!nextPageRef) {
      break;
    }
    await page.goto(nextPageRef);
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
