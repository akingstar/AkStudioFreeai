import JSZip from "jszip";

(() => {
  const prompts = [
    "आज मैं अपनी आवाज़ में एक नया गीत गाने जा रहा हूँ।",
    "तेरी यादों में दिल आज भी खोया रहता है।",
    "चाँदनी रात में सपनों का एक नया संसार है।",
    "दिल की हर धड़कन में एक कहानी छुपी है।",
    "मैं धीरे-धीरे सुरों को ऊँचा और फिर नीचे ले जा रहा हूँ।",
    "आज की सुबह उम्मीदों से भरी हुई है।",
    "मेरी आवाज़ में खुशी, दर्द और प्यार के अलग-अलग रंग हैं।",
    "The sound of my voice is clear, natural and expressive.",
    "I can sing softly, loudly, and with different emotions.",
    "Every little moment becomes a beautiful melody.",
    "I am recording my natural singing voice for my own AI voice project.",
    "I will sing this line again with a different pitch and expression."
  ];

  const DB_NAME = "akstudio_voice_dataset";
  const STORE = "recordings";

  let db;
  let recorder;
  let chunks = [];
  let stream;
  let startedAt = 0;
  let recordingPrompt = "";
  let previewUrls = [];

  const openDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const getAll = () => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly")
      .objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  const save = (sample) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite")
      .objectStore(STORE).put(sample);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  const remove = (id) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite")
      .objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  function createInterface() {
    if (document.getElementById("ak-voice-builder")) return;

    const style = document.createElement("style");
    style.textContent = `
      #ak-voice-launch {
        position:fixed;left:18px;bottom:18px;z-index:99990;
        border:1px solid #888;border-radius:30px;padding:12px 17px;
        background:#fff;color:#000;font-weight:700;cursor:pointer;
        box-shadow:0 5px 20px #0005;
      }
      #ak-voice-builder {
        display:none;position:fixed;inset:3%;z-index:99999;
        overflow:auto;background:#101010;color:#fff;
        border:1px solid #555;border-radius:18px;padding:20px;
        box-shadow:0 15px 60px #000b;
        font:14px/1.5 system-ui,sans-serif;
      }
      #ak-voice-builder.open {display:block}
      #ak-voice-builder h2 {margin:0 0 8px;font-size:23px}
      #ak-voice-builder p {color:#bbb}
      #ak-voice-builder select {
        width:100%;padding:13px;border-radius:9px;
        background:#222;color:#fff;border:1px solid #555;
      }
      #ak-voice-builder button {
        padding:11px 15px;border-radius:9px;border:1px solid #777;
        cursor:pointer;font-weight:700;margin:5px 5px 5px 0;
      }
      #ak-vb-record {background:#fff;color:#000}
      #ak-vb-stop {background:#a22;color:#fff}
      #ak-vb-export {background:#ddd;color:#000}
      #ak-vb-close {float:right;background:#222;color:#fff}
      #ak-vb-consent {display:flex;gap:10px;align-items:flex-start;margin:15px 0}
      #ak-vb-consent input {width:20px;height:20px;flex-shrink:0}
      #ak-vb-samples {margin-top:18px}
      .ak-vb-sample {
        padding:12px;margin:9px 0;border:1px solid #444;
        border-radius:10px;overflow-wrap:anywhere;
      }
      .ak-vb-sample audio {width:100%;margin-top:8px}
      .ak-vb-delete {background:#222;color:#fff}
      #ak-vb-status {color:#ddd;white-space:pre-wrap}
      @media(max-width:600px) {
        #ak-voice-builder {inset:2%;padding:14px}
      }
    `;
    document.head.appendChild(style);

    const launch = document.createElement("button");
    launch.id = "ak-voice-launch";
    launch.textContent = "🎙 Voice Dataset";
    document.body.appendChild(launch);

    const panel = document.createElement("section");
    panel.id = "ak-voice-builder";
    panel.innerHTML = `
      <button id="ak-vb-close">Close ×</button>
      <h2>🎙 My AI Voice Dataset</h2>
      <p>Record your own singing voice. Read or sing each prompt naturally, preferably 2–3 times with different expressions.</p>
      <p><b>Dataset target:</b> Start with 10–30 minutes of clean recordings. More consistent, varied samples can help later training.</p>
      <label for="ak-vb-prompt">Choose a recording prompt</label>
      <select id="ak-vb-prompt"></select>

      <div id="ak-vb-consent">
        <input type="checkbox" id="ak-vb-permission">
        <label for="ak-vb-permission">I confirm this is my own voice, or I have explicit permission from the speaker to record and use this voice for AI training.</label>
      </div>

      <button id="ak-vb-record">● Start Recording</button>
      <button id="ak-vb-stop" disabled>■ Stop & Save</button>
      <button id="ak-vb-export">Export Dataset ZIP</button>

      <p id="ak-vb-status">Ready. Allow microphone access when asked.</p>
      <div id="ak-vb-samples"></div>
    `;
    document.body.appendChild(panel);

    const select = panel.querySelector("#ak-vb-prompt");
    prompts.forEach((prompt, i) => {
      const option = document.createElement("option");
      option.value = prompt;
      option.textContent = `Prompt ${i + 1}: ${prompt}`;
      select.appendChild(option);
    });

    launch.addEventListener("click", () => {
      panel.classList.add("open");
      renderSamples();
    });
    panel.querySelector("#ak-vb-close").addEventListener("click", () => {
      panel.classList.remove("open");
    });
    panel.querySelector("#ak-vb-record").addEventListener("click", startRecording);
    panel.querySelector("#ak-vb-stop").addEventListener("click", stopRecording);
    panel.querySelector("#ak-vb-export").addEventListener("click", exportDataset);
  }

  async function startRecording() {
    const status = document.getElementById("ak-vb-status");
    const consent = document.getElementById("ak-vb-permission");

    if (!consent.checked) {
      status.textContent = "Please confirm recording permission first.";
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      status.textContent = "This browser does not support audio recording. Try updated Chrome over HTTPS.";
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";

      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      chunks = [];
      recordingPrompt = document.getElementById("ak-vb-prompt").value;

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm"
          });
          const durationMs = Date.now() - startedAt;

          if (blob.size < 1000 || durationMs < 1000) {
            status.textContent = "Recording too short. Please record again.";
            return;
          }

          await save({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            prompt: recordingPrompt,
            blob,
            mimeType: blob.type,
            durationMs,
            createdAt: new Date().toISOString()
          });

          status.textContent = "Recording saved successfully on this device.";
          await renderSamples();
        } catch (error) {
          status.textContent = "Could not save recording: " + error.message;
        } finally {
          stream?.getTracks().forEach(track => track.stop());
          stream = null;
          document.getElementById("ak-vb-record").disabled = false;
          document.getElementById("ak-vb-stop").disabled = true;
        }
      };

      recorder.start();
      startedAt = Date.now();
      document.getElementById("ak-vb-record").disabled = true;
      document.getElementById("ak-vb-stop").disabled = false;
      status.textContent = "🔴 Recording... Sing your selected prompt, then press Stop & Save.";
    } catch (error) {
      status.textContent = "Microphone error: " + error.message;
      stream?.getTracks().forEach(track => track.stop());
    }
  }

  function stopRecording() {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function renderSamples() {
    const container = document.getElementById("ak-vb-samples");
    if (!container) return;

    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = [];

    const samples = await getAll();
    container.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = `Saved recordings: ${samples.length}`;
    container.appendChild(heading);

    if (!samples.length) {
      const empty = document.createElement("p");
      empty.textContent = "No recordings yet. Start recording your first sample.";
      container.appendChild(empty);
      return;
    }

    samples.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    samples.forEach(sample => {
      const item = document.createElement("div");
      item.className = "ak-vb-sample";

      const title = document.createElement("strong");
      title.textContent = sample.prompt;
      item.appendChild(title);

      const info = document.createElement("p");
      info.textContent = `${(sample.durationMs / 1000).toFixed(1)} seconds · ${new Date(sample.createdAt).toLocaleString()}`;
      item.appendChild(info);

      const audio = document.createElement("audio");
      audio.controls = true;
      const url = URL.createObjectURL(sample.blob);
      previewUrls.push(url);
      audio.src = url;
      item.appendChild(audio);

      const del = document.createElement("button");
      del.className = "ak-vb-delete";
      del.textContent = "Delete recording";
      del.addEventListener("click", async () => {
        if (confirm("Delete this recording?")) {
          await remove(sample.id);
          await renderSamples();
        }
      });
      item.appendChild(del);
      container.appendChild(item);
    });
  }

  async function exportDataset() {
    const status = document.getElementById("ak-vb-status");
    try {
      const samples = await getAll();
      if (!samples.length) {
        status.textContent = "Record at least one sample before exporting.";
        return;
      }

      const zip = new JSZip();
      const audioFolder = zip.folder("audio");
      const metadata = [];

      samples.forEach((sample, index) => {
        const extension = sample.mimeType.includes("mp4") ? "m4a" : "webm";
        const filename = `sample-${String(index + 1).padStart(3, "0")}.${extension}`;
        audioFolder.file(filename, sample.blob);
        metadata.push({
          filename,
          prompt: sample.prompt,
          mime_type: sample.mimeType,
          duration_seconds: Number((sample.durationMs / 1000).toFixed(2)),
          recorded_at: sample.createdAt
        });
      });

      zip.file("metadata.json", JSON.stringify({
        project: "AkStudioFreeai",
        dataset_type: "personal_voice_recordings",
        exported_at: new Date().toISOString(),
        note: "Raw browser recordings. Convert to WAV and review audio quality before model training.",
        samples: metadata
      }, null, 2));

      status.textContent = "Preparing ZIP...";
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AkStudioFreeai-Voice-Dataset-${Date.now()}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = `Dataset exported: ${samples.length} recordings.`;
    } catch (error) {
      status.textContent = "Export failed: " + error.message;
    }
  }

  async function init() {
    try {
      db = await openDB();
      createInterface();
    } catch (error) {
      console.error("Voice dataset initialization failed:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
