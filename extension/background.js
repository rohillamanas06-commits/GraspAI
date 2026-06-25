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

// Listen for messages from content.js (hover UI)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "generate_flashcards") {
    (async () => {
      try {
        const { graspai_token } = await chrome.storage.local.get("graspai_token");
        if (!graspai_token) {
          throw new Error("You must log in to the GraspAI extension first.");
        }

        const API_BASE = "https://graspai.onrender.com";
        const res = await fetch(`${API_BASE}/api/extension/generate-flashcards`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${graspai_token}`
          },
          body: JSON.stringify({ text: request.text, session_id: request.session_id })
        });

        const responseText = await res.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (err) {
          throw new Error(`Backend returned non-JSON (${res.status})`);
        }

        if (!res.ok) throw new Error(data.detail || `Failed to generate flashcards (${res.status})`);

        sendResponse({ success: true, count: data.count });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep the message channel open for async response
  }
  
  if (request.type === "get_sessions") {
    (async () => {
      try {
        const data = await chrome.storage.local.get(["graspai_token", "graspai_sessions"]);
        if (!data.graspai_token) {
          sendResponse({ loggedIn: false });
        } else {
          sendResponse({ loggedIn: true, sessions: data.graspai_sessions || [] });
        }
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }
});
