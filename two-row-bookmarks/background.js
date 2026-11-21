importScripts('data.js');

const SCRIPT_ID = 'two-row-bar';
const ALL_SITES = { origins: ['<all_urls>'] };

async function broadcast(msg) {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) chrome.tabs.sendMessage(t.id, msg).catch(() => {});
}

// Registers the on-site bar only when the setting is on and Chrome granted site access.
async function syncContentScript() {
  const [settings, allowed, existing] = await Promise.all([
    trbSettings(),
    chrome.permissions.contains(ALL_SITES),
    chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] })
  ]);
  const want = settings.everyPage && allowed;
  if (want && !existing.length) {
    await chrome.scripting.registerContentScripts([
      { id: SCRIPT_ID, matches: ['<all_urls>'], js: ['bar.js', 'content.js'], runAt: 'document_idle' }
    ]);
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const t of tabs) {
      chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['bar.js', 'content.js'] }).catch(() => {});
    }
  } else if (!want && existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    broadcast({ type: 'trb:remove' });
  } else if (want) {
    broadcast({ type: 'trb:refresh' });
  }
}

// Every website asks for the same bookmark data, so build it once and reuse it until something changes.
let payloadCache = null;
function getPayload() {
  if (!payloadCache) {
    payloadCache = trbPayload().catch((err) => {
      payloadCache = null;
      throw err;
    });
  }
  return payloadCache;
}

let refreshTimer = 0;
function bookmarksChanged() {
  payloadCache = null;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => broadcast({ type: 'trb:refresh' }), 200);
}

// Favicons are kept for the browser session, so pages don't refetch them each time this worker wakes up.
async function fetchFavicon(url) {
  try {
    const res = await fetch(chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`));
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${res.headers.get('content-type') || 'image/png'};base64,${btoa(bin)}`;
  } catch {
    return '';
  }
}

async function favicons(urls) {
  const keys = urls.map((u) => 'fav:' + u);
  let stored = {};
  try {
    stored = await chrome.storage.session.get(keys);
  } catch {}
  const out = {};
  const missing = [];
  urls.forEach((u, i) => {
    if (stored[keys[i]]) out[u] = stored[keys[i]];
    else missing.push(u);
  });
  const fresh = await Promise.all(missing.map(fetchFavicon));
  const save = {};
  missing.forEach((u, i) => {
    out[u] = fresh[i];
    if (fresh[i]) save['fav:' + u] = fresh[i];
  });
  if (Object.keys(save).length) chrome.storage.session.set(save).catch(() => {});
  return out;
}

function settle(promise, reply) {
  promise.then(
    () => reply(true),
    () => reply(false)
  );
  return true;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  switch (msg.type) {
    case 'trb:get':
      getPayload().then(reply, () => reply(null));
      return true;
    case 'trb:icons':
      favicons(msg.urls.map(String)).then(reply, () => reply({}));
      return true;
    case 'trb:move': {
      const dest = { parentId: String(msg.dest.parentId) };
      if (Number.isInteger(msg.dest.index)) dest.index = msg.dest.index;
      return settle(chrome.bookmarks.move(String(msg.id), dest), reply);
    }
    case 'trb:create': {
      const i = msg.info || {};
      const info = { parentId: String(i.parentId), title: String(i.title || '').slice(0, 500) };
      if (i.url != null) {
        if (!/^(https?|file|ftp|javascript):/i.test(String(i.url))) return reply(false);
        info.url = String(i.url);
      }
      if (Number.isInteger(i.index)) info.index = i.index;
      return settle(chrome.bookmarks.create(info), reply);
    }
    case 'trb:update': {
      const c = msg.changes || {};
      const changes = {};
      if (typeof c.title === 'string') changes.title = c.title.slice(0, 500);
      if (typeof c.url === 'string') changes.url = c.url;
      return settle(chrome.bookmarks.update(String(msg.id), changes), reply);
    }
    case 'trb:remove': {
      const id = String(msg.id);
      return settle(msg.tree ? chrome.bookmarks.removeTree(id) : chrome.bookmarks.remove(id), reply);
    }
  }
});

chrome.runtime.onInstalled.addListener(syncContentScript);
chrome.runtime.onStartup.addListener(syncContentScript);
chrome.permissions.onRemoved.addListener(syncContentScript);
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== 'sync') return;
  payloadCache = null;
  syncContentScript();
});

for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
  chrome.bookmarks[ev].addListener(bookmarksChanged);
}

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'toggle-bar' && tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: 'trb:toggle' }).catch(() => {});
});
