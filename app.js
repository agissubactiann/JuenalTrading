/* ===== Jurnal Trading v2: data disimpan di localStorage ===== */
const KEY = "jurnal-trading-v2";
const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
let S = load(),
  filt = "Semua",
  cal = new Date(),
  onSub = null,
  selDay = null,
  quiet = false;
cal.setDate(1);
S.payouts ||= [];
const $ = (s) => document.querySelector(s),
  dlg = $("#dlg");

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { accounts: [], rules: [] };
  } catch {
    return { accounts: [], rules: [] };
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(S));
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const ds = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const today = () => {
  const t = new Date();
  return ds(t.getFullYear(), t.getMonth(), t.getDate());
};
const num = (n) => Math.abs(Math.round(n)).toLocaleString("id-ID");
const idr = (n) => (n < 0 ? "-" : "") + "Rp " + num(n);
const sg = (n) => (n > 0 ? "+" : n < 0 ? "-" : "") + "Rp " + num(n);
const sum = (a) => a.reduce((s, x) => s + x.amount, 0);
function short(n) {
  const a = Math.abs(n),
    s = n > 0 ? "+" : n < 0 ? "-" : "",
    f = (v) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return a >= 1e9 ? s + f(a / 1e9) + "M" : a >= 1e6 ? s + f(a / 1e6) + "jt" : a >= 1e3 ? s + f(a / 1e3) + "rb" : s + a;
}
const FM = { idr, sg };
const cu = (n, f) => `<span data-cnt="${n}" data-f="${f}">${FM[f](n)}</span>`;
function fx() {
  document.querySelectorAll("#view h1").forEach((h) => {
    h.innerHTML = h.textContent
      .split(" ")
      .map((w, i) => `<span class="w" style="--d:${i * 90}ms">${esc(w)}</span>`)
      .join(" ");
  });
  document.querySelectorAll("#view .acc,.obj,.card,.day,.tr,.rule,.cert,.chip,.mo,.mini,.grp h3").forEach((el, i) => el.style.setProperty("--i", Math.min(i, 36)));
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  countUp(document);
}
function countUp(root) {
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  root.querySelectorAll("[data-cnt]").forEach((el) => {
    const to = +el.dataset.cnt,
      f = FM[el.dataset.f],
      t0 = performance.now();
    (function s(t) {
      const p = Math.min(1, (t - t0) / 1000),
        e = 1 - Math.pow(1 - p, 3);
      el.textContent = f(to * e);
      if (p < 1) requestAnimationFrame(s);
    })(t0);
  });
}
const money = (v) => Number(String(v).replace(/\D/g, "")) || 0;

/* ---------- Hitung statistik & status akun ---------- */
function calc(a) {
  const t = [...a.trades].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.id - y.id));
  const days = {},
    pts = [a.start];
  let bal = a.start;
  t.forEach((x) => {
    days[x.date] = (days[x.date] || 0) + x.amount;
    bal += x.amount;
    pts.push(bal);
  });
  // Aturan dihitung per akhir hari (urutan trade dalam satu hari tidak dicatat jamnya)
  const keys = Object.keys(days).sort(),
    dl = (a.start * a.dailyP) / 100,
    ml = a.start * (1 - a.maxP / 100),
    target = (a.start * a.profP) / 100;
  let run = a.start,
    low = a.start,
    mcDate = null,
    passDate = null;
  const dailyHits = [];
  keys.forEach((d, i) => {
    run += days[d];
    low = Math.min(low, run);
    if (days[d] <= -dl) dailyHits.push(d); // daily loss: hanya mengunci hari itu
    if (!mcDate && run <= ml) mcDate = d; // max loss / MC: mengunci akun
    if (!passDate && !mcDate && run - a.start >= target && i + 1 >= a.minD) passDate = d;
  });
  const profit = bal - a.start,
    nd = keys.length;
  const w = t.filter((x) => x.amount > 0),
    l = t.filter((x) => x.amount < 0),
    gp = sum(w),
    gl = -sum(l);
  const paid = (S.payouts || []).filter((p) => p.acc == a.id).reduce((x, p) => x + p.amount, 0);
  return {
    passDate,
    mcDate,
    dailyHits,
    t,
    days,
    pts,
    trBal: bal,
    bal: bal - paid,
    paid,
    profit,
    target,
    nd,
    n: t.length,
    wins: w.length,
    breach: mcDate ? `Max loss limit tercapai pada ${mcDate} (MC). Akun terkunci dan tidak bisa input trade.` : null,
    status: mcDate ? "Breached" : profit >= target && nd >= a.minD ? "Passed" : "Active",
    pf: gl ? gp / gl : null,
    avgW: w.length ? gp / w.length : 0,
    avgL: l.length ? gl / l.length : 0,
    worstDay: Math.min(0, ...Object.values(days)),
    low,
  };
}
const stTag = (c) => (c.status !== "Breached" && c.dailyHits.includes(today()) ? '<span class="tag Daily">Daily Breach</span>' : `<span class="tag ${c.status}">${c.status}</span>`);
function info(t, msg) {
  onSub = null;
  dlg.innerHTML = `<div><h2>${t}</h2><p class="muted" style="margin-top:10px">${msg}</p><div class="row"><button type="button" class="btn" data-act="close">Mengerti</button></div></div>`;
  dlg.showModal();
}

/* ---------- Dialog ---------- */
function openDlg(title, body, ok, fn) {
  dlg.innerHTML = `<form id="f"><h2>${title}</h2>${body}<div class="row"><button type="button" class="btn ghost" data-act="close">Batal</button><button class="btn">${ok}</button></div></form>`;
  onSub = fn;
  dlg.showModal();
}
const fld = (l, n, a = "") => `<label>${l}</label><input name="${n}" ${a} required>`;
const mfld = (l, n, v = "") => fld(l, n, `inputmode="numeric" data-money placeholder="0" autocomplete="off" value="${v}"`);

function newAccount() {
  openDlg(
    "Buat akun",
    fld("Nama akun", "name", `value="Akun ${S.accounts.length + 1}" autocomplete="off"`) +
      mfld("Saldo awal (IDR)", "start", "10.000.000") +
      `<div class="two"><div>${fld("Profit target (%)", "profP", 'type="number" step="any" min="0" value="8"')}</div><div>${fld("Min trading days", "minD", 'type="number" min="0" value="5"')}</div>
     <div>${fld("Daily loss (%)", "dailyP", 'type="number" step="any" min="0" value="5"')}</div><div>${fld("Max loss (%)", "maxP", 'type="number" step="any" min="0" value="10"')}</div></div>`,
    "Buat akun",
    (f) => {
      const start = money(f.get("start"));
      if (!start) return false;
      const id = Date.now();
      S.accounts.push({ id, name: f.get("name").trim(), start, profP: +f.get("profP"), dailyP: +f.get("dailyP"), maxP: +f.get("maxP"), minD: +f.get("minD"), trades: [] });
      save();
      location.hash = `#/account/${id}/overview`;
    },
  );
}

function addTrade(a, date) {
  if (calc(a).status === "Breached") return info("Akun terkunci (MC)", "Max loss limit sudah tercapai, jadi akun ini tidak bisa menerima trade baru. Kalau limitnya perlu diubah, klik ikon pensil di kartu Max loss limit pada tab Overview.");
  openDlg(
    "Catat trade",
    fld("Tanggal", "date", `type="date" value="${date || today()}"`) +
      fld("Pair", "pair", 'placeholder="XAUUSD, EURUSD…" autocomplete="off"') +
      `<label>Posisi</label><select name="side"><option>Buy</option><option>Sell</option></select>` +
      mfld("Hasil (IDR)", "amount") +
      `<div class="seg"><input type="radio" name="type" id="tp" value="p" checked><label class="p" for="tp">Profit</label><input type="radio" name="type" id="tl" value="l"><label class="l" for="tl">Minus</label></div><p class="err" role="alert"></p>`,
    "Simpan",
    (f) => {
      const v = money(f.get("amount"));
      if (!v) return false;
      const d = f.get("date"),
        cc = calc(a);
      const err =
        cc.status === "Breached"
          ? "Akun terkunci karena Max loss limit tercapai (MC)."
          : (cc.days[d] || 0) <= -(a.start * a.dailyP) / 100
            ? `Daily loss limit tanggal ${d} sudah tercapai, jadi trade di hari itu dikunci. Besok akun aktif lagi.`
            : "";
      if (err) {
        dlg.querySelector(".err").textContent = err;
        return false;
      }
      a.trades.push({ id: Date.now(), date: f.get("date"), pair: f.get("pair").trim().toUpperCase(), side: f.get("side"), amount: f.get("type") === "l" ? -v : v });
      save();
      route();
    },
  );
}

/* ---------- Halaman ---------- */
const bar = (p, bad) => `<div class="bar ${bad ? "bad" : ""}"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`;
const tabs = (id, t) => `<div class="tabs">${["overview", "calendar", "history"].map((x) => `<a href="#/account/${id}/${x}" class="${x === t ? "on" : ""}">${x[0].toUpperCase() + x.slice(1)}</a>`).join("")}</div>`;

function pAccounts() {
  const list = S.accounts.map((a) => ({ a, c: calc(a) })).filter((x) => filt === "Semua" || x.c.status === filt);
  return `<div class="head"><h1>Accounts</h1><button class="btn" data-act="newAcc">+ Buat akun</button></div>
  <div class="chips">${["Semua", "Active", "Passed", "Breached"].map((f) => `<button class="chip ${f === filt ? "on" : ""}" data-act="filt" data-v="${f}">${f}</button>`).join("")}</div>
  ${
    list.length
      ? list
          .map(
            ({ a, c }) => `<article class="acc"><div class="badge"><small>${esc(a.name)}</small><b>Rp ${short(a.start).replace("+", "")}</b></div>
    <div class="accbody"><span class="lbl">Current Balance</span><strong>${cu(c.bal, "idr")}</strong>
    <div class="tags"><span class="tag ${c.profit >= 0 ? "win" : "lose"}">${c.profit >= 0 ? "Profit" : "Loss"}: ${sg(c.profit)}</span><span class="tag">${c.n} Trades</span>${c.paid ? `<span class="tag">Payout: -${idr(c.paid)}</span>` : ""}${stTag(c)}</div></div>
    <a class="btn sm" href="#/account/${a.id}/overview">View details</a></article>`,
          )
          .join("")
      : `<div class="empty">${S.accounts.length ? "Tidak ada akun dengan status ini." : "Belum ada akun. Klik “+ Buat akun” untuk mulai."}</div>`
  }`;
}

function chart(a, c) {
  const lo = a.start * (1 - a.maxP / 100),
    hi = a.start + c.target,
    all = [...c.pts, lo, hi];
  let mn = Math.min(...all),
    mx = Math.max(...all);
  const p = (mx - mn) * 0.08 || 1;
  mn -= p;
  mx += p;
  const W = 640,
    H = 220,
    X = (i) => 8 + (c.pts.length > 1 ? i / (c.pts.length - 1) : 0) * (W - 16),
    Y = (v) => H - ((v - mn) / (mx - mn)) * H;
  const ln = (v, k, t) => `<line class="ln ${k}" x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/><text class="lt ${k}" x="${W - 4}" y="${Y(v) - 5}" text-anchor="end">${t}</text>`;
  const last = c.pts.length - 1,
    P = c.pts.map((v, i) => X(i) + "," + Y(v)).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${ln(hi, "g", "Profit target " + idr(hi))}${ln(lo, "r", "Max loss " + idr(lo))}
  <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7a5f" stop-opacity=".28"/><stop offset="1" stop-color="#0e7a5f" stop-opacity="0"/></linearGradient></defs><polygon class="ar" fill="url(#ar)" points="${P} ${X(last)},${H} ${X(0)},${H}"/><polyline class="pl" pathLength="1" fill="none" stroke="#0e7a5f" stroke-width="2.5" stroke-linejoin="round" points="${P}"/><circle class="ring" cx="${X(last)}" cy="${Y(c.pts[last])}" r="4"/><circle class="dot" cx="${X(last)}" cy="${Y(c.pts[last])}" r="5"/></svg>`;
}

const PEN = (k, t) =>
  `<button class="pen" data-act="editLimit" data-v="${k}" aria-label="Ubah ${t}" title="Ubah ${t}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg></button>`;

function pOverview(a, c) {
  const dl = (a.start * a.dailyP) / 100,
    ml = (a.start * a.maxP) / 100,
    dd = Math.max(0, a.start - c.low);
  return `${c.breach ? `<div class="alert">${c.breach}</div>` : c.dailyHits.includes(today()) ? `<div class="alert warn">Daily loss limit tercapai hari ini. Input trade untuk hari ini dikunci, dan akun aktif lagi besok.</div>` : ""}${c.dailyHits.length ? `<p class="note">Daily loss limit pernah tercapai pada: ${c.dailyHits.slice(-5).map(fd).join(", ")}${c.dailyHits.length > 5 ? " dan lainnya" : ""}. Akun otomatis aktif lagi keesokan harinya.</p>` : ""}
  <div class="objs">
   <div class="obj"><span class="lbl">Profit target (${a.profP}%)</span><strong>${idr(c.target)}</strong>${bar((c.profit / c.target) * 100)}<small>Hasil: ${sg(c.profit)}</small></div>
   <div class="obj"><span class="lbl">Min trading days</span><strong>${a.minD} Hari</strong>${bar(a.minD ? (c.nd / a.minD) * 100 : 100)}<small>Hasil: ${c.nd} Hari</small></div>
   <div class="obj"><div class="objh"><span class="lbl">Daily loss limit (-${a.dailyP}%)</span>${PEN("dailyP", "Daily loss limit")}</div><strong>${idr(dl)}</strong>${bar((-c.worstDay / dl) * 100, 1)}<small>Hari terburuk: ${idr(c.worstDay)}</small></div>
   <div class="obj"><div class="objh"><span class="lbl">Max loss limit (-${a.maxP}%)</span>${PEN("maxP", "Max loss limit")}</div><strong>${idr(ml)}</strong>${bar((dd / ml) * 100, 1)}<small>Drawdown: ${idr(dd)}</small></div></div>
  <div class="ov"><section class="card"><h2>Account Status</h2><span class="muted">Equity per trade</span>${chart(a, c)}</section>
  <aside class="card"><div class="bal"><span class="lbl">Current balance</span><span class="big">${cu(c.bal, "idr")}</span></div>
   <div class="kv"><span class="muted">Initial balance</span><b>${idr(a.start)}</b></div><div class="kv"><span class="muted">Equity</span><b>${idr(c.bal)}</b></div>
   <div class="kv"><span class="muted">Profit/Loss</span><b class="${c.profit >= 0 ? "pos" : "neg"}">${sg(c.profit)}</b></div>${c.paid ? `<div class="kv"><span class="muted">Total payout</span><b class="neg">-${idr(c.paid)}</b></div>` : ""}</aside></div>`;
}

const BLNS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const fd = (k) => {
  const [y, m, d] = k.split("-");
  return `${+d} ${BLN[m - 1]} ${y}`;
};
const trRow = (t) =>
  `<div class="tr"><b>${esc(t.pair || "-")}</b><span class="side-tag ${t.side}">${t.side}</span><b class="${t.amount >= 0 ? "pos" : "neg"}">${sg(t.amount)}</b><button class="x" data-act="delTrade" data-v="${t.id}" aria-label="Hapus">&times;</button></div>`;

function pCalendar(a, c) {
  const y = cal.getFullYear(),
    m = cal.getMonth(),
    off = (new Date(y, m, 1).getDay() + 6) % 7,
    dim = new Date(y, m + 1, 0).getDate(),
    pre = `${y}-${pad(m + 1)}`;
  const cnt = {};
  a.trades.forEach((t) => (cnt[t.date] = (cnt[t.date] || 0) + 1));
  const ms = BLNS.map((_, i) => {
    const L = c.t.filter((t) => t.date.startsWith(`${y}-${pad(i + 1)}`));
    return { n: L.length, s: sum(L) };
  });
  let cells = '<div class="day void"></div>'.repeat(off);
  for (let d = 1; d <= dim; d++) {
    const k = ds(y, m, d),
      wd = (off + d - 1) % 7 > 4,
      s = c.days[k];
    cells += `<button class="day ${wd ? "off" : ""} ${k === today() ? "today" : ""} ${k === selDay ? "sel" : ""} ${s > 0 ? "win" : s < 0 ? "lose" : ""}" data-act="day" data-v="${k}" aria-label="Lihat history ${fd(k)}"><b>${pad(d)}</b>
    ${cnt[k] ? `<small>${cnt[k]}<span class="tw"> Trades</span><span class="tx">x</span></small><span class="r">${short(s)}</span>` : wd ? '<small class="wkd">Weekend</small>' : ""}</button>`;
  }
  const list = selDay ? c.t.filter((t) => t.date === selDay) : c.t.filter((t) => t.date.startsWith(pre));
  const tot = sum(list),
    w = list.filter((t) => t.amount > 0).length,
    g = {};
  list.forEach((t) => (g[t.date] ||= []).push(t));
  const addD = selDay || (today().startsWith(pre) ? today() : ds(y, m, 1));
  return `<div class="cal-head"><h2>Trading Calendar</h2><div class="yr"><button class="icon" data-act="yprev" aria-label="Tahun sebelumnya">&#8249;</button><b>${y}</b><button class="icon" data-act="ynext" aria-label="Tahun berikutnya">&#8250;</button></div></div>
  <div class="months">${BLNS.map((n, i) => `<button class="mo ${i === m ? "on" : ""} ${ms[i].n ? (ms[i].s >= 0 ? "win" : "lose") : ""}" data-act="month" data-v="${i}" title="${BLN[i]} ${y}"><b>${n}</b><small>${ms[i].n ? short(ms[i].s) : "–"}</small></button>`).join("")}</div>
  <div class="wk">${HARI.map((h) => `<span>${h.slice(0, 3)}</span>`).join("")}</div><div class="dg">${cells}</div>
  <section class="card hist" id="hist"><div class="hhead"><div><h2>History ${selDay ? fd(selDay) : BLN[m] + " " + y}</h2>
   <span class="muted">${list.length} trade &middot; Win rate ${list.length ? Math.round((w / list.length) * 100) : 0}% &middot; <b class="${tot >= 0 ? "pos" : "neg"}">${sg(tot)}</b>${selDay && c.dailyHits.includes(selDay) ? ' &middot; <b class="neg">Daily limit tercapai</b>' : ""}</span></div>
   <div>${selDay ? `<button class="btn ghost sm" data-act="day" data-v="${selDay}">Lihat sebulan</button> ` : ""}${c.status === "Breached" ? `<button class="btn sm" disabled>Akun terkunci</button>` : `<button class="btn sm" data-act="dayAdd" data-v="${addD}">+ Catat trade</button>`}</div></div>
  ${
    Object.keys(g)
      .sort()
      .reverse()
      .map((d) => `<div class="grp">${selDay ? "" : `<h3>${fd(d)}<small>${g[d].length} trade &middot; <b class="${sum(g[d]) >= 0 ? "pos" : "neg"}">${sg(sum(g[d]))}</b></small></h3>`}${g[d].map(trRow).join("")}</div>`)
      .join("") || `<div class="empty">Belum ada trade ${selDay ? "di tanggal ini" : "di bulan ini"}.</div>`
  }</section>`;
}

function pHistory(a, c) {
  const g = {};
  c.t.forEach((t) => (g[t.date] ||= []).push(t));
  return `<h2 style="margin-bottom:14px">Trading History</h2><div class="stats">
  <div class="card"><span class="lbl">Balance</span><strong>${cu(c.bal, "idr")}</strong></div>
  <div class="card"><span class="lbl">Profit Factor</span><strong>${c.pf === null ? "-" : c.pf.toFixed(2)}</strong></div>
  <div class="card"><span class="lbl">Win Rate</span><strong>${c.n ? ((c.wins / c.n) * 100).toFixed(2) : "0.00"}%</strong></div>
  <div class="card"><span class="lbl">Avg Profit / Avg Loss</span><strong>${c.avgL ? (c.avgW / c.avgL).toFixed(2) : "-"}</strong></div>
  <div class="card"><span class="lbl">Total Trades</span><strong>${c.n}</strong></div></div>
  ${
    Object.keys(g)
      .sort()
      .reverse()
      .map(
        (d) =>
          `<div class="grp"><h3>${d}<small>Total Trades: ${g[d].length}</small></h3>${g[d]
            .map(
              (t) =>
                `<div class="tr"><b>${esc(t.pair || "-")}</b><span class="side-tag ${t.side}">${t.side}</span><b class="${t.amount >= 0 ? "pos" : "neg"}">${sg(t.amount)}</b><button class="x" data-act="delTrade" data-v="${t.id}" aria-label="Hapus">&times;</button></div>`,
            )
            .join("")}</div>`,
      )
      .join("") || '<div class="empty">Belum ada trade.</div>'
  }`;
}

function pDetail(id, tab) {
  const a = S.accounts.find((x) => x.id == id);
  if (!a) return (location.hash = "#/accounts");
  const c = calc(a),
    body = tab === "calendar" ? pCalendar(a, c) : tab === "history" ? pHistory(a, c) : pOverview(a, c);
  return `<div class="crumb"><a href="#/accounts">Accounts</a> / Account Overview</div>
  <div class="head"><div><h1>${esc(a.name)}</h1>${stTag(c)} <span class="muted">Saldo awal ${idr(a.start)}</span></div>
  <div>${c.status === "Breached" ? `<button class="btn" disabled>Akun terkunci (MC)</button>` : `<button class="btn" data-act="addTrade" data-id="${a.id}">+ Catat trade</button>`} <button class="link" data-act="delAcc" data-id="${a.id}">Hapus akun</button></div></div>${tabs(a.id, tab)}${body}`;
}

const SEAL = `<svg class="seal" viewBox="0 0 100 120" aria-hidden="true"><polygon points="30,80 18,118 38,108 50,118 50,84" fill="#8a1c2b"/><polygon points="70,80 82,118 62,108 50,118 50,84" fill="#a82a3b"/><circle cx="50" cy="48" r="44" fill="#c9a24b"/><circle cx="50" cy="48" r="38" fill="none" stroke="#fff6d6" stroke-width="1.5" stroke-dasharray="2 3"/><circle cx="50" cy="48" r="31" fill="#e3c372"/><polygon points="50,24 56,40 73,41 60,52 64,69 50,60 36,69 40,52 27,41 44,40" fill="#fff6d6" stroke="#a37d2a" stroke-width="1"/></svg>`;

const certFull = (a, c) => {
  const nm = esc(S.trader || "Nama Trader");
  return `
  <section class="cert"><i class="co k1"></i><i class="co k2"></i><i class="co k3"></i><i class="co k4"></i><div class="cin">
   <span class="eyebrow">Jurnal Trading &middot; Prop Challenge</span>
   <h2 class="ctitle">Certificate of Achievement</h2>
   <p class="csub">Dengan bangga diberikan kepada</p>
   <div class="cname">${nm}</div><div class="cline"></div>
   <p class="csub">atas keberhasilan mencapai target profit ${a.profP}% pada akun <b>${esc(a.name)}</b><br>${c.dailyHits.length ? "tanpa menyentuh batas max loss." : "tanpa melanggar batas daily loss maupun max loss."}</p>
   <div class="cstats"><div><b>${cu(c.profit, "sg")}</b><span>Total profit</span></div><div><b>${c.nd}</b><span>Hari trading</span></div><div><b>${cu(c.trBal, "idr")}</b><span>Saldo akhir</span></div></div>
   <div class="cfoot"><div><b>${c.passDate || "-"}</b><span>Tanggal lolos</span></div>${SEAL}<div><b>JT-${String(a.id).slice(-6)}</b><span>Nomor sertifikat</span></div></div></div></section>`;
};

function pCerts() {
  const ok = S.accounts.map((a) => ({ a, c: calc(a) })).filter((x) => x.c.status === "Passed");
  return (
    `<div class="head"><h1>Certificates</h1><button class="btn ghost" data-act="setName">${S.trader ? "Ubah" : "Atur"} nama trader</button></div>` +
    (ok.length
      ? `<div class="minis">${ok
          .map(
            ({ a, c }) => `
   <article class="mini"><div class="mthumb gold">${SEAL}<span>Certificate of Achievement</span></div>
    <h3>${esc(a.name)}</h3>
    <div class="tags"><span class="tag Passed">Passed</span><span class="tag">Rp ${short(a.start).replace("+", "")}</span><span class="tag win">${sg(c.profit)}</span></div>
    <p class="muted">Tanggal lolos: ${c.passDate ? fd(c.passDate) : "-"}</p>
    <button class="btn sm" data-act="viewCert" data-id="${a.id}">Lihat sertifikat</button></article>`,
          )
          .join("")}</div>`
      : '<div class="empty">Belum ada sertifikat. Akun yang mencapai profit target dan min trading days tanpa breach akan muncul di sini.</div>')
  );
}

const fdl = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return `${HARI[(new Date(y, m - 1, d).getDay() + 6) % 7]}, ${d} ${BLN[m - 1]} ${y}`;
};

function addPayout() {
  const opts = S.accounts
    .filter((x) => calc(x).status !== "Breached")
    .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`)
    .join("");
  openDlg(
    "Catat payout",
    fld("Tanggal payout", "date", `type="date" value="${today()}"`) +
      mfld("Nominal payout (IDR)", "amount") +
      `<label>Dari akun</label><select name="acc"><option value="">Tanpa akun</option>${opts}</select>
     <small class="muted">Kalau memilih akun, Current Balance akun itu otomatis berkurang sebesar nominal payout.</small>
     <label>Catatan (opsional)</label><input name="note" placeholder="Misal: Payout pertama" autocomplete="off">`,
    "Simpan",
    (f) => {
      const v = money(f.get("amount"));
      if (!v) return false;
      const ac = S.accounts.find((x) => x.id == f.get("acc"));
      if (ac) {
        const c = calc(ac),
          free = Math.max(0, c.profit - c.paid);
        if (v > free && !confirm(`Nominal payout melebihi profit yang tersedia (${idr(free)}). Tetap catat?`)) return false;
      }
      S.payouts.push({ id: Date.now(), date: f.get("date"), amount: v, acc: f.get("acc"), note: f.get("note").trim() });
      save();
      route();
    },
  );
}

const payFull = (p) => {
  const nm = esc(S.trader || "Nama Trader"),
    ac = S.accounts.find((x) => x.id == p.acc);
  return `<section class="cert pay"><i class="co k1"></i><i class="co k2"></i><i class="co k3"></i><i class="co k4"></i><div class="cin">
   <span class="eyebrow">Jurnal Trading &middot; Payout</span>
   <h2 class="ctitle">Payout Certificate</h2>
   <p class="csub">Dengan bangga diberikan kepada</p>
   <div class="cname">${nm}</div><div class="cline"></div>
   <p class="csub">atas payout yang diterima pada</p>
   <div class="pdate">${fdl(p.date)}</div>
   <div class="pamt">${cu(p.amount, "idr")}</div>
   <p class="csub">Apresiasi atas konsistensi dan disiplin dalam trading.</p>
   ${p.note ? `<p class="csub pnote">${esc(p.note)}</p>` : ""}
   <div class="cfoot"><div><b>${ac ? esc(ac.name) : "-"}</b><span>Akun</span></div>${SEAL}<div><b>PO-${String(p.id).slice(-6)}</b><span>Nomor payout</span></div></div></div></section>`;
};

function pPayout() {
  const L = [...S.payouts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  const tot = L.reduce((s, p) => s + p.amount, 0);
  return (
    `<div class="head"><h1>Payout</h1><div><button class="btn ghost" data-act="setName">${S.trader ? "Ubah" : "Atur"} nama trader</button> <button class="btn" data-act="addPayout">+ Catat payout</button></div></div>
  <div class="pstats"><div class="card"><span class="lbl">Total payout</span><strong>${cu(tot, "idr")}</strong></div>
   <div class="card"><span class="lbl">Jumlah payout</span><strong>${L.length}x</strong></div>
   <div class="card"><span class="lbl">Payout terakhir</span><strong>${L.length ? fd(L[0].date) : "-"}</strong></div></div>` +
    (L.length
      ? `<div class="minis">${L.map((p) => {
          const ac = S.accounts.find((x) => x.id == p.acc);
          return `
   <article class="mini"><div class="mthumb green"><small>PAYOUT</small><b>${idr(p.amount)}</b></div>
    <h3>${fd(p.date)}</h3>
    <div class="tags"><span class="tag">${ac ? esc(ac.name) : "Tanpa akun"}</span><span class="tag">PO-${String(p.id).slice(-6)}</span></div>
    <p class="muted">${fdl(p.date).split(",")[0]}${p.note ? " · " + esc(p.note) : ""}</p>
    <button class="btn sm" data-act="viewPay" data-v="${p.id}">Lihat detail</button></article>`;
        }).join("")}</div>`
      : '<div class="empty">Belum ada payout. Klik “+ Catat payout” setelah lu berhasil menarik profit, dan kartu apresiasinya muncul di sini.</div>')
  );
}

/* ----- Modal sertifikat besar ----- */
function showCert(html, extra = "") {
  dlg.classList.add("wide");
  onSub = null;
  dlg.innerHTML = `<div class="cview">${html}<div class="row">${extra}<button type="button" class="btn ghost" data-act="close">Tutup</button><button type="button" class="btn" data-act="print">Simpan PDF / Cetak</button></div></div>`;
  dlg.showModal();
  countUp(dlg);
}
dlg.addEventListener("close", () => dlg.classList.remove("wide"));
dlg.addEventListener("click", (e) => {
  if (e.target === dlg && dlg.classList.contains("wide")) dlg.close();
});

function pRules() {
  return `<div class="head"><h1>Rules Trading</h1></div><form class="rform" data-form="rule"><input name="r" placeholder="Tulis aturan trading kamu…" autocomplete="off" required><button class="btn">Tambah</button></form>
  ${S.rules.map((r, i) => `<div class="rule"><b>${i + 1}.</b><span>${esc(r.text)}</span><button class="link" data-act="delRule" data-v="${r.id}">Hapus</button></div>`).join("") || '<div class="empty">Belum ada aturan. Tulis aturan pribadi kamu, misalnya “Maksimal 3 trade per hari”.</div>'}`;
}

/* ---------- Router ---------- */
function route() {
  const [, p = "accounts", id, tab = "overview"] = location.hash.split("/");
  document.querySelectorAll("#nav a").forEach((l) => l.classList.toggle("on", l.dataset.p === (p === "account" ? "accounts" : p)));
  $("#view").innerHTML = p === "account" ? pDetail(id, tab) : p === "certificates" ? pCerts() : p === "payout" ? pPayout() : p === "rules" ? pRules() : pAccounts();
  fx();
  $("#view").classList.toggle("quiet", quiet);
  quiet = false;
}
addEventListener("hashchange", () => {
  selDay = null;
  if (mob()) setNav(false);
  route();
});

/* ---------- Event ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const v = b.dataset.v,
    a = S.accounts.find((x) => x.id == (b.dataset.id || location.hash.split("/")[2]));
  ({
    close: () => dlg.close(),
    newAcc: newAccount,
    addPayout,
    editLimit: () => {
      const k = v,
        t = k === "dailyP" ? "Daily loss limit" : "Max loss limit";
      openDlg(
        `Ubah ${t}`,
        `<p class="muted">Saat ini ${a[k]}% dari saldo awal = ${idr((a.start * a[k]) / 100)}. Status akun dihitung ulang setelah disimpan, jadi akun yang terkunci bisa aktif lagi kalau limitnya dinaikkan.</p>` +
          fld(`${t} (%)`, "p", `type="number" step="any" min="0.1" max="100" value="${a[k]}"`),
        "Simpan",
        (f) => {
          const p = +f.get("p");
          if (!(p > 0 && p <= 100)) return false;
          a[k] = p;
          save();
          route();
        },
      );
    },
    viewCert: () => showCert(certFull(a, calc(a))),
    viewPay: () => showCert(payFull(S.payouts.find((p) => p.id == v)), `<button type="button" class="link" style="margin-right:auto" data-act="delPayout" data-v="${v}">Hapus payout</button>`),
    delPayout: () => {
      if (confirm("Hapus payout ini? Saldo akun akan kembali bertambah.")) {
        S.payouts = S.payouts.filter((p) => p.id != v);
        save();
        dlg.close();
        route();
      }
    },
    setName: () =>
      openDlg("Nama trader", fld("Nama lengkap", "n", `value="${esc(S.trader || "")}" autocomplete="off"`), "Simpan", (f) => {
        S.trader = f.get("n").trim();
        save();
        route();
      }),
    print: () => print(),
    filt: () => {
      filt = v;
      route();
    },
    yprev: () => {
      cal.setFullYear(cal.getFullYear() - 1);
      selDay = null;
      quiet = true;
      route();
    },
    ynext: () => {
      cal.setFullYear(cal.getFullYear() + 1);
      selDay = null;
      quiet = true;
      route();
    },
    month: () => {
      cal.setMonth(+v);
      selDay = null;
      quiet = true;
      route();
    },
    day: () => {
      selDay = selDay === v ? null : v;
      quiet = true;
      route();
      requestAnimationFrame(() => $("#hist")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    },
    addTrade: () => addTrade(a),
    dayAdd: () => addTrade(a, v),
    delTrade: () => {
      a.trades = a.trades.filter((t) => t.id != v);
      save();
      route();
    },
    delAcc: () => {
      if (confirm("Hapus akun ini beserta semua trade-nya?")) {
        S.accounts = S.accounts.filter((x) => x !== a);
        save();
        location.hash = "#/accounts";
      }
    },
    delRule: () => {
      S.rules = S.rules.filter((r) => r.id != v);
      save();
      route();
    },
  })[b.dataset.act]?.();
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "f") {
    if (onSub(new FormData(e.target)) !== false) dlg.close();
  } else if (e.target.dataset.form === "rule") {
    S.rules.push({ id: Date.now(), text: new FormData(e.target).get("r").trim() });
    save();
    route();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.money !== undefined) {
    const d = e.target.value.replace(/\D/g, "");
    e.target.value = d ? Number(d).toLocaleString("id-ID") : "";
  }
});
route();

/* ===== PWA: tombol install + service worker ===== */
let dip = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  dip = e;
  $("#install").hidden = false;
});
$("#install").addEventListener("click", async () => {
  if (!dip) return;
  dip.prompt();
  await dip.userChoice;
  dip = null;
  $("#install").hidden = true;
});
addEventListener("appinstalled", () => {
  $("#install").hidden = true;
});
const iosDev = /iphone|ipad|ipod/i.test(navigator.userAgent),
  standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (iosDev && !standalone) $("#iosHint").hidden = false;
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) addEventListener("load", () => navigator.serviceWorker.register("sw.js"));

/* ===== Menu hamburger ===== */
const mob = () => matchMedia("(max-width:900px)").matches;
function setNav(on) {
  document.body.classList.toggle("nav-off", !on);
  $("#burger").setAttribute("aria-expanded", on);
  if (!mob()) localStorage.setItem("jt-nav", on ? "on" : "off");
}
$("#burger").addEventListener("click", () => setNav(document.body.classList.contains("nav-off")));
document.body.classList.add("init");
setNav(mob() ? false : localStorage.getItem("jt-nav") !== "off");
requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("init")));
