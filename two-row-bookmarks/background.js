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

let refreshTimer = 0;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => broadcast({ type: 'trb:refresh' }), 200);
}

const iconCache = new Map();
async function favicon(url) {
  if (iconCache.has(url)) return iconCache.get(url);
  try {
    const res = await fetch(chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`));
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const data = `data:${res.headers.get('content-type') || 'image/png'};base64,${btoa(bin)}`;
    if (iconCache.size > 500) iconCache.clear();
    iconCache.set(url, data);
    return data;
  } catch {
    return '';
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'trb:get') {
    trbPayload().then(reply, () => reply(null));
    return true;
  }
  if (msg.type === 'trb:icons') {
    Promise.all(msg.urls.map(favicon)).then((list) =>
      reply(Object.fromEntries(msg.urls.map((u, i) => [u, list[i]])))
    );
    return true;
  }
});

chrome.runtime.onInstalled.addListener(syncContentScript);
chrome.runtime.onStartup.addListener(syncContentScript);
chrome.permissions.onRemoved.addListener(syncContentScript);
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') syncContentScript();
});

for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
  chrome.bookmarks[ev].addListener(scheduleRefresh);
}

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'toggle-bar' && tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: 'trb:toggle' }).catch(() => {});
});
