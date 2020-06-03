// ==UserScript==
// @name        Youtube双语字幕-下载解说词-记忆播放速度
// @namespace    https://greasyfork.org
// @version      2.3.4
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
    const TIMER = 100;
    const MAX_VIDEO_LOAD_COUNT = 100;
    const MAX_SUBTITLES_ENABLE_COUNT = 100;
    const MAX_SETTINGS_MENU_LOAD_COUNT = 30;
    const MAX_SUBTITLE_MENU_LOAD_COUNT = 30;
    const MAX_TRANS_TO_SIMP_CHINESES_COUNT = 30;
    const MAX_PLAY_SPEED_MENU_LOAD_COUNT = 30;
    const MAX_VIDEO_PRIMARY_INFO_LOAD_COUNT = 100;
    const MIN_MORE_ACTIONS_MENU_LOAD_COUNT = 10;
    const MAX_MORE_ACTIONS_MENU_LOAD_COUNT = 30;
    const MAX_OPEN_TRANSCRIPT_COUNT = 30;
    const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-subtitle-play-speed';

    let ytdPlayer,
      subtitlesEnableButton,
      settingsButton,
      playSpeedButton,
      subtitlesSelectButton,
      ytdVideoPrimaryInfo,
      moreActionsMenuButton,
      openTranscriptButton,
      panels;
    let videoLoadCount,
      subtitlesEnableCount,
      settingsMenuLoadCount,
      subtitleMenuLoadCount,
      transToSimpChineseCount,
      playSpeedMenuLoadCount,
      videoPrimaryInfoLoadCount,
      moreActionsMenuLoadCount,
      openTranscriptCount;
    videoLoadCount = subtitlesEnableCount = settingsMenuLoadCount = subtitleMenuLoadCount = transToSimpChineseCount = playSpeedMenuLoadCount = videoPrimaryInfoLoadCount = moreActionsMenuLoadCount = openTranscriptCount = 0;

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
      setTimeout(youtubeConfig, TIMER);
    }

    function onVideoPlayed() {
      if (subtitlesEnableCount >= MAX_SUBTITLES_ENABLE_COUNT) {
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
        onSubtitlesEnabled();
        return;
      }
      subtitlesEnableCount++;
      setTimeout(onVideoPlayed, TIMER);
    }

    function onSubtitlesEnabled() {
      settingsButton = getElementByClassNameAndAttribute(ytdPlayer, 'ytp-settings-button', 'aria-label', '设置');
      settingsButton.click();
      onSettingsMenuButtonClicked();
    }

    function onSettingsMenuButtonClicked() {
      if (settingsMenuLoadCount >= MAX_SETTINGS_MENU_LOAD_COUNT) {
        settingsButton.click();
        return;
      }

      let radios = ytdPlayer.getElementsByClassName('ytp-menuitem-label');
      if (radios !== null) {
        for (let radio of radios) {
          if (radio.innerText === '播放速度') {
            playSpeedButton = radio;
          }
          if (radio.innerText.indexOf('字幕') !== -1) {
            subtitlesSelectButton = radio;
          }
        }

        if (playSpeedButton !== null && subtitlesSelectButton !== null) {
          subtitlesSelectButton.click();
          turnOnSubtitle();
          return;
        }
      }

      settingsMenuLoadCount++;
      setTimeout(onSettingsMenuButtonClicked, TIMER);
    }

    function turnOnSubtitle() {
      if (subtitleMenuLoadCount >= MAX_SUBTITLE_MENU_LOAD_COUNT) {
        memoryPlaySpeedAndOpenTranscriptAfterSettingsMenuOpended();
        return;
      }

      let closeSubtitleButton = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem', '关闭');
      if (closeSubtitleButton !== null) {
        let chineseSubtitleRadio = getElementByClassNameAndPartInnerText(ytdPlayer, 'ytp-menuitem', '中文');
        if (chineseSubtitleRadio !== null) {
          chineseSubtitleRadio.click();
          setTimeout(memoryPlaySpeedAndOpenTranscriptAfterSettingsMenuOpended, TIMER);
          return;
        } else {
          let autoTransRadio = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem', '自动翻译');
          if (autoTransRadio !== null) {
            autoTransRadio.click();
            setTimeout(onAutoTransRadioClicked, TIMER);
            return;
          }
        }
      }
      subtitleMenuLoadCount++;
      setTimeout(turnOnSubtitle, TIMER);
    }

    function onAutoTransRadioClicked() {
      if (transToSimpChineseCount >= MAX_TRANS_TO_SIMP_CHINESES_COUNT) {
        // No Simp Chinese, fatal error
        return;
      }

      let transToSimpChineseRadio = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem', '中文（简体）');
      if (transToSimpChineseRadio !== null) {
        transToSimpChineseRadio.click();
        setTimeout(memoryPlaySpeedAndOpenTranscriptBeforeSettingsMenuOpended, TIMER);
        return;
      }
      transToSimpChineseCount++;
      setTimeout(onAutoTransRadioClicked, TIMER);
    }

    function memoryPlaySpeedAndOpenTranscriptBeforeSettingsMenuOpended() {
      // Open settings menu
      settingsButton.click();
      setTimeout(memoryPlaySpeedAndOpenTranscriptAfterSettingsMenuOpended, TIMER);
    }

    function memoryPlaySpeedAndOpenTranscriptAfterSettingsMenuOpended() {
      playSpeedButton.click();
      setTimeout(onPlaySpeedButtonClicked, TIMER);
    }

    function onPlaySpeedButtonClicked() {
      if (playSpeedMenuLoadCount >= MAX_PLAY_SPEED_MENU_LOAD_COUNT) {
        setTimeout(onPlaySpeedRestored, TIMER);
        return;
      }

      let normalSpeedRadio = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem', '正常');
      if (normalSpeedRadio !== null) {
        listenPlaySpeedButtonClick();
        let playSpeedInLocalStorage = localStorage.getItem(PLAY_SPEED_LOCAL_STORAGE_KEY);
        if (playSpeedInLocalStorage !== null) {
          let radio = getElementByClassNameAndInnerText(ytdPlayer, 'ytp-menuitem', playSpeedInLocalStorage);
          if (radio !== null) {
            let ariaChecked = radio.getAttribute('aria-checked');
            if (ariaChecked !== 'true') {
              // different play speed between playSpeedInLocalStorage and checkedRadio
              radio.click();
              setTimeout(onPlaySpeedRestored, TIMER);
              return;
            }
          }
        }
        onPlaySpeedRestored();
        return;
      }

      playSpeedMenuLoadCount++;
      setTimeout(onPlaySpeedButtonClicked, TIMER);
    }

    function onPlaySpeedRestored() {
      // Close settings menu
      settingsButton.click();
      setTimeout(turnOnTranscript, TIMER);
    }

    function listenPlaySpeedButtonClick() {
      let menuItemRadios = ytdPlayer.querySelectorAll('[role="menuitemradio"]');
      for (let radio of menuItemRadios) {
        radio.addEventListener('click', savePlaySpeed);
      }
    }

    function savePlaySpeed() {
      let playSpeed = this.innerText;
      localStorage.setItem(PLAY_SPEED_LOCAL_STORAGE_KEY, playSpeed);
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
          setTimeout(onYtdVideoPrimaryInfoLoaded, TIMER * time);
        } else {
          onYtdVideoPrimaryInfoLoaded();
        }
        return;
      }
      videoPrimaryInfoLoadCount++;
      setTimeout(turnOnTranscript, TIMER);
    }

    function onYtdVideoPrimaryInfoLoaded() {
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
            setTimeout(openTranscript, TIMER);
            return;
          }
        }
      }
      moreActionsMenuLoadCount++;
      setTimeout(onYtdVideoPrimaryInfoLoaded, TIMER);
    }

    function openTranscript() {
      if (openTranscriptCount >= MAX_OPEN_TRANSCRIPT_COUNT) {
        // Close more actions menu button.
        moreActionsMenuButton.click();
        return;
      }

      let menuPopupRenderers = document.getElementsByTagName('ytd-menu-popup-renderer');
      if (menuPopupRenderers !== null) {
        let items = menuPopupRenderers[0].querySelector('#items');
        if (items !== null) {
          let reportButton = getElementByTagNameAndInnerText(items, 'yt-formatted-string', '举报');
          if (reportButton !== null) {
            openTranscriptButton = getElementByTagNameAndInnerText(items, 'yt-formatted-string', '打开解说词');
            if (openTranscriptButton !== null) {
              openTranscriptButton.click();
              setTimeout(addTranscriptDownloadButton, TIMER);
              return;
            }
            // There is '举报' botton, but no '打开解说词' button, close more actions menu button.
            moreActionsMenuButton.click();
            return;
          }
        }
      }

      openTranscriptCount++;
      setTimeout(openTranscript, TIMER);
    }

    function clickOpenTranscriptButton() {
      openTranscriptButton.click();
      return;
    }

    function addTranscriptDownloadButton() {
      panels = document.getElementById('panels');
      if (panels !== null) {
        let menu = panels.querySelector('#menu');
        if (menu !== null) {
          let checkResult = hasScriptDownloadButton(menu);
          if (checkResult === true) {
            setTimeout(clickOpenTranscriptButton, TIMER);
            return;
          }
          let scriptDownloadButton = createScriptDownloadButton();
          menu.parentNode.insertBefore(scriptDownloadButton, menu);
        }
      }
      //click openTranscriptButton again to close the more actions menu
      setTimeout(clickOpenTranscriptButton, TIMER);
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
      let titles = ytdVideoPrimaryInfo.getElementsByTagName('h1');
      if (titles === null || titles.length !== 1) {
        return;
      }
      let filename = titles[0].innerText + '.srt';

      /*
    let transcriptBodyRenderer = panels.getElementsByTagName('ytd-transcript-body-renderer');
    if (transcriptBodyRenderer === null || transcriptBodyRenderer.length !== 1) {
      return;
    }
    */
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
  }

  window.addEventListener('yt-navigate-finish', onYtNavigateFinish);
})();
