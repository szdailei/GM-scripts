// ==UserScript==
// @name        Youtube剧场模式，双语字幕，记忆播放速度
// @namespace    https://greasyfork.org
// @version      2.2.0
// @description  自动进入Youtube剧场模式，中文字幕位于播放器下方，解说词位于播放器右下侧。有字幕时，自动记忆设置的播放速度，重新进入Youtube不丢失；无字幕时，不自动调整播放速度。
// @author      szdailei@gmail.com
// @source      https://github.com/szdailei/GM-scripts
// @match       https://www.youtube.com/*
// @run-at       document-start
// ==/UserScript==

'use strict';
/**
require:  Trigger the event yt-navigate-finish. That's a special event in www.youtube.com, happens when open link in an exsit tab.
ensure: 
    1. Open theater mode.
    2. If there is subtitle, save and restore play speed.
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
    openTranscriptButton;
  let playerSizeChanged = false;
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

    if (playerSizeChanged === false) {
      setPlayerFullSize();
      playerSizeChanged = true;
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

  function setPlayerFullSize() {
    let sizeButtons = ytdPlayer.getElementsByClassName('ytp-size-button');
    if (sizeButtons !== null && sizeButtons.length === 1) {
      let sizeButton = sizeButtons[0];
      if (sizeButton.title.indexOf('剧场模式') !== -1) {
        sizeButton.click();
      }
    }
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
          iconButtons[i].click();
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
          setTimeout(closeMoreActionsMenu, 300);
          return;
        }
      }
    }

    openTranscriptCount++;
    setTimeout(openTranscript, 1000);
  }

  function closeMoreActionsMenu() {
    //click openTranscriptButton again to close the more actions menu
    openTranscriptButton.click();
    return;
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
