import { idbAdapter } from '../data/adapters.js';
import { createStore } from '../data/store.js';
import { fmt, fromMinor, toMinor, convert, advise,goalPlan, projection } from '../core/index.js';

// ---------- helper kecil ----------
const $ = s => document.querySelector(s);
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const CATS = { makan: ['Makan', '🍚'], minum: ['Minum', '🧋'], transport: ['Transport', '🚌'],transfer: ['Transfer', '🔁'], lain: ['Lainnya', '🧾'], barang: ['Barang', '🛍️'], income: ['Pemasukan', '💰'] };

// ---------- store ----------
const store = await createStore(idbAdapter());
const W = () => store.wallets();
let tab = 'home';

// ---------- toast (pesan kecil + tombol Batalkan) ----------
function toast(msg, label, fn) {
    $('#tmsg').textContent = msg;
    const b = $('#tact');
    b.textContent = label || '';
    b.style.display = label ? '' : 'none';
    b.onclick = () => { fn?.(); $('#toast').classList.remove('on'); };
    $('#toast').classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $('#toast').classList.remove('on'), 5000);
}

// ---------- turunan data ----------
const cycTx = k => store.txs().filter(t => t.ts >= +k.cycle.st && t.ts < +k.cycle.en);
const spentOf = (k, id) => cycTx(k).filter(t => t.type === 'expense' && t.walletId === id).reduce((a, t) => a + t.amount, 0);
const money = t => t.type === 'income'
    ? '+' + fmt(t.amount, W()[t.walletId].currency)
    : fmt(t.orig ? t.orig.amount : t.amount, t.orig ? 'MYR' : W()[t.walletId].currency);

function row(t) {
    const c = CATS[t.category] || CATS.lain, d = new Date(t.ts), w = W()[t.walletId];
    const jam = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return `<div class="it"><div class="e">${c[1]}</div>
    <div class="t" data-ed="${t.id}" style="cursor:pointer"><b>${esc(t.note || c[0])}</b><span>${c[0]}${w.id !== 'makan' ? ' · ' + w.name : ''} · ${jam}</span></div>
    <div class="a">${money(t)}</div><button class="x" data-del="${t.id}" aria-label="Hapus">×</button></div>`;
}
function bindDel() {
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        const t = store.txs().find(x => x.id === b.dataset.del);
        // satu pembelian yang dipecah ke beberapa sumber dana dihapus (dan dibatalkan) bersama
        const ids = t.group ? store.txs().filter(x => x.group === t.group).map(x => x.id) : [t.id];
        for (const id of ids) await store.remove(id);
        toast(ids.length > 1 ? 'Pembelian dihapus (' + ids.length + ' catatan)' : 'Catatan dihapus', 'Batalkan',
            async () => { for (const id of ids) await store.undelete(id); });
    });
    document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => openSheet(store.txs().find(x => x.id === b.dataset.ed)));
}

// ---------- layar Home ----------
function home() {
    const k = store.stats('makan'), c = k.cycle;
    const r = k.allow > 0 ? Math.max(0, Math.min(1, k.remain / k.allow)) : 0;
    const neg = k.remain < 0;
    const st = neg ? 'var(--tight)' : r > .4 ? 'var(--good)' : r > .15 ? 'var(--warn)' : 'var(--tight)';
    const CIRC = 2 * Math.PI * 92;
    const v = fromMinor(Math.abs(k.remain), 'MYR'), whole = Math.floor(v);
    const cents = String(Math.round((v - whole) * 100)).padStart(2, '0');

    // proyeksi akhir siklus
    const pj = projection({ spent: k.spent, elapsed: c.idx + 1, total: c.total, budget: k.budget });
    let p;
    if (pj.state === 'kosong') p = 'Mulai catat pengeluaran untuk melihat proyeksi akhir siklus.';
    else if (pj.state === 'aman') p = 'Tempo sekarang aman. Perkiraan sisa ' + fmt(pj.surplus, 'MYR') + ' di akhir siklus.';
    else {
        const d = new Date(c.st); d.setDate(d.getDate() + pj.emptyDay);
        p = `Dengan tempo sekarang uang habis sekitar ${d.getDate()} ${MON[d.getMonth()]}. Agar cukup, rata-rata harian perlu di bawah ${fmt(pj.maxDaily, 'MYR')}, atau pindahkan pembelian ke gaji.`;
    }

    const dar = k.reserve - spentOf(k, 'darurat');
    const gj = store.balance('gaji');
    const f = k.budget ? Math.max(0, Math.min(1, k.left / k.budget)) : 0;
    const hariIni = store.txs().filter(t => t.ts >= +c.t0).sort((a, b) => b.ts - a.ts).slice(0, 4);

    $('#app').innerHTML = `
<header><h1>Jatah</h1><button class="ic" id="gear" aria-label="Pengaturan">⚙️</button></header>
<div class="hero">
  <div class="ring" style="--st:${st}" role="img" aria-label="Sisa jatah hari ini">
    <svg viewBox="0 0 200 200"><circle class="tr" cx="100" cy="100" r="92"/>
      <circle class="pg" cx="100" cy="100" r="92" style="stroke-dasharray:${CIRC};stroke-dashoffset:${CIRC * (1 - r)}"/></svg>
    <div class="in"><div class="lbl">${neg ? 'Lewat dari jatah' : 'Hari ini boleh habis'}</div>
      <div class="big"><span class="cur">RM</span>${neg ? '−' : ''}${whole}<small>.${cents}</small></div>
      <div class="lbl">dari budget harian ${fmt(k.allow, 'MYR')}</div></div>
  </div>
  <p class="note">${neg ? 'Budget hari ini terlewat. Tidak apa-apa, besok mulai lagi dari awal.' : k.today === 0 ? 'Belum ada catatan hari ini. Ketuk + saat kamu beli makan.' : 'Sudah terpakai ' + fmt(k.today, 'MYR') + ' hari ini.'} Reset dalam ${Math.max(1, Math.ceil((+c.t0 + 864e5 - Date.now()) / 36e5))} jam.</p>
</div>
<div class="panel">
  <div id="wallet" style="margin-bottom:12px">
    <div class="wr"><div><span>Sisa uang makan</span><small>dari ${fmt(k.budget, 'MYR')} siklus ini</small></div>
      <b>${k.left < 0 ? 'Lewat ' + fmt(-k.left, 'MYR') : fmt(k.left, 'MYR')}</b>
      <i class="mb"><i style="width:${f * 100}%;background:${f < .2 ? 'var(--tight)' : f < .4 ? 'var(--warn)' : 'var(--good)'}"></i></i></div>
    <div class="wr"><div><span>Gaji</span><small>${gj ? 'saldo dari catatan' : 'Catat pemasukan gaji lewat +'}</small></div><b>${fmt(gj, 'IDR')}</b></div>
    <div class="wr"><div><span>Dana darurat</span><small>cadangan ${W().makan.rule.reservePct || 0}% dari uang makan</small></div><b>${fmt(dar, 'MYR')}</b></div>
  </div>
  <p class="proj" style="--st:${st}">${p}</p>
  <div class="bar"><i style="width:${Math.min(100, k.budget ? k.spent / k.budget * 100 : 0)}%"></i></div>
  <div class="row2"><span>Terpakai ${fmt(k.spent, 'MYR')} dari ${fmt(k.budget, 'MYR')}</span><span>${c.left} hari lagi</span></div>
</div>
<button class="btn" id="buyBtn" style="width:100%;padding:14px;font-size:16px">🛒 Mau beli sesuatu?</button>
${goalsHTML()}
<h2>Catatan hari ini</h2>
<div class="list">${hariIni.length ? hariIni.map(row).join('') : '<div class="empty">Belum ada catatan.</div>'}</div>`;
    bindDel();
    document.querySelectorAll('[data-setor]').forEach(b => b.onclick = () => openSetor(b.dataset.setor));
    bindGoalDelete();
    const gn = $('#goalNew'); if (gn) gn.onclick = openGoal;
}

// ---------- sheet Catat (tambah, edit, catat mundur, favorit) ----------
const SRC = { makan: 'Uang makan', gaji: 'Gaji', darurat: 'Dana darurat' };
const num = (v, c) => { const x = parseFloat(v); return isNaN(x) ? 0 : toMinor(x, c); };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const tsFrom = (str, base) => { const [y, m, d] = str.split('-').map(Number); return +new Date(y, m - 1, d, base.getHours(), base.getMinutes()); };
const favs = () => store.settings().favs || [];
let S = {};

function openSheet(tx) {
    if (tx) {   // mode edit: isi form dari catatan yang diketuk
        const inc = tx.type === 'income', w = W()[tx.walletId];
        S = {
            edit: tx.id, mode: inc ? 'in' : 'out', cat: tx.category, src: tx.walletId, dest: tx.walletId, note: tx.note || '', date: ymd(new Date(tx.ts)), fav: false,
            amt: String(fromMinor(tx.orig ? tx.orig.amount : tx.amount, tx.orig ? 'MYR' : w.currency))
        };
    } else S = { mode: 'out', amt: '', cat: 'makan', src: 'makan', dest: 'gaji', note: '', date: ymd(new Date()), fav: false };
    sheetUI(); showSheet();
}
const showSheet = () => { $('#sheet').classList.add('on'); $('#bd').classList.add('on'); };
let sheetDrag = null;
const sheetElement = $('#sheet');
sheetElement.addEventListener('pointerdown', e => {
    if (!e.target.closest('.grab') || !sheetElement.classList.contains('on') || sheetElement.classList.contains('confirm')) return;
    sheetDrag = { id: e.pointerId, y: e.clientY };
    sheetElement.classList.add('dragging');
    sheetElement.setPointerCapture(e.pointerId);
});
sheetElement.addEventListener('pointermove', e => {
    if (!sheetDrag || e.pointerId !== sheetDrag.id) return;
    sheetElement.style.setProperty('--drag-y', `${Math.max(0, e.clientY - sheetDrag.y)}px`);
});
const endSheetDrag = (e, dismiss = false) => {
    if (!sheetDrag || e.pointerId !== sheetDrag.id) return;
    const distance = e.clientY - sheetDrag.y;
    sheetDrag = null;
    sheetElement.classList.remove('dragging');
    sheetElement.style.removeProperty('--drag-y');
    if (dismiss && distance >= 110) closeSheet();
};
sheetElement.addEventListener('pointerup', e => endSheetDrag(e, true));
sheetElement.addEventListener('pointercancel', e => endSheetDrag(e));
const closeSheet = () => { sheetDrag = null; sheetElement.classList.remove('on', 'confirm', 'dragging'); sheetElement.style.removeProperty('--drag-y'); sheetElement.removeAttribute('aria-labelledby'); $('#bd').classList.remove('on'); };
const chips = (obj, cur, key) => Object.entries(obj).map(([k, v]) =>
    `<button class="chip${k === cur ? ' on' : ''}" data-${key}="${k}">${Array.isArray(v) ? v[1] + ' ' + v[0] : v}</button>`).join('');

async function addExpense(m, cat, note, src, ts) {   // m = sen RM; sumber gaji otomatis dikonversi ke Rp
    const kurs = store.settings().kurs, base = { type: 'expense', category: cat, note, ts };
    if (src === 'gaji') return (await store.add({ ...base, walletId: 'gaji', amount: convert(m, 'MYR', 'IDR', kurs), fxRate: kurs, orig: { amount: m, currency: 'MYR' } })).id;
    return (await store.add({ ...base, walletId: src, amount: m })).id;
}

function sheetUI() {
    const ed = !!S.edit, out = S.mode === 'out';
    const cur = out ? 'MYR' : W()[S.dest].currency, v = parseFloat(S.amt) || 0, sym = cur === 'MYR' ? 'RM' : 'Rp';
    const cats = { makan: CATS.makan, minum: CATS.minum, transport: CATS.transport, lain: CATS.lain };
    $('#sheet').innerHTML = `<div class="grab"></div>
${ed ? '<h2 style="margin:0 0 8px;text-align:center">Ubah catatan</h2>'
            : `<div class="seg"><button class="chip${out ? ' on' : ''}" data-m="out">Pengeluaran</button><button class="chip${out ? '' : ' on'}" data-m="in">Pemasukan</button></div>`}
${!ed && out && favs().length ? `<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px">${favs().map((f, i) => `<button class="chip" data-f="${i}">★ ${esc(f.label)} · ${fmt(f.amt, 'MYR')}</button>`).join('')}</div>` : ''}
<div class="disp"><span>${sym}</span><b>${S.amt || '0'}</b></div>
${out ? `<div class="cats">${chips(cats, S.cat, 'c')}</div>${ed ? '' : `<div class="cats">${chips(SRC, S.src, 's')}</div>`}`
            : ed ? '' : `<p class="mute" style="text-align:center;margin:0 0 8px;font-size:14px">Masuk ke dompet mana?</p><div class="cats">${chips(SRC, S.dest, 'd')}</div>`}
<input class="note-in" id="nIn" placeholder="Catatan (opsional)" maxlength="40" value="${esc(S.note)}">
<label class="fv">Tanggal <input type="date" class="note-in" id="dIn" style="margin:0;width:auto" value="${S.date}" max="${ymd(new Date())}"></label>
${!ed && out ? `<label class="fv"><input type="checkbox" id="favCk" ${S.fav ? 'checked' : ''}> Simpan sebagai favorit</label>` : ''}
<div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(k => `<button data-k="${k}" aria-label="${k === '⌫' ? 'Hapus angka' : k}">${k}</button>`).join('')}</div>
<button class="save" id="save" ${v > 0 ? '' : 'disabled'}>${v > 0 ? (ed ? 'Simpan perubahan ' : 'Simpan ') + sym + ' ' + S.amt : 'Simpan'}</button>`;

    const on = (attr, fn) => $('#sheet').querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = () => fn(b.dataset[attr]));
    on('m', m => { S.mode = m; S.amt = ''; sheetUI(); });
    on('c', c => { S.cat = c; sheetUI(); });
    on('s', s => { S.src = s; sheetUI(); });
    on('d', d => { S.dest = d; S.amt = ''; sheetUI(); });
    on('f', async i => {   // favorit: catat langsung satu ketukan
        const f = favs()[+i]; closeSheet();
        const id = await addExpense(f.amt, f.cat, f.label, f.src || 'makan', Date.now());
        toast('Tersimpan ' + fmt(f.amt, 'MYR'), 'Batalkan', () => store.remove(id));
    });
    $('#nIn').oninput = e => { S.note = e.target.value; };
    $('#dIn').onchange = e => { if (e.target.value) S.date = e.target.value; };
    const fc = $('#favCk'); if (fc) fc.onchange = e => { S.fav = e.target.checked; };
    on('k', k => {
        const dg = cur === 'MYR' ? 2 : 0;
        if (k === '⌫') S.amt = S.amt.slice(0, -1);
        else if (k === '.') { if (dg && !S.amt.includes('.')) S.amt = (S.amt || '0') + '.'; }
        else { if (S.amt.includes('.') && S.amt.split('.')[1].length >= dg) return; if (S.amt.replace('.', '').length >= 10) return; S.amt = S.amt === '0' ? k : S.amt + k; }
        sheetUI();
    });
    $('#save').onclick = saveTx;
}

async function saveTx() {
    const v = parseFloat(S.amt) || 0; if (!(v > 0)) return;
    const note = S.note.trim();
    if (S.edit) {
        const t = store.txs().find(x => x.id === S.edit), patch = { note, ts: tsFrom(S.date, new Date(t.ts)), category: t.type === 'income' ? 'income' : S.cat };
        if (t.orig) { const m = num(S.amt, 'MYR'); patch.orig = { ...t.orig, amount: m }; patch.amount = convert(m, 'MYR', 'IDR', t.fxRate); }
        else patch.amount = num(S.amt, W()[t.walletId].currency);
        await store.edit(S.edit, patch); closeSheet(); toast('Perubahan disimpan'); return;
    }
    const ts = tsFrom(S.date, new Date());
    let id;
    if (S.mode === 'in') id = (await store.add({ type: 'income', walletId: S.dest, amount: num(S.amt, W()[S.dest].currency), category: 'income', note, ts })).id;
    else {
        const m = num(S.amt, 'MYR'); id = await addExpense(m, S.cat, note, S.src, ts);
        if (S.fav) await store.setSettings({ favs: [...favs(), { label: note || CATS[S.cat][0], amt: m, cat: S.cat, src: S.src }] });
    }
    closeSheet(); toast('Tersimpan', 'Batalkan', () => store.remove(id));
}

// ---------- Mau Beli ----------
let B = {};   // state sheet Mau Beli
function openBuy() { B = { bs: 'makan', mix: 50, name: '', price: '' }; buyUI(true); showSheet(); }

function buyCalc() {
    const k = store.stats('makan'), s = store.settings(), p = num(B.price, 'MYR');
    if (!(p > 0)) return { p, text: 'Masukkan harga untuk melihat dampaknya.' };
    const dar = k.reserve - spentOf(k, 'darurat');
    const a = advise({
        price: p, source: B.bs, mix: B.mix / 100, food: k, minFood: s.minFood,
        salaryIDR: s.salaryIDR, capIDR: s.capIDR, gajiSpentIDR: spentOf(k, 'gaji'),
        rate: s.kurs, reserveLeft: dar,
    });
    const L = [`Setara ${a.dayEq.toFixed(1)} hari jatah makan · ${fmt(a.rpEq, 'IDR')}`];
    if (a.pm > 0) {
        L.push(`Rata-rata per hari ke depan: ${fmt(a.avgBefore, 'MYR')} → ${fmt(a.avgAfter, 'MYR')}`);
        if (a.belowMin) L.push(`Di bawah batas aman makan (${fmt(s.minFood, 'MYR')}).`);
    }
    if (a.salaryMonths != null) L.push(`Dari gaji: ${fmt(convert(a.pg, 'MYR', 'IDR', s.kurs), 'IDR')} (sekitar ${a.salaryMonths.toFixed(2)} bulan gaji)`);
    if (a.capLeft != null) L.push(`Sisa batas belanja gaji: ${fmt(a.capLeft, 'IDR')}`);
    if (a.reserveAfter != null) L.push(`Sisa dana darurat: ${fmt(dar, 'MYR')} → ${fmt(a.reserveAfter, 'MYR')}`);
    const judul = ['Aman. Beli kalau memang perlu.', 'Pikir dulu. Dampaknya terasa, coba tunggu dulu.', 'Sebaiknya tunda atau ganti sumber dana.'][a.level];
    return { p, a, text: `<b>${judul}</b><br>${L.map(esc).join('<br>')}`, st: ['var(--good)', 'var(--warn)', 'var(--tight)'][a.level] };
}

function buyUI(full) {
    if (full) {
        // kerangka digambar sekali, supaya kolom yang sedang diketik tidak hilang fokus
        $('#sheet').innerHTML = `<div class="grab"></div>
<input class="note-in" id="bName" placeholder="Barang apa?" maxlength="40">
<input class="note-in" id="bPrice" type="number" inputmode="decimal" placeholder="Harga (RM)">
<div class="cats" id="bSrc"></div>
<label class="fv" id="bMixW" style="display:none">Porsi uang makan <input type="range" id="bMix" min="10" max="90" step="10" value="50"> <b id="bMixV">50%</b></label>
<p class="proj" id="bRes"></p>
<button class="save" id="bBuy" disabled>Beli dan catat</button>`;
        $('#bName').oninput = e => { B.name = e.target.value; };
        $('#bPrice').oninput = e => { B.price = e.target.value; buyUI(); };
        $('#bMix').oninput = e => { B.mix = +e.target.value; buyUI(); };
        $('#bBuy').onclick = buyNow;
    }
    const r = buyCalc();
    $('#bSrc').innerHTML = chips({ makan: 'Uang makan', gaji: 'Gaji', campur: 'Campur', darurat: 'Dana darurat' }, B.bs, 's');
    $('#bSrc').querySelectorAll('button').forEach(b => b.onclick = () => { B.bs = b.dataset.s; buyUI(); });
    $('#bMixW').style.display = B.bs === 'campur' ? 'flex' : 'none';
    $('#bMixV').textContent = B.mix + '%';
    $('#bRes').innerHTML = r.text;
    $('#bRes').style.setProperty('--st', r.st || 'var(--line)');
    $('#bBuy').disabled = !(r.p > 0);
}
async function buyNow() {
    const p = num(B.price, 'MYR'); if (!(p > 0)) return;
    const kurs = store.settings().kurs, note = B.name.trim(), ids = [];
    const base = { type: 'expense', category: 'barang', note, group: 'g' + Date.now() };
    const add = async f => ids.push((await store.add({ ...base, ...f })).id);

    // bagi pembayaran sesuai sumber dana
    const pm = B.bs === 'campur' ? Math.round(p * B.mix / 100) : B.bs === 'makan' ? p : 0;  // porsi uang makan
    const pg = B.bs === 'darurat' ? 0 : p - pm;                                              // porsi gaji
    if (pm) await add({ walletId: 'makan', amount: pm });
    if (pg) await add({ walletId: 'gaji', amount: convert(pg, 'MYR', 'IDR', kurs), fxRate: kurs, orig: { amount: pg, currency: 'MYR' } });
    if (B.bs === 'darurat') await add({ walletId: 'darurat', amount: p });

    closeSheet();
    toast('Tercatat ' + fmt(p, 'MYR'), 'Batalkan', () => ids.forEach(id => store.remove(id)));
}

// ---------- Tabungan & target ----------
function goalsHTML() {
  const s = store.settings(), gs = Object.values(W()).filter(w => w.kind === 'goal');
  return '<h2>Tabungan dan target</h2>' + gs.map(w => {
    const saved = store.balance(w.id), g = w.goal || {}, p = goalPlan({ target: g.target, saved, deadline: g.deadline, rate: s.kurs });
    const info = p.state === 'bebas' ? 'Tanpa target' : p.state === 'tercapai' ? 'Target tercapai 🎉'
      : p.state === 'lewat' ? 'Tenggat terlewat, kurang ' + fmt(p.need, 'IDR')
      : `Perlu ${fmt(p.perCycle, 'IDR')} per siklus (≈ ${fmt(p.perCycleMYR, 'MYR')}) · ${p.monthsLeft} bulan lagi`;
    return `<div class="panel" style="padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(w.name)}</b>
<div style="display:flex;gap:6px"><button class="btn" data-setor="${w.id}" style="padding:6px 14px;font-size:13px">Setor</button><button class="btn" data-goal-del="${w.id}" aria-label="Hapus ${esc(w.name)}" style="padding:6px 10px;font-size:13px">Hapus</button></div></div>
<div style="font-size:22px;font-weight:800;margin:6px 0">${fmt(saved, 'IDR')}${g.target ? ` <small class="mute" style="font-size:13px;font-weight:600">dari ${fmt(g.target, 'IDR')}</small>` : ''}</div>
${g.target ? `<div class="bar"><i style="width:${p.pct * 100}%"></i></div>` : ''}<div class="mute" style="font-size:13px;margin-top:6px">${info}</div></div>`;
  }).join('') + '<button class="btn" id="goalNew" style="width:100%;margin-bottom:8px">+ Target baru</button>';
}
function showForm(html) { $('#sheet').innerHTML = '<div class="grab"></div>' + html; showSheet(); }
function openSetor(id) {
  const w = W()[id];
  showForm(`<h2 style="margin:0 0 6px;text-align:center">Setor ke ${esc(w.name)}</h2><p class="mute" style="text-align:center;margin:0 0 10px;font-size:14px">Dipindahkan dari saldo Gaji (${fmt(store.balance('gaji'), 'IDR')})</p>
<input class="note-in" id="gAmt" type="number" inputmode="numeric" placeholder="Jumlah (Rp)"><button class="save" id="gOk">Setor</button>`);
  $('#gOk').onclick = async () => {
    const a = Math.round(parseFloat($('#gAmt').value)); if (!(a > 0)) return toast('Isi jumlah setoran');
    const t = await store.add({ type: 'transfer', walletId: 'gaji', toWalletId: id, amount: a, category: 'transfer', note: 'Setor ' + w.name });
    closeSheet(); toast('Disetor ' + fmt(a, 'IDR'), 'Batalkan', () => store.remove(t.id));
  };
}
function bindGoalDelete() {
    document.querySelectorAll('[data-goal-del]').forEach(b => b.onclick = () => {
        const w = W()[b.dataset.goalDel];
        if (!w) return;
        showForm(`<h2 id="goalConfirmTitle" style="margin:0 0 8px">Hapus target?</h2>
<p class="mute" style="margin:0">Target <b>${esc(w.name)}</b> dan semua catatan transaksinya akan dihapus. Saldo terkait juga akan dikembalikan.</p>
<div class="confirm-actions"><button class="btn" id="goalCancel">Batal</button><button class="btn d" id="goalConfirm">Hapus target</button></div>`);
        $('#sheet').classList.add('confirm');
        $('#sheet').setAttribute('aria-labelledby', 'goalConfirmTitle');
        $('#goalCancel').onclick = closeSheet;
        $('#goalConfirm').onclick = async () => {
            await store.removeWallet(w.id);
            closeSheet();
            toast('Target dihapus');
        };
    });
}
function openGoal() {
  showForm(`<h2 style="margin:0 0 10px;text-align:center">Target baru</h2><input class="note-in" id="nName" placeholder="Nama target, mis. Dana nikah" maxlength="30">
<input class="note-in" id="nTarget" type="number" inputmode="numeric" placeholder="Target (Rp)"><label class="fv">Tenggat <input type="date" class="note-in" id="nDue" style="margin:0;width:auto"></label><button class="save" id="nOk">Buat target</button>`);
  $('#nOk').onclick = async () => {
    const name = $('#nName').value.trim(), target = Math.round(parseFloat($('#nTarget').value)), due = $('#nDue').value;
    if (!name || !(target > 0) || !due) return toast('Isi nama, target, dan tenggat');
    await store.addWallet({ id: 'g' + Date.now().toString(36), name, currency: 'IDR', kind: 'goal', goal: { target, deadline: due } });
    closeSheet(); toast('Target dibuat');
  };
}


// ---------- layar Riwayat ----------
const myr = t => t.orig ? t.orig.amount : W()[t.walletId].currency === 'MYR' ? t.amount : 0;
function hist() {
    const k = store.stats('makan'), g = {};
    cycTx(k).sort((a, b) => b.ts - a.ts).forEach(t => {
        const d = new Date(t.ts), key = d.getDate() + ' ' + MON[d.getMonth()];
        (g[key] = g[key] || []).push(t);
    });
    $('#app').innerHTML = '<header><h1>Riwayat</h1></header>' + (Object.keys(g).length
        ? Object.entries(g).map(([hari, a]) => {
            const total = a.filter(t => t.type === 'expense').reduce((s, t) => s + myr(t), 0);
            return `<div class="day"><span>${hari}</span><span>${fmt(total, 'MYR')}</span></div><div class="list">${a.map(row).join('')}</div>`;
        }).join('')
        : '<div class="empty">Belum ada catatan di siklus ini.</div>');
    bindDel();
}

// ---------- layar Pengaturan ----------
function settings() {
    const r = W().makan.rule, s = store.settings();
    const F = (id, label, hint, val, extra = '') =>
        `<label class="f"><span>${label}<br><small class="mute">${hint}</small></span><input id="${id}" type="number" inputmode="decimal" min="0" value="${val || ''}" ${extra}></label>`;
    $('#app').innerHTML = `<header><h1>Pengaturan</h1></header><div class="list">
${F('cBudget', 'Uang makan per siklus (RM)', 'Dibagi jadi jatah harian', fromMinor(r.budget, 'MYR'))}
${F('cStart', 'Siklus mulai tanggal', '1-31, sesuai tanggal uang makan masuk', r.startDay, 'min="1" max="31"')}
${F('cRes', 'Cadangan darurat (%)', 'Disisihkan dari jatah, tidak dihitung', r.reservePct, 'max="30"')}
<label class="f"><span>Sisa jatah kemarin<br><small class="mute">Hangus: jatah tetap. Terbawa: dibagi ke sisa hari</small></span>
  <select id="cMode" class="note-in"><option value="hangus">Hangus</option><option value="terbawa">Terbawa</option></select></label>
${F('cMin', 'Jatah makan minimal (RM/hari)', 'Batas aman saat simulasi beli', fromMinor(s.minFood, 'MYR'))}
${F('cKurs', 'Kurs 1 RM = Rp', 'Diisi manual, tersimpan per transaksi', s.kurs)}
${F('cGaji', 'Gaji bulanan (Rp)', 'Hanya untuk hitung dampak', s.salaryIDR)}
${F('cCap', 'Batas belanja dari gaji (Rp/bulan)', 'Opsional, peringatan lunak', s.capIDR)}
</div>
   <h2>Favorit</h2><div class="list">${(s.favs || []).length ? s.favs.map((f, i) => `<div class="it"><div class="e">${CATS[f.cat][1]}</div><div class="t"><b>${esc(f.label)}</b><span>${CATS[f.cat][0]}</span></div><div class="a">${fmt(f.amt, 'MYR')}</div><button class="x" data-ff="${i}" aria-label="Hapus favorit">×</button></div>`).join('') : '<div class="empty">Belum ada favorit. Centang "Simpan sebagai favorit" saat mencatat.</div>'}</div>
<h2>Cadangan data</h2>
<div class="panel"><p class="mute" style="margin:0 0 4px;font-size:14px;line-height:1.45">Data hanya ada di HP ini. Salin teks untuk disimpan, atau tempel teks lama lalu ketuk Impor.</p>
<textarea id="bk" aria-label="Data cadangan"></textarea><button class="btn" id="bkCopy">Salin</button> <button class="btn" id="bkImp">Impor</button></div>`;

    $('#cMode').value = r.carryMode;
    document.querySelectorAll('[data-ff]').forEach(b => b.onclick = async () => { await store.setSettings({ favs: (s.favs || []).filter((_, i) => i !== +b.dataset.ff) }); settings(); });
    $('#bk').value = JSON.stringify(store.exportAll());

    // tiap kolom menyimpan sendiri saat selesai diubah
    const bind = (id, save) => $('#' + id).onchange = async e => {
        const v = id === 'cMode' ? e.target.value : parseFloat(e.target.value);
        if (id !== 'cMode' && !(v >= 0)) return;
        await save(v); toast('Tersimpan');
    };
    bind('cBudget', v => store.setRule('makan', { budget: toMinor(v, 'MYR') }));
    bind('cStart', v => store.setRule('makan', { startDay: Math.min(31, Math.max(1, Math.round(v))) }));
    bind('cRes', v => store.setRule('makan', { reservePct: v }));
    bind('cMode', v => store.setRule('makan', { carryMode: v }));
    bind('cMin', v => store.setSettings({ minFood: toMinor(v, 'MYR') }));
    bind('cKurs', v => store.setSettings({ kurs: v }));
    bind('cGaji', v => store.setSettings({ salaryIDR: Math.round(v) }));
    bind('cCap', v => store.setSettings({ capIDR: Math.round(v) }));

    $('#bkCopy').onclick = async () => {
        try { await navigator.clipboard.writeText($('#bk').value); toast('Data disalin'); }
        catch { $('#bk').select(); toast('Salin manual dari kotak teks'); }
    };
    $('#bkImp').onclick = async () => {
        try { await store.importAll(JSON.parse($('#bk').value)); toast('Data diimpor'); settings(); }
        catch { toast('Teks tidak valid, impor dibatalkan'); }
    };
}

// ---------- router ----------
const SCREENS = { home, hist, set: settings };
function go(t) {
    tab = t;
    document.querySelectorAll('nav .n').forEach(e => e.classList.toggle('on', e.dataset.t === t));
    render(); scrollTo(0, 0);
}
function render() {
    (SCREENS[tab] || home)();
    const g = $('#gear'); if (g) g.onclick = () => go('set');
    const b = $('#buyBtn'); if (b) b.onclick = openBuy;
}
document.querySelectorAll('nav .n').forEach(b => b.onclick = () => go(b.dataset.t));
// layar Pengaturan tidak digambar ulang otomatis, supaya kolom yang sedang diketik tidak hilang
store.subscribe(() => { if (tab !== 'set') render(); });
setInterval(() => { if (tab !== 'set') render(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && tab !== 'set') render(); });
render();

$('#fab').onclick = () => openSheet();
$('#bd').onclick = closeSheet;
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });