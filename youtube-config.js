// ==UserScript==
// @name               Youtube记忆恢复双语字幕和播放速度-下载字幕
// @name:en         Youtube store/restore bilingual subtitles and playback speed - download subtitles
// @description    记忆播放器设置菜单（含自动翻译菜单）选择的字幕语言和播放速度。默认正常速度和中文（简体）字幕/默认字幕（双语）；找不到完全匹配的语言时，匹配前缀，例如中文（简体）->中文
// @description:en  The selected subtitle language and playback speed are stored and auto restored
// @match       https://www.youtube.com/*
// @run-at       document-start
// @author      szdailei@gmail.com
// @source      https://github.com/szdailei/GM-scripts
// @namespace  https://greasyfork.org
// @version         3.0.0
// ==/UserScript==

/**
require:  @run-at document-start
ensure:  run onYtNavigateFinish() when yt-navigate-finish event triggered
*/
(function () {
  'use strict';
  const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-config-play-speed';
  const SUBTITLE_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-config-subtitle';
  const NOT_SUPPORT_LANGUAGE =
    'Only English and Chinese are supported. \n\nFor users who have signed in youtube, please change the account language to English or Chinese. \n\nFor users who have not signed in youtube, please change the browser language to English or Chinese.';
  const DEFAULT_PLAY_SPEED = 'normal';
  const DEFAULT_SUBTITLES = 'chinese';
  const TIMER_OF_MENU_LOAD_AFTER_USER_CLICK = 20;
  const TIMER_OF_ELEMENT_LOAD = 100;
  const numbers = '0123456789';
  const specialCharacterAndNumbers = '`~!@#$%^&*()_+<>?:"{},./;\'[]0123456789-=（）';
  const resource = {
    en: {
      playSpeed: 'Playback speed',
      subtitles: 'Subtitles',
      autoTranlate: 'Auto-translate',
      normal: 'Normal',
      chinese: 'Chinese (Simplified)',
      openTranscript: 'Open transcript',
      downloadTranscript: 'Download transcript',
    },
    cmnHans: {
      playSpeed: '播放速度',
      subtitles: '字幕',
      autoTranlate: '自动翻译',
      normal: '正常',
      chinese: '中文（简体）',
      openTranscript: '打开解说词',
      downloadTranscript: '下载字幕',
    },
    cmnHant: {
      playSpeed: '播放速度',
      subtitles: '字幕',
      autoTranlate: '自動翻譯',
      normal: '正常',
      chinese: '中文（簡體）',
      openTranscript: '開啟字幕記錄',
      downloadTranscript: '下載字幕',
    },
    cmnHantHK: {
      playSpeed: '播放速度',
      subtitles: '字幕',
      autoTranlate: '自動翻譯',
      normal: '正常',
      chinese: '中文（簡體字）',
      openTranscript: '開啟字幕',
      downloadTranscript: '下載字幕',
    },
  };

  class I18n {
    constructor(langCode, resource) {
      this.langCode = langCode;
      switch (langCode) {
        case 'zh':
        case 'zh-CN':
        case 'cmn-Hans-CN':
        case 'zh-SG':
        case 'cmn-Hans-SG':
          this.resource = resource.cmnHans;
          break;
        case 'zh-TW':
        case 'cmn-Hant-TW':
          this.resource = resource.cmnHant;
          break;
        case 'zh-HK':
        case 'yue-Hant-HK':
        case 'zh-MO':
        case 'yue-Hant-MO':
          this.resource = resource.cmnHantHK;
          break;
        case 'en':
        case 'en-AU':
        case 'en-BZ':
        case 'en-CA':
        case 'en-CB':
        case 'en-GB':
        case 'en-IE':
        case 'en-IN':
        case 'en-JM':
        case 'en-NZ':
        case 'en-PH':
        case 'en-TT':
        case 'en-US':
        case 'en-ZA':
        case 'en-ZW':
          this.resource = resource.en;
          break;
        default:
          alert(NOT_SUPPORT_LANGUAGE);
          this.resource = resource.en;
          break;
      }
    }
    t(key) {
      return this.resource[key];
    }
  }

  let settingsButton, ytpPopup, infoContents;
  let lastHref = null;
  let hostLanguage = document.getElementsByTagName('html')[0].getAttribute('lang');
  if (hostLanguage === null) {
    return;
  }
  let i18n = new I18n(hostLanguage, resource);
  if (getStorage(i18n.t('playSpeed')) === null) {
    setStorage(i18n.t('playSpeed'), i18n.t(DEFAULT_PLAY_SPEED));
  }
  if (getStorage(i18n.t('subtitles')) === null) {
    setStorage(i18n.t('subtitles'), i18n.t(DEFAULT_SUBTITLES));
  }

  window.addEventListener('yt-navigate-finish', onYtNavigateFinish);
  return;

  function onYtNavigateFinish() {
    let href = window.location.href;
    if (href === lastHref || href.indexOf('/watch') === -1) {
      return;
    }

    lastHref = href;
    // run once on https://www.youtube.com/watch*.
    youtubeConfig();
  }

  /**
require:  yt-navigate-finish event on https://www.youtube.com/watch*
ensure: 
    1. If there isn't subtitle enable button, exit.
    2. store/resotre play speed and subtitle. If can't restore subtitle, but there is auto-translate radio, translate to stored subtitle.
    3. If there is transcript, trun on transcript.
*/
  async function youtubeConfig() {
    if ((await isSubtitleEabled()) === false) {
      return;
    }
    settingsButton.addEventListener('click', onRadioClicked);
    settingsButton.click();
    ytpPopup = await waitUntil(document.getElementById('ytp-id-20'));
    let settingsMenu = await waitUntil(getPanelMenuByTitle(''));

    await restoreSettingOfTitle(settingsMenu, i18n.t('playSpeed'));

    let isSubtitlRestored = await restoreSettingOfTitle(settingsMenu, i18n.t('subtitles'));

    if (isSubtitlRestored === false) {
      let labels = settingsMenu.getElementsByClassName('ytp-menuitem-label');
      let subtitlesRadio = getElementByShortTextContent(labels, i18n.t('subtitles'));
      subtitlesRadio.click();
      let subtitleMenu = await waitUntil(getPanelMenuByTitle(i18n.t('subtitles')));
      let isAutoTransSubtitleRestored = await restoreSettingOfTitle(subtitleMenu, i18n.t('autoTranlate'));
      if (isAutoTransSubtitleRestored === false) {
        settingsButton.click(); // close settings menu
      }
    } else {
      settingsButton.click(); // close settings menu
    }

    await turnOnTranscript();
  }

  async function isSubtitleEabled() {
    let player = await waitUntil(document.getElementById('movie_player'));
    let rightControls = await waitUntil(player.getElementsByClassName('ytp-right-controls'));
    let rightControl = rightControls[0];
    let settingsButtons = await waitUntil(rightControl.getElementsByClassName('ytp-settings-button'));
    settingsButton = settingsButtons[0];

    let subtitlesEnableButtons = rightControl.getElementsByClassName('ytp-subtitles-button');
    if (
      subtitlesEnableButtons === null ||
      subtitlesEnableButtons[0] === null ||
      subtitlesEnableButtons[0].style.display === 'none'
    ) {
      return false;
    }
    if (subtitlesEnableButtons[0].getAttribute('aria-pressed') === 'false') {
      subtitlesEnableButtons[0].click();
    }
    return true;
  }

  async function restoreSettingOfTitle(openedMenu, subMenuTitle) {
    let labels = openedMenu.getElementsByClassName('ytp-menuitem-label');
    let radio = getElementByShortTextContent(labels, subMenuTitle);
    if (radio === null) {
      return false;
    }
    radio.click();
    let subMenu = await waitUntil(getPanelMenuByTitle(subMenuTitle));
    let value = getStorage(subMenuTitle);
    return restoreSettingByValue(subMenu, value);
  }

  function getPanelMenuByTitle(title) {
    if (title === null || title === '') {
      // settings menu
      let panelMenus = ytpPopup.getElementsByClassName('ytp-panel-menu');
      if (panelMenus === null || panelMenus[0].previousElementSibling !== null) {
        // no panelMenus or panelMenu has previousElementSibling (panelHeader)
        return null;
      }
      return panelMenus[0];
    }

    // other menu, not settings menu
    let panelHeaders = ytpPopup.getElementsByClassName('ytp-panel-header');
    if (panelHeaders !== null) {
      let length = panelHeaders.length;
      for (let i = 0; i < length; i++) {
        let panelHeaderTitle = getPanelHeaderTitle(panelHeaders[i]);
        if (getShortText(panelHeaderTitle.textContent) === title) {
          return panelHeaders[i].nextElementSibling;
        }
      }
    }
    return null;
  }

  function getPanelHeaderTitle(panelHeader) {
    let panelTitles = panelHeader.getElementsByClassName('ytp-panel-title');
    return panelTitles[0];
  }

  function restoreSettingByValue(openedMenu, value) {
    let panelheader = openedMenu.previousElementSibling;
    let panelTitle = getPanelHeaderTitle(panelheader);
    let labels = openedMenu.getElementsByClassName('ytp-menuitem-label');
    let storedRadio = getElementByTextContent(labels, value);
    if (storedRadio === null) {
      // if can't match '中文（简体）'，try '中文'
      storedRadio = getElementByShortTextContent(labels, getShortText(value));
      if (storedRadio === null) {
        panelTitle.click();
        return false;
      }
    }

    if (storedRadio.parentElement.getAttribute('aria-checked') === 'true') {
      panelTitle.click();
      return true;
    } else {
      storedRadio.click();
      return true;
    }
  }

  function onRadioClicked() {
    if (this.textContent === '') {
      // clicked on settingsButton which will open settingsMenu
      onRadioToPanelMenuClicked('');
      return;
    }

    // clicked on radio which will open subMenu
    let label = this.getElementsByClassName('ytp-menuitem-label')[0];
    let textContent = label.textContent;
    let shortText = getShortText(textContent);
    if (
      shortText === i18n.t('playSpeed') ||
      shortText === i18n.t('subtitles') ||
      shortText === i18n.t('autoTranlate')
    ) {
      onRadioToPanelMenuClicked(shortText);
      return;
    }

    // in 'autoTranlate' menu, only one radio which seleted by default has parentNode, others are orphan nodes and can't get parentNode by 'this'
    let panelHeaders = ytpPopup.getElementsByClassName('ytp-panel-header');
    let title = getShortText(getPanelHeaderTitle(panelHeaders[0]).textContent);
    setStorage(title, textContent);
  }

  async function onRadioToPanelMenuClicked(title) {
    let panelMenu = await waitUntil(getPanelMenuByTitle(title), TIMER_OF_MENU_LOAD_AFTER_USER_CLICK);
    addEventListenerOnPanelMenu(panelMenu);
    return;
  }

  function addEventListenerOnPanelMenu(panelMenu) {
    let radios = panelMenu.getElementsByClassName('ytp-menuitem-label');
    for (let radio of radios) {
      radio.parentElement.addEventListener('click', onRadioClicked);
    }
  }

  async function turnOnTranscript() {
    infoContents = await waitUntil(document.getElementById('info-contents'));
    let moreActionsMenuButtons = await waitUntil(infoContents.getElementsByClassName('dropdown-trigger'));
    let moreActionsMenuButton = moreActionsMenuButtons[0];

    moreActionsMenuButton.click();
    let menuPopupRenderers = await waitUntil(document.getElementsByTagName('ytd-menu-popup-renderer'));
    let formattedStrings = menuPopupRenderers[0].getElementsByTagName('yt-formatted-string');
    let openTranscriptRadio = getElementByTextContent(formattedStrings, i18n.t('openTranscript'));
    if (openTranscriptRadio === null) {
      moreActionsMenuButton.click(); // close moreActionsMenu
      return;
    }

    openTranscriptRadio.click();
    let panels = await waitUntil(document.getElementById('panels'));
    let actionButton = panels.querySelector('#action-button');
    insertPaperButton(actionButton, i18n.t('downloadTranscript'), onTranscriptDownloadButtonClicked);
  }

  function insertPaperButton(referenceNode, textContent, clickCallback) {
    let previousElementSibling = referenceNode.previousElementSibling;
    if (previousElementSibling !== null && previousElementSibling.textContent.indexOf(textContent) !== -1) {
      return;
    }

    let newNode = document.createElement('paper-button');
    newNode.className = 'style-scope ytd-subscribe-button-renderer';
    newNode.textContent = textContent;

    referenceNode.parentNode.insertBefore(newNode, referenceNode);
    newNode.addEventListener('click', clickCallback);
  }

  function onTranscriptDownloadButtonClicked() {
    let title = infoContents.getElementsByTagName('h1')[0];
    let filename = title.textContent + '.srt';

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

  function getElementByTextContent(elements, textContent) {
    let length = elements.length;
    for (let i = 0; i < length; i++) {
      if (elements[i].textContent === textContent) {
        return elements[i];
      }
    }
    return null;
  }

  function getElementByShortTextContent(elements, textContent) {
    let length = elements.length;
    for (let i = 0; i < length; i++) {
      if (getShortText(elements[i].textContent) === textContent) {
        return elements[i];
      }
    }
    return null;
  }

  function getShortText(text) {
    if (text === null) {
      return null;
    }
    if (text === '' || numbers.indexOf(text[0]) !== -1 || text === i18n.t('autoTranlate')) {
      return text.trim();
    }

    // return input text before specialCharacterAndNumbers
    let shortText = '';
    let length = text.length;
    for (let i = 0; i < length; i++) {
      if (specialCharacterAndNumbers.indexOf(text[i]) !== -1) {
        break;
      }
      shortText += text[i];
    }
    return shortText.trim();
  }

  function getStorage(title) {
    let storedValue = null;
    switch (title) {
      case i18n.t('playSpeed'):
        storedValue = localStorage.getItem(PLAY_SPEED_LOCAL_STORAGE_KEY);
        break;
      case i18n.t('subtitles'):
      case i18n.t('autoTranlate'):
        storedValue = localStorage.getItem(SUBTITLE_LOCAL_STORAGE_KEY);
        break;
      default:
        break;
    }
    return storedValue;
  }

  function setStorage(title, value) {
    switch (title) {
      case i18n.t('playSpeed'):
        localStorage.setItem(PLAY_SPEED_LOCAL_STORAGE_KEY, value);
        break;
      case i18n.t('subtitles'):
      case i18n.t('autoTranlate'):
        localStorage.setItem(SUBTITLE_LOCAL_STORAGE_KEY, value);
        break;
      default:
        break;
    }
  }

  async function waitUntil(condition, timer) {
    let timeout = TIMER_OF_ELEMENT_LOAD;
    if (timer !== undefined) {
      timeout = timer;
    }
    return await new Promise((resolve) => {
      const interval = setInterval(() => {
        let result = condition;
        if (result !== null) {
          clearInterval(interval);
          resolve(result);
          return;
        }
      }, timeout);
    });
  }
})();
