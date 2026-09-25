(() => {
  const flow = document.querySelector('#flow');
  if (!flow) return;

  const section = document.createElement('section');
  section.className = 'section calc-section';
  section.id = 'calculator';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">02 · LIVE QUANTITY + RAB PROOF OF CONCEPT</p>
        <h2>Ubah desain.<br><em>Angka bergerak langsung.</em></h2>
      </div>
      <p>Simulasi ini belum membaca IFC. Kita masukkan parameter geometri seperti yang nantinya dibaca dari model, lalu formula menghitung quantity, BOQ, biaya, dan dampak revisi secara real time.</p>
    </div>

    <div class="calc-shell">
      <aside class="calc-controls">
        <div class="calc-control-head">
          <div><span>OBJECT</span><b>WALL-01</b></div>
          <button type="button" id="calc-reset">RESET</button>
        </div>

        <div class="calc-group">
          <p>GEOMETRY</p>
          <label>Panjang dinding <span><input id="wall-length" type="number" min="0" step="0.1" value="5"> m</span></label>
          <label>Tinggi dinding <span><input id="wall-height" type="number" min="0" step="0.1" value="3.2"> m</span></label>
          <label>Lebar opening <span><input id="opening-width" type="number" min="0" step="0.05" value="0.9"> m</span></label>
          <label>Tinggi opening <span><input id="opening-height" type="number" min="0" step="0.05" value="2.1"> m</span></label>
          <label>Jumlah opening <span><input id="opening-count" type="number" min="0" step="1" value="1"> unit</span></label>
        </div>

        <div class="calc-group">
          <p>RULES</p>
          <label>Sisi finishing
            <select id="finish-sides"><option value="1">1 sisi</option><option value="2" selected>2 sisi</option></select>
          </label>
          <label>Waste factor <span><input id="waste-factor" type="number" min="0" max="50" step="0.5" value="5"> %</span></label>
        </div>

        <div class="calc-group">
          <p>PRICE BOOK · Rp / m²</p>
          <label>Bata ringan <span>Rp <input id="price-wall" type="number" min="0" step="1000" value="165000"></span></label>
          <label>Plester <span>Rp <input id="price-plaster" type="number" min="0" step="1000" value="68000"></span></label>
          <label>Acian <span>Rp <input id="price-skim" type="number" min="0" step="1000" value="42000"></span></label>
          <label>Cat <span>Rp <input id="price-paint" type="number" min="0" step="1000" value="48000"></span></label>
        </div>
      </aside>

      <div class="calc-workspace">
        <div class="calc-wall-view">
          <div class="calc-grid-bg"></div>
          <div class="calc-wall" id="calc-wall">
            <span class="calc-opening" id="calc-opening"></span>
            <i>WALL-01 · AAC 100</i>
          </div>
          <span class="calc-dim calc-dim-x" id="dim-x">5.00 m</span>
          <span class="calc-dim calc-dim-y" id="dim-y">3.20 m</span>
        </div>

        <div class="calc-trace">
          <div><span>Gross wall</span><b id="gross-formula">5.00 × 3.20</b><strong id="gross-area">16.00 m²</strong></div>
          <div><span>Openings</span><b id="opening-formula">0.90 × 2.10 × 1</b><strong id="opening-area">− 1.89 m²</strong></div>
          <div class="calc-trace-total"><span>Net wall</span><b>geometry result</b><strong id="net-area">14.11 m²</strong></div>
        </div>
      </div>

      <aside class="calc-results">
        <p class="card-kicker">LIVE BOQ</p>
        <div class="calc-result-row"><span>Bata ringan</span><div><b id="qty-wall">14.82 m²</b><strong id="cost-wall">Rp 2.445.000</strong></div></div>
        <div class="calc-result-row"><span>Plester</span><div><b id="qty-plaster">29.63 m²</b><strong id="cost-plaster">Rp 2.015.000</strong></div></div>
        <div class="calc-result-row"><span>Acian</span><div><b id="qty-skim">29.63 m²</b><strong id="cost-skim">Rp 1.244.000</strong></div></div>
        <div class="calc-result-row"><span>Cat</span><div><b id="qty-paint">29.63 m²</b><strong id="cost-paint">Rp 1.422.000</strong></div></div>

        <div class="calc-total-card">
          <span>ESTIMATED WALL PACKAGE</span>
          <strong id="calc-total">Rp 7.126.000</strong>
          <small>Geometry + rules + current price book</small>
        </div>

        <div class="calc-revision-card">
          <div><span>BASELINE</span><b>5.00 m wall</b></div>
          <div><span>CURRENT</span><b id="revision-current">5.00 m wall</b></div>
          <div class="calc-delta"><span>COST IMPACT</span><strong id="revision-delta">Rp 0</strong></div>
        </div>
      </aside>
    </div>

    <div class="calc-note">
      <b>Proof of concept:</b> sekarang input masih manual. Saat IFC parser aktif, nilai panjang, tinggi, opening, material, room, dan object class akan datang dari model. Formula yang sama tetap digunakan sehingga hasil bisa diaudit.
    </div>`;

  flow.insertAdjacentElement('afterend', section);

  const ids = [
    'wall-length','wall-height','opening-width','opening-height','opening-count','finish-sides','waste-factor',
    'price-wall','price-plaster','price-skim','price-paint'
  ];
  const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

  const out = id => document.getElementById(id);
  const defaults = {
    'wall-length': 5,
    'wall-height': 3.2,
    'opening-width': 0.9,
    'opening-height': 2.1,
    'opening-count': 1,
    'finish-sides': 2,
    'waste-factor': 5,
    'price-wall': 165000,
    'price-plaster': 68000,
    'price-skim': 42000,
    'price-paint': 48000
  };

  const num = id => Math.max(0, Number(el[id].value) || 0);
  const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.round(value));
  const qty = value => `${value.toFixed(2)} m²`;

  function calculate(lengthOverride = null) {
    const length = lengthOverride ?? num('wall-length');
    const height = num('wall-height');
    const openingWidth = num('opening-width');
    const openingHeight = num('opening-height');
    const openingCount = Math.floor(num('opening-count'));
    const sides = Math.max(1, Math.min(2, Number(el['finish-sides'].value) || 1));
    const waste = num('waste-factor') / 100;

    const gross = length * height;
    const openings = Math.min(gross, openingWidth * openingHeight * openingCount);
    const net = Math.max(0, gross - openings);
    const wallQty = net * (1 + waste);
    const finishQty = net * sides * (1 + waste);

    const wallCost = wallQty * num('price-wall');
    const plasterCost = finishQty * num('price-plaster');
    const skimCost = finishQty * num('price-skim');
    const paintCost = finishQty * num('price-paint');
    const total = wallCost + plasterCost + skimCost + paintCost;

    return { length, height, openingWidth, openingHeight, openingCount, gross, openings, net, wallQty, finishQty, wallCost, plasterCost, skimCost, paintCost, total };
  }

  function render() {
    const r = calculate();
    const baseline = calculate(5);
    const delta = r.total - baseline.total;

    out('gross-formula').textContent = `${r.length.toFixed(2)} × ${r.height.toFixed(2)}`;
    out('gross-area').textContent = qty(r.gross);
    out('opening-formula').textContent = `${r.openingWidth.toFixed(2)} × ${r.openingHeight.toFixed(2)} × ${r.openingCount}`;
    out('opening-area').textContent = `− ${qty(r.openings)}`;
    out('net-area').textContent = qty(r.net);

    out('qty-wall').textContent = qty(r.wallQty);
    out('qty-plaster').textContent = qty(r.finishQty);
    out('qty-skim').textContent = qty(r.finishQty);
    out('qty-paint').textContent = qty(r.finishQty);
    out('cost-wall').textContent = rupiah(r.wallCost);
    out('cost-plaster').textContent = rupiah(r.plasterCost);
    out('cost-skim').textContent = rupiah(r.skimCost);
    out('cost-paint').textContent = rupiah(r.paintCost);
    out('calc-total').textContent = rupiah(r.total);

    out('revision-current').textContent = `${r.length.toFixed(2)} m wall`;
    out('revision-delta').textContent = `${delta > 0 ? '+' : delta < 0 ? '−' : ''} ${rupiah(Math.abs(delta))}`;
    out('revision-delta').dataset.direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';

    out('dim-x').textContent = `${r.length.toFixed(2)} m`;
    out('dim-y').textContent = `${r.height.toFixed(2)} m`;

    const wall = out('calc-wall');
    const opening = out('calc-opening');
    const wallW = Math.max(38, Math.min(84, 42 + r.length * 6));
    const wallH = Math.max(34, Math.min(72, 28 + r.height * 9));
    wall.style.width = `${wallW}%`;
    wall.style.height = `${wallH}%`;
    opening.style.width = `${Math.max(8, Math.min(42, (r.openingWidth / Math.max(r.length, 0.1)) * 100))}%`;
    opening.style.height = `${Math.max(10, Math.min(88, (r.openingHeight / Math.max(r.height, 0.1)) * 100))}%`;
    opening.style.display = r.openingCount > 0 && r.openings > 0 ? 'block' : 'none';
  }

  ids.forEach(id => {
    el[id].addEventListener('input', render);
    el[id].addEventListener('change', render);
  });

  document.getElementById('calc-reset').addEventListener('click', () => {
    Object.entries(defaults).forEach(([id, value]) => { el[id].value = value; });
    render();
  });

  const nav = document.querySelector('.topbar nav');
  if (nav) {
    const link = document.createElement('a');
    link.href = '#calculator';
    link.textContent = 'Live RAB';
    nav.appendChild(link);
  }

  render();
})();
