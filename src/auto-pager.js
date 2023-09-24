// ==UserScript==
// @name        Auto pager - 69shuba.com
// @namespace   Violentmonkey Scripts
// @match       https://www.69shuba.com/txt/*
// @grant       none
// @version     1.0
// @author      -
// @description Auto pager for novel site
// ==/UserScript==

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

function getNextPageRef(doc) {
  const nextPageButton = getNextPageButton(doc);
  const { href } = nextPageButton;
  return href;
}

let isAppended = false;

function onKeydown(event) {
  const nextPageRef = getNextPageRef(document);
  if (event.keyCode == 37) document.location = preview_page;
  if (event.keyCode == 39) document.location = nextPageRef;
  if (event.keyCode == 13) document.location = index_page;
}

function onScroll() {
  const nextPageRef = getNextPageRef(document);
  let contentElement;
  let nextPageButton;
  let req;
  if (!nextPageRef || isAppended) {
    return;
  }

  function myFunc() {
    const res = req.response;
    const frag = document.createDocumentFragment();

    const nextPageContentElement = res.getElementsByClassName('txtnav')[0];
    const text = nextPageContentElement.textContent;
    const lines = text.split('\n');

    // The top  and last are ads, skip
    for (let i = 0, { length } = lines; i < length; i += 1) {
      const line = lines[i];
      if (line.indexOf('loadAdv') === -1) {
        const textNode = document.createTextNode(line);
        frag.appendChild(textNode);
      }
      const brElement = document.createElement('BR');
      frag.appendChild(brElement);
    }

    contentElement.appendChild(frag);
    nextPageButton.parentNode.replaceChild(getNextPageButton(res), nextPageButton);
    isAppended = false;
  }

  const isNearBottom = window.innerHeight + window.pageYOffset + 1800 >= document.body.offsetHeight;
  if (isNearBottom) {
    isAppended = true;
    contentElement = document.getElementsByClassName('txtnav')[0];
    nextPageButton = getNextPageButton(document);

    req = new XMLHttpRequest();
    req.open('GET', nextPageRef);
    req.responseType = 'document';
    req.onload = myFunc;
    req.send();
  }
}

addEventListener('scroll', onScroll);
addEventListener('keydown', onKeydown);
