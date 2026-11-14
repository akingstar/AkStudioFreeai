(() => {
  function init() {
    const panel = document.querySelector('#otherPage .empty-state');
    if (!panel) return;

    const tools = {
      voices: {
        title: 'Personal AI Voice Studio',
        description: 'Record your own voice, prepare a dataset and open your voice-training workflows.',
        actions: [
          ['ak-voice-launch', '🎙 Record Voice Dataset'],
          ['ak-voice-model-launch', '🎵 Speaking & Singing Voice Training']
        ]
      },
      tools: {
        title: 'Professional Audio Workspace',
        description: 'Open browser-based tools for mixing, audio effects and basic stereo vocal processing.',
        actions: [
          ['ak-mixer-launch', '🎚 Song Mixer'],
          ['ak-effects-launch', '🎛 Audio Effects & Mastering'],
          ['ak-stem-launch', '🎤 Vocal & Center Processing'],
          ['ak-mastering-launch', '🎚 Mastering Studio 2.0']
        ]
      }
    };

    function showPage(page) {
      const config = tools[page];
      if (!config) return;

      panel.classList.add('ak-library-panel', 'ak-control-panel');
      panel.innerHTML = `
        <div class="ak-control-heading">
          <span class="ak-control-kicker">AKSTUDIOFREEAI WORKSPACE</span>
          <h2>${config.title}</h2>
          <p>${config.description}</p>
        </div>
        <div class="ak-control-actions">
          ${config.actions.map(([id, label]) =>
            `<button type="button" class="secondary ak-tool-open" data-target="${id}">${label} →</button>`
          ).join('')}
        </div>
        <p class="ak-control-note">
          These tools run in your browser. Voice model training requires an external
          supported training environment. Basic center processing is not AI source separation.
        </p>
      `;
    }

    document.querySelectorAll('.nav[data-page]').forEach(button => {
      button.addEventListener('click', () => showPage(button.dataset.page));
    });

    panel.addEventListener('click', event => {
      const button = event.target.closest('.ak-tool-open');
      if (!button) return;

      const target = document.getElementById(button.dataset.target);
      if (target) {
        target.click();
      } else {
        const name = button.dataset.target;
        const status = panel.querySelector('.ak-control-note');
        if (status) status.textContent =
          'Tool is still initializing. Refresh the page and try again.';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
