(() => {
  function init() {
    const panel = document.querySelector('#otherPage .empty-state');
    if (!panel) {
      if (!window.akStudioNavObserver) {
        const observer = new MutationObserver(() => {
          if (document.querySelector('#otherPage .empty-state')) {
            observer.disconnect();
            delete window.akStudioNavObserver;
            init();
          }
        });
        window.akStudioNavObserver = observer;
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }
      return;
    }
    if (panel.dataset.akProNavigation === '1') return;
    panel.dataset.akProNavigation = '1';

    const sections = {
      voices: {
        title: 'Voice Studio',
        description: 'Record, organize and prepare your voice for speaking and singing workflows.',
        groups: [
          { title: 'Voice Recording', items: [
            ['ak-voice-launch', '🎙 Record Voice Dataset', 'Record and manage voice samples']
          ]},
          { title: 'Voice Model Training', items: [
            ['ak-voice-model-launch', '🎵 Speaking & Singing Voice', 'Open voice training workflows']
          ]}
        ]
      },
      tools: {
        title: 'Professional Audio Workspace',
        description: 'Choose a dedicated workspace for each part of your music production.',
        groups: [
          { title: 'Audio Production', items: [
            ['ak-mixer-launch', '🎚 Song Mixer', 'Mix vocals and instrumental tracks'],
            ['ak-effects-launch', '🎛 Audio Effects', 'Equalizer, reverb and compression'],
            ['ak-stem-launch', '🎤 Vocal & Center Processing', 'Basic stereo center processing'],
            ['ak-ultimate-launch', '🎼 Ultimate Music Studio', 'Multitrack editing and mixing'],
            ['ak-mastering-launch', '✨ Mastering Studio', 'Master and export WAV audio']
          ]},
          { title: 'Songwriting & Languages', items: [
            ['ak-songwriting-launch', '✍️ Songwriting Studio', 'Write and organize song lyrics'],
            ['ak-multilingual-launch', '🌍 Multilingual Song Studio', 'Prepare multilingual song prompts']
          ]},
          { title: 'AI Engine Management', items: [
            ['ak-suno-hub', '🚀 AI Studio Hub', 'Check generation backend and API'],
            ['ak-engine-launch', '⚙️ AI Engine Manager', 'Inspect engine status and generation jobs']
          ]},
          { title: 'Account & Cloud', items: [
            ['ak-profile-launch', '👤 My Profile', 'Manage local profile and preferences'],
            ['ak-cloud-launch', '☁️ Cloud Login & Sync', 'Open account and cloud options']
          ]}
        ]
      }
    };

    function showPage(page) {
      const config = sections[page];
      if (!config) return;

      panel.classList.add('ak-library-panel', 'ak-control-panel', 'ak-pro-workspace');
      panel.innerHTML = `
        <div class="ak-control-heading">
          <span class="ak-control-kicker">AKSTUDIOFREEAI WORKSPACE</span>
          <h2>${config.title}</h2>
          <p>${config.description}</p>
        </div>
        ${config.groups.map(group => `
          <section class="ak-tool-group">
            <h3>${group.title}</h3>
            <div class="ak-pro-tool-grid">
              ${group.items.map(([id, label, description]) => `
                <button type="button" class="ak-pro-tool" data-target="${id}">
                  <span class="ak-pro-tool-title">${label}</span>
                  <span class="ak-pro-tool-description">${description}</span>
                  <span class="ak-pro-tool-arrow">Open workspace →</span>
                </button>
              `).join('')}
            </div>
          </section>
        `).join('')}
        <p class="ak-control-note">
          Tools open their existing functions. Voice model training requires a supported
          external training environment. Vocal & Center Processing is not AI source separation.
        </p>
      `;
    }

    window.akRenderStudioPage = showPage;

    panel.addEventListener('click', event => {
      const button = event.target.closest('.ak-pro-tool');
      if (!button) return;
      const target = document.getElementById(button.dataset.target);
      if (target) {
        target.click();
      } else {
        const status = panel.querySelector('.ak-control-note');
        if (status) status.textContent =
          'This tool is initializing. Refresh the page and try again.';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
