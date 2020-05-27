// ==UserScript==
// @name               自动进入Youtube剧场模式，打开中文字幕和解说词，记忆播放速度
// @namespace    https://greasyfork.org
// @version      2.1.0
// @description  自动进入Youtube剧场模式，汉语字幕位于播放器下方，解说词位于播放器右下侧。有字幕时，自动记忆设置的播放速度，重新进入Youtube不丢失；无字幕时，不自动调整播放速度。
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
    6. If there is transcript, open transcript
    7. If there is subtitle, save and restore play speed.
*/
function onYtNavigateFinish() {
  const MAX_VIDEO_LOAD_COUNT = 10;
  const MAX_SUBTITLE_MENU_LOAD_COUNT = 10;
  const MAX_MORE_ACTIONS_MENU_LOAD_COUNT = 10;
  const MAX_OPEN_TRANSCRIPT_COUNT = 10;
  const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-subtitle-play-speed';

  let playerSizeChanged = false;
  let videoLoadCount, subtitleMenuLoadCount, moreActionsMenuLoadCount, openTranscriptCount;
  videoLoadCount = subtitleMenuLoadCount = moreActionsMenuLoadCount = openTranscriptCount = 0;

  if (window.location.pathname.indexOf('/watch') === -1) {
    return;
  }

  // config on https://www.youtube.com/watch?*
  youtubeConfig();

  function youtubeConfig() {
    if (videoLoadCount === MAX_VIDEO_LOAD_COUNT) {
      return;
    }
    let videos = document.getElementsByTagName('video');
    if (videos !== null) {
      let video = videos.item(0);
      if (video !== null) {
        video.play();
        onVideoPlayed();
        return;
      }
    }
    videoLoadCount++;
    setTimeout(youtubeConfig, 1000);
  }

  function onVideoPlayed() {
    if (subtitleMenuLoadCount === MAX_SUBTITLE_MENU_LOAD_COUNT) {
      return;
    }

    if (playerSizeChanged === false) {
      setPlayerFullSize();
      playerSizeChanged = true;
    }

    let subtitlesButtons = document.getElementsByClassName('ytp-subtitles-button');
    if (subtitlesButtons !== null) {
      let subtitlesButton = subtitlesButtons[0];
      if (
        subtitlesButton !== undefined &&
        subtitlesButton !== null &&
        subtitlesButton.getAttribute('aria-pressed') !== null
      ) {
        if (subtitlesButton.getAttribute('aria-pressed') === false) {
          subtitlesButton.click();
        }
        onSubtitlesMenuLoaded();
        return;
      }
    }
    subtitleMenuLoadCount++;
    setTimeout(onVideoPlayed, 1000);
  }

  function setPlayerFullSize() {
    let sizeButtons = document.getElementsByClassName('ytp-size-button');
    if (sizeButtons !== null && sizeButtons.length === 1) {
      let sizeButton = sizeButtons[0];
      if (sizeButton.title.indexOf('剧场模式') !== -1) {
        sizeButton.click();
      }
    }
  }

  function onSubtitlesMenuLoaded() {
    turnOnSubtitle();
    adjustPlaySpeed();
  }

  function turnOnSubtitle() {
    clickSettingsButton();
    enterSubMenu('字幕');
    let result = getSubMenuButton('中文');
    if (Array.isArray(result) === false) {
      // turn on Chinese subtitle, and open transcript
      result.click();
      clickSettingsButton();
      openTranscript();
      return;
    }

    if (result.includes('自动翻译') === true) {
      // translate to Simp Chinese subtitle, and open transcript
      turnOnAutoTrans();
      openTranscript();
      return;
    }

    let length = result.length;
    for (let i = 0; i < length; i++) {
      let buttonName = result[i];
      if (buttonName.indexOf('添加字幕') !== -1 || buttonName.indexOf('关闭') !== -1) {
        continue;
      }
      // turn on non Chinese subtitle, and open transcript
      getSubMenuButton(buttonName).click();
      clickSettingsButton();
      openTranscript();
      return;
    }
    clickSettingsButton();
  }

  function clickSettingsButton() {
    let settingsButtons = document.getElementsByClassName('ytp-settings-button');
    let settingsButton = settingsButtons[0];

    settingsButton.click();
  }

  function enterSubMenu(menuName) {
    let menuItems = document.querySelectorAll('[role="menuitem"]');
    let length = menuItems.length;
    for (let i = 0; i < length; i++) {
      let innerText = menuItems[i].innerText;
      if (innerText.indexOf(menuName) !== -1) {
        menuItems[i].click();
        return;
      }
    }
  }

  function getSubMenuButton(buttonName, exactMatch) {
    let buttonNames = [];
    let menuItemRadios = document.querySelectorAll('[role="menuitemradio"]');
    let length = menuItemRadios.length;
    for (let i = length - 1; i > -1; i--) {
      let innerText = menuItemRadios[i].innerText;
      if (exactMatch === true) {
        if (innerText === buttonName) {
          return menuItemRadios[i];
        }
      } else if (innerText.indexOf(buttonName) !== -1) {
        return menuItemRadios[i];
      }
      buttonNames.push(innerText);
    }
    return buttonNames;
  }

  function turnOnAutoTrans() {
    let autoTransButton = getSubMenuButton('自动翻译');
    autoTransButton.click();
    let simpChineseButton = getSubMenuButton('中文（简体）');
    simpChineseButton.click();
  }

  function openTranscript() {
    if (moreActionsMenuLoadCount === MAX_MORE_ACTIONS_MENU_LOAD_COUNT) {
      return;
    }

    let result = clickMoreActionsMenuButton();
    if (result === true) {
      clickOpenTranscriptButton();
      return;
    }
    moreActionsMenuLoadCount++;
    setTimeout(openTranscript, 1000);
  }

  function clickMoreActionsMenuButton() {
    let dropdownTriggers = document.getElementsByClassName('dropdown-trigger');
    if (dropdownTriggers !== null) {
      let length = dropdownTriggers.length;
      for (let i = 0; i < length; i++) {
        let button = dropdownTriggers[i].children[0];
        if (button !== null && button.getAttribute('aria-label') === '其他操作') {
          button.click();
          return true;
        }
      }
    }
  }

  function clickOpenTranscriptButton() {
    if (openTranscriptCount === MAX_OPEN_TRANSCRIPT_COUNT) {
      return;
    }
    let menuItems = document.querySelectorAll('[role="option"]');
    if (menuItems !== null && menuItems.length >= 2) {
      if (menuItems[1].innerText.indexOf('打开解说词') !== -1) {
        menuItems[1].click();
        return;
      } else {
        // Timeout, the more actions menu closed automaticly. Turn on again.
        clickMoreActionsMenuButton();
      }
    }
    openTranscriptCount++;
    setTimeout(clickOpenTranscriptButton, 1000);
  }

  function adjustPlaySpeed() {
    clickSettingsButton();
    enterSubMenu('播放速度');
    listenPlaySpeedButtonClick();

    let playSpeedInLocalStorage = localStorage.getItem(PLAY_SPEED_LOCAL_STORAGE_KEY);
    if (playSpeedInLocalStorage === null) {
      clickSettingsButton();
      return;
    }

    // restore play speed
    const exactMatch = true;
    let result = getSubMenuButton(playSpeedInLocalStorage, exactMatch);
    if (Array.isArray(result) === false) {
      result.click();
    }
    clickSettingsButton();
  }

  function listenPlaySpeedButtonClick() {
    let menuItemRadios = document.querySelectorAll('[role="menuitemradio"]');
    let length = menuItemRadios.length;
    for (let i = 0; i < length; i++) {
      menuItemRadios[i].addEventListener('click', savePlaySpeed);
    }
  }

  function savePlaySpeed() {
    let playSpeed = this.innerText;
    localStorage.setItem(PLAY_SPEED_LOCAL_STORAGE_KEY, playSpeed);
  }
}

/**
require:  The document is still loading
ensure:  addEventListener on yt-navigate-finish event.
*/
(function () {
  window.addEventListener('yt-navigate-finish', onYtNavigateFinish);
})();
