// ==UserScript==
// @name               Youtube SubTitle
// @namespace    https://greasyfork.org
// @version      1.0
// @description  打开中文字幕，无中文字幕则将第一个字幕自动翻译为简体中文，无自动翻译则使用第一个字幕
// @author      szdailei@gmail.com
// @source      https://github.com/szdailei/GM-scripts
// @match       https://www.youtube.com/watch?v=*
// @run-at       document-end
// ==/UserScript==

('use strict');
(function youtubeSubTitle() {
  var waitVideoLoadCount = 0;
  var waitButtonLoadCount = 0;

  function translateToSimpChinese() {
    var menuItemRadios = document.querySelectorAll('[role="menuitemradio"]');
    var length = menuItemRadios.length;
    for (var i = length - 1; i > -1; i--) {
      var innerText = menuItemRadios[i].innerText;
      if (innerText.indexOf('中文（简体）') !== -1) {
        menuItemRadios[i].click();
        return;
      }
    }
  }

  function turnOnChineseSubTitle() {
    var menuItemRadios = document.querySelectorAll('[role="menuitemradio"]');
    var length = menuItemRadios.length;
    for (var i = 0; i < length; i++) {
      var innerText = menuItemRadios[i].innerText;
      if (
        innerText.indexOf('中文') !== -1 ||
        innerText.indexOf('中文（中国）') !== -1 ||
        innerText.indexOf('中文（香港）') !== -1 ||
        innerText.indexOf('中文（台湾）') !== -1 ||
        innerText.indexOf('中文（简体）') !== -1 ||
        innerText.indexOf('中文（繁体）') !== -1
      ) {
        menuItemRadios[i].click();
        return true;
      }
    }
    if (menuItemRadios[length - 1].innerText === '自动翻译') {
      menuItemRadios[length - 1].click();
      return false;
    }
    return undefined;
  }

  function turnOnFirstSubTitle() {
    var menuItemRadios = document.querySelectorAll('[role="menuitemradio"]');
    var length = menuItemRadios.length;
    for (var i = 0; i < length; i++) {
      var innerText = menuItemRadios[i].innerText;
      if (innerText.indexOf('添加字幕') !== -1 || innerText.indexOf('关闭') !== -1) {
        continue;
      }
      menuItemRadios[i].click();
      return true;
    }
    return false;
  }

  function enterSubtitleMenu() {
    var menuItems = document.querySelectorAll('[role="menuitem"]');
    var length = menuItems.length;
    for (var i = 0; i < length; i++) {
      var innerText = menuItems[i].innerText;
      if (innerText.indexOf('字幕') !== -1) {
        menuItems[i].click();
        break;
      }
    }
  }

  function clickSettingsButtion() {
    var settingsButtions = document.getElementsByClassName('ytp-settings-button');
    var settingsButtion = settingsButtions[0];
    settingsButtion.click();
  }

  function onSubMenuLoaded() {
    clickSettingsButtion();
    enterSubtitleMenu();
    var turnOnChineseSubTitleResult = turnOnChineseSubTitle();
    if (turnOnChineseSubTitleResult === true || turnOnChineseSubTitleResult === undefined) {
      // Chinese subTitle, or keep using firstSubTitle without Chinese subTitle and without '自动翻译'
      clickSettingsButtion();
      return;
    } else if (turnOnChineseSubTitleResult === false) {
      // no Chinese subTitle, found '自动翻译'
      translateToSimpChinese();
      return;
    }
  }

  function onSubtitlesEnabled() {
    clickSettingsButtion();
    enterSubtitleMenu();
    var turnOnFirstSubTitleResult = turnOnFirstSubTitle();
    clickSettingsButtion();
    if (turnOnFirstSubTitleResult === true) {
      setTimeout(onSubMenuLoaded, 100);
    }
  }

  function onVideoPlayed() {
    var subtitlesButtons = document.getElementsByClassName('ytp-subtitles-button');
    if (subtitlesButtons !== null) {
      var subtitlesButton = subtitlesButtons[0];
      if (subtitlesButton !== null && subtitlesButton.getAttribute('aria-pressed') !== null) {
        if (subtitlesButton.getAttribute('aria-pressed') === false) {
          subtitlesButton.click();
        }
        setTimeout(onSubtitlesEnabled, 200);
        return;
      }
    }
    if (waitButtonLoadCount === 10) {
      return;
    }
    setTimeout(onVideoPlayed, 1000);
    waitButtonLoadCount++;
  }

  function onDOMContentLoaded() {
    var videos = document.getElementsByTagName('video');
    if (videos != null) {
      var video = videos.item(0);
      if (video !== null) {
        video.play();
        onVideoPlayed();
        return;
      }
    }
    if (waitVideoLoadCount === 10) {
      return;
    }
    setTimeout(onDOMContentLoaded, 1000);
    waitVideoLoadCount++;
  }

  window.addEventListener('yt-navigate-finish', youtubeSubTitle); // reRun this script if click on youtube link
  onDOMContentLoaded();
})();
