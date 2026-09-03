// Element Feedback content script: in-page picker for "grab" and "annotate" modes.
(() => {
  if (window.__efLoaded) return;
  window.__efLoaded = true;

  const Z = 2147483647;
  let mode = null; // "grab" | "annotate" | null
  let highlight = null;
  let label = null;
  let current = null;
  let childStack = []; // for ArrowUp/ArrowDown parent/child refinement
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

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
    highlight.style.cssText = `position:fixed;pointer-events:none;z-index:${Z};background:rgba(59,130,246,.14);outline:1.5px solid #3b82f6;outline-offset:-1px;border-radius:2px;transition:left .06s,top .06s,width .06s,height .06s;box-shadow:0 0 0 4px rgba(59,130,246,.08)`;
    label = document.createElement("div");
    label.style.cssText = `position:fixed;pointer-events:none;z-index:${Z};display:flex;gap:8px;align-items:baseline;background:#1c1f24;color:#e6e8eb;font:11px/1.7 ui-monospace,monospace;padding:2px 8px;border-radius:4px;max-width:70vw;overflow:hidden;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)`;
    document.documentElement.append(highlight, label);
  }

  function moveHighlight(el) {
    const r = el.getBoundingClientRect();
    highlight.style.left = r.x + "px";
    highlight.style.top = r.y + "px";
    highlight.style.width = r.width + "px";
    highlight.style.height = r.height + "px";
    label.innerHTML = "";
    const sel = document.createElement("span");
    sel.style.cssText = "color:#7cb1ff;overflow:hidden;text-overflow:ellipsis";
    sel.textContent = segment(el);
    const dim = document.createElement("span");
    dim.style.cssText = "color:#9aa1ab";
    dim.textContent = `${Math.round(r.width)}\u00d7${Math.round(r.height)}`;
    label.append(sel, dim);
    const labelTop = r.y >= 26 ? r.y - 24 : Math.min(window.innerHeight - 24, r.y + r.height + 4);
    label.style.left = Math.max(4, r.x) + "px";
    label.style.top = labelTop + "px";
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);opacity:0;z-index:${Z};background:#1c1f24;color:#e6e8eb;font:13px/1.4 system-ui,sans-serif;padding:9px 18px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.35);transition:opacity .15s,transform .15s`;
    document.documentElement.append(t);
    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateX(-50%)";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 200);
    }, 2200);
  }

  function commentBox(el, rect) {
    const c = dark
      ? { bg: "#1f2329", fg: "#e6e8eb", muted: "#9aa1ab", border: "#3a4048", field: "#171a1f" }
      : { bg: "#ffffff", fg: "#1a1d21", muted: "#6b7280", border: "#e5e7eb", field: "#f7f8fa" };
    const box = document.createElement("div");
    box.style.cssText = `position:fixed;z-index:${Z};background:${c.bg};color:${c.fg};border:1px solid ${c.border};border-radius:10px;padding:10px;box-shadow:0 10px 32px rgba(0,0,0,.3);width:300px;font:13px/1.45 system-ui,sans-serif`;
    const top = Math.min(Math.max(8, rect.y + rect.height + 8), window.innerHeight - 170);
    const leftPos = Math.min(Math.max(8, rect.x), window.innerWidth - 316);
    box.style.top = top + "px";
    box.style.left = leftPos + "px";
    box.innerHTML = `
      <div data-ef-sel style="font:11px ui-monospace,monospace;color:${c.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:8px"></div>
      <textarea placeholder="Feedback for this element\u2026" style="width:100%;height:70px;box-sizing:border-box;font:13px/1.45 system-ui,sans-serif;padding:8px;border:1px solid ${c.border};border-radius:6px;resize:vertical;background:${c.field};color:${c.fg};outline:none"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <span style="font-size:11px;color:${c.muted};margin-right:auto">Ctrl+Enter saves</span>
        <button data-ef="cancel" style="padding:5px 12px;border:1px solid ${c.border};border-radius:6px;background:transparent;cursor:pointer;color:${c.fg};font:600 12px system-ui">Cancel</button>
        <button data-ef="save" style="padding:5px 14px;border:0;border-radius:6px;background:#3b82f6;color:#fff;cursor:pointer;font:600 12px system-ui">Save</button>
      </div>`;
    box.querySelector("[data-ef-sel]").textContent = segment(el);
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
    childStack = [];
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
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      stopPicker();
      return;
    }
    if (!current) return;
    // Refine the selection: ArrowUp widens to the parent, ArrowDown steps back in.
    if (e.key === "ArrowUp") {
      const parent = current.parentElement;
      if (parent && parent !== document.documentElement && parent !== document.body) {
        childStack.push(current);
        current = parent;
        moveHighlight(current);
      }
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === "ArrowDown") {
      const child = childStack.pop();
      if (child) {
        current = child;
        moveHighlight(current);
      }
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    }
  }

  function startPicker(m) {
    stopPicker();
    mode = m;
    makeHighlight();
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    document.documentElement.style.cursor = "crosshair";
    toast(
      (m === "grab" ? "Click an element to copy its context" : "Click an element to annotate") +
        " \u00b7 \u2191\u2193 parent/child \u00b7 Esc cancels"
    );
  }

  function stopPicker() {
    mode = null;
    current = null;
    childStack = [];
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
