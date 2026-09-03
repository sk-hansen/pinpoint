# Element Feedback

Chrome extension: click elements on any page, add feedback, copy it all as
Markdown for an AI coding agent. Inspired by
[browser-annotations](https://github.com/wiebekaai/browser-annotations) and
Orca's "grab / annotate page element", but with an in-page picker.

## Modes

- **Grab element** — click an element, its full context (selector, HTML
  snippet, position, size, viewport, framework source file if detectable) is
  copied to the clipboard immediately.
- **Annotate element** — click an element, write a comment, repeat. Then
  **Copy all as Markdown** from the popup to get one `# Feedback` block with
  every annotation. Annotations persist per site until cleared.

Framework source detection works for React (`_debugSource`), Svelte
(`__svelte_meta`), and Solid (`data-source-loc`) dev builds.

## Install (unpacked)

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Reload any already-open tabs you want to use it on

Shortcuts: `Alt+Shift+G` grab, `Alt+Shift+A` annotate, `Esc` cancels the picker.

## Test

```
node test_format.js
```
