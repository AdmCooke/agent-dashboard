# Two Row Bookmarks

A Chrome extension that shows your bookmarks in one or two clean rows, with room for far more than Chrome's own bar.

Chrome does not let extensions change its built-in bookmarks bar, so this extension draws its own bar:

- On the New Tab page, always, with a search box that uses your default search engine.
- In a popup when you click the extension's toolbar button. It works on any page and adds nothing to the page.
- On websites, if you turn it on in settings. By default the rows stay hidden and slide down only when you rest the pointer at the very top edge of the page, so the site's own top bar stays where it is.

## Install

1. Download this `two-row-bookmarks` folder (or unzip `two-row-bookmarks.zip`).
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `two-row-bookmarks` folder.
4. Open a new tab. If Chrome asks "Change back to Google?", click **Keep it**.

## Use

- **Rows:** pick 1 or 2 rows in settings. Two is the default.
- **Bookmarks bar mode (default):** your Bookmarks bar fills the rows in order. Anything left over sits behind the `»` button.
- **Folder mode:** pick one folder for each row in settings.
- **Right-click** a bookmark to open it in a new tab, edit its name or address, or delete it. Right-click a folder to rename or delete it. Deleting a bookmark or an empty folder shows an Undo button. Deleting a folder with bookmarks inside asks first.
- Click a folder to open it. Click a subfolder inside the menu to go deeper, and use `‹` to go back.
- Drag and drop:
  - Open a folder and drag a link out of it onto the rows.
  - Drag bookmarks along the rows to reorder them. A blue line shows where they land.
  - Drop a bookmark onto a folder to file it there. Hold it over the folder for a moment and the folder opens, so you can drop it at an exact spot or into a subfolder.
  - Drag a link from any web page, or the address from the address bar, onto the rows to save it as a bookmark.
- Labels: full names, short names, or icons only.
- **Toolbar popup:** click the extension's icon to see your rows on any page. Links open in the current tab. Ctrl-click (Cmd-click on Mac) or middle-click opens a new tab. Pin the icon from the puzzle piece menu to keep it in view.
- **Websites:** turn it on in settings. Chrome asks for site access. The extension reads nothing from the sites you visit. Pick how it shows:
  - **Slide down from the top edge (default):** hidden until you rest the pointer at the very top of the page for a moment. The rows slide down over the page and tuck away when you move off. The page never moves. Drag a link to the top edge to open the rows and drop it in.
  - **Always visible:** sits above the site and pushes the page down.
- `Alt+Shift+2` shows or hides the rows on the current site. Change it at `chrome://extensions/shortcuts`.
- Add sites to "Never show on these sites" for web apps that fight with the bar.
- Hide Chrome's own bar with `Ctrl+Shift+B` (`Cmd+Shift+B` on Mac).
- Settings: click Settings in the toolbar popup, or "Bookmark row settings" on the New Tab page.

## Known limits

- In "Always visible" mode, sites that pin their own header to the top of the window get that header covered by the rows. The default slide-down mode avoids this.
- Slide-down mode needs the pointer on the page itself. On a site whose top edge is an embedded frame, use the shortcut or the toolbar popup.
- Chrome blocks extensions on `chrome://` pages and the Chrome Web Store, so the rows don't show there.
- Bookmarklets (`javascript:` bookmarks) only run from the rows on a website, not on the New Tab page.

## Files

| File | Job |
| --- | --- |
| `manifest.json` | Extension setup and permissions |
| `bar.js` | Draws the two rows and the folder menus |
| `data.js` | Reads bookmarks and settings |
| `newtab.html`, `newtab.js` | New Tab page |
| `popup.html`, `popup.js` | Toolbar popup |
| `ext-page.js` | Shared setup for the New Tab page and the popup |
| `content.js` | The rows on websites (slide-down or always visible) |
| `background.js` | Turns the website bar on and off, keeps it in sync with bookmark edits |
| `options.html`, `options.js` | Settings page |
