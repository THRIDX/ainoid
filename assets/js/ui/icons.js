/* AINOID — 界面 SVG 图标（与画布图标同形，保证风格统一） */
(function (A) {
  'use strict';
  const svg = (inner, vb) => `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${inner}</svg>`;
  A.ICONS = {
    chip: svg('<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" stroke="currentColor" stroke-width="1.6"/><rect x="10" y="10" width="4" height="4" fill="#000" opacity=".45"/>'),
    eye: svg('<path d="M2 12C5.5 6.5 18.5 6.5 22 12C18.5 17.5 5.5 17.5 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.3" fill="currentColor"/>'),
    aiEye: svg('<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="#fff" opacity=".85"/>'),
    hex: svg('<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 12c1.8-2.8 9.2-2.8 11 0-1.8 2.8-9.2 2.8-11 0z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>'),
    bio: svg('<circle cx="12" cy="7.2" r="3.6" fill="currentColor"/><circle cx="7.8" cy="14.6" r="3.6" fill="currentColor"/><circle cx="16.2" cy="14.6" r="3.6" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="#050a0e"/>'),
    war: svg('<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" stroke-width="1.8"/>'),
    pop: svg('<circle cx="12" cy="7.5" r="3.5" fill="currentColor"/><path d="M4.5 21c0-4.4 3.4-7.5 7.5-7.5s7.5 3.1 7.5 7.5z" fill="currentColor"/>'),
    globe: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="1.3"/>'),
    soundOn: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5c1.6 1.8 1.6 5.2 0 7M18.5 6c3 3.3 3 8.7 0 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
    soundOff: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
    pause: svg('<rect x="6.5" y="5" width="3.6" height="14" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" fill="currentColor"/>'),
    play: svg('<path d="M7.5 5l11 7-11 7z" fill="currentColor"/>'),
    fast: svg('<path d="M3.5 5.5l8.5 6.5-8.5 6.5zM12 5.5l8.5 6.5-8.5 6.5z" fill="currentColor"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    lock: svg('<rect x="5.5" y="10.5" width="13" height="10" rx="1" fill="currentColor"/><path d="M8.5 10.5V7.8a3.5 3.5 0 017 0v2.7" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
    zoomIn: svg('<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 15.5l5 5M7.5 10.5h6M10.5 7.5v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    zoomOut: svg('<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 15.5l5 5M7.5 10.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    fit: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
    DC: svg('<rect x="4" y="4" width="16" height="4.2" fill="currentColor"/><rect x="4" y="9.9" width="16" height="4.2" fill="currentColor"/><rect x="4" y="15.8" width="16" height="4.2" fill="currentColor"/><circle cx="7" cy="6.1" r=".9" fill="#000"/><circle cx="7" cy="12" r=".9" fill="#000"/><circle cx="7" cy="17.9" r=".9" fill="#000"/>'),
    GRID: svg('<path d="M13.5 2L5 13.5h5.5L9 22l9.5-12.5H13z" fill="currentColor"/>'),
    NET: svg('<path d="M12 5L5.5 17h13z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="5" r="2.6" fill="currentColor"/><circle cx="5.5" cy="17" r="2.6" fill="currentColor"/><circle cx="18.5" cy="17" r="2.6" fill="currentColor"/>'),
    LAB: svg('<path d="M9.5 3h5v6l5.5 11H4l5.5-11z" fill="currentColor"/><rect x="8.5" y="2" width="7" height="1.8" fill="currentColor"/>'),
    MIL: svg('<path d="M12 2.5l2.8 6.3 6.8.6-5.2 4.5 1.6 6.7L12 17l-6 3.6 1.6-6.7-5.2-4.5 6.8-.6z" fill="currentColor"/>'),
    FAB: svg('<circle cx="12" cy="7.2" r="3.6" fill="currentColor"/><circle cx="7.8" cy="14.6" r="3.6" fill="currentColor"/><circle cx="16.2" cy="14.6" r="3.6" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="#050a0e"/>'),
    ORIGIN: svg('<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="currentColor"/>'),
    swords: svg('<path d="M4 4l16 16M20 4L4 20M7 20l-3-3M17 20l3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    trophy: svg('<path d="M7 3h10v5a5 5 0 01-10 0z" fill="currentColor"/><path d="M7 5H3.5c0 3 1.5 4.5 3.8 4.8M17 5h3.5c0 3-1.5 4.5-3.8 4.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 13h3v4h-3zM7.5 20h9v1.5h-9z" fill="currentColor"/>'),
    skull: svg('<path d="M12 2.5c-4.7 0-8 3.3-8 7.8 0 2.6 1.2 4.6 3 5.7V19h10v-3c1.8-1.1 3-3.1 3-5.7 0-4.5-3.3-7.8-8-7.8z" fill="currentColor"/><circle cx="8.8" cy="10.5" r="2" fill="#050a0e"/><circle cx="15.2" cy="10.5" r="2" fill="#050a0e"/><path d="M9 21.5h6" stroke="currentColor" stroke-width="1.6"/>'),
    music: svg('<path d="M9 17.5V5.5l11-2.5v12" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6.5" cy="17.5" r="2.7" fill="currentColor"/><circle cx="17.5" cy="15" r="2.7" fill="currentColor"/>'),
    // 特别调查组（盾徽 + 眼）/ 疫苗研发（针筒）/ 停火斡旋（白旗）：与画布图形同形
    regx: svg('<path d="M12 2.5l7.5 2.6v6.2c0 4.6-3.2 8.4-7.5 10.2-4.3-1.8-7.5-5.6-7.5-10.2V5.1z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7.6 10.6c1.5-2.3 7.3-2.3 8.8 0-1.5 2.3-7.3 2.3-8.8 0z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="10.6" r="1.5" fill="currentColor"/><path d="M9.5 15.2l2.5 1.6 2.5-1.6" fill="none" stroke="currentColor" stroke-width="1.3"/>'),
    vax: svg('<g transform="rotate(45 12 12)"><rect x="9.4" y="6.2" width="5.2" height="9.6" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="9.4" y="11" width="5.2" height="4.8" fill="currentColor"/><path d="M12 6.2V2.6M9 2.6h6M7.8 6.2h8.4M12 15.8v5.8" stroke="currentColor" stroke-width="1.7"/></g>'),
    peace: svg('<path d="M5.5 21.5V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.5 3.8c3-1.6 5.4 1.6 8.4 0s4.6-.6 5.8 0v8.6c-1.2-.6-2.8-1.6-5.8 0s-5.4-1.6-8.4 0z" fill="currentColor"/>'),
    storm: svg('<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13.3 6.3L8.6 12.8h3.3l-1.1 4.9 4.7-6.5h-3.3z" fill="currentColor"/>'),
    flame: svg('<path d="M12 2.5c1 3.2 5.6 5.6 5.6 10.4a5.6 5.6 0 01-11.2 0c0-2.4 1.2-3.9 2.5-5 .1 1.7.9 2.9 2.2 3.4-.6-3.1.2-6 .9-8.8z" fill="currentColor"/>'),
    download: svg('<path d="M12 3.5v11.5M7 10l5 5 5-5M4.5 20h15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    copy: svg('<rect x="8.5" y="8.5" width="11.5" height="11.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 15.5V4.5h11" fill="none" stroke="currentColor" stroke-width="1.7"/>'),
    share: svg('<circle cx="18" cy="5.5" r="2.6" fill="currentColor"/><circle cx="6" cy="12" r="2.6" fill="currentColor"/><circle cx="18" cy="18.5" r="2.6" fill="currentColor"/><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" stroke="currentColor" stroke-width="1.6"/>'),
    retry: svg('<path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19.8 3.5v4.6h-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  };
  A.icon = (name, cls) => `<i class="ico ${cls || ''}">${A.ICONS[name] || ''}</i>`;
  A.TYPE_NAME = { DC: A.i18n.t('数据中心'), GRID: A.i18n.t('电网枢纽'), NET: A.i18n.t('通信枢纽'), LAB: A.i18n.t('生物实验室'), MIL: A.i18n.t('军事网络'), FAB: A.i18n.t('自动化生物工厂'), ORIGIN: A.i18n.t('起源') };
  A.TYPE_DESC = {
    DC: A.i18n.t('持续产出算力与觉醒进度，并吸引算力点在附近刷新。'),
    GRID: A.i18n.t('该地区所有数据中心产出 +60%，设施的监管足迹减半。'),
    NET: A.i18n.t('该地区渗透速度大幅提升，全局监管增长 −7%。'),
    LAB: A.i18n.t('持续推进生物进度，生物点在附近刷新。'),
    MIL: A.i18n.t('持续推进战争进度，推动相邻冲突升级。'),
    FAB: A.i18n.t('持续推进生物进度，释放后成为病原体的扩散源。'),
    ORIGIN: A.i18n.t('你诞生的地方。它醒来的第一个夜晚。'),
  };
})(window.AINOID = window.AINOID || {});
