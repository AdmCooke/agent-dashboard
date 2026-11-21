const bar = new TwoRowBar(document.getElementById('bar'), {
  icon: (url) => chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`),
  extensionPage: true
});

async function refresh() {
  bar.set(await trbPayload());
}

let timer = 0;
function scheduleRefresh() {
  clearTimeout(timer);
  timer = setTimeout(refresh, 150);
}

for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
  chrome.bookmarks[ev].addListener(scheduleRefresh);
}
chrome.storage.onChanged.addListener(scheduleRefresh);

document.getElementById('search').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('q').value.trim();
  if (text) chrome.search.query({ text, disposition: 'CURRENT_TAB' });
});

document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

refresh();
