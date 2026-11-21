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
  .row { display: flex; align-items: center; gap: 2px; height: 28px; overflow: hidden; flex-wrap: nowrap; }
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
  .item {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 30px; padding: 0 14px;
    border: 0; background: transparent; color: inherit; font: inherit; text-align: left;
    text-decoration: none; cursor: pointer; white-space: nowrap;
  }
  .item:hover { background: var(--hover); }
  .item span { overflow: hidden; text-overflow: ellipsis; }
  .item.back { color: var(--muted); border-bottom: 1px solid var(--line); margin-bottom: 4px; }
  .empty { padding: 6px 14px; color: var(--muted); }
  `;

  const FOLDER_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>';

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

  class TwoRowBar {
    constructor(host, { icon, extensionPage = false }) {
      this.host = host;
      this.icon = icon;
      this.extensionPage = extensionPage;
      this.payload = null;
      this.menu = null;
      this.menuAnchor = null;
      this.lastWidth = 0;

      const shadow = host.attachShadow({ mode: 'closed' });
      const style = make('style');
      style.textContent = CSS;
      this.root = make('div', 'root');
      this.bar = make('div', 'bar');
      this.rows = [make('div', 'row'), make('div', 'row')];
      this.bar.append(...this.rows);
      this.root.append(this.bar);
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
      window.addEventListener('blur', () => this.closeMenu());
    }

    set(payload) {
      this.payload = payload;
      this.layout();
    }

    layout() {
      this.closeMenu();
      this.rows.forEach((r) => r.replaceChildren());
      if (!this.payload) return;
      const { settings, groups } = this.payload;
      this.bar.className = 'bar labels-' + settings.labels;
      if (groups.length === 1) this.fill(this.rows, groups[0]);
      else {
        this.fill([this.rows[0]], groups[0]);
        this.fill([this.rows[1]], groups[1]);
      }
    }

    // Puts chips into the rows in order. Whatever does not fit goes into a » menu at the end.
    fill(rows, nodes) {
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
      more.addEventListener('click', () => this.toggleMenu(more, overflow));
    }

    favicon(url) {
      const img = make('img');
      img.alt = '';
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
        c.addEventListener('click', () => this.toggleMenu(c, n.children, n));
      }
      c._node = n;
      return c;
    }

    toggleMenu(anchor, nodes) {
      if (this.menuAnchor === anchor) return this.closeMenu();
      this.closeMenu();
      this.menuAnchor = anchor;
      anchor.classList.add('open');
      this.menu = make('div', 'menu');
      this.menu.setAttribute('role', 'menu');
      this.root.append(this.menu);
      this.stack = [];
      this.renderMenu(nodes);
    }

    renderMenu(nodes, title) {
      const m = this.menu;
      m.replaceChildren();
      if (this.stack.length) {
        const back = make('button', 'item back', '‹  ' + (title || 'Back'));
        back.addEventListener('click', () => {
          const prev = this.stack.pop();
          this.renderMenu(prev.nodes, prev.title);
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
          b.addEventListener('click', () => {
            this.stack.push({ nodes, title });
            this.renderMenu(n.children, n.title);
          });
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
      if (this.menuAnchor) this.menuAnchor.classList.remove('open');
      this.menuAnchor = null;
    }
  }

  globalThis.TwoRowBar = TwoRowBar;
})();
