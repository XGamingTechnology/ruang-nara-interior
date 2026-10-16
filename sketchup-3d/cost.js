// Same quantity rules as rab/demo-project.js, so the 3D model and the RAB page agree.
export const money = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.round(n));
export const q2 = n => Number(n || 0).toFixed(2);

function wall(el, data, overrides = {}) {
  const g = { ...el.geometry, ...overrides };
  const gross = g.lengthM * g.heightM;
  const openings = (el.openings || []).reduce((s, o) => s + o.widthM * o.heightM * (o.count || 1), 0);
  const net = Math.max(0, gross - openings);
  const waste = 1 + data.rules.wallWastePct / 100;
  const p = data.priceBook;
  const finishRate = p.plaster_m2 + p.skim_coat_m2 + p.paint_wall_m2;
  return {
    qty: net,
    unit: 'm²',
    cost: net * waste * p.wall_aac_100_m2 + net * data.rules.finishSides * waste * finishRate,
    detail: `${q2(net)} m² net wall`,
    trace: [
      ['Gross', `${q2(g.lengthM)} × ${q2(g.heightM)}`, `${q2(gross)} m²`],
      ['Opening', (el.openings || []).map(o => `${q2(o.widthM)} × ${q2(o.heightM)}`).join(' + ') || '—', `− ${q2(openings)} m²`],
      ['Net', `waste ${data.rules.wallWastePct}% · ${data.rules.finishSides} sisi finishing`, `${q2(net)} m²`]
    ]
  };
}

function area(el, data, wastePct) {
  const qty = el.geometry.areaM2 * (1 + wastePct / 100);
  const rate = data.priceBook[el.priceKey];
  return {
    qty, unit: 'm²', cost: qty * rate, detail: `${q2(qty)} m² incl. waste`,
    trace: [
      ['Area model', `${q2(el.geometry.areaM2)} m²`, ''],
      ['Waste', `${wastePct}%`, `${q2(qty)} m²`],
      ['Harga', `${money(rate)} / m²`, money(qty * rate)]
    ]
  };
}

function unit(el, data) {
  const qty = el.geometry.count || 1;
  const rate = data.priceBook[el.priceKey];
  return {
    qty, unit: 'unit', cost: qty * rate, detail: `${qty} unit`,
    trace: [['Jumlah', `${qty} × ${money(rate)}`, money(qty * rate)]]
  };
}

function concrete(el, data) {
  const g = el.geometry;
  let volume = 0;
  let formula = '';
  if (g.widthM && g.depthM && g.heightM) {
    volume = g.widthM * g.depthM * g.heightM * (g.count || 1);
    formula = `${q2(g.widthM)} × ${q2(g.depthM)} × ${q2(g.heightM)} × ${g.count || 1}`;
  } else if (g.areaM2 && g.thicknessM) {
    volume = g.areaM2 * g.thicknessM * (g.count || 1);
    formula = `${q2(g.areaM2)} × ${q2(g.thicknessM)}`;
  }
  const rate = data.priceBook[el.priceKey];
  return {
    qty: volume, unit: 'm³', cost: volume * rate, detail: `${q2(volume)} m³`,
    trace: [['Volume', formula, `${q2(volume)} m³`], ['Harga', `${money(rate)} / m³`, money(volume * rate)]]
  };
}

export function evaluate(el, data, override = {}) {
  if (el.type === 'wall') return wall(el, data, override);
  if (el.type === 'floor') return area(el, data, data.rules.floorWastePct);
  if (el.type === 'ceiling') return area(el, data, data.rules.ceilingWastePct);
  if (el.type === 'door' || el.type === 'window') return unit(el, data);
  if (el.type === 'concrete') return concrete(el, data);
  return { qty: 0, unit: '', cost: 0, detail: '—', trace: [] };
}

export const TYPE_LABEL = { wall: 'Dinding', floor: 'Lantai', ceiling: 'Plafon', door: 'Pintu', window: 'Jendela', concrete: 'Struktur' };
