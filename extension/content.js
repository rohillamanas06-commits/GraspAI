// content.js
(() => {
  // SVG Icon for GraspAI
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>`;

  let shadowContainer = null;
  let shadowRoot = null;
  let selectedText = "";

  document.addEventListener("mouseup", (e) => {
    // If we click inside our own shadow DOM, do nothing
    if (shadowContainer && e.composedPath().includes(shadowContainer)) {
      return;
    }

    // Wait a brief moment for the selection to finish updating
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length > 0) {
        selectedText = text;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Inject or update the hover button
        showHoverButton(rect.right + window.scrollX, rect.bottom + window.scrollY + 5);
      } else {
        removeHoverUI();
      }
    }, 10);
  });

  function removeHoverUI() {
    if (shadowContainer) {
      shadowContainer.remove();
      shadowContainer = null;
      shadowRoot = null;
    }
  }

  function showHoverButton(x, y) {
    if (!shadowContainer) {
      shadowContainer = document.createElement('div');
      shadowContainer.style.position = 'absolute';
      shadowContainer.style.zIndex = '2147483647'; // max z-index
      shadowContainer.style.left = `${x}px`;
      shadowContainer.style.top = `${y}px`;
      
      shadowRoot = shadowContainer.attachShadow({ mode: 'open' });
      document.body.appendChild(shadowContainer);
      
      renderButton();
    } else {
      shadowContainer.style.left = `${x}px`;
      shadowContainer.style.top = `${y}px`;
      renderButton(); // Make sure it's in the initial button state
    }
  }

  function renderButton() {
    shadowRoot.innerHTML = `
      <style>
        .graspai-hover-btn {
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6366f1;
          transition: transform 0.1s, box-shadow 0.1s;
        }
        .graspai-hover-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
      </style>
      <div class="graspai-hover-btn" title="Send to GraspAI">
        ${iconSvg}
      </div>
    `;

    const btn = shadowRoot.querySelector('.graspai-hover-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMiniPopup();
    });
  }

  async function openMiniPopup() {
    shadowRoot.innerHTML = `
      <style>
        .graspai-popup {
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          width: 250px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          font-family: system-ui, -apple-system, sans-serif;
          color: #0f172a;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14px;
          color: #4f46e5;
        }
        select {
          width: 100%;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          font-size: 13px;
          outline: none;
        }
        select:focus {
          border-color: #4f46e5;
        }
        button {
          width: 100%;
          padding: 8px 12px;
          border-radius: 6px;
          border: none;
          background-color: #4f46e5;
          color: white;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        button:hover {
          background-color: #4338ca;
        }
        button:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
        }
        .message {
          font-size: 12px;
          text-align: center;
        }
        .error { color: #ef4444; }
        .success { color: #10b981; }
      </style>
      <div class="graspai-popup">
        <div class="header">
          ${iconSvg}
          GraspAI Flashcards
        </div>
        <select id="session-select">
          <option value="">Loading sessions...</option>
        </select>
        <button id="generate-btn" disabled>Generate Flashcards</button>
        <div id="msg" class="message"></div>
      </div>
    `;

    const select = shadowRoot.getElementById('session-select');
    const btn = shadowRoot.getElementById('generate-btn');
    const msg = shadowRoot.getElementById('msg');

    try {
      const data = await chrome.storage.local.get("graspai_sessions");
      const sessions = data.graspai_sessions || [];
      
      select.innerHTML = "";
      if (sessions.length === 0) {
        select.innerHTML = '<option value="">No sessions found. Log in to extension.</option>';
      } else {
        sessions.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s.session_id;
          opt.textContent = s.session_name;
          select.appendChild(opt);
        });
        btn.disabled = false;
      }
    } catch (err) {
      select.innerHTML = '<option value="">Error loading sessions</option>';
    }

    btn.addEventListener('click', async () => {
      const sessionId = select.value;
      if (!sessionId) return;
      
      btn.disabled = true;
      btn.textContent = "Generating...";
      msg.textContent = "";

      chrome.runtime.sendMessage(
        { type: "generate_flashcards", text: selectedText, session_id: sessionId },
        (response) => {
          if (chrome.runtime.lastError) {
            msg.className = "message error";
            msg.textContent = "Error: Could not reach GraspAI. Please refresh page.";
            btn.textContent = "Generate Flashcards";
            btn.disabled = false;
            return;
          }

          if (response && response.success) {
            msg.className = "message success";
            msg.textContent = `Success! Added ${response.count} flashcards.`;
            btn.textContent = "Done";
            setTimeout(() => removeHoverUI(), 3000);
          } else {
            msg.className = "message error";
            msg.textContent = response?.error || "Unknown error occurred.";
            btn.textContent = "Generate Flashcards";
            btn.disabled = false;
          }
        }
      );
    });
  }
})();
