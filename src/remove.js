// ==UserScript==
// @name             remove
// @name:zh       remove
// @namespace  https://greasyfork.org
// @version         2.4.0
// @description       For the first time, please select a subtitle language manually (including languages in the auto-translate menu). Next time the bilingual subtitles will be opened automatically. Subtitles are available for download.
// @description:zh  第一次使用时请人工选择一种字幕语言（含自动翻译菜单里面的字幕）。以后自动打开双语字幕。字幕可下载。
// @author      szdailei@gmail.com
// @source      https://github.com/szdailei/GM-scripts
// @match       https://www.youtube.com/*
// @run-at       document-start
// ==/UserScript==

/**
require:  @run-at document-start
ensure:  run onYtNavigateFinish() if yt-navigate-finish event triggered
*/
(() => {
  'use strict';

  const PLAY_SPEED_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-config-play-speed';
  const SUBTITLE_LOCAL_STORAGE_KEY = 'greasyfork-org-youtube-config-subtitle';

  localStorage.removeItem(PLAY_SPEED_LOCAL_STORAGE_KEY);

  localStorage.removeItem(SUBTITLE_LOCAL_STORAGE_KEY);
})();
