// Runs on websites only after you turn on "Also show on websites" in settings.
//
// Two ways to show the rows on a site:
// - 'reveal' (default): hidden until you point at the very top edge of the page. Then the rows
//   slide down over the page and tuck away once you move off. The page itself never moves.
// - 'pinned': always visible, and the page is pushed down to make room.
(() => {
  if (window.top !== window || globalThis.__twoRowBookmarks) return;
  if (!(document.documentElement instanceof HTMLHtmlElement)) return;
  globalThis.__twoRowBookmarks = true;

  const html = document.documentElement;
  const EDGE_PX = 4; // how close to the top edge counts as pointing at it
  const DWELL_MS = 250; // how long to rest there, so passing through to the tabs doesn't open it
  const GRACE_MS = 1200; // after opening, how long to wait for the pointer to come onto the rows
  const HIDE_MS = 500; // delay before tucking away after the pointer leaves
  const BASE =
    'all:initial !important;display:block !important;position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:2147483647 !important;';

  // ---- Favicons, fetched in batches from the background worker ----
  const iconCache = new Map();
  const pending = new Map();
  let iconTimer = 0;

  function icon(url) {
    if (iconCache.has(url)) return iconCache.get(url);
    return new Promise((resolve) => {
      if (!pending.has(url)) pending.set(url, []);
      pending.get(url).push(resolve);
      clearTimeout(iconTimer);
      iconTimer = setTimeout(flushIcons, 0);
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

  // ---- State ----
  let host = null;
  let bar = null;
  let mode = 'reveal';
  let hidden = false; // pinned mode: hidden with the keyboard shortcut
  let revealed = false; // reveal mode: slid down right now
  let byKeyboard = false;
  let pointerInside = false;
  let savedMargin = null;
  let dwellTimer = 0;
  let hideTimer = 0;

  function restoreMargin() {
    if (savedMargin) html.style.setProperty('margin-top', savedMargin[0], savedMargin[1]);
  }

  function render() {
    if (!host) return;
    const full = !!document.fullscreenElement;
    let style = BASE;
    if (mode === 'pinned') {
      if (hidden || full) style += 'display:none !important;';
    } else {
      const show = revealed && !full;
      // Becomes visible at once when sliding in, and only turns invisible after sliding out.
      style += show
        ? 'transition:transform .16s ease !important;transform:none !important;visibility:visible !important;'
        : 'transition:transform .16s ease,visibility 0s linear .16s !important;transform:translateY(-100%) !important;visibility:hidden !important;';
    }
    host.setAttribute('style', style);
    if (bar) bar.setOverlay(mode === 'reveal');

    if (savedMargin === null) {
      savedMargin = [html.style.getPropertyValue('margin-top'), html.style.getPropertyPriority('margin-top')];
    }
    if (mode === 'pinned' && !hidden && !full) html.style.setProperty('margin-top', host.offsetHeight + 'px', 'important');
    else restoreMargin();
  }

  // ---- Reveal mode ----
  function busy() {
    return (bar && bar.isBusy()) || (byKeyboard && document.activeElement === host);
  }

  function reveal(keyboard) {
    clearTimeout(dwellTimer);
    if (!host || mode !== 'reveal' || document.fullscreenElement) return;
    byKeyboard = !!keyboard;
    if (!revealed) {
      revealed = true;
      render();
    }
    if (keyboard) bar.focusFirst();
    scheduleHide(GRACE_MS);
  }

  function hide() {
    clearTimeout(hideTimer);
    if (!revealed) return;
    revealed = false;
    byKeyboard = false;
    if (bar) bar.blur();
    render();
  }

  function scheduleHide(ms) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(tryHide, ms);
  }

  function tryHide() {
    if (!revealed || pointerInside) return;
    if (busy()) return scheduleHide(HIDE_MS);
    hide();
  }

  function nearEdge(e) {
    if (!host || mode !== 'reveal' || revealed) return;
    if (e.clientY <= EDGE_PX) {
      if (!dwellTimer) {
        dwellTimer = setTimeout(() => {
          dwellTimer = 0;
          reveal(false);
        }, DWELL_MS);
      }
    } else {
      clearTimeout(dwellTimer);
      dwellTimer = 0;
    }
  }

  const passive = { capture: true, passive: true };
  window.addEventListener('mousemove', nearEdge, passive);
  window.addEventListener('dragover', nearEdge, passive); // drag a link to the top edge to save it
  window.addEventListener(
    'mouseout',
    (e) => {
      if (!e.relatedTarget) {
        clearTimeout(dwellTimer); // pointer left the window, for example up to the tabs
        dwellTimer = 0;
      }
    },
    passive
  );
  for (const type of ['drop', 'dragend']) {
    window.addEventListener(
      type,
      () => {
        if (!revealed) return;
        pointerInside = false;
        scheduleHide(HIDE_MS);
      },
      passive
    );
  }
  window.addEventListener(
    'keydown',
    (e) => {
      // First Escape closes an open menu (the bar handles that), the next one tucks the rows away.
      if (e.key === 'Escape' && revealed && !(bar && bar.isBusy())) hide();
    },
    true
  );

  // ---- Mounting ----
  function mount() {
    if (host) return;
    host = document.createElement('two-row-bookmarks');
    host.setAttribute('style', BASE + 'visibility:hidden !important;');
    html.append(host);
    bar = new TwoRowBar(host, {
      icon,
      ops: {
        move: (id, dest) => chrome.runtime.sendMessage({ type: 'trb:move', id, dest }),
        create: (info) => chrome.runtime.sendMessage({ type: 'trb:create', info }),
        update: (id, changes) => chrome.runtime.sendMessage({ type: 'trb:update', id, changes }),
        remove: (id, tree) => chrome.runtime.sendMessage({ type: 'trb:remove', id, tree })
      }
    });
    host.addEventListener('mouseenter', () => {
      pointerInside = true;
      clearTimeout(hideTimer);
    });
    host.addEventListener('mouseleave', () => {
      pointerInside = false;
      if (revealed) scheduleHide(HIDE_MS);
    });
    host.addEventListener('focusout', () => {
      if (revealed && byKeyboard) scheduleHide(HIDE_MS);
    });
  }

  function unmount() {
    if (!host) return;
    host.remove();
    host = null;
    bar = null;
    revealed = false;
    restoreMargin();
    savedMargin = null;
  }

  function excludedHere(settings) {
    const hostname = location.hostname.toLowerCase();
    return settings.exclude
      .split(/[\s,]+/)
      .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(Boolean)
      .some((h) => hostname === h || hostname.endsWith('.' + h));
  }

  async function load() {
    let payload;
    try {
      payload = await chrome.runtime.sendMessage({ type: 'trb:get' });
    } catch {
      return unmount();
    }
    if (!payload || !payload.settings.everyPage || excludedHere(payload.settings)) return unmount();
    mount();
    if (payload.settings.pageMode !== mode) {
      mode = payload.settings.pageMode;
      revealed = false;
      hidden = false;
    }
    bar.set(payload);
    render();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'trb:refresh') load();
    else if (msg.type === 'trb:remove') unmount();
    else if (msg.type === 'trb:toggle') {
      if (!host) return;
      if (mode === 'reveal') {
        if (revealed) hide();
        else reveal(true);
      } else {
        hidden = !hidden;
        render();
      }
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) hide();
    render();
  });
  load();
})();
