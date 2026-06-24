const API_BASE = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", async () => {
  const loginView = document.getElementById("login-view");
  const mainView = document.getElementById("main-view");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const loginBtn = document.getElementById("login-btn");
  
  const sessionSelect = document.getElementById("session-select");
  const selectionText = document.getElementById("selection-text");
  const generateBtn = document.getElementById("generate-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const mainError = document.getElementById("main-error");
  const mainSuccess = document.getElementById("main-success");
  const creditsCount = document.getElementById("credits-count");

  // Check login state
  const { graspai_token } = await chrome.storage.local.get("graspai_token");
  
  if (graspai_token) {
    showMainView(graspai_token);
  } else {
    showLoginView();
  }

  // Handle Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");

      await chrome.storage.local.set({ graspai_token: data.access_token });
      showMainView(data.access_token);
    } catch (err) {
      loginError.textContent = err.message;
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Log In";
    }
  });

  // Handle Logout
  logoutBtn.addEventListener("click", () => {
    chrome.storage.local.remove("graspai_token");
    showLoginView();
  });

  // Handle Generate
  generateBtn.addEventListener("click", async () => {
    const text = selectionText.value.trim();
    const sessionId = sessionSelect.value;

    if (!text) return showError("Please select or paste some text.");
    if (!sessionId) return showError("Please select a study session.");

    mainError.textContent = "";
    mainSuccess.textContent = "";
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating... (takes 5-15s)";

    const { graspai_token } = await chrome.storage.local.get("graspai_token");

    try {
      const res = await fetch(`${API_BASE}/api/extension/generate-flashcards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${graspai_token}`
        },
        body: JSON.stringify({ text, session_id: sessionId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate flashcards");

      mainSuccess.textContent = `Success! Added ${data.count} flashcards to the session.`;
      selectionText.value = ""; // clear
      await chrome.storage.local.remove("graspai_selection");
      
      // Update credits locally (optimistic)
      let currentCredits = parseInt(creditsCount.textContent);
      if (!isNaN(currentCredits)) creditsCount.textContent = currentCredits - 1;

    } catch (err) {
      showError(err.message);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate & Add (1 Credit)";
    }
  });

  async function showMainView(token) {
    loginView.classList.add("hidden");
    mainView.classList.remove("hidden");
    
    // Fetch sessions
    try {
      const res = await fetch(`${API_BASE}/api/dashboard`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        chrome.storage.local.remove("graspai_token");
        return showLoginView();
      }
      
      const data = await res.json();
      creditsCount.textContent = data.user?.credits ?? 0;
      
      sessionSelect.innerHTML = "";
      if (!data.sessions || data.sessions.length === 0) {
        sessionSelect.innerHTML = `<option value="">No sessions found. Create one first.</option>`;
        generateBtn.disabled = true;
      } else {
        data.sessions.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s.session_id;
          opt.textContent = s.session_name;
          sessionSelect.appendChild(opt);
        });
      }
    } catch (err) {
      showError("Failed to load sessions. Is the backend running?");
    }

    // Populate selected text
    const { graspai_selection } = await chrome.storage.local.get("graspai_selection");
    if (graspai_selection) {
      selectionText.value = graspai_selection;
    } else {
      // Try to get selection from active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.getSelection().toString()
          }).then(results => {
            if (results && results[0] && results[0].result) {
              selectionText.value = results[0].result;
            }
          }).catch(() => {});
        }
      });
    }
  }

  function showLoginView() {
    loginView.classList.remove("hidden");
    mainView.classList.add("hidden");
  }

  function showError(msg) {
    mainError.textContent = msg;
    mainSuccess.textContent = "";
  }
});
