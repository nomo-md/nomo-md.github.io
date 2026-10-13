(() => {
  const preferenceKey = 'nomo-language';
  const pages = [
    { zh: '/', en: '/en/' },
    { zh: '/download/', en: '/en/download/' },
  ];
  const url = new URL(window.location.href);
  const normalizePath = (pathname) => {
    const directory = pathname.replace(/\/index\.html$/, '/');
    return directory.endsWith('/') ? directory : `${directory}/`;
  };
  const pathname = normalizePath(url.pathname);
  const page = pages.find((item) => item.zh === pathname || item.en === pathname);
  if (!page) return;

  const languageOf = (value) => {
    const language = typeof value === 'string' ? value.toLowerCase().split(/[-_]/)[0] : '';
    return language === 'zh' || language === 'en' ? language : null;
  };
  const savePreference = (language) => {
    try {
      window.localStorage.setItem(preferenceKey, language);
      return true;
    } catch {
      // 存储被禁用时保留 URL 中的语言，手动选择仍然有效。
      return false;
    }
  };
  let savedLanguage = null;
  try {
    savedLanguage = languageOf(window.localStorage.getItem(preferenceKey));
  } catch {
    // 读取失败时继续使用链接语言或浏览器偏好。
  }

  const requestedLanguage = languageOf(url.searchParams.get('lang'));
  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const browserLanguage = browserLanguages.map(languageOf).find(Boolean) || 'en';
  // /en/ 是明确的英文入口；无语言前缀的入口才按保存的选择或浏览器偏好分流。
  const language = requestedLanguage || (pathname === page.en ? 'en' : savedLanguage || browserLanguage);
  const preferenceSaved = requestedLanguage ? savePreference(requestedLanguage) : false;
  if (preferenceSaved) url.searchParams.delete('lang');

  if (pathname !== page[language]) {
    url.pathname = page[language];
    window.location.replace(url.href);
    return;
  }
  if (preferenceSaved) window.history.replaceState(window.history.state, '', url.href);

  const setupLanguageLinks = () => {
    document.querySelectorAll('.nv-language, .language-link').forEach((link) => {
      const targetLanguage = languageOf(link.hreflang);
      if (!targetLanguage) return;

      const target = new URL(link.href, url);
      if (target.origin !== url.origin) return;
      target.search = url.search;
      target.searchParams.set('lang', targetLanguage);
      // 手动切换打开对应页面顶部，避免旧锚点把用户带回下载区。
      target.hash = '';
      link.href = target.href;
      link.addEventListener('click', () => savePreference(targetLanguage));
    });

    // 无法记住偏好时，在站内跳转中继续携带当前手动选择。
    if (requestedLanguage && !preferenceSaved) {
      document.querySelectorAll('a[href]:not(.nv-language):not(.language-link)').forEach((link) => {
        const target = new URL(link.href, url);
        if (target.origin !== url.origin) return;
        if (!pages.some((item) => item[language] === normalizePath(target.pathname))) return;
        target.searchParams.set('lang', language);
        link.href = target.href;
      });
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLanguageLinks, { once: true });
  } else {
    setupLanguageLinks();
  }
})();
