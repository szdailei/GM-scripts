// ==UserScript==
// @name               Youtube记忆恢复字幕语言和播放速度-自选语言双语字幕-下载字幕
// @name:en         Youtube store/restore subtitles language and playback speed - bilingual subtitles of selected language - download subtitles
// @description    记忆播放器设置菜单选择的字幕语言（含自动翻译）和播放速度，按照记忆自动打开双语字幕，支持播放器设置菜单里面所有的字幕语言，默认中文；同时存在中文简体和中文繁体字幕时，选择中文简体字幕。字幕可下载。浏览器语言支持英文和中文
// @description:en  The selected subtitle language (including the auto-translate language) and playback speed in player settings menu are stored and auto restored. All subtitle languages in player settings menu are supported, default is Chinese. Chinese(Simplified) subtitle is selected when there are both simplified and traditional Chinese subtitle. Subtitle is available for download. English and Chinese of browser language are supported
// @match       https://www.youtube.com/*
// @run-at       document-start
// @author      szdailei@gmail.com
// @source      https://github.com/szdailei/GM-scripts
// @namespace  https://greasyfork.org
// @version         3.0.0
// ==/UserScript==

'use strict';
/**
require:  @run-at document-start
ensure:  run onYtNavigateFinish() when yt-navigate-finish event triggered
*/
(function () {
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

    await restoreSettingOfMenu(settingsMenu, i18n.t('playSpeed'), getStorage(i18n.t('playSpeed')));

    let isSubtitlRestored = await restoreSettingOfMenu(
      settingsMenu,
      i18n.t('subtitles'),
      getStorage(i18n.t('subtitles'))
    );

    if (isSubtitlRestored === false) {
      let subtitlesRadio = getElementByClassNameAndShortTextContent(
        settingsMenu,
        'ytp-menuitem-label',
        i18n.t('subtitles')
      );
      subtitlesRadio.click();
      let subtitleMenu = await waitUntil(getPanelMenuByTitle(i18n.t('subtitles')));
      let isAutoTransSubtitleRestored = await restoreSettingOfMenu(
        subtitleMenu,
        i18n.t('autoTranlate'),
        getStorage(i18n.t('autoTranlate'))
      );
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

  async function restoreSettingOfMenu(openedMenu, subMenuTitle, value) {
    let radio = getElementByClassNameAndShortTextContent(openedMenu, 'ytp-menuitem-label', subMenuTitle);
    if (value === null || radio === null) {
      return false;
    }
    radio.click();
    let subMenu = await waitUntil(getPanelMenuByTitle(subMenuTitle));
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
    let storedRadio = getElementByClassNameAndShortTextContent(openedMenu, 'ytp-menuitem-label', value);
    if (storedRadio === null) {
      panelTitle.click();
      return false;
    } else {
      if (storedRadio.parentElement.getAttribute('aria-checked') === 'true') {
        panelTitle.click();
        return true;
      } else {
        storedRadio.click();
        return true;
      }
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
    let text = getShortText(label.textContent);
    if (text === i18n.t('playSpeed') || text === i18n.t('subtitles') || text === i18n.t('autoTranlate')) {
      onRadioToPanelMenuClicked(text);
      return;
    }

    // in 'autoTranlate' menu, only one radio which seleted by default has parentNode, others are orphan nodes and can't get parentNode by 'this'
    let panelHeaders = ytpPopup.getElementsByClassName('ytp-panel-header');
    let title = getShortText(getPanelHeaderTitle(panelHeaders[0]).textContent);
    setStorage(title, text);
  }

  async function onRadioToPanelMenuClicked(text) {
    let panelMenu = await waitUntil(getPanelMenuByTitle(text), TIMER_OF_MENU_LOAD_AFTER_USER_CLICK);
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
    let openTranscriptRadio = getElementByTagNameAndTextContent(
      menuPopupRenderers[0],
      'yt-formatted-string',
      i18n.t('openTranscript')
    );
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

  function getElementByClassNameAndShortTextContent(element, className, textContent) {
    return getElementByTextContent(element.getElementsByClassName(className), textContent);
  }

  function getElementByTagNameAndTextContent(element, tagName, textContent) {
    return getElementByTextContent(element.getElementsByTagName(tagName), textContent);
  }

  function getElementByTextContent(elements, textContent) {
    let length = elements.length;
    // 中文语言的自动翻译菜单按照中文（繁体）-中文（简体）的顺序排列，英文语言的自动翻译菜单按照Chinese (Simplified)-Chinese (Traditional)的顺序排列。中文反序查找以便优先选择到中文（简体）
    if (i18n.isReverseSearch() === false) {
      for (let i = 0; i < length; i++) {
        if (getShortText(elements[i].textContent) === textContent) {
          return elements[i];
        }
      }
    } else {
      for (let i = length - 1; i >= 0; i--) {
        if (getShortText(elements[i].textContent) === textContent) {
          return elements[i];
        }
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
          this.reverseSearch = true;
          break;
        case 'zh-TW':
        case 'cmn-Hant-TW':
          this.resource = resource.cmnHant;
          this.reverseSearch = true;
          break;
        case 'zh-HK':
        case 'yue-Hant-HK':
        case 'zh-MO':
        case 'yue-Hant-MO':
          this.resource = resource.cmnHantHK;
          this.reverseSearch = true;
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
          this.reverseSearch = false;
          break;
        default:
          alert(NOT_SUPPORT_LANGUAGE);
          this.resource = resource.en;
          this.reverseSearch = false;
          break;
      }
    }
    isReverseSearch() {
      return this.reverseSearch;
    }
    t(key) {
      return this.resource[key];
    }
  }

  const resource = {
    en: {
      playSpeed: 'Playback speed',
      subtitles: 'Subtitles',
      autoTranlate: 'Auto-translate',
      chinese: 'Chinese',
      openTranscript: 'Open transcript',
      downloadTranscript: 'Download transcript',
    },
    cmnHans: {
      playSpeed: '播放速度',
      subtitles: '字幕',
      autoTranlate: '自动翻译',
      chinese: '中文',
      openTranscript: '打开解说词',
      downloadTranscript: '下载字幕',
    },
    cmnHant: {
      playSpeed: '播放速度',
      subtitles: '字幕',
      autoTranlate: '自動翻譯',
      chinese: '中文',
      openTranscript: '開啟字幕記錄',
      downloadTranscript: '下載字幕',
    },
    cmnHantHK: {
      playSpeed: '播放速度',
      subtitles: '字幕',
      autoTranlate: '自動翻譯',
      openTranscript: '開啟字幕',
      downloadTranscript: '下載字幕',
    },
  };

  const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-config-play-speed';
  const SUBTITLE_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-config-subtitle';
  const NOT_SUPPORT_LANGUAGE =
    'Only English and Chinese are supported. \n\nFor users who have signed in youtube, please change the account language to English or Chinese. \n\nFor users who have not signed in youtube, please change the browser language to English or Chinese.';
  const DEFAULT_SUBTITLES = 'chinese';
  const TIMER_OF_MENU_LOAD_AFTER_USER_CLICK = 20;
  const TIMER_OF_ELEMENT_LOAD = 100;
  const numbers = '0123456789';
  const specialCharacterAndNumbers = '`~!@#$%^&*()_+<>?:"{},./;\'[]0123456789-=（）';

  let hostLanguage, lastHref, settingsButton, ytpPopup, infoContents;
  hostLanguage = document.getElementsByTagName('html')[0].getAttribute('lang');
  if (hostLanguage === null) {
    return;
  }
  let i18n = new I18n(hostLanguage, resource);

  if (getStorage(i18n.t('subtitles')) === null) {
    setStorage(i18n.t('subtitles'), i18n.t(DEFAULT_SUBTITLES));
  }
  lastHref = null;
  window.addEventListener('yt-navigate-finish', onYtNavigateFinish);
})();
