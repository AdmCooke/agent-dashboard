// The toolbar popup: your rows on any page, without adding anything to the page.
// Links open in the current tab (or a new tab with Ctrl/Cmd-click, middle-click, or the right-click menu).
trbMountBar(document.getElementById('bar'), {
  openLink: (url, newTab) => {
    if (newTab) chrome.tabs.create({ url, active: false });
    else {
      chrome.tabs.update({ url }).finally(() => window.close());
    }
  }
});

document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
