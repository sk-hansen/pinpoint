// Element Feedback content script: in-page picker for "grab" and "annotate" modes.
(() => {
  if (window.__efLoaded) return;
  window.__efLoaded = true;

  const Z = 2147483647;
  let mode = null; // "grab" | "annotate" | null
  let highlight = null;
  let label = null;
  let current = null;

  // ---------- selector builder (id -> test attrs -> classes -> nth-of-type) ----------
  function esc(v) {
    return CSS.escape(v);
  }

  function segment(el) {
    if (el.id) return `#${esc(el.id)}`;
    for (const attr of ["data-testid", "data-test", "aria-label", "name"]) {
      const v = el.getAttribute(attr);
      if (v) return `${el.localName}[${attr}="${v.replace(/"/g, '\\"')}"]`;
    }
    const classes = [...el.classList].slice(0, 3).map(esc);
    if (classes.length) return `${el.localName}.${classes.join(".")}`;
    return el.localName;
  }

  function buildSelector(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      let seg = segment(node);
      const parent = node.parentElement;
      if (parent) {
        const scope = parent;
        if (scope.querySelectorAll(`:scope > ${seg}`).length > 1) {
          const siblings = [...parent.children].filter((c) => c.localName === node.localName);
          seg += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(seg);
      // Stop early if the path so far is already unique on the page.
      const candidate = parts.join(" > ");
      try {
        if (document.querySelectorAll(candidate).length === 1) return candidate;
      } catch {
        /* invalid selector fragment, keep walking */
      }
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  // ---------- framework source detection (React / Svelte / Solid) ----------
  function detectSource(el) {
    let node = el;
    while (node) {
      // Svelte
      const meta = node.__svelte_meta;
      if (meta?.loc) return `${meta.loc.file}:${meta.loc.line}`;
      // Solid
      const loc = node.getAttribute?.("data-source-loc");
      if (loc) return loc;
      // React
      const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
      if (key) {
        let fiber = node[key];
        while (fiber) {
          const src = fiber._debugSource;
          if (src?.fileName) return `${src.fileName}:${src.lineNumber}`;
          fiber = fiber._debugOwner || fiber.return;
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  // ---------- context capture ----------
  function htmlSnippet(el) {
    let html = el.outerHTML.replace(/\s+/g, " ").trim();
    if (html.length > 500) html = html.slice(0, 500) + "\u2026";
    return html;
  }

  function capture(el, comment) {
    const r = el.getBoundingClientRect();
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      comment: comment || "",
      selector: buildSelector(el),
      html: htmlSnippet(el),
      url: location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      dpr: window.devicePixelRatio,
      position: { x: Math.round(r.x), y: Math.round(r.y) },
      size: { w: Math.round(r.width), h: Math.round(r.height) },
      source: detectSource(el),
    };
  }

  // ---------- clipboard ----------
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  // ---------- UI bits ----------
  function makeHighlight() {
    highlight = document.createElement("div");
    highlight.style.cssText = `position:fixed;pointer-events:none;z-index:${Z};background:rgba(64,132,255,.18);outline:2px solid #4084ff;border-radius:2px;transition:all .05s`;
    label = document.createElement("div");
    label.style.cssText = `position:fixed;pointer-events:none;z-index:${Z};background:#1a1a1a;color:#fff;font:12px/1.6 monospace;padding:1px 6px;border-radius:3px;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
    document.documentElement.append(highlight, label);
  }

  function moveHighlight(el) {
    const r = el.getBoundingClientRect();
    highlight.style.left = r.x + "px";
    highlight.style.top = r.y + "px";
    highlight.style.width = r.width + "px";
    highlight.style.height = r.height + "px";
    label.textContent = segment(el);
    label.style.left = r.x + "px";
    label.style.top = Math.max(0, r.y - 22) + "px";
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:${Z};background:#1a1a1a;color:#fff;font:13px system-ui;padding:8px 16px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.3)`;
    document.documentElement.append(t);
    setTimeout(() => t.remove(), 2000);
  }

  function commentBox(el, rect) {
    const box = document.createElement("div");
    box.style.cssText = `position:fixed;z-index:${Z};background:#fff;border:1px solid #ccc;border-radius:8px;padding:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);width:280px;font:13px system-ui;color:#111`;
    const top = Math.min(Math.max(8, rect.y + rect.height + 6), window.innerHeight - 140);
    const leftPos = Math.min(Math.max(8, rect.x), window.innerWidth - 296);
    box.style.top = top + "px";
    box.style.left = leftPos + "px";
    box.innerHTML = `
      <textarea placeholder="Feedback for this element\u2026 (Ctrl+Enter to save)" style="width:100%;height:64px;box-sizing:border-box;font:13px system-ui;padding:6px;border:1px solid #ddd;border-radius:4px;resize:vertical;background:#fff;color:#111"></textarea>
      <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:6px">
        <button data-ef="cancel" style="padding:4px 10px;border:1px solid #ccc;border-radius:4px;background:#f5f5f5;cursor:pointer;color:#111">Cancel</button>
        <button data-ef="save" style="padding:4px 10px;border:0;border-radius:4px;background:#4084ff;color:#fff;cursor:pointer">Save</button>
      </div>`;
    document.documentElement.append(box);
    const ta = box.querySelector("textarea");
    ta.focus();

    function close() {
      box.remove();
    }
    async function save() {
      const annotation = capture(el, ta.value.trim());
      const key = "ef:" + location.origin;
      const store = await chrome.storage.local.get(key);
      const list = store[key] || [];
      list.push(annotation);
      await chrome.storage.local.set({ [key]: list });
      close();
      toast(`Annotation ${list.length} saved`);
    }
    box.addEventListener("click", (e) => {
      const b = e.target.dataset?.ef;
      if (b === "save") save();
      if (b === "cancel") close();
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
      if (e.key === "Escape") close();
    });
  }

  // ---------- picker ----------
  function onMove(e) {
    highlight.style.display = "none";
    label.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    highlight.style.display = "";
    label.style.display = "";
    if (!el || el === document.documentElement || el === document.body) {
      current = null;
      return;
    }
    current = el;
    moveHighlight(el);
  }

  async function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = current;
    const pickedMode = mode;
    stopPicker();
    if (!el) return;
    if (pickedMode === "grab") {
      const a = capture(el);
      await copyText(efFormatAnnotation(a, 1).replace(/^## 1\. /, "## ") + "\n");
      toast("Element context copied");
    } else {
      commentBox(el, el.getBoundingClientRect());
    }
  }

  function onKey(e) {
    if (e.key === "Escape") stopPicker();
  }

  function startPicker(m) {
    stopPicker();
    mode = m;
    makeHighlight();
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    document.documentElement.style.cursor = "crosshair";
    toast(m === "grab" ? "Click an element to copy its context (Esc to cancel)" : "Click an element to annotate (Esc to cancel)");
  }

  function stopPicker() {
    mode = null;
    current = null;
    highlight?.remove();
    label?.remove();
    highlight = label = null;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    document.documentElement.style.cursor = "";
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "start-picker") {
      startPicker(msg.mode);
      sendResponse({ ok: true });
    }
  });
})();
