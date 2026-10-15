(function () {
  'use strict';
  const categories = { hunian: 'Hunian', hospitality: 'Hospitality', kantor: 'Kantor', konstruksi: 'Konstruksi' };
  const order = [10, 5, 4, 7, 1, 2, 3, 6, 8, 9, 11];
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function filterProjects(projects, category, query) {
    const q = normalize(query);
    return projects.filter(p => (category === 'semua' || p.category === category) && normalize([p.name, p.location, categories[p.category], p.mediaType].join(' ')).includes(q));
  }
  function nextPhotoIndex(current, direction, count) { return count > 0 ? ((current + direction) % count + count) % count : 0; }
  function createBrief(values) {
    const lines = ['BRIEF PROYEK — TAPPA DESIGN AND BUILD', '', 'Nama: ' + (values.name || '').trim(), 'Lokasi proyek: ' + (values.location || '').trim(), 'Jenis proyek: ' + (values.category || '').trim()];
    if ((values.budget || '').trim()) lines.push('Kisaran anggaran: ' + values.budget.trim());
    if ((values.timeline || '').trim()) lines.push('Target waktu: ' + values.timeline.trim());
    lines.push('', 'KEBUTUHAN DAN PRIORITAS', (values.needs || '').trim());
    return lines.join('\n');
  }
  function projectFromURL(projects, location) { return projects.find(p => p.slug === new URL(location).searchParams.get('proyek')) || null; }
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalize, escapeHTML, filterProjects, nextPhotoIndex, createBrief, projectFromURL };
  if (typeof document === 'undefined') return;
  const projects = (window.TAPPA_PROJECTS || []).slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const grid = document.getElementById('project-grid');
  const search = document.getElementById('project-search');
  const dialog = document.getElementById('project-dialog');
  let category = 'semua', activeProject = null, activePhoto = 0, returnFocus = null, brief = '';
  function renderProjects() {
    const shown = filterProjects(projects, category, search.value);
    grid.innerHTML = shown.map(p => {
      const cover = p.photos[p.cover];
      return '<article class="project-card"><button type="button" data-open-project="' + p.id + '" aria-label="Buka galeri ' + escapeHTML(p.name) + '"><div class="project-image"><img src="' + cover.src + '" alt="' + escapeHTML(p.name + ' — ' + cover.caption) + '" width="' + cover.width + '" height="' + cover.height + '" loading="lazy"><span class="project-arrow" aria-hidden="true">↗</span></div><div class="project-meta"><div class="project-kicker"><span>' + categories[p.category] + (p.location ? ' / ' + escapeHTML(p.location) : '') + '</span><span>' + p.photos.length + ' gambar</span></div><h3>' + escapeHTML(p.name) + '</h3><p>' + escapeHTML(p.mediaType) + '</p></div></button></article>';
    }).join('');
    document.getElementById('project-status').textContent = 'Menampilkan ' + shown.length + ' dari ' + projects.length + ' proyek';
    document.getElementById('empty-state').hidden = shown.length !== 0;
  }
  function updateURL() {
    const url = new URL(window.location.href);
    if (activeProject) { url.searchParams.set('proyek', activeProject.slug); url.searchParams.set('foto', String(activePhoto + 1)); }
    else { url.searchParams.delete('proyek'); url.searchParams.delete('foto'); }
    try { window.history.replaceState(null, '', url.pathname + url.search + url.hash); } catch { /* Gallery remains usable in local file previews. */ }
  }
  function renderPhoto() {
    if (!activeProject) return;
    const photo = activeProject.photos[activePhoto];
    const image = document.getElementById('gallery-photo');
    image.src = photo.src;
    image.alt = activeProject.name + ' — ' + photo.caption;
    image.width = photo.width;
    image.height = photo.height;
    document.getElementById('photo-caption').textContent = photo.id + '  ' + photo.caption;
    document.getElementById('photo-counter').textContent = 'Foto ' + (activePhoto + 1) + ' / ' + activeProject.photos.length;
    document.querySelectorAll('[data-photo-index]').forEach(button => { button.setAttribute('aria-current', String(Number(button.dataset.photoIndex) === activePhoto)); });
    const selected = document.querySelector('[data-photo-index="' + activePhoto + '"]');
    if (selected && typeof selected.scrollIntoView === 'function') selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    updateURL();
  }
  function openProject(id, start = 0) {
    const project = projects.find(p => p.id === Number(id));
    if (!project) return;
    returnFocus = document.activeElement;
    activeProject = project;
    activePhoto = Math.max(0, Math.min(project.photos.length - 1, Math.floor(Number(start) || 0)));
    document.getElementById('dialog-title').textContent = project.name;
    document.getElementById('dialog-type').textContent = categories[project.category] + ' / ' + project.mediaType;
    document.getElementById('dialog-description').textContent = project.description;
    document.getElementById('photo-thumbnails').innerHTML = project.photos.map((photo, index) => '<button type="button" data-photo-index="' + index + '" aria-label="Foto ' + (index + 1) + ': ' + escapeHTML(photo.caption) + '" aria-current="false"><img src="' + photo.src + '" alt="" width="' + photo.width + '" height="' + photo.height + '" loading="lazy"></button>').join('');
    if (!dialog.open) { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }
    document.body.style.overflow = 'hidden';
    renderPhoto();
    document.getElementById('close-dialog').focus();
  }
  function finishClose() { activeProject = null; document.body.style.overflow = ''; updateURL(); if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus(); }
  function closeProject() { if (typeof dialog.close === 'function') dialog.close(); else { dialog.removeAttribute('open'); finishClose(); } }
  document.addEventListener('click', event => {
    const projectButton = event.target.closest('[data-open-project]');
    if (projectButton) openProject(projectButton.dataset.openProject);
    const thumbnail = event.target.closest('[data-photo-index]');
    if (thumbnail && activeProject) { activePhoto = Number(thumbnail.dataset.photoIndex); renderPhoto(); }
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    renderProjects();
  }));
  search.addEventListener('input', renderProjects);
  document.getElementById('close-dialog').addEventListener('click', closeProject);
  dialog.addEventListener('close', finishClose);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeProject(); });
  document.getElementById('previous-photo').addEventListener('click', () => { if (activeProject) { activePhoto = nextPhotoIndex(activePhoto, -1, activeProject.photos.length); renderPhoto(); } });
  document.getElementById('next-photo').addEventListener('click', () => { if (activeProject) { activePhoto = nextPhotoIndex(activePhoto, 1, activeProject.photos.length); renderPhoto(); } });
  dialog.addEventListener('keydown', event => { if (!activeProject) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); activePhoto = nextPhotoIndex(activePhoto, event.key === 'ArrowRight' ? 1 : -1, activeProject.photos.length); renderPhoto(); } });
  const menu = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); nav.classList.toggle('menu-open', open); });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('menu-open'); }));
  document.getElementById('brief-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    brief = createBrief(values);
    document.getElementById('brief-text').textContent = brief;
    document.getElementById('brief-result').hidden = false;
    document.getElementById('brief-status').textContent = 'Brief siap disimpan atau dibagikan.';
    if (typeof navigator.share === 'function') document.getElementById('share-brief').hidden = false;
  });
  document.getElementById('download-brief').addEventListener('click', () => {
    if (!brief) return;
    const url = URL.createObjectURL(new Blob([brief], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Brief-Proyek-TAPPA.txt'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('copy-brief').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(brief); document.getElementById('brief-status').textContent = 'Brief berhasil disalin.'; }
    catch { document.getElementById('brief-status').textContent = 'Salin teks brief di atas atau gunakan tombol Unduh brief.'; }
  });
  document.getElementById('share-brief').addEventListener('click', async () => { try { await navigator.share({ title: 'Brief Proyek TAPPA', text: brief }); } catch (error) { if (error.name !== 'AbortError') document.getElementById('brief-status').textContent = 'Gunakan tombol Unduh brief atau Salin teks.'; } });
  const config = window.TAPPA_CONFIG || {};
  const official = document.getElementById('official-contact');
  if (/^[1-9]\d{7,14}$/.test(config.whatsapp || '')) { const a = document.createElement('a'); a.className = 'text-link'; a.href = 'https://wa.me/' + config.whatsapp; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Hubungi TAPPA via WhatsApp ↗'; official.appendChild(a); official.hidden = false; }
  renderProjects();
  const requested = projectFromURL(projects, window.location.href);
  if (requested) { const photo = Number(new URL(window.location.href).searchParams.get('foto') || 1); openProject(requested.id, Number.isFinite(photo) ? photo - 1 : 0); }
}());
