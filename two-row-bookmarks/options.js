const $ = (id) => document.getElementById(id);
const ALL_SITES = { origins: ['<all_urls>'] };
let statusTimer = 0;

function saved() {
  $('status').classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => $('status').classList.remove('show'), 1200);
}

async function save(patch) {
  await chrome.storage.sync.set(patch);
  saved();
}

function folderOptions(node, depth, out) {
  for (const child of node.children || []) {
    if (child.url) continue;
    out.push({ id: child.id, name: '   '.repeat(depth) + (child.title || 'Untitled folder') });
    folderOptions(child, depth + 1, out);
  }
  return out;
}

async function init() {
  const [s, t, allowed] = await Promise.all([trbSettings(), trbTree(), chrome.permissions.contains(ALL_SITES)]);
  const folders = folderOptions(t.root, 0, []);

  for (const [id, fallback] of [['row1', t.bar.id], ['row2', t.other.id]]) {
    const sel = $(id);
    for (const f of folders) sel.add(new Option(f.name, f.id));
    sel.value = folders.some((f) => f.id === s[id]) ? s[id] : fallback;
    sel.addEventListener('change', () => save({ [id]: sel.value }));
  }

  let rows = s.rows;
  let mode = s.mode;
  const showFolders = () => {
    $('folders').hidden = mode !== 'folders';
    $('row2field').hidden = rows === 1;
  };
  document.querySelectorAll('input[name=rows]').forEach((r) => {
    r.checked = Number(r.value) === rows;
    r.addEventListener('change', () => {
      rows = Number(r.value);
      showFolders();
      save({ rows });
    });
  });
  document.querySelectorAll('input[name=mode]').forEach((r) => {
    r.checked = r.value === s.mode;
    r.addEventListener('change', () => {
      mode = r.value;
      showFolders();
      save({ mode, row1: $('row1').value, row2: $('row2').value });
    });
  });
  showFolders();

  document.querySelectorAll('input[name=labels]').forEach((r) => {
    r.checked = r.value === s.labels;
    r.addEventListener('change', () => save({ labels: r.value }));
  });

  const every = $('everyPage');
  every.checked = s.everyPage && allowed;
  every.addEventListener('change', async () => {
    if (every.checked) {
      const ok = await chrome.permissions.request(ALL_SITES);
      if (!ok) {
        every.checked = false;
        return;
      }
      save({ everyPage: true });
    } else {
      await save({ everyPage: false });
      chrome.permissions.remove(ALL_SITES);
    }
  });

  const ex = $('exclude');
  ex.value = s.exclude;
  let exTimer = 0;
  ex.addEventListener('input', () => {
    clearTimeout(exTimer);
    exTimer = setTimeout(() => save({ exclude: ex.value }), 400);
  });

  $('shortcuts').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
}

init();
