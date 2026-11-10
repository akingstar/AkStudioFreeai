(() => {
  const SPACE_URL = "https://huggingface.co/spaces/ACE-Step/Ace-Step-v1.5";

  function addFreeEngine() {
    if (document.getElementById("ak-free-engine")) return;

    const style = document.createElement("style");
    style.textContent = `
      #ak-free-engine {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 99999;
        max-width: min(340px, calc(100vw - 36px));
        padding: 15px;
        border: 1px solid #777;
        border-radius: 16px;
        background: #101010;
        color: #fff;
        box-shadow: 0 8px 35px #0008;
        font: 14px/1.45 system-ui, sans-serif;
      }
      #ak-free-engine strong { display:block; margin-bottom:5px; }
      #ak-free-engine p { margin:0 0 12px; color:#ccc; }
      #ak-free-engine a {
        display:block;
        padding:11px 14px;
        border-radius:10px;
        background:#fff;
        color:#000;
        text-align:center;
        text-decoration:none;
        font-weight:700;
      }
      #ak-free-engine small {
        display:block;
        margin-top:9px;
        color:#aaa;
        font-size:11px;
      }
      #ak-free-engine-close {
        float:right;
        border:0;
        background:transparent;
        color:#aaa;
        font-size:19px;
        cursor:pointer;
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("section");
    panel.id = "ak-free-engine";
    panel.innerHTML = `
      <button id="ak-free-engine-close" aria-label="Close">×</button>
      <strong>Free AI Music Engine</strong>
      <p>Generate songs with the official ACE-Step demo. Open it and paste your lyrics or music prompt.</p>
      <a href="${SPACE_URL}" target="_blank" rel="noopener noreferrer">
        Open Free AI Music Generator ↗
      </a>
      <small>Free ZeroGPU access has daily limits and may have a waiting queue.</small>
    `;
    document.body.appendChild(panel);

    panel.querySelector("#ak-free-engine-close").addEventListener("click", () => {
      panel.remove();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addFreeEngine, { once: true });
  } else {
    addFreeEngine();
  }
})();
