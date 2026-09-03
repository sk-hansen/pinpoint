let tab, key;

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  key = "ef:" + new URL(tab.url).origin;
  refresh();
}

async function getList() {
  const store = await chrome.storage.local.get(key);
  return store[key] || [];
}

async function setList(list) {
  if (list.length) await chrome.storage.local.set({ [key]: list });
  else await chrome.storage.local.remove(key);
  refresh();
}

async function refresh() {
  const list = await getList();
  document.getElementById("count").textContent = list.length;
  document.getElementById("empty").hidden = list.length > 0;
  const container = document.getElementById("list");
  container.replaceChildren(
    ...list.map((a, i) => {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <span class="n">${i + 1}</span>
        <div class="body">
          <div class="sel"></div>
          <div class="comment"></div>
        </div>
        <button class="del" title="Remove">\u00d7</button>`;
      item.querySelector(".sel").textContent = a.selector;
      const c = item.querySelector(".comment");
      if (a.comment) c.textContent = a.comment;
      else c.remove();
      item.querySelector(".del").onclick = async () => {
        const cur = await getList();
        setList(cur.filter((x) => x.id !== a.id));
      };
      return item;
    })
  );
}

function status(msg, ok) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = ok ? "ok" : "";
}

function startPicker(mode) {
  chrome.tabs.sendMessage(tab.id, { action: "start-picker", mode }, () => {
    if (chrome.runtime.lastError) {
      status("Reload the page first, then try again");
      return;
    }
    window.close();
  });
}

document.getElementById("grab").onclick = () => startPicker("grab");
document.getElementById("annotate").onclick = () => startPicker("annotate");

document.getElementById("copy").onclick = async () => {
  const list = await getList();
  if (!list.length) return status("Nothing to copy");
  await navigator.clipboard.writeText(efFormatAll(list));
  status(`Copied ${list.length} annotation${list.length === 1 ? "" : "s"} \u2713`, true);
};

document.getElementById("clear").onclick = () => setList([]);

init();
