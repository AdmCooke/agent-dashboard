// Shared setup for the extension's own pages (New Tab and the toolbar popup).
// These pages talk to Chrome's bookmarks directly, with no background worker in between.
function trbMountBar(el, extra = {}) {
  const bar = new TwoRowBar(el, {
    icon: (url) => chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`),
    extensionPage: true,
    ops: {
      move: (id, dest) => chrome.bookmarks.move(id, dest),
      create: (info) => chrome.bookmarks.create(info),
      update: (id, changes) => chrome.bookmarks.update(id, changes),
      remove: (id, tree) => (tree ? chrome.bookmarks.removeTree(id) : chrome.bookmarks.remove(id))
    },
    ...extra
  });

  const refresh = async () => bar.set(await trbPayload());
  let timer = 0;
  const scheduleRefresh = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  };
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
    chrome.bookmarks[ev].addListener(scheduleRefresh);
  }
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') scheduleRefresh();
  });

  refresh();
  return bar;
}
