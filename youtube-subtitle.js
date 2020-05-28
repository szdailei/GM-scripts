// ==UserScript==
// @name        自动进入Youtube剧场模式，双语字幕，记忆播放速度
// @namespace    https://greasyfork.org
// @version      2.1.5
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
    2. If the video is not played, or no subtitle, exit.
    3. If there is Chinese subtitle, turn on it, and open transcript.
    4. If there is non-Chinese subtitle and auto-translation, turn on the first subtitle and translate to Simp Chinese.
    5. If there is non-Chinese subtitle without auto-translation, turn on the first subtitle.
    6. If there is transcript, trun on transcript
    7. If there is subtitle, save and restore play speed.
*/
function onYtNavigateFinish() {
  const MAX_VIDEO_LOAD_COUNT = 10;
  const MAX_SUBTITLE_MENU_LOAD_COUNT = 10;
  const MAX_VIDEO_PRIMARY_INFO_LOAD_COUNT = 10;
  const TOO_FAST_COUNT = 2;
  const MAX_MORE_ACTIONS_MENU_LOAD_COUNT = 10;
  const MAX_OPEN_TRANSCRIPT_COUNT = 10;
  const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-subtitle-play-speed';

  let ytdPlayer,
    subtitlesEnableButton,
    settingsButton,
    playSpeedButton,
    subtitlesSelectButton,
    ytdVideoPrimaryInfo,
    moreActionsButton;
  let playerSizeChanged, moreActionsMenuLoadTooFast;
  playerSizeChanged = moreActionsMenuLoadTooFast = false;
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
      if (videos !== null) {
        let video = videos.item(0);
        if (video !== null) {
          video.play();
          onVideoPlayed();
          return;
        }
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
      let pressed = subtitlesEnableButton.getAttribute('aria-pressed');
      if (pressed === 'true') {
        onSubtitlesMenuLoaded();
        return;
      }
      subtitlesEnableButton.click();
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
    subtitlesSelectButton = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem-label', '字幕', false);

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

    const exactMatch = true;
    let result = getMenuItemRadio(playSpeedInLocalStorage, exactMatch);
    if (Array.isArray(result) === false) {
      result.click();
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
    let result = getMenuItemRadio('中文');
    if (Array.isArray(result) === false) {
      // turn on Chinese subtitle
      result.click();
      settingsButton.click();
      turnOnTranscript();
      return;
    }

    if (result.includes('自动翻译') === true) {
      getMenuItemRadio('自动翻译').click();
      getMenuItemRadio('中文（简体）').click();
      turnOnTranscript();
      return;
    }

    let length = result.length;
    for (let i = 0; i < length; i++) {
      let radioName = result[i];
      if (radioName.indexOf('添加字幕') !== -1 || radioName.indexOf('关闭') !== -1) {
        continue;
      }
      // turn on the first subtitle (Non-Chinese)
      getMenuItemRadio(radioName).click();
      settingsButton.click();
      return;
    }
    settingsButton.click();
  }

  function getMenuItemRadio(radioName, exactMatch) {
    let menuItemRadioNames = [];
    let menuItemRadios = ytdPlayer.querySelectorAll('[role="menuitemradio"]');
    let length = menuItemRadios.length;
    for (let i = length - 1; i > -1; i--) {
      let innerText = menuItemRadios[i].innerText;
      if (exactMatch === true) {
        if (innerText === radioName) {
          return menuItemRadios[i];
        }
      } else if (innerText.indexOf(radioName) !== -1) {
        return menuItemRadios[i];
      }
      menuItemRadioNames.push(innerText);
    }
    return menuItemRadioNames;
  }

  function turnOnTranscript() {
    if (videoPrimaryInfoLoadCount >= MAX_VIDEO_PRIMARY_INFO_LOAD_COUNT) {
      return;
    }
    let ytdVideoPrimaryInfos = document.getElementsByTagName('ytd-video-primary-info-renderer');
    if (ytdVideoPrimaryInfos !== null && ytdVideoPrimaryInfos.length > 0) {
      ytdVideoPrimaryInfo = ytdVideoPrimaryInfos[0];
      if (videoPrimaryInfoLoadCount <= TOO_FAST_COUNT) {
        moreActionsMenuLoadTooFast = true;
      }
      enterMoreActionsMenu();
      return;
    }
    videoPrimaryInfoLoadCount++;
    setTimeout(turnOnTranscript, 1000);
  }

  function enterMoreActionsMenu() {
    const maxCount = moreActionsMenuLoadTooFast
      ? MAX_MORE_ACTIONS_MENU_LOAD_COUNT + TOO_FAST_COUNT
      : MAX_MORE_ACTIONS_MENU_LOAD_COUNT;
    if (moreActionsMenuLoadCount >= maxCount) {
      return;
    }

    if (moreActionsMenuLoadTooFast === false || moreActionsMenuLoadCount >= TOO_FAST_COUNT) {
      let iconButtons = ytdVideoPrimaryInfo.getElementsByClassName('yt-icon-button');
      if (iconButtons !== null) {
        let length = iconButtons.length;
        for (let i = 0; i < length; i++) {
          if (iconButtons[i].getAttribute('aria-label') === '其他操作') {
            moreActionsButton = iconButtons[i];
            moreActionsButton.click();
            openTranscript();
            setTimeout(closeMoreActionsMenu, 1000);
            return;
          }
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
    if (menuPopupRenderers !== null && menuPopupRenderers.length > 0) {
      let length = menuPopupRenderers.length;
      for (let i = 0; i < length; i++) {
        let formattedStrings = menuPopupRenderers[i].getElementsByTagName('yt-formatted-string');
        let formattedStringsLength = formattedStrings.length;
        for (let j = 0; j < formattedStringsLength; j++) {
          if (formattedStrings[j].innerText === '打开解说词') {
            // open transcript
            formattedStrings[j].click();
            if (moreActionsMenuLoadTooFast === false) {
              return;
            }
          }
        }
      }
    }
    openTranscriptCount++;
    setTimeout(openTranscript, 1000);
  }

  function closeMoreActionsMenu() {
    let menuPopupRenderers = document.getElementsByTagName('ytd-menu-popup-renderer');
    if (menuPopupRenderers !== null && menuPopupRenderers.length > 0) {
      let length = menuPopupRenderers.length;
      for (let i = 0; i < length; i++) {
        let formattedStrings = menuPopupRenderers[i].getElementsByTagName('yt-formatted-string');
        let formattedStringsLength = formattedStrings.length;
        for (let j = 0; j < formattedStringsLength; j++) {
          if (formattedStrings[j].innerText === '举报') {
            // more actions menu opend, click the more actions button to close menu
            moreActionsButton.click();
          }
        }
      }
    }
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

  function getElementByClassNameAndInnerText(element, className, innerText, exactMatch) {
    let results = element.getElementsByClassName(className);
    if (results !== null) {
      let length = results.length;
      for (let i = 0; i < length; i++) {
        if (exactMatch === undefined || exactMatch === true) {
          if (results[i].innerText === innerText) {
            return results[i];
          }
        }
        if (exactMatch === false) {
          if (results[i].innerText.indexOf(innerText) !== -1) {
            return results[i];
          }
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
