(() => {
  const notebookURL =
    "https://colab.research.google.com/github/akingstar/AkStudioFreeai/blob/main/notebooks/AkStudioFreeai_RVC_Training.ipynb";

  function init() {
    if (document.getElementById("ak-voice-model-launch")) return;

    const style = document.createElement("style");
    style.textContent = `
      #ak-voice-model-launch {
        position:fixed;left:18px;bottom:76px;z-index:99990;
        border:1px solid #777;border-radius:30px;padding:12px 17px;
        background:#111;color:#fff;font-weight:700;cursor:pointer;
        box-shadow:0 5px 20px #0005;
      }
      #ak-voice-model-panel {
        display:none;position:fixed;z-index:99999;
        left:18px;bottom:132px;width:min(350px,calc(100vw - 36px));
        padding:17px;border:1px solid #666;border-radius:16px;
        background:#101010;color:#fff;box-shadow:0 10px 35px #0009;
        font:14px/1.5 system-ui,sans-serif;
      }
      #ak-voice-model-panel.open {display:block}
      #ak-voice-model-panel p {color:#ccc}
      #ak-voice-model-panel a {
        display:block;padding:12px;border-radius:9px;
        background:#fff;color:#000;text-align:center;
        text-decoration:none;font-weight:700;
      }
      #ak-voice-model-panel button {
        float:right;background:#222;color:#fff;
        border:1px solid #555;border-radius:8px;padding:5px 9px;
      }
    `;
    document.head.appendChild(style);

    const launch = document.createElement("button");
    launch.id = "ak-voice-model-launch";
    launch.textContent = "🎚 Train My AI Voice";
    document.body.appendChild(launch);

    const panel = document.createElement("section");
    panel.id = "ak-voice-model-panel";
    panel.innerHTML = `
      <button id="ak-voice-model-close">Close ×</button>
      <strong>Personal AI Voice Training</strong>
      <p>Use your own voice dataset ZIP and try RVC training on a free Google Colab GPU, if available.</p>
      <p>Free GPU access is limited. Save your model before the session ends.</p>
      <a href="${notebookURL}" target="_blank" rel="noopener noreferrer">
        Open Free RVC Training Notebook ↗
      </a>
    `;
    document.body.appendChild(panel);

    launch.addEventListener("click", () => panel.classList.add("open"));
    panel.querySelector("#ak-voice-model-close").addEventListener("click", () => {
      panel.classList.remove("open");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
