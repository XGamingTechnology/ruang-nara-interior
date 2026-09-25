(() => {
  const money = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.round(n));
  const q2 = n => Number(n || 0).toFixed(2);

  function wallCost(el, data, overrides = {}) {
    const g = { ...el.geometry, ...overrides };
    const gross = g.lengthM * g.heightM;
    const openings = (el.openings || []).reduce((s, o) => s + o.widthM * o.heightM * (o.count || 1), 0);
    const net = Math.max(0, gross - openings);
    const waste = 1 + data.rules.wallWastePct / 100;
    const wallQty = net * waste;
    const finishQty = net * data.rules.finishSides * waste;
    const p = data.priceBook;
    return {
      qty: net,
      cost: wallQty * p.wall_aac_100_m2 + finishQty * (p.plaster_m2 + p.skim_coat_m2 + p.paint_wall_m2),
      detail: `${q2(net)} m² net wall`
    };
  }

  function floorCost(el, data) {
    const qty = el.geometry.areaM2 * (1 + data.rules.floorWastePct / 100);
    return { qty, cost: qty * data.priceBook[el.priceKey], detail: `${q2(qty)} m² incl. waste` };
  }

  function ceilingCost(el, data) {
    const qty = el.geometry.areaM2 * (1 + data.rules.ceilingWastePct / 100);
    return { qty, cost: qty * data.priceBook[el.priceKey], detail: `${q2(qty)} m² incl. waste` };
  }

  function unitCost(el, data) {
    const qty = el.geometry.count || 1;
    return { qty, cost: qty * data.priceBook[el.priceKey], detail: `${qty} unit` };
  }

  function concreteCost(el, data) {
    const g = el.geometry;
    let volume = 0;
    if (g.widthM && g.depthM && g.heightM) volume = g.widthM * g.depthM * g.heightM * (g.count || 1);
    else if (g.areaM2 && g.thicknessM) volume = g.areaM2 * g.thicknessM * (g.count || 1);
    return { qty: volume, cost: volume * data.priceBook[el.priceKey], detail: `${q2(volume)} m³` };
  }

  function evaluate(el, data, override = {}) {
    if (el.type === 'wall') return wallCost(el, data, override);
    if (el.type === 'floor') return floorCost(el, data);
    if (el.type === 'ceiling') return ceilingCost(el, data);
    if (el.type === 'door' || el.type === 'window') return unitCost(el, data);
    if (el.type === 'concrete') return concreteCost(el, data);
    return { qty: 0, cost: 0, detail: '—' };
  }

  function categoryName(type) {
    return ({ wall:'Walls', floor:'Floors', ceiling:'Ceilings', door:'Doors', window:'Windows', concrete:'Concrete' })[type] || type;
  }

  async function loadDemo() {
    const host = document.getElementById('dummy-project-host');
    if (!host) return;
    host.innerHTML = '<div class="dummy-loading">Loading dummy project…</div>';

    try {
      const res = await fetch('./data/demo-project.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const rows = data.elements.map(el => ({ el, ...evaluate(el, data) }));
      const total = rows.reduce((s, r) => s + r.cost, 0);
      const grouped = {};
      rows.forEach(r => {
        grouped[r.el.type] = (grouped[r.el.type] || 0) + r.cost;
      });

      const baselineRows = data.elements.map(el => {
        const override = data.revisionBaseline?.overrides?.[el.id] || {};
        return evaluate(el, data, override);
      });
      const baseline = baselineRows.reduce((s, r) => s + r.cost, 0);
      const delta = total - baseline;

      const p = data.project;
      host.innerHTML = `
        <section class="dummy-project-card">
          <div class="dummy-top">
            <div>
              <p class="card-kicker">DUMMY IFC-LIKE PROJECT LOADED</p>
              <h3>${p.name}</h3>
              <span>${p.id} · ${p.location} · ${p.designRevision}</span>
            </div>
            <div class="dummy-total"><span>CALCULATED RAB</span><strong>${money(total)}</strong><small>${data.elements.length} model elements</small></div>
          </div>

          <div class="dummy-kpis">
            <div><span>MODEL AREA</span><b>${p.grossFloorAreaM2} m²</b></div>
            <div><span>ELEMENTS</span><b>${data.elements.length}</b></div>
            <div><span>BASELINE</span><b>${money(baseline)}</b></div>
            <div><span>REVISION IMPACT</span><b class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : '−'} ${money(Math.abs(delta))}</b></div>
          </div>

          <div class="dummy-grid">
            <div class="dummy-categories">
              <p class="card-kicker">COST BY CATEGORY</p>
              ${Object.entries(grouped).map(([type, cost]) => `<div><span>${categoryName(type)}</span><b>${money(cost)}</b></div>`).join('')}
            </div>
            <div class="dummy-source">
              <p class="card-kicker">DATA SOURCE</p>
              <code>demo-project.json</code>
              <p>Struktur data dibuat menyerupai output parser IFC: class, object type, room, material, geometry, openings, rules, dan price key.</p>
              <button id="sync-first-wall" type="button">Load WALL-01 into Live RAB</button>
            </div>
          </div>

          <div class="dummy-table-wrap">
            <div class="dummy-table-head"><span>ID</span><span>MODEL CLASS</span><span>OBJECT</span><span>QUANTITY</span><span>COST</span></div>
            ${rows.map(r => `<div class="dummy-row"><span>${r.el.id}</span><span>${r.el.ifcClass}</span><span><b>${r.el.name}</b><small>${r.el.room || ''}</small></span><span>${r.detail}</span><strong>${money(r.cost)}</strong></div>`).join('')}
          </div>
        </section>`;

      document.getElementById('sync-first-wall')?.addEventListener('click', () => {
        const wall = data.elements.find(e => e.id === 'WALL-01');
        if (!wall) return;
        const opening = wall.openings?.[0];
        const values = {
          'wall-length': wall.geometry.lengthM,
          'wall-height': wall.geometry.heightM,
          'opening-width': opening?.widthM || 0,
          'opening-height': opening?.heightM || 0,
          'opening-count': opening?.count || 0,
          'waste-factor': data.rules.wallWastePct,
          'finish-sides': data.rules.finishSides,
          'price-wall': data.priceBook.wall_aac_100_m2,
          'price-plaster': data.priceBook.plaster_m2,
          'price-skim': data.priceBook.skim_coat_m2,
          'price-paint': data.priceBook.paint_wall_m2
        };
        Object.entries(values).forEach(([id, value]) => {
          const input = document.getElementById(id);
          if (!input) return;
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
      });
    } catch (err) {
      host.innerHTML = `<div class="dummy-error">Dummy project gagal dimuat: ${err.message}</div>`;
    }
  }

  const calc = document.getElementById('calculator');
  if (!calc) return;
  const section = document.createElement('section');
  section.className = 'section dummy-section';
  section.id = 'dummy-project';
  section.innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">03 · DUMMY MODEL DATA</p><h2>Biarkan sistem<br><em>menghitung satu proyek.</em></h2></div>
      <p>Dataset ini mensimulasikan keluaran IFC parser. Tujuannya menguji alur model → quantity → rules → price book → RAB sebelum kita sambungkan file IFC asli.</p>
    </div>
    <div class="dummy-actionbar"><button id="load-dummy-project" type="button">↻ Load Dummy Project</button><span>Senopati Residence · 13 model elements · 5 quantity categories</span></div>
    <div id="dummy-project-host"></div>`;
  calc.insertAdjacentElement('afterend', section);
  document.getElementById('load-dummy-project').addEventListener('click', loadDemo);

  const nav = document.querySelector('.topbar nav');
  if (nav) {
    const a = document.createElement('a');
    a.href = '#dummy-project';
    a.textContent = 'Dummy Project';
    nav.appendChild(a);
  }

  loadDemo();
})();
