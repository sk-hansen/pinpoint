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

async function refresh() {
  const list = await getList();
  document.getElementById("count").textContent = `${list.length} annotation${list.length === 1 ? "" : "s"} for this site`;
}

function status(msg) {
  document.getElementById("status").textContent = msg;
}

function startPicker(mode) {
  chrome.tabs.sendMessage(tab.id, { action: "start-picker", mode }, () => {
    if (chrome.runtime.lastError) {
      status("Reload the page first");
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
  status("Copied " + list.length + " annotation(s)");
};

document.getElementById("clear").onclick = async () => {
  await chrome.storage.local.remove(key);
  refresh();
  status("Cleared");
};

init();
