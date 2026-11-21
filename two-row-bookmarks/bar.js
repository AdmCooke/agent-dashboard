// Draws the bookmark rows inside a closed shadow root, so site styles never leak in.
(() => {
  if (globalThis.TwoRowBar) return;

  const GAP = 2; // px between bookmarks, on top of each one's 9px side padding (about 20px apart)

  const CSS = `
  .root {
    --bg: #ffffff; --fg: #1f1f1f; --muted: #5f6368; --line: #e3e3e3;
    --hover: rgba(0,0,0,.06); --active: rgba(0,0,0,.1); --focus: #0b57d0; --on-focus: #ffffff;
    --danger: #b3261e; --on-danger: #ffffff;
    --menu: #ffffff; --shadow: 0 2px 6px rgba(0,0,0,.15), 0 8px 24px rgba(0,0,0,.12);
    font: 12px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: var(--fg); -webkit-font-smoothing: antialiased;
  }
  @media (prefers-color-scheme: dark) {
    .root {
      --bg: #2b2c2f; --fg: #e3e3e3; --muted: #a8abb0; --line: #3c3d40;
      --hover: rgba(255,255,255,.08); --active: rgba(255,255,255,.14); --focus: #a8c7fa; --on-focus: #062e6f;
      --danger: #f2b8b5; --on-danger: #601410;
      --menu: #2f3033; --shadow: 0 2px 6px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
    }
  }
  * { box-sizing: border-box; }
  .bar {
    display: flex; flex-direction: column; gap: 2px; padding: 3px 8px;
    background: var(--bg); border-bottom: 1px solid var(--line);
  }
  .row { display: flex; align-items: center; gap: ${GAP}px; height: 28px; overflow: hidden; flex-wrap: nowrap; }
  .row[hidden] { display: none; }
  .chip {
    flex: none; display: inline-flex; align-items: center; gap: 6px; height: 28px; max-width: 180px;
    padding: 0 9px; border: 0; border-radius: 14px; background: transparent; color: inherit;
    font: inherit; text-decoration: none; cursor: pointer; white-space: nowrap;
  }
  .chip:hover, .chip.open { background: var(--hover); }
  .chip:active { background: var(--active); }
  .chip:focus-visible, .item:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
  .chip span { overflow: hidden; text-overflow: ellipsis; }
  .chip img, .chip svg, .item img, .item svg { width: 16px; height: 16px; flex: none; }
  .chip svg, .item svg { color: var(--muted); }
  .chip.disabled { opacity: .45; cursor: default; }
  .labels-short .chip span { max-width: 72px; }
  .labels-icons .chip.link span { display: none; }
  .labels-icons .chip.link { padding: 0 6px; }
  .more { margin-left: auto; padding: 0 10px; font-size: 14px; color: var(--muted); }
  .menu {
    position: fixed; z-index: 1; min-width: 220px; max-width: 360px; padding: 6px 0; overflow: auto;
    background: var(--menu); border-radius: 8px; box-shadow: var(--shadow);
  }
  .menu.ctx { z-index: 3; min-width: 170px; }
  .item {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 30px; padding: 0 14px;
    border: 0; background: transparent; color: inherit; font: inherit; text-align: left;
    text-decoration: none; cursor: pointer; white-space: nowrap;
  }
  .item:hover { background: var(--hover); }
  .item span { overflow: hidden; text-overflow: ellipsis; }
  .item.back { color: var(--muted); border-bottom: 1px solid var(--line); margin-bottom: 4px; }
  .item.danger { color: var(--danger); }
  .empty { padding: 6px 14px; color: var(--muted); }
  .marker { position: fixed; z-index: 2; display: none; background: var(--focus); border-radius: 1px; pointer-events: none; }
  .drop-into { background: var(--hover); outline: 2px solid var(--focus); outline-offset: -2px; }
  .panel {
    position: fixed; z-index: 4; width: 320px; max-width: calc(100vw - 16px); padding: 14px;
    display: grid; gap: 10px; background: var(--menu); border-radius: 10px; box-shadow: var(--shadow);
  }
  .panel-title { font-size: 13px; font-weight: 600; }
  .panel p { margin: 0; line-height: 1.45; }
  .panel label { display: grid; gap: 4px; font-size: 11px; color: var(--muted); }
  .panel input {
    width: 100%; padding: 7px 9px; font: inherit; font-size: 13px; color: var(--fg);
    background: var(--bg); border: 1px solid var(--line); border-radius: 6px; outline: none;
  }
  .panel input:focus { border-color: var(--focus); }
  .error { font-size: 11px; color: var(--danger); }
  .error:empty { display: none; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .btn {
    height: 30px; padding: 0 14px; font: inherit; font-size: 12px; color: var(--fg); cursor: pointer;
    background: transparent; border: 1px solid var(--line); border-radius: 15px;
  }
  .btn.primary { background: var(--focus); border-color: var(--focus); color: var(--on-focus); }
  .btn.danger { background: var(--danger); border-color: var(--danger); color: var(--on-danger); }
  .btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .toast {
    position: fixed; z-index: 5; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
    max-width: calc(100vw - 16px); padding: 6px 6px 6px 14px; font-size: 12px;
    background: var(--fg); color: var(--bg); border-radius: 8px; box-shadow: var(--shadow);
  }
  .toast span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .toast button {
    flex: none; padding: 5px 10px; font: inherit; font-weight: 600; color: inherit; cursor: pointer;
    background: transparent; border: 0; border-radius: 6px; text-decoration: underline;
  }
  `;

  const FOLDER_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>';
  const ID_TYPE = 'application/x-two-row-id';
  const HOVER_OPEN_MS = 600;
  const TOAST_MS = 6000;
  const BATCH = 16; // bookmarks measured per layout pass

  function make(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function label(n) {
    if (n.title) return n.title;
    try {
      return new URL(n.url).hostname.replace(/^www\./, '') || n.url;
    } catch {
      return n.url || '';
    }
  }

  function countItems(n) {
    return (n.children || []).reduce((sum, c) => sum + 1 + countItems(c), 0);
  }

  // Turns what someone typed into a full address. "example.com" becomes "https://example.com/".
  function normalizeUrl(value) {
    let v = value.trim();
    if (!v) return null;
    if (/^javascript:/i.test(v)) return v;
    if (/\s/.test(v)) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && !/^(mailto|about|chrome|file|data):/i.test(v)) v = 'https://' + v;
    let u;
    try {
      u = new URL(v);
    } catch {
      return null;
    }
    // Web addresses need a real domain (example.com), localhost, or an IP address.
    if (/^https?:$/.test(u.protocol) && !/\.|^localhost$|^\[/.test(u.hostname)) return null;
    return u.href;
  }

  // Reads a link dragged in from a web page or the address bar.
  function readLink(dt) {
    const raw = (dt.getData('text/uri-list') || '').split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'));
    if (!raw) return null;
    let u;
    try {
      u = new URL(raw.trim());
    } catch {
      return null;
    }
    if (!/^(https?|file|ftp):$/.test(u.protocol)) return null;
    let title = '';
    const html = dt.getData('text/html');
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const a = doc.querySelector('a');
      title = ((a ? a.textContent : doc.body && doc.body.textContent) || '').replace(/\s+/g, ' ').trim();
    }
    if (!title) {
      const plain = (dt.getData('text/plain') || '').trim();
      if (plain && plain !== raw.trim() && plain !== u.href) title = plain;
    }
    if (!title) title = u.hostname.replace(/^www\./, '') || u.href;
    return { url: u.href, title: title.slice(0, 200) };
  }

  class TwoRowBar {
    constructor(host, { icon, ops, extensionPage = false }) {
      this.host = host;
      this.icon = icon;
      this.ops = ops;
      this.extensionPage = extensionPage;
      this.payload = null;
      this.menu = null;
      this.menuAnchor = null;
      this.menuParent = null;
      this.ctx = null;
      this.panel = null;
      this.toast = null;
      this.toastTimer = 0;
      this.lastWidth = -1;
      this.frame = 0;
      this.drag = null;
      this.dropEl = null;
      this.hoverEl = null;
      this.hoverTimer = 0;
      this.leaveTimer = 0;
      this.lastDragOver = 0;

      const shadow = host.attachShadow({ mode: 'closed' });
      const style = make('style');
      style.textContent = CSS;
      this.root = make('div', 'root');
      this.bar = make('div', 'bar');
      this.rows = [make('div', 'row'), make('div', 'row')];
      this.marker = make('div', 'marker');
      this.bar.append(...this.rows);
      this.root.append(this.bar, this.marker);
      shadow.append(style, this.root);

      // Re-fit the rows when the window width changes, at most once per frame.
      new ResizeObserver(() => {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = 0;
          if (this.bar.clientWidth !== this.lastWidth) this.layout();
        });
      }).observe(this.bar);

      document.addEventListener(
        'mousedown',
        (e) => {
          if (!e.composedPath().includes(this.host)) {
            this.closeMenu();
            this.closeCtx();
            this.closePanel();
          }
        },
        true
      );
      this.root.addEventListener('mousedown', (e) => {
        const path = e.composedPath();
        if (this.ctx && !path.includes(this.ctx)) this.closeCtx();
        if (this.panel && !path.includes(this.panel)) this.closePanel();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (this.ctx) this.closeCtx();
        else this.closeMenu();
      });
      window.addEventListener('blur', () => {
        if (this.drag || Date.now() - this.lastDragOver < 1000) return;
        this.closeMenu();
        this.closeCtx();
      });

      this.root.addEventListener('contextmenu', (e) => this.onContextMenu(e));
      this.root.addEventListener('dragstart', (e) => this.onDragStart(e));
      this.root.addEventListener('dragover', (e) => this.onDragOver(e));
      this.root.addEventListener('dragleave', () => {
        clearTimeout(this.leaveTimer);
        this.leaveTimer = setTimeout(() => this.clearTarget(), 80);
      });
      this.root.addEventListener('drop', (e) => this.onDrop(e));
      this.root.addEventListener('dragend', () => this.endDrag());
    }

    set(payload) {
      this.payload = payload;
      this.layout();
    }

    layout() {
      this.closeMenu();
      this.closeCtx();
      this.rows.forEach((r) => r.replaceChildren());
      if (!this.payload) return;
      const { settings, groups, parents } = this.payload;
      const count = settings.rows === 1 ? 1 : 2;
      this.bar.className = 'bar labels-' + settings.labels;
      this.rows[1].hidden = count === 1;
      this.lastWidth = this.bar.clientWidth;
      const visible = this.rows.slice(0, count);
      if (groups.length === 1) this.fill(visible, groups[0], parents[0]);
      else groups.forEach((g, k) => visible[k] && this.fill([visible[k]], g, parents[k]));
    }

    // Measures bookmarks in small batches and stops once the rows are full, so a bar
    // with hundreds of bookmarks only builds what fits. Then fills the rows in order.
    // Whatever does not fit goes behind a » button at the end of the last row.
    fill(rows, nodes, parentId) {
      if (!nodes.length) return;
      const probe = rows[0];
      const avail = probe.clientWidth - 1;
      const capacity = avail * rows.length;
      const more = make('button', 'chip more', '»');
      more.title = 'More bookmarks';
      probe.append(more);
      const moreW = more.getBoundingClientRect().width;
      const chips = [];
      const widths = [];
      let total = 0;
      while (chips.length < nodes.length && total <= capacity) {
        const batch = nodes.slice(chips.length, chips.length + BATCH).map((n) => this.chip(n));
        probe.append(...batch);
        for (const c of batch) {
          const w = c.getBoundingClientRect().width;
          widths.push(w);
          total += w + GAP;
        }
        chips.push(...batch);
      }
      probe.replaceChildren();

      const placed = rows.map(() => []);
      let ri = 0;
      let used = 0;
      let i = 0;
      for (; i < chips.length; i++) {
        const need = used ? used + GAP + widths[i] : widths[i];
        if (need > avail && used) {
          if (++ri >= rows.length) break;
          used = widths[i];
        } else used = need;
        placed[ri].push(i);
      }

      const overflow = nodes.slice(i);
      if (overflow.length) {
        const last = placed[rows.length - 1];
        while (last.length && used + GAP + moreW > avail) {
          const j = last.pop();
          overflow.unshift(nodes[j]);
          used -= widths[j] + (last.length ? GAP : 0);
        }
      }

      rows.forEach((r, k) => {
        const els = placed[k].map((j) => chips[j]);
        r.append(...els);
        els.forEach((c) => this.loadIcon(c));
      });
      if (overflow.length) {
        more._open = () => this.toggleMenu(more, overflow, parentId);
        more.addEventListener('click', more._open);
        rows[rows.length - 1].append(more);
      }
    }

    // Favicons load only for bookmarks that end up on screen.
    loadIcon(el) {
      const img = el.querySelector('img');
      if (!img || !img._url) return;
      const url = img._url;
      img._url = null;
      Promise.resolve(this.icon(url)).then((src) => {
        if (src) {
          img.src = src;
          img.style.visibility = '';
        }
      });
    }

    link(n, cls) {
      const a = make('a', cls);
      const blocked = this.extensionPage && /^javascript:/i.test(n.url);
      a.title = blocked
        ? 'Bookmarklets run from the rows on a website, not on the New Tab page'
        : n.title
          ? n.title + '\n' + n.url
          : n.url;
      if (blocked) a.classList.add('disabled');
      else {
        a.href = n.url;
        a.target = '_top';
        a.rel = 'noopener';
        a.addEventListener('click', () => this.closeMenu());
      }
      const img = make('img');
      img.alt = '';
      img.draggable = false;
      img.style.visibility = 'hidden';
      img._url = n.url;
      a.append(img, make('span', null, label(n)));
      a.draggable = true;
      a._node = n;
      return a;
    }

    chip(n) {
      if (n.url) return this.link(n, 'chip link');
      const c = make('button', 'chip folder');
      c.title = n.title;
      c.innerHTML = FOLDER_SVG;
      c.append(make('span', null, n.title || 'Folder'));
      c.draggable = true;
      c._node = n;
      c._open = () => this.toggleMenu(c, n.children, n.id);
      c.addEventListener('click', c._open);
      return c;
    }

    toggleMenu(anchor, nodes, parentId) {
      if (this.menuAnchor === anchor) return this.closeMenu();
      this.closeMenu();
      this.menuAnchor = anchor;
      anchor.classList.add('open');
      this.menu = make('div', 'menu');
      this.menu.setAttribute('role', 'menu');
      this.root.append(this.menu);
      this.stack = [];
      this.renderMenu(nodes, null, parentId);
    }

    renderMenu(nodes, title, parentId) {
      const m = this.menu;
      this.menuParent = parentId;
      m.replaceChildren();
      if (this.stack.length) {
        const back = make('button', 'item back', '‹  ' + (title || 'Back'));
        back.addEventListener('click', () => {
          const prev = this.stack.pop();
          this.renderMenu(prev.nodes, prev.title, prev.parentId);
        });
        m.append(back);
      }
      if (!nodes.length) m.append(make('div', 'empty', 'This folder is empty'));
      for (const n of nodes) {
        if (n.url) {
          const a = this.link(n, 'item');
          m.append(a);
          this.loadIcon(a);
        } else {
          const b = make('button', 'item');
          b.innerHTML = FOLDER_SVG;
          b.append(make('span', null, n.title || 'Folder'));
          b.draggable = true;
          b._node = n;
          b._open = () => {
            this.stack.push({ nodes, title, parentId });
            this.renderMenu(n.children, n.title, n.id);
          };
          b.addEventListener('click', b._open);
          m.append(b);
        }
      }
      this.place();
      const first = m.querySelector('a, button');
      if (first) first.focus({ preventScroll: true });
    }

    place() {
      const r = this.menuAnchor.getBoundingClientRect();
      const m = this.menu;
      const top = r.bottom + 4;
      m.style.top = top + 'px';
      m.style.maxHeight = Math.max(120, window.innerHeight - top - 8) + 'px';
      const w = m.offsetWidth;
      m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    }

    // Puts a floating box below a spot on screen, or above it when there is no room below.
    placeAt(el, rect) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let top = rect.bottom + 4;
      if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 4);
      el.style.top = top + 'px';
      el.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)) + 'px';
    }

    closeMenu() {
      if (!this.menu) return;
      this.menu.remove();
      this.menu = null;
      this.menuParent = null;
      if (this.menuAnchor) this.menuAnchor.classList.remove('open');
      this.menuAnchor = null;
    }

    // ---- Right-click: open, edit, rename, delete ----

    onContextMenu(e) {
      const el = e.target && e.target.closest ? e.target.closest('.chip, .item') : null;
      if (!el || !el._node || !this.ops) return;
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      const keyboard = e.clientX === 0 && e.clientY === 0;
      this.openCtx(el, keyboard ? r.left : e.clientX, keyboard ? r.bottom : e.clientY);
    }

    openCtx(el, x, y) {
      this.closeCtx();
      const n = el._node;
      const m = make('div', 'menu ctx');
      m.setAttribute('role', 'menu');
      const add = (text, fn, cls) => {
        const b = make('button', 'item' + (cls ? ' ' + cls : ''), text);
        b.addEventListener('click', () => {
          this.closeCtx();
          fn();
        });
        m.append(b);
      };
      if (n.url && !(this.extensionPage && /^javascript:/i.test(n.url))) {
        const a = make('a', 'item', 'Open in new tab');
        a.href = n.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.addEventListener('click', () => this.closeCtx());
        m.append(a);
      }
      add(n.url ? 'Edit' : 'Rename', () => this.openEditor(el, n));
      add('Delete', () => this.remove(el, n), 'danger');
      this.root.append(m);
      this.ctx = m;
      m.style.left = Math.max(8, Math.min(x, window.innerWidth - m.offsetWidth - 8)) + 'px';
      m.style.top = Math.max(8, Math.min(y, window.innerHeight - m.offsetHeight - 8)) + 'px';
      m.querySelector('a, button').focus({ preventScroll: true });
    }

    closeCtx() {
      if (!this.ctx) return;
      this.ctx.remove();
      this.ctx = null;
    }

    // A small form or question box. Keystrokes stay inside it, so site shortcuts don't fire while you type.
    openPanel(anchorEl, build) {
      this.closePanel();
      const p = make('form', 'panel');
      p.noValidate = true;
      for (const type of ['keydown', 'keyup', 'keypress']) {
        p.addEventListener(type, (e) => {
          e.stopPropagation();
          if (type === 'keydown' && e.key === 'Escape') {
            e.preventDefault();
            this.closePanel();
          }
        });
      }
      build(p);
      this.root.append(p);
      this.panel = p;
      this.placeAt(p, anchorEl.getBoundingClientRect());
      const first = p.querySelector('input, .btn.danger, .btn.primary');
      if (first) {
        first.focus({ preventScroll: true });
        if (first.select) first.select();
      }
    }

    closePanel() {
      if (!this.panel) return;
      this.panel.remove();
      this.panel = null;
    }

    buttons(p, okText, okClass) {
      const row = make('div', 'actions');
      const cancel = make('button', 'btn', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', () => this.closePanel());
      const ok = make('button', 'btn ' + okClass, okText);
      ok.type = 'submit';
      row.append(cancel, ok);
      p.append(row);
    }

    openEditor(el, n) {
      this.openPanel(el, (p) => {
        p.append(make('div', 'panel-title', n.url ? 'Edit bookmark' : 'Rename folder'));
        const nameLabel = make('label', null, 'Name');
        const name = make('input');
        name.value = n.title;
        name.maxLength = 500;
        nameLabel.append(name);
        p.append(nameLabel);
        let url = null;
        if (n.url) {
          const urlLabel = make('label', null, 'Address');
          url = make('input');
          url.value = n.url;
          url.spellcheck = false;
          url.autocomplete = 'off';
          urlLabel.append(url);
          p.append(urlLabel);
        }
        const err = make('div', 'error');
        p.append(err);
        this.buttons(p, 'Save', 'primary');
        p.addEventListener('submit', async (e) => {
          e.preventDefault();
          const changes = { title: name.value.trim() };
          if (url) {
            const href = normalizeUrl(url.value);
            if (!href) {
              err.textContent = 'Enter a full web address, like example.com';
              url.focus();
              return;
            }
            changes.url = href;
          }
          let ok = false;
          try {
            ok = (await this.ops.update(n.id, changes)) !== false;
          } catch {}
          if (ok) this.closePanel();
          else err.textContent = 'Chrome did not save that change. Try again.';
        });
      });
    }

    async remove(el, n) {
      const items = countItems(n);
      if (!n.url && items) {
        this.openPanel(el, (p) => {
          p.append(make('div', 'panel-title', 'Delete folder?'));
          p.append(make('p', null, `"${n.title || 'Folder'}" and the ${items} ${items === 1 ? 'item' : 'items'} inside it will be deleted.`));
          this.buttons(p, 'Delete', 'danger');
          p.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.closePanel();
            try {
              await this.ops.remove(n.id, true);
            } catch {}
          });
        });
        return;
      }
      let ok = false;
      try {
        ok = (await this.ops.remove(n.id, !n.url)) !== false;
      } catch {}
      if (!ok) return;
      const restore = { parentId: n.parentId, index: n.index, title: n.title };
      if (n.url) restore.url = n.url;
      this.showToast(`Deleted "${label(n) || 'Folder'}"`, () => this.ops.create(restore));
    }

    showToast(text, undo) {
      this.closeToast();
      const t = make('div', 'toast');
      t.setAttribute('role', 'status');
      t.append(make('span', null, text));
      if (undo) {
        const b = make('button', null, 'Undo');
        b.addEventListener('click', () => {
          this.closeToast();
          undo();
        });
        t.append(b);
      }
      this.root.append(t);
      this.toast = t;
      t.style.top = this.bar.getBoundingClientRect().bottom + 8 + 'px';
      this.toastTimer = setTimeout(() => this.closeToast(), TOAST_MS);
    }

    closeToast() {
      clearTimeout(this.toastTimer);
      if (this.toast) this.toast.remove();
      this.toast = null;
    }

    // ---- Drag and drop ----

    onDragStart(e) {
      const el = e.target && e.target.closest ? e.target.closest('.chip, .item') : null;
      if (!el || !el._node) return;
      const n = el._node;
      this.closeCtx();
      this.drag = { id: n.id };
      e.dataTransfer.effectAllowed = 'all';
      e.dataTransfer.setData(ID_TYPE, n.id);
      if (n.url) {
        e.dataTransfer.setData('text/uri-list', n.url);
        e.dataTransfer.setData('text/plain', n.url);
      } else e.dataTransfer.setData('text/plain', n.title || 'Folder');
    }

    accepts(e) {
      if (this.drag) return true;
      const types = Array.from(e.dataTransfer.types);
      return types.includes(ID_TYPE) || types.includes('text/uri-list');
    }

    onDragOver(e) {
      if (!this.payload || !this.accepts(e)) return;
      const t = this.target(e);
      if (!t) return this.clearTarget();
      e.preventDefault();
      clearTimeout(this.leaveTimer);
      this.lastDragOver = Date.now();
      const internal = this.drag || Array.from(e.dataTransfer.types).includes(ID_TYPE);
      e.dataTransfer.dropEffect = internal ? 'move' : 'copy';
      this.showTarget(t);
      // Holding over a folder (or ») opens it, so you can drop deeper.
      const opener = t.into || t.more || null;
      if (opener !== this.hoverEl) {
        clearTimeout(this.hoverTimer);
        this.hoverEl = opener;
        if (opener && opener._open && opener !== this.menuAnchor) {
          this.hoverTimer = setTimeout(() => {
            if (this.hoverEl === opener && opener.isConnected) opener._open();
          }, HOVER_OPEN_MS);
        }
      }
    }

    async onDrop(e) {
      const t = this.target(e);
      const id = (this.drag && this.drag.id) || e.dataTransfer.getData(ID_TYPE);
      const link = id ? null : readLink(e.dataTransfer);
      this.endDrag();
      if (!t || !e.isTrusted || (!id && !link)) return;
      e.preventDefault();
      const dest = t.into ? { parentId: t.into._node.id } : { parentId: t.parentId };
      if (!t.into && Number.isInteger(t.index)) dest.index = t.index;
      try {
        if (id) {
          if (id !== dest.parentId) await this.ops.move(id, dest);
        } else await this.ops.create({ ...dest, ...link });
      } catch {}
    }

    endDrag() {
      this.drag = null;
      clearTimeout(this.hoverTimer);
      this.hoverEl = null;
      this.clearTarget();
    }

    target(e) {
      const path = e.composedPath();
      if (this.menu && path.includes(this.menu)) return this.menuTarget(e);
      if (path.includes(this.bar)) return this.rowTarget(e);
      return null;
    }

    // Finds where a drop lands among a list of chips or menu items.
    slot(els, e, vertical) {
      const p = vertical ? e.clientY : e.clientX;
      for (const el of els) {
        const b = el.getBoundingClientRect();
        const lo = vertical ? b.top : b.left;
        const hi = vertical ? b.bottom : b.right;
        if (p > hi) continue;
        const q = (hi - lo) / 4;
        if (!el._node.url && p > lo + q && p < hi - q) return { into: el };
        return p < (lo + hi) / 2 ? { index: el._node.index, at: lo } : { index: el._node.index + 1, at: hi };
      }
      const last = els[els.length - 1];
      if (!last) return { index: undefined, at: null };
      const b = last.getBoundingClientRect();
      return { index: last._node.index + 1, at: vertical ? b.bottom : b.right };
    }

    rowTarget(e) {
      const { groups, parents } = this.payload;
      const rows = this.rows.filter((r) => !r.hidden);
      let ri = rows.findIndex((r) => e.clientY <= r.getBoundingClientRect().bottom + 1);
      if (ri < 0) ri = rows.length - 1;
      const row = rows[ri];
      const rb = row.getBoundingClientRect();
      const parentId = parents[groups.length === 1 ? 0 : ri];
      const line = (x) => ({ left: x - 1, top: rb.top + 4, width: 2, height: rb.height - 8 });
      const more = row.querySelector('.more');
      if (more && e.clientX >= more.getBoundingClientRect().left - 4) {
        return { parentId, index: undefined, more, line: line(more.getBoundingClientRect().left - 2) };
      }
      const s = this.slot(Array.from(row.children).filter((c) => c._node), e, false);
      if (s.into) return { into: s.into };
      return { parentId, index: s.index, line: line(s.at == null ? rb.left + 2 : s.at) };
    }

    menuTarget(e) {
      const mb = this.menu.getBoundingClientRect();
      const s = this.slot(Array.from(this.menu.children).filter((c) => c._node), e, true);
      if (s.into) return { into: s.into };
      const y = s.at == null ? mb.top + 6 : s.at;
      return { parentId: this.menuParent, index: s.index, line: { left: mb.left + 8, top: y - 1, width: mb.width - 16, height: 2 } };
    }

    showTarget(t) {
      if (this.dropEl && this.dropEl !== t.into) this.dropEl.classList.remove('drop-into');
      this.dropEl = t.into || null;
      if (t.into) {
        t.into.classList.add('drop-into');
        this.marker.style.display = 'none';
        return;
      }
      const m = this.marker.style;
      m.left = t.line.left + 'px';
      m.top = t.line.top + 'px';
      m.width = t.line.width + 'px';
      m.height = t.line.height + 'px';
      m.display = 'block';
    }

    clearTarget() {
      if (this.dropEl) this.dropEl.classList.remove('drop-into');
      this.dropEl = null;
      this.marker.style.display = 'none';
    }
  }

  globalThis.TwoRowBar = TwoRowBar;
})();
