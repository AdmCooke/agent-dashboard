// Runs on websites only after you turn on "Show on every website" in settings.
(() => {
  if (window.top !== window || globalThis.__twoRowBookmarks) return;
  if (!(document.documentElement instanceof HTMLHtmlElement)) return;
  globalThis.__twoRowBookmarks = true;

  const html = document.documentElement;
  const iconCache = new Map();
  const pending = new Map();
  let timer = 0;

  function icon(url) {
    if (iconCache.has(url)) return iconCache.get(url);
    return new Promise((resolve) => {
      if (!pending.has(url)) pending.set(url, []);
      pending.get(url).push(resolve);
      clearTimeout(timer);
      timer = setTimeout(flushIcons, 0);
    });
  }

  async function flushIcons() {
    const batch = new Map(pending);
    pending.clear();
    let map = {};
    try {
      map = (await chrome.runtime.sendMessage({ type: 'trb:icons', urls: [...batch.keys()] })) || {};
    } catch {}
    for (const [url, waiters] of batch) {
      const src = map[url] || '';
      if (src) iconCache.set(url, src);
      waiters.forEach((r) => r(src));
    }
  }

  let host = null;
  let bar = null;
  let hidden = false;
  let savedMargin = null;

  function applyOffset() {
    if (!host) return;
    const off = hidden || document.fullscreenElement;
    host.style.display = off ? 'none' : 'block';
    if (savedMargin === null) {
      savedMargin = [html.style.getPropertyValue('margin-top'), html.style.getPropertyPriority('margin-top')];
    }
    if (off) html.style.setProperty('margin-top', savedMargin[0], savedMargin[1]);
    else html.style.setProperty('margin-top', host.offsetHeight + 'px', 'important');
  }

  function mount() {
    if (host) return;
    host = document.createElement('two-row-bookmarks');
    host.setAttribute(
      'style',
      'all:initial !important;display:block !important;position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:2147483647 !important;'
    );
    html.append(host);
    bar = new TwoRowBar(host, {
      icon,
      ops: {
        move: (id, dest) => chrome.runtime.sendMessage({ type: 'trb:move', id, dest }),
        create: (info) => chrome.runtime.sendMessage({ type: 'trb:create', info })
      }
    });
  }

  function unmount() {
    if (!host) return;
    host.remove();
    host = null;
    bar = null;
    if (savedMargin) html.style.setProperty('margin-top', savedMargin[0], savedMargin[1]);
    savedMargin = null;
  }

  async function load() {
    let payload;
    try {
      payload = await chrome.runtime.sendMessage({ type: 'trb:get' });
    } catch {
      return unmount();
    }
    if (!payload || !payload.settings.everyPage || trbExcludedHost(payload.settings)) return unmount();
    mount();
    bar.set(payload);
    applyOffset();
  }

  function trbExcludedHost(settings) {
    const hostname = location.hostname.toLowerCase();
    return settings.exclude
      .split(/[\s,]+/)
      .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(Boolean)
      .some((h) => hostname === h || hostname.endsWith('.' + h));
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'trb:refresh') load();
    else if (msg.type === 'trb:remove') unmount();
    else if (msg.type === 'trb:toggle') {
      hidden = !hidden;
      applyOffset();
    }
  });

  document.addEventListener('fullscreenchange', applyOffset);
  load();
})();
