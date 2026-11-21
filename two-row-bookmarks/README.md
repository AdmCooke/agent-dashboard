# Two Row Bookmarks

A Chrome extension that shows your bookmarks in two clean rows instead of Chrome's single row.

Chrome does not let extensions change its built-in bookmarks bar, so this extension draws its own two-row bar:

- On the New Tab page, always, with a search box that uses your default search engine.
- At the top of every website, if you turn it on in settings.

## Install

1. Download this `two-row-bookmarks` folder (or unzip `two-row-bookmarks.zip`).
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `two-row-bookmarks` folder.
4. Open a new tab. If Chrome asks "Change back to Google?", click **Keep it**.

## Use

- **Split mode (default):** your Bookmarks bar fills row 1, then row 2. Anything left over sits behind the `»` button.
- **Folder mode:** pick one folder for each row in settings.
- Click a folder to open it. Click a subfolder inside the menu to go deeper, and use `‹` to go back.
- Labels: full names, short names, or icons only.
- **Every website:** turn it on in settings. Chrome asks for site access. The extension reads nothing from the sites you visit. It only draws the bar and pushes the page down to make room.
- `Alt+Shift+2` hides or shows the rows on the current site. Change it at `chrome://extensions/shortcuts`.
- Add sites to "Never show on these sites" for web apps that fight with the bar.
- Hide Chrome's own bar with `Ctrl+Shift+B` (`Cmd+Shift+B` on Mac).
- Settings: click the extension's toolbar icon, or "Bookmark row settings" on the New Tab page.

## Known limits

- Some sites pin their own header to the top of the window. On those, the rows cover that header. Hide the rows there with the shortcut, or add the site to the never-show list.
- Chrome blocks extensions on `chrome://` pages and the Chrome Web Store, so the rows don't show there.
- Bookmarklets (`javascript:` bookmarks) only run from the rows on a website, not on the New Tab page.

## Files

| File | Job |
| --- | --- |
| `manifest.json` | Extension setup and permissions |
| `bar.js` | Draws the two rows and the folder menus |
| `data.js` | Reads bookmarks and settings |
| `newtab.html`, `newtab.js` | New Tab page |
| `content.js` | The bar on websites |
| `background.js` | Turns the website bar on and off, keeps it in sync with bookmark edits |
| `options.html`, `options.js` | Settings page |
