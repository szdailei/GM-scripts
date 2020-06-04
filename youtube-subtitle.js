// ==UserScript==
// @name        Youtube双语字幕-下载解说词-记忆播放速度
// @namespace    https://greasyfork.org
// @version      2.3.5
// @description  自动打开中文字幕和解说词。解说词可选择语言并下载。有字幕时，自动记忆设置的播放速度，重新进入Youtube不丢失；无字幕时，不自动调整播放速度。
// @author      szdailei@gmail.com
// @source      https://github.com/szdailei/GM-scripts
// @match       https://www.youtube.com/*
// @run-at       document-start
// ==/UserScript==

'use strict';
/**
require:  Trigger the yt-navigate-finish event on www.youtube.com.
ensure: 
    1. If there is subtitle enable button, enable subtitle, save and restore play speed. If no, exit.
    2. If there is Chinese subtitle, turn on it. If no, but with auto-translation, translate to Simp Chinese.
    3. If there is transcript, trun on transcript.
*/
function onYtNavigateFinish() {
  if (window.location.pathname.indexOf('/watch') === -1) {
    return;
  }
  // config on https://www.youtube.com/watch?*
  youtubeConfig();
}

async function youtubeConfig() {
  let ytdPlayer = await waitUntil(document.getElementById('ytd-player'));
  let settingsButton = await waitUntil(
    getElementByClassNameAndAttribute(ytdPlayer, 'ytp-settings-button', 'aria-label', '设置')
  );
  let subtitlesEnableButton = getElementByClassNameAndAttribute(
    ytdPlayer,
    'ytp-subtitles-button',
    'aria-label',
    '字幕 (c)'
  );

  if (subtitlesEnableButton === null || subtitlesEnableButton.style.display === 'none') {
    return;
  }
  if (subtitlesEnableButton.getAttribute('aria-pressed') === 'false') {
    subtitlesEnableButton.click();
  }

  settingsButton.click();
  let playSpeedsRadio = await waitUntil(
    getElementByClassNameAndTextContent(ytdPlayer, 'ytp-menuitem-label', '播放速度')
  );
  let subtitlesRadio = getElementByClassNameAndPartTextContent(ytdPlayer, 'ytp-menuitem-label', '字幕');
  listenAndRestorePlaySpeed(ytdPlayer, playSpeedsRadio);

  subtitlesRadio.click();
  turnOnSubtitle(ytdPlayer, settingsButton);
  turnOnTranscript();
}

async function listenAndRestorePlaySpeed(player, playSpeedsRadio) {
  const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-subtitle-play-speed';

  function savePlaySpeed() {
    let playSpeed = this.textContent;
    localStorage.setItem(PLAY_SPEED_LOCAL_STORAGE_KEY, playSpeed);
  }

  playSpeedsRadio.click();
  let normalSpeedRadio = await waitUntil(getElementByClassNameAndTextContent(player, 'ytp-menuitem', '正常'));
  let playSpeedMenu = normalSpeedRadio.parentElement;

  let menuItemRadios = playSpeedMenu.querySelectorAll('[role="menuitemradio"]');
  for (let radio of menuItemRadios) {
    radio.addEventListener('click', savePlaySpeed);
  }

  let playSpeedInLocalStorage = localStorage.getItem(PLAY_SPEED_LOCAL_STORAGE_KEY);
  if (playSpeedInLocalStorage === null) {
    return;
  }
  let radio = getElementByClassNameAndTextContent(playSpeedMenu, 'ytp-menuitem', playSpeedInLocalStorage);
  if (radio === null) {
    return;
  }
  let ariaChecked = radio.getAttribute('aria-checked');
  if (ariaChecked === 'true') {
    return;
  }
  radio.click();
}

async function turnOnSubtitle(player, settingsButton) {
  let closeSubtitleRadio = await waitUntil(getElementByClassNameAndTextContent(player, 'ytp-menuitem', '关闭'));
  let subtitleMenu = closeSubtitleRadio.parentElement;
  let chineseSubtitleRadio = getElementByClassNameAndPartTextContent(subtitleMenu, 'ytp-menuitem', '中文');
  if (chineseSubtitleRadio !== null) {
    chineseSubtitleRadio.click();
    settingsButton.click();
  } else {
    let autoTransRadio = getElementByClassNameAndTextContent(subtitleMenu, 'ytp-menuitem', '自动翻译');
    if (autoTransRadio === null) {
      return;
    }
    autoTransRadio.click();
    let transToSimpChineseRadio = await waitUntil(
      getElementByClassNameAndTextContent(player, 'ytp-menuitem', '中文（简体）')
    );
    transToSimpChineseRadio.click();
  }
}

async function turnOnTranscript() {
  let infoContents = await waitUntil(document.getElementById('info-contents'));
  let moreActionsMenuButton = await waitUntil(
    getElementByClassNameAndAttribute(infoContents, 'yt-icon-button', 'aria-label', '其他操作')
  );
  moreActionsMenuButton.click();
  let menuPopupRenderers = await waitUntil(document.getElementsByTagName('ytd-menu-popup-renderer'));
  let items = menuPopupRenderers[0].querySelector('#items');
  let openTranscriptRadio = getElementByTagNameAndTextContent(items, 'yt-formatted-string', '打开解说词');
  if (openTranscriptRadio === null) {
    moreActionsMenuButton.click();
    return;
  }

  openTranscriptRadio.click();
  let panels = await waitUntil(document.getElementById('panels'));
  let actionButton = panels.querySelector('#action-button');
  addTranscriptDownloadButton(actionButton);
}

function addTranscriptDownloadButton(actionButton) {
  let previousElementSibling = actionButton.previousElementSibling;
  if (previousElementSibling.textContent.indexOf('下载解说词') !== -1) {
    return;
  }

  let transcriptDownloadButton = document.createElement('paper-button');
  transcriptDownloadButton.className = 'style-scope ytd-subscribe-button-renderer';
  transcriptDownloadButton.textContent = '下载解说词';

  actionButton.parentNode.insertBefore(transcriptDownloadButton, actionButton);
  transcriptDownloadButton.addEventListener('click', onTranscriptDownloadButtonClick);
}

function onTranscriptDownloadButtonClick() {
  let infoContents = document.getElementById('info-contents');
  let titles = infoContents.getElementsByTagName('h1');
  let filename = titles[0].textContent + '.srt';

  let panels = document.getElementById('panels');
  let cueGroups = panels.getElementsByClassName('cue-group');
  if (cueGroups === null) {
    return;
  }
  let content = getFormattedSRT(cueGroups);
  saveTextAsFile(filename, content);
}

function getFormattedSRT(cueGroups) {
  let content = '';
  let length = cueGroups.length;
  for (let i = 0; i < length; i++) {
    let currentSubtitleStartOffsets = cueGroups[i].getElementsByClassName('cue-group-start-offset');
    let startTime = currentSubtitleStartOffsets[0].textContent.split('\n').join('').trim();
    let endTime;
    if (i === length - 1) {
      endTime = getLastSubtitleEndTime(startTime);
    } else {
      let nextSubtitleStartOffsets = cueGroups[i + 1].getElementsByClassName('cue-group-start-offset');
      endTime = nextSubtitleStartOffsets[0].textContent.split('\n').join('').trim();
    }

    let serialNumberLine = i + 1 + '\n';
    let timeLine = '00:' + startTime + ',000' + '  --> ' + '00:' + endTime + ',000' + '\n';
    let cues = cueGroups[i].getElementsByClassName('cue');
    let contentLine = cues[0].textContent.split('\n').join('').trim() + '\n';
    content = content + serialNumberLine + timeLine + contentLine + '\n';
  }
  return content;
}

function getLastSubtitleEndTime(startTime) {
  // assume 2 minutes long of the last subtitle
  let startTimes = startTime.split(':');
  let minuteNumber = parseInt(startTimes[0]) + 2;
  let endTime = minuteNumber.toString() + ':' + startTimes[1];
  return endTime;
}

function saveTextAsFile(filename, text) {
  let a = document.createElement('a');
  a.href = 'data:text/txt;charset=utf-8,' + encodeURIComponent(text);
  a.download = filename;
  a.click();
}

function getElementByClassNameAndAttribute(element, className, attributeName, attributeValue) {
  let results = element.getElementsByClassName(className);
  if (results !== null) {
    let length = results.length;
    for (let i = 0; i < length; i++) {
      if (results[i].getAttribute(attributeName) === attributeValue) {
        return results[i];
      }
    }
  }
  return null;
}

function getElementByClassNameAndTextContent(element, className, textContent) {
  let results = element.getElementsByClassName(className);
  if (results !== null) {
    let length = results.length;
    for (let i = 0; i < length; i++) {
      if (results[i].textContent === textContent) {
        return results[i];
      }
    }
  }
  return null;
}

function getElementByClassNameAndPartTextContent(element, className, textContent) {
  let results = element.getElementsByClassName(className);
  if (results !== null) {
    let length = results.length;
    for (let i = 0; i < length; i++) {
      if (results[i].textContent.indexOf(textContent) !== -1) {
        return results[i];
      }
    }
  }
  return null;
}

function getElementByTagNameAndTextContent(element, tagName, textContent) {
  let results = element.getElementsByTagName(tagName);
  if (results !== null) {
    let length = results.length;
    for (let i = 0; i < length; i++) {
      if (results[i].textContent === textContent) {
        return results[i];
      }
    }
  }
  return null;
}

async function waitUntil(condition) {
  return await new Promise((resolve) => {
    const interval = setInterval(() => {
      let result = condition;
      if (result !== null) {
        clearInterval(interval);
        resolve(result);
        return;
      }
    }, 100);
  });
}

/**
require:  @run-at       document-start
ensure:  
  1. addEventListener on yt-navigate-finish event.
  2. run onYtNavigateFinish() if yt-navigate-finish event triggered
*/
(function () {
  window.addEventListener('yt-navigate-finish', onYtNavigateFinish);
})();
