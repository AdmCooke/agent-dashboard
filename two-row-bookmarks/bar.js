// Draws the two bookmark rows inside a closed shadow root, so site styles never leak in.
(() => {
  if (globalThis.TwoRowBar) return;

  const CSS = `
  .root {
    --bg: #ffffff; --fg: #1f1f1f; --muted: #5f6368; --line: #e3e3e3;
    --hover: rgba(0,0,0,.06); --active: rgba(0,0,0,.1); --focus: #0b57d0;
    --menu: #ffffff; --shadow: 0 2px 6px rgba(0,0,0,.15), 0 8px 24px rgba(0,0,0,.12);
    font: 12px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: var(--fg); -webkit-font-smoothing: antialiased;
  }
  @media (prefers-color-scheme: dark) {
    .root {
      --bg: #2b2c2f; --fg: #e3e3e3; --muted: #a8abb0; --line: #3c3d40;
      --hover: rgba(255,255,255,.08); --active: rgba(255,255,255,.14); --focus: #a8c7fa;
      --menu: #2f3033; --shadow: 0 2px 6px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
    }
  }
  * { box-sizing: border-box; }
  .bar {
    display: flex; flex-direction: column; gap: 2px; padding: 3px 8px;
    background: var(--bg); border-bottom: 1px solid var(--line);
  }
  .row { display: flex; align-items: center; gap: 0; height: 28px; overflow: hidden; flex-wrap: nowrap; }
  .chip {
    flex: none; display: inline-flex; align-items: center; gap: 5px; height: 28px; max-width: 180px;
    padding: 0 5px; border: 0; border-radius: 14px; background: transparent; color: inherit;
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
  .labels-icons .chip.link { padding: 0 4px; }
  .more { margin-left: auto; padding: 0 10px; font-size: 14px; color: var(--muted); }
  .menu {
    position: fixed; z-index: 1; min-width: 220px; max-width: 360px; padding: 6px 0; overflow: auto;
    background: var(--menu); border-radius: 8px; box-shadow: var(--shadow);
  }
  .item {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 30px; padding: 0 14px;
    border: 0; background: transparent; color: inherit; font: inherit; text-align: left;
    text-decoration: none; cursor: pointer; white-space: nowrap;
  }
  .item:hover { background: var(--hover); }
  .item span { overflow: hidden; text-overflow: ellipsis; }
  .item.back { color: var(--muted); border-bottom: 1px solid var(--line); margin-bottom: 4px; }
  .empty { padding: 6px 14px; color: var(--muted); }
  .marker { position: fixed; z-index: 2; display: none; background: var(--focus); border-radius: 1px; pointer-events: none; }
  .drop-into { background: var(--hover); outline: 2px solid var(--focus); outline-offset: -2px; }
  `;

  const FOLDER_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>';
  const ID_TYPE = 'application/x-two-row-id';
  const HOVER_OPEN_MS = 600;

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
      this.lastWidth = 0;
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

      new ResizeObserver(() => {
        const w = this.bar.clientWidth;
        if (w !== this.lastWidth) {
          this.lastWidth = w;
          this.layout();
        }
      }).observe(this.bar);

      document.addEventListener(
        'mousedown',
        (e) => {
          if (this.menu && !e.composedPath().includes(this.host)) this.closeMenu();
        },
        true
      );
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeMenu();
      });
      window.addEventListener('blur', () => {
        if (!this.drag && Date.now() - this.lastDragOver > 1000) this.closeMenu();
      });

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
      this.rows.forEach((r) => r.replaceChildren());
      if (!this.payload) return;
      const { settings, groups, parents } = this.payload;
      this.bar.className = 'bar labels-' + settings.labels;
      if (groups.length === 1) this.fill(this.rows, groups[0], parents[0]);
      else {
        this.fill([this.rows[0]], groups[0], parents[0]);
        this.fill([this.rows[1]], groups[1], parents[1]);
      }
    }

    // Puts chips into the rows in order. Whatever does not fit goes into a » menu at the end.
    fill(rows, nodes, parentId) {
      const overflow = [];
      let ri = 0;
      for (const n of nodes) {
        if (ri >= rows.length) {
          overflow.push(n);
          continue;
        }
        const chip = this.chip(n);
        rows[ri].append(chip);
        if (rows[ri].scrollWidth > rows[ri].clientWidth && rows[ri].children.length > 1) {
          chip.remove();
          ri++;
          if (ri < rows.length) rows[ri].append(chip);
          else overflow.push(n);
        }
      }
      if (!overflow.length) return;
      const last = rows[rows.length - 1];
      const more = make('button', 'chip more', '»');
      more.title = 'More bookmarks';
      last.append(more);
      while (last.scrollWidth > last.clientWidth && last.children.length > 1) {
        const c = more.previousElementSibling;
        overflow.unshift(c._node);
        c.remove();
      }
      more._open = () => this.toggleMenu(more, overflow, parentId);
      more.addEventListener('click', more._open);
    }

    favicon(url) {
      const img = make('img');
      img.alt = '';
      img.draggable = false;
      img.style.visibility = 'hidden';
      Promise.resolve(this.icon(url)).then((src) => {
        if (src) {
          img.src = src;
          img.style.visibility = '';
        }
      });
      return img;
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
      a.append(this.favicon(n.url), make('span', null, label(n)));
      a.draggable = true;
      a._node = n;
      return a;
    }

    chip(n) {
      let c;
      if (n.url) c = this.link(n, 'chip link');
      else {
        c = make('button', 'chip folder');
        c.title = n.title;
        c.innerHTML = FOLDER_SVG;
        c.append(make('span', null, n.title || 'Folder'));
        c.draggable = true;
        c._node = n;
        c._open = () => this.toggleMenu(c, n.children, n.id);
        c.addEventListener('click', c._open);
      }
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
        if (n.url) m.append(this.link(n, 'item'));
        else {
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

    closeMenu() {
      if (!this.menu) return;
      this.menu.remove();
      this.menu = null;
      this.menuParent = null;
      if (this.menuAnchor) this.menuAnchor.classList.remove('open');
      this.menuAnchor = null;
    }

    // ---- Drag and drop ----

    onDragStart(e) {
      const el = e.target && e.target.closest ? e.target.closest('.chip, .item') : null;
      if (!el || !el._node) return;
      const n = el._node;
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
      let ri = this.rows.findIndex((r) => e.clientY <= r.getBoundingClientRect().bottom + 1);
      if (ri < 0) ri = this.rows.length - 1;
      const row = this.rows[ri];
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
