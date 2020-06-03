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
require:  The document is still loading
ensure:  
  1. addEventListener on yt-navigate-finish event.
  2. run onYtNavigateFinish() if yt-navigate-finish event triggered
*/
(function () {
  /**
require:  Trigger the yt-navigate-finish event on www.youtube.com.
ensure: 
    1. Open theater mode.
    2. If there is subtitle enable button, enable subtitle, save and restore play speed. If no, exit.
    3. If there is Chinese subtitle, turn on it. If no, but with auto-translation, translate to Simp Chinese.
    4. If there is transcript, trun on transcript.
*/
  function onYtNavigateFinish() {
    if (window.location.pathname.indexOf('/watch') === -1) {
      return;
    }
    // config on https://www.youtube.com/watch?*
    youtubeConfig();
  }

  async function youtubeConfig() {
    let titles, panels;
    let ytdPlayer = await waitUntil(document.getElementById('ytd-player'));
    await waitUntil(ytdPlayer.getElementsByTagName('video'));

    let subtitlesEnableButton = await waitUntil(
      getElementByClassNameAndAttribute(ytdPlayer, 'ytp-subtitles-button', 'aria-label', '字幕 (c)')
    );
    if (subtitlesEnableButton.style.display === 'none') {
      return;
    }
    if (subtitlesEnableButton.getAttribute('aria-pressed') === 'false') {
      subtitlesEnableButton.click();
    }

    let settingsButton = getElementByClassNameAndAttribute(ytdPlayer, 'ytp-settings-button', 'aria-label', '设置');
    settingsButton.click();

    let playSpeedButton = await waitUntil(
      getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem-label', '播放速度')
    );
    let subtitlesSelectButton = getElementByClassNameAndPartInnerText(ytdPlayer, 'ytp-menuitem-label', '字幕');

    listenAndRestorePlaySpeed(ytdPlayer, playSpeedButton);
    subtitlesSelectButton.click();
    turnOnSubtitle(ytdPlayer, settingsButton);
    turnOnTranscript();

    async function listenAndRestorePlaySpeed(player, playSpeedButton) {
      const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-subtitle-play-speed';

      function savePlaySpeed() {
        let playSpeed = this.innerText;
        localStorage.setItem(PLAY_SPEED_LOCAL_STORAGE_KEY, playSpeed);
      }

      playSpeedButton.click();
      await waitUntil(getElementByClassNameAndInnerText(player, 'ytp-menuitem', '正常'));

      let menuItemRadios = player.querySelectorAll('[role="menuitemradio"]');
      for (let radio of menuItemRadios) {
        radio.addEventListener('click', savePlaySpeed);
      }

      let playSpeedInLocalStorage = localStorage.getItem(PLAY_SPEED_LOCAL_STORAGE_KEY);
      if (playSpeedInLocalStorage !== null) {
        let radio = getElementByClassNameAndInnerText(player, 'ytp-menuitem', playSpeedInLocalStorage);
        if (radio !== null) {
          let ariaChecked = radio.getAttribute('aria-checked');
          if (ariaChecked !== 'true') {
            // different play speed between playSpeedInLocalStorage and checkedRadio
            radio.click();
          }
        }
      }
    }

    async function turnOnSubtitle(player, settingsButton) {
      let closeSubtitleRadio = await waitUntil(getElementByClassNameAndInnerText(player, 'ytp-menuitem', '关闭'));
      let subtitleMenu = closeSubtitleRadio.parentElement;
      let chineseSubtitleRadio = getElementByClassNameAndPartInnerText(subtitleMenu, 'ytp-menuitem', '中文');
      if (chineseSubtitleRadio !== null) {
        chineseSubtitleRadio.click();
        settingsButton.click();
      } else {
        let autoTransRadio = getElementByClassNameAndInnerText(subtitleMenu, 'ytp-menuitem', '自动翻译');
        if (autoTransRadio !== null) {
          autoTransRadio.click();
          let transToSimpChineseRadio = await waitUntil(
            getElementByClassNameAndInnerText(player, 'ytp-menuitem', '中文（简体）')
          );
          transToSimpChineseRadio.click();
        }
      }
    }

    async function turnOnTranscript() {
      let ytdVideoPrimaryInfos = await waitUntil(document.getElementsByTagName('ytd-video-primary-info-renderer'));
      let ytdVideoPrimaryInfo = ytdVideoPrimaryInfos[0];
      titles = ytdVideoPrimaryInfo.getElementsByTagName('h1');

      let moreActionsMenuButton = await waitUntil(
        getElementByClassNameAndAttribute(ytdVideoPrimaryInfo, 'yt-icon-button', 'aria-label', '其他操作')
      );
      moreActionsMenuButton.click();

      let menuPopupRenderers = await waitUntil(document.getElementsByTagName('ytd-menu-popup-renderer'));
      let items = menuPopupRenderers[0].querySelector('#items');
      let openTranscriptButton = getElementByTagNameAndInnerText(items, 'yt-formatted-string', '打开解说词');
      if (openTranscriptButton === null) {
        // no '打开解说词' button, close more actions menu button.
        moreActionsMenuButton.click();
        return;
      }

      openTranscriptButton.click();
      panels = await waitUntil(document.getElementById('panels'));
      addTranscriptDownloadButton();
    }

    function addTranscriptDownloadButton() {
      let menu = panels.querySelector('#menu');
      let previousElementSibling = menu.previousElementSibling;
      if (previousElementSibling !== null && previousElementSibling.innerText === '下载解说词') {
        return;
      }
      let scriptDownloadButton = createScriptDownloadButton();
      menu.parentNode.insertBefore(scriptDownloadButton, menu);
    }

    function createScriptDownloadButton() {
      let scriptDownloadButton = document.createElement('paper-button');
      scriptDownloadButton.className = 'style-scope ytd-subscribe-button-renderer';
      scriptDownloadButton.innerHTML = '下载解说词';
      scriptDownloadButton.addEventListener('click', onScriptDownloadButtonClick);
      return scriptDownloadButton;
    }

    function onScriptDownloadButtonClick() {
      let filename = titles[0].innerText + '.srt';
      let transcriptBodys = panels.getElementsByClassName('cue-group');
      if (transcriptBodys === null) {
        return;
      }
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
  }

  window.addEventListener('yt-navigate-finish', onYtNavigateFinish);
})();
