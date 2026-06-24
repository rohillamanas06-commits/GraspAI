// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-graspai",
    title: "Send to GraspAI Flashcards",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "send-to-graspai" && info.selectionText) {
    chrome.storage.local.set({ graspai_selection: info.selectionText }, () => {
      // Trying to open popup directly is not fully supported in MV3 via API without user action,
      // but we can notify the user or just rely on them clicking the extension icon.
      // We will inject a small notification toast into the page.
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const toast = document.createElement("div");
          toast.innerText = "Text saved! Open GraspAI extension to generate flashcards.";
          toast.style.position = "fixed";
          toast.style.bottom = "20px";
          toast.style.right = "20px";
          toast.style.backgroundColor = "#4f46e5";
          toast.style.color = "white";
          toast.style.padding = "12px 24px";
          toast.style.borderRadius = "8px";
          toast.style.zIndex = "999999";
          toast.style.fontFamily = "system-ui, sans-serif";
          toast.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
          document.body.appendChild(toast);
          setTimeout(() => {
            toast.remove();
          }, 3000);
        }
      }).catch(err => console.log("Failed to inject toast", err));
    });
  }
});
