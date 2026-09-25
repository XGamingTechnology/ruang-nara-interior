(() => {
  const loader = document.getElementById('loading-state');
  const hint = document.getElementById('hint-text');
  if (!loader) return;

  let timer = null;

  const arm = () => {
    window.clearTimeout(timer);
    if (loader.hidden) return;
    timer = window.setTimeout(() => {
      loader.hidden = true;
      if (hint) hint.textContent = 'Viewer gagal selesai dimuat. Coba refresh; jika tetap terjadi, gunakan mode MAP atau upload GLB lagi.';
    }, 2500);
  };

  const observer = new MutationObserver(arm);
  observer.observe(loader, { attributes: true, attributeFilter: ['hidden'] });

  window.addEventListener('error', () => {
    if (!loader.hidden) {
      loader.hidden = true;
      if (hint) hint.textContent = 'Terjadi error saat membuka viewer. Refresh halaman lalu coba kembali.';
    }
  });

  window.addEventListener('unhandledrejection', () => {
    if (!loader.hidden) {
      loader.hidden = true;
      if (hint) hint.textContent = 'Resource 3D gagal dimuat. Refresh halaman lalu coba kembali.';
    }
  });

  arm();
})();
