// GitHub Actions build ke waqt VITE_VOICE_SPACE inject hota hai (deploy.yml),
// taaki "GitHub se direct" setup me Space id manually daalne ki zaroorat na pade.
const ENV_SPACE = (() => {
  try { return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_VOICE_SPACE) || '' }
  catch { return '' }
})()

export const VOICE_SPACE_DEFAULT = ENV_SPACE || 'Ashklyrics/AkStudioFreeai-voice'
