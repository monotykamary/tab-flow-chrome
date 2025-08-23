// Offscreen document script: handles clipboard writes

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'copy-to-clipboard') {
    const text: string = typeof msg.text === 'string' ? msg.text : ''
    ;(async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text)
          sendResponse({ ok: true })
          return
        }
      } catch {}
      try {
        // Fallback using a hidden textarea + execCommand
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        ta.remove()
        sendResponse({ ok })
      } catch {
        sendResponse({ ok: false })
      }
    })()
    return true
  }
})
