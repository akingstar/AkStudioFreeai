(() => {
  const speakingURL =
    "https://colab.research.google.com/github/akingstar/AkStudioFreeai/blob/main/notebooks/AkStudioFreeai_Speaking_Voice_Clone.ipynb";

  const singingURL =
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
        max-height:70vh;overflow:auto;
        padding:17px;border:1px solid #666;border-radius:16px;
        background:#101010;color:#fff;box-shadow:0 10px 35px #0009;
        font:14px/1.5 system-ui,sans-serif;
      }
      #ak-voice-model-panel.open {display:block}
      #ak-voice-model-panel p {color:#ccc}
      #ak-voice-model-panel a {
        display:block;margin:10px 0;padding:12px;border-radius:9px;
        background:#fff;color:#000;text-align:center;
        text-decoration:none;font-weight:700;
      }
      #ak-voice-model-panel button {
        float:right;background:#222;color:#fff;
        border:1px solid #555;border-radius:8px;padding:5px 9px;
      }
      #ak-voice-model-panel .ak-vm-note {
        font-size:12px;color:#aaa;
      }
    `;
    document.head.appendChild(style);

    const launch = document.createElement("button");
    launch.id = "ak-voice-model-launch";
    launch.textContent = "🎙️ My AI Voice Studio";
    document.body.appendChild(launch);

    const panel = document.createElement("section");
    panel.id = "ak-voice-model-panel";
    panel.innerHTML = `
      <button id="ak-voice-model-close">Close ×</button>
      <h3>My Personal AI Voice Studio</h3>
      <p>Choose what you want to create with your own voice.</p>

      <strong>🎙️ Speaking Voice Clone</strong>
      <p>Convert written text into speech using your reference voice.</p>
      <a href="${speakingURL}" target="_blank" rel="noopener noreferrer">
        Open Speaking Voice Clone ↗
      </a>

      <strong>🎵 Singing Voice Clone</strong>
      <p>Train an RVC model using your singing recordings and convert song vocals.</p>
      <a href="${singingURL}" target="_blank" rel="noopener noreferrer">
        Open Singing Voice Training ↗
      </a>

      <p class="ak-vm-note">
        Both workflows use Google Colab. Free GPU access is limited and not guaranteed.
        Use only your own voice or a voice you have permission to use.
        Hindi speaking support is not guaranteed by the current MeloTTS workflow.
      </p>
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
