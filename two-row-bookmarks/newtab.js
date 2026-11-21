const bar = trbMountBar(document.getElementById('bar'));

document.getElementById('search').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('q').value.trim();
  if (text) chrome.search.query({ text, disposition: 'CURRENT_TAB' });
});

document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
