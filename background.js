// Relays keyboard commands to the active tab's content script.
chrome.commands.onCommand.addListener(async (command) => {
  const mode = command === "start-grab" ? "grab" : command === "start-annotate" ? "annotate" : null;
  if (!mode) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: "start-picker", mode }).catch(() => {});
});
