// ==UserScript==
// @name               Youtube Subtitle
// @namespace    https://greasyfork.org
// @version      1.1.3
// @description  1. 打开中文字幕。2. 没有中文字幕则将第一个字幕翻译为简体中文。3. 翻译失败则使用第一个字幕。
// @author      szdailei@gmail.com
// @source      https://github.com/szdailei/GM-scripts
// @match       https://www.youtube.com/watch?v=*
// @run-at       document-start
// ==/UserScript==

'use strict';
/**
require:  Trigger the event yt-navigate-finish. That's a special event in www.youtube.com, happens when open link in an exsit tab.
ensure: 
  Meet one of the conditions as the following order:
    1. If there is Chinese subtitle, turn on it.
    2. If there is non-Chinese subtitle and auto-translation, turn on the first subtitle and translate to Simp Chinese.
    3. If there is non-Chinese subtitle without auto-translation, turn on the first subtitle.
    4. If there isn't subtitle, doesn't turn on subtitle.
*/
function youtubeSubtitle() {
  var videoLoadCount, subtitleMenuLoadCount, translateToSimpChineseCount;
  videoLoadCount = subtitleMenuLoadCount = translateToSimpChineseCount = 0;
  const MAX_VIDEO_LOAD_COUNT = 10;
  const MAX_SUBTITLE_MENU_LOAD_COUNT = 10;
  const MAX_TRANS_TO_SIMP_CHINESE_COUNT = 2;
  const CHINESE_SUBTITLE = 'Chinese Subtitle';
  const NO_SUBTITLE = 'No Subtitle';
  const NON_CHINESE_SUBTITLE = 'Non Chinese Subtitle';
  const ON_SUBTITLE_MENU = 'On Subtitle Menu';

  function onYtNavigateFinish() {
    if (videoLoadCount === MAX_VIDEO_LOAD_COUNT) {
      return;
    }
    var videos = document.getElementsByTagName('video');
    if (videos !== null) {
      var video = videos.item(0);
      if (video !== null) {
        video.play();
        onVideoPlayed();
        return;
      }
    }
    videoLoadCount++;
    setTimeout(onYtNavigateFinish, 1000);
  }

  function onVideoPlayed() {
    if (subtitleMenuLoadCount === MAX_SUBTITLE_MENU_LOAD_COUNT) {
      return;
    }
    var SubtitlesButtons = document.getElementsByClassName('ytp-subtitles-button');
    if (SubtitlesButtons !== null) {
      var SubtitlesButton = SubtitlesButtons[0];
      if (
        SubtitlesButton !== undefined &&
        SubtitlesButton !== null &&
        SubtitlesButton.getAttribute('aria-pressed') !== null
      ) {
        if (SubtitlesButton.getAttribute('aria-pressed') === false) {
          SubtitlesButton.click();
        }
        onSubtitlesMenuLoaded();
        return;
      }
    }
    subtitleMenuLoadCount++;
    setTimeout(onVideoPlayed, 1000);
  }

  function onSubtitlesMenuLoaded() {
    var turnOnChineseSubtitleResult = turnOnChineseSubtitle();
    clickSettingsButtion();
    if (turnOnChineseSubtitleResult === NON_CHINESE_SUBTITLE) {
      translateToSimpChinese();
    }
  }

  function turnOnChineseSubtitle() {
    clickSettingsButtion();
    var enterSubtitleMenuResult = enterSubtitleMenu();
    if (enterSubtitleMenuResult === CHINESE_SUBTITLE) {
      return;
    }
    var menuItemRadios = document.querySelectorAll('[role="menuitemradio"]');
    var length = menuItemRadios.length;
    var firstSubtitleIndex = 0;
    for (var i = 0; i < length; i++) {
      var innerText = menuItemRadios[i].innerText;
      if (innerText.indexOf('添加字幕') !== -1 || innerText.indexOf('关闭') !== -1) {
        continue;
      }
      firstSubtitleIndex = i;
      if (innerText.indexOf('中文') !== -1) {
        menuItemRadios[i].click();
        return CHINESE_SUBTITLE;
      }
    }
    if (firstSubtitleIndex === 0) {
      return NO_SUBTITLE;
    } else {
      menuItemRadios[firstSubtitleIndex].click();
      return NON_CHINESE_SUBTITLE;
    }
  }

  function translateToSimpChinese() {
    if (translateToSimpChineseCount === MAX_TRANS_TO_SIMP_CHINESE_COUNT) {
      return;
    }
    clickSettingsButtion();
    enterSubtitleMenu();
    var menuItemRadios = document.querySelectorAll('[role="menuitemradio"]');
    var length = menuItemRadios.length;
    if (menuItemRadios[length - 1].innerText === '自动翻译') {
      menuItemRadios[length - 1].click();
      menuItemRadios = document.querySelectorAll('[role="menuitemradio"]');
      length = menuItemRadios.length;
      for (var i = length - 1; i > -1; i--) {
        var innerText = menuItemRadios[i].innerText;
        if (innerText.indexOf('中文（简体）') !== -1) {
          menuItemRadios[i].click();
          return;
        }
      }
      clickSettingsButtion();
      return;
    }
    clickSettingsButtion();
    translateToSimpChineseCount++;
    setTimeout(translateToSimpChinese, 1000);
  }

  function clickSettingsButtion() {
    var settingsButtions = document.getElementsByClassName('ytp-settings-button');
    var settingsButtion = settingsButtions[0];
    settingsButtion.click();
  }

  function enterSubtitleMenu() {
    var menuItems = document.querySelectorAll('[role="menuitem"]');
    var length = menuItems.length;
    for (var i = 0; i < length; i++) {
      var innerText = menuItems[i].innerText;
      if (innerText.indexOf('字幕') !== -1) {
        if (innerText.indexOf('中文') !== -1) {
          return CHINESE_SUBTITLE;
        } else {
          menuItems[i].click();
          return ON_SUBTITLE_MENU;
        }
      }
    }
  }
  
  onYtNavigateFinish();
}

/**
require:  The document is still loading
ensure:  addEventListener on yt-navigate-finish event.
*/
(function () {
  window.addEventListener('yt-navigate-finish', youtubeSubtitle);
})();
