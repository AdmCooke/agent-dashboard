// Shared by the background worker, the New Tab page and the settings page.
const TRB_DEFAULTS = {
  mode: 'split', // 'split': Bookmarks bar wraps onto two rows. 'folders': one folder per row.
  row1: '',
  row2: '',
  rows: 2, // 1 or 2
  labels: 'full', // 'full' | 'short' | 'icons'
  everyPage: false,
  exclude: ''
};

async function trbSettings() {
  const s = await chrome.storage.sync.get(TRB_DEFAULTS);
  s.rows = Number(s.rows) === 1 ? 1 : 2;
  return s;
}

function trbFind(node, id) {
  if (!id) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const hit = trbFind(child, id);
    if (hit) return hit;
  }
  return null;
}

function trbSlim(n) {
  const base = { id: n.id, parentId: n.parentId, index: n.index, title: n.title };
  return n.url ? { ...base, url: n.url } : { ...base, children: (n.children || []).map(trbSlim) };
}

async function trbTree() {
  const [root] = await chrome.bookmarks.getTree();
  const tops = root.children || [];
  const bar = tops.find((t) => t.folderType === 'bookmarks-bar') || tops[0];
  const other = tops.find((t) => t.folderType === 'other') || tops[1] || bar;
  return { root, tops, bar, other };
}

async function trbPayload() {
  const [settings, t] = await Promise.all([trbSettings(), trbTree()]);
  const folder = (id, fallback) => {
    const node = trbFind(t.root, id);
    return node && !node.url ? node : fallback;
  };
  const folders =
    settings.mode !== 'folders'
      ? [t.bar]
      : settings.rows === 1
        ? [folder(settings.row1, t.bar)]
        : [folder(settings.row1, t.bar), folder(settings.row2, t.other)];
  return {
    settings,
    parents: folders.map((f) => f.id),
    groups: folders.map((f) => (f.children || []).map(trbSlim))
  };
}
