// ==UserScript==
// @name        Youtube双语字幕/下载解说词/记忆播放速度
// @namespace    https://greasyfork.org
// @version      2.3.1
// @description  自动打开中文字幕和解说词，有按钮下载解说词。有字幕时，自动记忆设置的播放速度，重新进入Youtube不丢失；无字幕时，不自动调整播放速度。
// @author      szdailei@gmail.com
// @source      https://github.com/szdailei/GM-scripts
// @match       https://www.youtube.com/*
// @run-at       document-start
// ==/UserScript==

'use strict';
/**
require:  Trigger the yt-navigate-finish event on www.youtube.com.
ensure: 
    1. Open theater mode.
    2. If there is subtitle enable button, enable subtitle, save and restore play speed. If no, exit.
    3. If there is Chinese subtitle, turn on it. If no, but with auto-translation, translate to Simp Chinese.
    4. If there is transcript, trun on transcript.
*/
function onYtNavigateFinish() {
  const MAX_VIDEO_LOAD_COUNT = 10;
  const MAX_SUBTITLE_MENU_LOAD_COUNT = 10;
  const MAX_VIDEO_PRIMARY_INFO_LOAD_COUNT = 10;
  const MIN_MORE_ACTIONS_MENU_LOAD_COUNT = 2;
  const MAX_MORE_ACTIONS_MENU_LOAD_COUNT = 10;
  const MAX_OPEN_TRANSCRIPT_COUNT = 5;
  const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-subtitle-play-speed';

  let ytdPlayer,
    subtitlesEnableButton,
    settingsButton,
    playSpeedButton,
    subtitlesSelectButton,
    ytdVideoPrimaryInfo,
    moreActionsMenuButton,
    openTranscriptButton,
    secondaryInner;
  let videoLoadCount, subtitleMenuLoadCount, videoPrimaryInfoLoadCount, moreActionsMenuLoadCount, openTranscriptCount;
  videoLoadCount = subtitleMenuLoadCount = videoPrimaryInfoLoadCount = moreActionsMenuLoadCount = openTranscriptCount = 0;

  if (window.location.pathname.indexOf('/watch') === -1) {
    return;
  }

  // config on https://www.youtube.com/watch?*
  youtubeConfig();

  function youtubeConfig() {
    if (videoLoadCount >= MAX_VIDEO_LOAD_COUNT) {
      return;
    }
    ytdPlayer = document.getElementById('ytd-player');
    if (ytdPlayer !== null) {
      let videos = ytdPlayer.getElementsByTagName('video');
      if (videos !== null && videos.length > 0 && videos.item(0) !== null) {
        onVideoPlayed();
        return;
      }
    }
    videoLoadCount++;
    setTimeout(youtubeConfig, 1000);
  }

  function onVideoPlayed() {
    if (subtitleMenuLoadCount >= MAX_SUBTITLE_MENU_LOAD_COUNT) {
      return;
    }

    subtitlesEnableButton = getElementByClassNameAndAttribute(
      ytdPlayer,
      'ytp-subtitles-button',
      'aria-label',
      '字幕 (c)'
    );
    if (subtitlesEnableButton !== null) {
      if (subtitlesEnableButton.style.display === 'none') {
        return;
      }
      if (subtitlesEnableButton.getAttribute('aria-pressed') === 'false') {
        subtitlesEnableButton.click();
      }
      onSubtitlesMenuLoaded();
      return;
    }
    subtitleMenuLoadCount++;
    setTimeout(onVideoPlayed, 1000);
  }

  function onSubtitlesMenuLoaded() {
    settingsButton = getElementByClassNameAndAttribute(ytdPlayer, 'ytp-settings-button', 'aria-label', '设置');
    settingsButton.click();

    playSpeedButton = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem-label', '播放速度');
    subtitlesSelectButton = getElementByClassNameAndPartInnerText(ytdPlayer, 'ytp-menuitem-label', '字幕');

    listenPlaySpeedButtonClickAndRestoretPlaySpeed();
    turnOnSubtitle();
  }

  function listenPlaySpeedButtonClickAndRestoretPlaySpeed() {
    settingsButton.click();
    playSpeedButton.click();
    listenPlaySpeedButtonClick();

    let playSpeedInLocalStorage = localStorage.getItem(PLAY_SPEED_LOCAL_STORAGE_KEY);
    if (playSpeedInLocalStorage === null) {
      settingsButton.click();
      return;
    }

    let radio = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem', playSpeedInLocalStorage);
    if (radio !== null) {
      radio.click();
      return;
    }
    settingsButton.click();
  }

  function listenPlaySpeedButtonClick() {
    let menuItemRadios = ytdPlayer.querySelectorAll('[role="menuitemradio"]');
    let length = menuItemRadios.length;
    for (let i = 0; i < length; i++) {
      menuItemRadios[i].addEventListener('click', savePlaySpeed);
    }
  }

  function savePlaySpeed() {
    let playSpeed = this.innerText;
    localStorage.setItem(PLAY_SPEED_LOCAL_STORAGE_KEY, playSpeed);
  }

  function turnOnSubtitle() {
    settingsButton.click();
    subtitlesSelectButton.click();
    let radio = getElementByClassNameAndPartInnerText(ytdPlayer, 'ytp-menuitem', '中文');
    if (radio !== null) {
      radio.click();
      settingsButton.click();
      turnOnTranscript();
      return;
    }

    radio = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem', '自动翻译');
    if (radio !== null) {
      radio.click();
      getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem', '中文（简体）').click();
      turnOnTranscript();
      return;
    }
    settingsButton.click();
  }

  function turnOnTranscript() {
    if (videoPrimaryInfoLoadCount >= MAX_VIDEO_PRIMARY_INFO_LOAD_COUNT) {
      return;
    }
    let ytdVideoPrimaryInfos = document.getElementsByTagName('ytd-video-primary-info-renderer');
    if (ytdVideoPrimaryInfos !== null && ytdVideoPrimaryInfos.length > 0) {
      ytdVideoPrimaryInfo = ytdVideoPrimaryInfos[0];
      let time = MIN_MORE_ACTIONS_MENU_LOAD_COUNT - videoPrimaryInfoLoadCount;
      if (time > 0) {
        setTimeout(enterMoreActionsMenu, 1000 * time);
      } else {
        enterMoreActionsMenu;
      }
      return;
    }
    videoPrimaryInfoLoadCount++;
    setTimeout(turnOnTranscript, 1000);
  }

  function enterMoreActionsMenu() {
    if (moreActionsMenuLoadCount >= MAX_MORE_ACTIONS_MENU_LOAD_COUNT) {
      return;
    }

    let iconButtons = ytdVideoPrimaryInfo.getElementsByClassName('yt-icon-button');
    if (iconButtons !== null) {
      let length = iconButtons.length;
      for (let i = 0; i < length; i++) {
        if (iconButtons[i].getAttribute('aria-label') === '其他操作') {
          moreActionsMenuButton = iconButtons[i];
          moreActionsMenuButton.click();
          openTranscript();
          return;
        }
      }
    }
    moreActionsMenuLoadCount++;
    setTimeout(enterMoreActionsMenu, 1000);
  }

  function openTranscript() {
    if (openTranscriptCount >= MAX_OPEN_TRANSCRIPT_COUNT) {
      return;
    }

    let menuPopupRenderers = document.getElementsByTagName('ytd-menu-popup-renderer');

    if (menuPopupRenderers !== null) {
      let length = menuPopupRenderers.length;
      for (let i = 0; i < length; i++) {
        openTranscriptButton = getElementByTagNameAndInnerText(
          menuPopupRenderers[i],
          'yt-formatted-string',
          '打开解说词'
        );
        if (openTranscriptButton !== null) {
          openTranscriptButton.click();
          //click openTranscriptButton again to close the more actions menu
          setTimeout(clickOpenTranscriptButton, 300);
          setTimeout(addScriptDownloadButton, 500);
          return;
        }

        let reportButton = getElementByTagNameAndInnerText(menuPopupRenderers[i], 'yt-formatted-string', '举报');
        // more actions menu opend without '打开解说词' button, click more actions menu button to close it.
        if (reportButton !== null) {
          moreActionsMenuButton.click();
          return;
        }
      }
    }

    openTranscriptCount++;
    setTimeout(openTranscript, 1000);
  }

  function clickOpenTranscriptButton() {
    openTranscriptButton.click();
    return;
  }

  function addScriptDownloadButton() {
    secondaryInner = document.getElementById('secondary-inner');
    if (secondaryInner !== null) {
      let headerRenderers = secondaryInner.getElementsByTagName('ytd-engagement-panel-title-header-renderer');
      if (headerRenderers !== null && headerRenderers.length === 1) {
        let menu = headerRenderers[0].querySelector('#menu');
        if (menu !== null) {
          let checkResult = hasScriptDownloadButton(menu);
          if (checkResult === true) {
            return;
          }
          let scriptDownloadButton = createScriptDownloadButton();
          menu.parentNode.insertBefore(scriptDownloadButton, menu);
        }
      }
    }
  }

  function hasScriptDownloadButton(menu) {
    let previousElementSibling = menu.previousElementSibling;
    if (previousElementSibling !== null && previousElementSibling.innerText === '下载解说词') {
      return true;
    }
    return false;
  }

  function createScriptDownloadButton() {
    let scriptDownloadButton = document.createElement('paper-button');
    scriptDownloadButton.className = 'style-scope ytd-subscribe-button-renderer';
    scriptDownloadButton.innerHTML = '下载解说词';
    scriptDownloadButton.addEventListener('click', scriptDownload);
    return scriptDownloadButton;
  }

  function scriptDownload() {
    let titles = ytdVideoPrimaryInfo.getElementsByClassName('title');
    if (titles === null || titles.length !== 1) {
      return;
    }
    let filename = titles[0].innerText + '.srt';

    let transcriptBodyRenderer = secondaryInner.getElementsByTagName('ytd-transcript-body-renderer');
    if (transcriptBodyRenderer === null || transcriptBodyRenderer.length !== 1) {
      return;
    }
    let transcriptBodys = transcriptBodyRenderer[0].getElementsByClassName('cue-group');
    let script = '';
    let length = transcriptBodys.length;
    for (let i = 0; i < length; i++) {
      let currentInnerText = transcriptBodys[i].innerText;
      let currentNewLinePostion = currentInnerText.indexOf('\n');
      let startTime = currentInnerText.substr(0, currentNewLinePostion);

      let endTime;
      if (i === length - 1) {
        endTime = getLastSubtitleEndTime(startTime);
      } else {
        let nextInnerText = transcriptBodys[i + 1].innerText;
        let nextNewLinePostion = nextInnerText.indexOf('\n');
        endTime = nextInnerText.substr(0, nextNewLinePostion);
      }

      let serialNumberLine = i + 1 + '\n';
      let timeLine = '00:' + startTime + ',000' + '  --> ' + '00:' + endTime + ',000' + '\n';
      let contentLine = currentInnerText.substr(currentNewLinePostion + 1);
      let newLine = '\n';

      script = script + serialNumberLine + timeLine + contentLine + newLine + '\n';
    }
    saveTextAsFile(filename, script);
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

  function getElementByClassNameAndInnerText(element, className, innerText) {
    let results = element.getElementsByClassName(className);
    if (results !== null) {
      let length = results.length;
      for (let i = 0; i < length; i++) {
        if (results[i].innerText === innerText) {
          return results[i];
        }
      }
    }
    return null;
  }

  function getElementByClassNameAndPartInnerText(element, className, innerText) {
    let results = element.getElementsByClassName(className);
    if (results !== null) {
      let length = results.length;
      for (let i = 0; i < length; i++) {
        if (results[i].innerText.indexOf(innerText) !== -1) {
          return results[i];
        }
      }
    }
    return null;
  }

  function getElementByTagNameAndInnerText(element, tagName, innerText) {
    let results = element.getElementsByTagName(tagName);
    if (results !== null) {
      let length = results.length;
      for (let i = 0; i < length; i++) {
        if (results[i].innerText === innerText) {
          return results[i];
        }
      }
    }
    return null;
  }
}

/**
require:  The document is still loading
ensure:  addEventListener on yt-navigate-finish event.
*/
(function () {
  window.addEventListener('yt-navigate-finish', onYtNavigateFinish);
})();
