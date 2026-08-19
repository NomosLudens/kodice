export function initPwa({ onUpdateAvailable, beforeReload } = {}) {
  const docEl = document.documentElement;
  const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const syncStandaloneClass = () => docEl.classList.toggle('pwa-standalone', standalone());
  syncStandaloneClass();
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', syncStandaloneClass);
  let deferredPrompt = null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const updateInstallUi = () => window.dispatchEvent(new CustomEvent('codice:pwa-install-state', { detail: { canInstall: !!deferredPrompt || (isIOS && isSafari && !standalone()), isIOS, standalone: standalone() } }));
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredPrompt = event; updateInstallUi(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; updateInstallUi(); window.dispatchEvent(new CustomEvent('codice:pwa-installed')); });
  window.addEventListener('codice:pwa-install-request', async () => {
    if (deferredPrompt) { const prompt = deferredPrompt; deferredPrompt = null; await prompt.prompt(); await prompt.userChoice.catch(() => null); updateInstallUi(); }
    else if (isIOS) window.dispatchEvent(new CustomEvent('codice:pwa-ios-instructions'));
  });
  updateInstallUi();
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!import.meta.env.PROD) {
    if (isLocalhost && 'serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    if (isLocalhost && 'caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    return;
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (window.KODICE_DISABLE_SW_RELOAD) return;
    if (!refreshing) { refreshing = true; location.reload(); }
  });
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller && !sessionStorage.getItem('codice.updateShown')) {
          sessionStorage.setItem('codice.updateShown', '1');
          onUpdateAvailable?.(async () => { await beforeReload?.(); worker.postMessage({ type: 'SKIP_WAITING' }); });
        }
      });
    });
  }).catch(err => console.warn('[Kódice] Service worker indisponível.', err));
}
