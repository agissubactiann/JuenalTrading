/* ===== Jurnal Trading v2: data disimpan di localStorage ===== */
const KEY = "jurnal-trading-v2";
const BLN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const HARI = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
let S = load(), filt = "Semua", cal = new Date(), onSub = null;
cal.setDate(1);
const $ = (s) => document.querySelector(s), dlg = $("#dlg");

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { accounts: [], rules: [] }; } catch { return { accounts: [], rules: [] }; } }
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const ds = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const today = () => { const t = new Date(); return ds(t.getFullYear(), t.getMonth(), t.getDate()); };
const num = (n) => Math.abs(Math.round(n)).toLocaleString("id-ID");
const idr = (n) => (n < 0 ? "-" : "") + "Rp " + num(n);
const sg = (n) => (n > 0 ? "+" : n < 0 ? "-" : "") + "Rp " + num(n);
const sum = (a) => a.reduce((s, x) => s + x.amount, 0);
function short(n) {
  const a = Math.abs(n), s = n > 0 ? "+" : n < 0 ? "-" : "", f = (v) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return a >= 1e9 ? s + f(a / 1e9) + "M" : a >= 1e6 ? s + f(a / 1e6) + "jt" : a >= 1e3 ? s + f(a / 1e3) + "rb" : s + a;
}
const FM = { idr, sg };
const cu = (n, f) => `<span data-cnt="${n}" data-f="${f}">${FM[f](n)}</span>`;
function fx() {
  document.querySelectorAll("#view h1").forEach((h) => { h.innerHTML = h.textContent.split(" ").map((w, i) => `<span class="w" style="--d:${i * 90}ms">${esc(w)}</span>`).join(" "); });
  document.querySelectorAll("#view .acc,.obj,.card,.day,.tr,.rule,.cert,.chip,.grp h3").forEach((el, i) => el.style.setProperty("--i", Math.min(i, 36)));
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  document.querySelectorAll("[data-cnt]").forEach((el) => {
    const to = +el.dataset.cnt, f = FM[el.dataset.f], t0 = performance.now();
    (function s(t) { const p = Math.min(1, (t - t0) / 1000), e = 1 - Math.pow(1 - p, 3); el.textContent = f(to * e); if (p < 1) requestAnimationFrame(s); })(t0);
  });
}
const money = (v) => Number(String(v).replace(/\D/g, "")) || 0;

/* ---------- Hitung statistik & status akun ---------- */
function calc(a) {
  const t = [...a.trades].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.id - y.id));
  const days = {}, pts = [a.start];
  let bal = a.start, breach = null, passDate = null;
  t.forEach((x) => {
    days[x.date] = (days[x.date] || 0) + x.amount; bal += x.amount; pts.push(bal);
    if (!breach && bal <= a.start * (1 - a.maxP / 100)) breach = "Max loss limit tercapai. Akun breached.";
    if (!breach && days[x.date] <= -a.start * a.dailyP / 100) breach = `Daily loss limit tercapai pada ${x.date}. Akun breached.`;
    if (!passDate && !breach && bal - a.start >= a.start * a.profP / 100 && Object.keys(days).length >= a.minD) passDate = x.date;
  });
  const profit = bal - a.start, target = a.start * a.profP / 100, nd = Object.keys(days).length;
  const w = t.filter((x) => x.amount > 0), l = t.filter((x) => x.amount < 0), gp = sum(w), gl = -sum(l);
  return { passDate, t, days, pts, bal, profit, target, nd, breach, n: t.length, wins: w.length,
    status: breach ? "Breached" : profit >= target && nd >= a.minD ? "Passed" : "Active",
    pf: gl ? gp / gl : null, avgW: w.length ? gp / w.length : 0, avgL: l.length ? gl / l.length : 0,
    worstDay: Math.min(0, ...Object.values(days)), low: Math.min(...pts) };
}

/* ---------- Dialog ---------- */
function openDlg(title, body, ok, fn) {
  dlg.innerHTML = `<form id="f"><h2>${title}</h2>${body}<div class="row"><button type="button" class="btn ghost" data-act="close">Batal</button><button class="btn">${ok}</button></div></form>`;
  onSub = fn; dlg.showModal();
}
const fld = (l, n, a = "") => `<label>${l}</label><input name="${n}" ${a} required>`;
const mfld = (l, n, v = "") => fld(l, n, `inputmode="numeric" data-money placeholder="0" autocomplete="off" value="${v}"`);

function newAccount() {
  openDlg("Buat akun",
    fld("Nama akun", "name", `value="Akun ${S.accounts.length + 1}" autocomplete="off"`) + mfld("Saldo awal (IDR)", "start", "10.000.000") +
    `<div class="two"><div>${fld("Profit target (%)", "profP", 'type="number" step="any" min="0" value="8"')}</div><div>${fld("Min trading days", "minD", 'type="number" min="0" value="5"')}</div>
     <div>${fld("Daily loss (%)", "dailyP", 'type="number" step="any" min="0" value="5"')}</div><div>${fld("Max loss (%)", "maxP", 'type="number" step="any" min="0" value="10"')}</div></div>`,
    "Buat akun", (f) => {
      const start = money(f.get("start")); if (!start) return false;
      const id = Date.now(); S.accounts.push({ id, name: f.get("name").trim(), start, profP: +f.get("profP"), dailyP: +f.get("dailyP"), maxP: +f.get("maxP"), minD: +f.get("minD"), trades: [] });
      save(); location.hash = `#/account/${id}/overview`;
    });
}

function addTrade(a, date) {
  openDlg("Catat trade",
    fld("Tanggal", "date", `type="date" value="${date || today()}"`) + fld("Pair", "pair", 'placeholder="XAUUSD, EURUSD…" autocomplete="off"') +
    `<label>Posisi</label><select name="side"><option>Buy</option><option>Sell</option></select>` + mfld("Hasil (IDR)", "amount") +
    `<div class="seg"><input type="radio" name="type" id="tp" value="p" checked><label class="p" for="tp">Profit</label><input type="radio" name="type" id="tl" value="l"><label class="l" for="tl">Minus</label></div>`,
    "Simpan", (f) => {
      const v = money(f.get("amount")); if (!v) return false;
      a.trades.push({ id: Date.now(), date: f.get("date"), pair: f.get("pair").trim().toUpperCase(), side: f.get("side"), amount: f.get("type") === "l" ? -v : v });
      save(); route();
    });
}

/* ---------- Halaman ---------- */
const bar = (p, bad) => `<div class="bar ${bad ? "bad" : ""}"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`;
const tabs = (id, t) => `<div class="tabs">${["overview", "calendar", "history"].map((x) => `<a href="#/account/${id}/${x}" class="${x === t ? "on" : ""}">${x[0].toUpperCase() + x.slice(1)}</a>`).join("")}</div>`;

function pAccounts() {
  const list = S.accounts.map((a) => ({ a, c: calc(a) })).filter((x) => filt === "Semua" || x.c.status === filt);
  return `<div class="head"><h1>Accounts</h1><button class="btn" data-act="newAcc">+ Buat akun</button></div>
  <div class="chips">${["Semua", "Active", "Passed", "Breached"].map((f) => `<button class="chip ${f === filt ? "on" : ""}" data-act="filt" data-v="${f}">${f}</button>`).join("")}</div>
  ${list.length ? list.map(({ a, c }) => `<article class="acc"><div class="badge"><small>${esc(a.name)}</small><b>Rp ${short(a.start).replace("+", "")}</b></div>
    <div class="accbody"><span class="lbl">Current Balance</span><strong>${cu(c.bal, "idr")}</strong>
    <div class="tags"><span class="tag ${c.profit >= 0 ? "win" : "lose"}">${c.profit >= 0 ? "Profit" : "Loss"}: ${sg(c.profit)}</span><span class="tag">${c.n} Trades</span><span class="tag ${c.status}">${c.status}</span></div></div>
    <a class="btn sm" href="#/account/${a.id}/overview">View details</a></article>`).join("")
    : `<div class="empty">${S.accounts.length ? "Tidak ada akun dengan status ini." : "Belum ada akun. Klik “+ Buat akun” untuk mulai."}</div>`}`;
}

function chart(a, c) {
  const lo = a.start * (1 - a.maxP / 100), hi = a.start + c.target, all = [...c.pts, lo, hi];
  let mn = Math.min(...all), mx = Math.max(...all); const p = (mx - mn) * 0.08 || 1; mn -= p; mx += p;
  const W = 640, H = 220, X = (i) => 8 + (c.pts.length > 1 ? i / (c.pts.length - 1) : 0) * (W - 16), Y = (v) => H - ((v - mn) / (mx - mn)) * H;
  const ln = (v, k, t) => `<line class="ln ${k}" x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tx ${k}" x="${W - 4}" y="${Y(v) - 5}" text-anchor="end">${t}</text>`;
  const last = c.pts.length - 1, P = c.pts.map((v, i) => X(i) + "," + Y(v)).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${ln(hi, "g", "Profit target " + idr(hi))}${ln(lo, "r", "Max loss " + idr(lo))}
  <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7a5f" stop-opacity=".28"/><stop offset="1" stop-color="#0e7a5f" stop-opacity="0"/></linearGradient></defs><polygon class="ar" fill="url(#ar)" points="${P} ${X(last)},${H} ${X(0)},${H}"/><polyline class="pl" pathLength="1" fill="none" stroke="#0e7a5f" stroke-width="2.5" stroke-linejoin="round" points="${P}"/><circle class="ring" cx="${X(last)}" cy="${Y(c.pts[last])}" r="4"/><circle class="dot" cx="${X(last)}" cy="${Y(c.pts[last])}" r="5"/></svg>`;
}

function pOverview(a, c) {
  const dl = a.start * a.dailyP / 100, ml = a.start * a.maxP / 100, dd = Math.max(0, a.start - c.low);
  return `${c.breach ? `<div class="alert">${c.breach}</div>` : ""}
  <div class="objs">
   <div class="obj"><span class="lbl">Profit target (${a.profP}%)</span><strong>${idr(c.target)}</strong>${bar((c.profit / c.target) * 100)}<small>Hasil: ${sg(c.profit)}</small></div>
   <div class="obj"><span class="lbl">Min trading days</span><strong>${a.minD} Hari</strong>${bar(a.minD ? (c.nd / a.minD) * 100 : 100)}<small>Hasil: ${c.nd} Hari</small></div>
   <div class="obj"><span class="lbl">Daily loss limit (-${a.dailyP}%)</span><strong>${idr(dl)}</strong>${bar((-c.worstDay / dl) * 100, 1)}<small>Hari terburuk: ${idr(c.worstDay)}</small></div>
   <div class="obj"><span class="lbl">Max loss limit (-${a.maxP}%)</span><strong>${idr(ml)}</strong>${bar((dd / ml) * 100, 1)}<small>Drawdown: ${idr(dd)}</small></div></div>
  <div class="ov"><section class="card"><h2>Account Status</h2><span class="muted">Equity per trade</span>${chart(a, c)}</section>
  <aside class="card"><div class="bal"><span class="lbl">Current balance</span><span class="big">${cu(c.bal, "idr")}</span></div>
   <div class="kv"><span class="muted">Initial balance</span><b>${idr(a.start)}</b></div><div class="kv"><span class="muted">Equity</span><b>${idr(c.bal)}</b></div>
   <div class="kv"><span class="muted">Profit/Loss</span><b class="${c.profit >= 0 ? "pos" : "neg"}">${sg(c.profit)}</b></div></aside></div>`;
}

function pCalendar(a, c) {
  const y = cal.getFullYear(), m = cal.getMonth(), off = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const cnt = {}; a.trades.forEach((t) => (cnt[t.date] = (cnt[t.date] || 0) + 1));
  let cells = '<div class="day void"></div>'.repeat(off);
  for (let d = 1; d <= dim; d++) {
    const k = ds(y, m, d), wd = (off + d - 1) % 7 > 4, s = c.days[k];
    cells += `<button class="day ${wd ? "off" : ""} ${k === today() ? "today" : ""} ${s > 0 ? "win" : s < 0 ? "lose" : ""}" data-act="dayAdd" data-v="${k}"><b>${pad(d)}</b>
    ${cnt[k] ? `<small>${cnt[k]}<span class="tw"> Trades</span><span class="tx">x</span></small><span class="r">${short(s)}</span>` : wd ? '<small class="wkd">Weekend</small>' : ""}</button>`;
  }
  return `<div class="cal-head"><h2>Trading Calendar</h2><div><button class="icon" data-act="prev">&#8249;</button> <b style="margin:0 10px">${BLN[m]} ${y}</b> <button class="icon" data-act="next">&#8250;</button></div></div>
  <div class="wk">${HARI.map((h) => `<span>${h.slice(0, 3)}</span>`).join("")}</div><div class="dg">${cells}</div>`;
}

function pHistory(a, c) {
  const g = {}; c.t.forEach((t) => (g[t.date] ||= []).push(t));
  return `<h2 style="margin-bottom:14px">Trading History</h2><div class="stats">
  <div class="card"><span class="lbl">Balance</span><strong>${cu(c.bal, "idr")}</strong></div>
  <div class="card"><span class="lbl">Profit Factor</span><strong>${c.pf === null ? "-" : c.pf.toFixed(2)}</strong></div>
  <div class="card"><span class="lbl">Win Rate</span><strong>${c.n ? ((c.wins / c.n) * 100).toFixed(2) : "0.00"}%</strong></div>
  <div class="card"><span class="lbl">Avg Profit / Avg Loss</span><strong>${c.avgL ? (c.avgW / c.avgL).toFixed(2) : "-"}</strong></div>
  <div class="card"><span class="lbl">Total Trades</span><strong>${c.n}</strong></div></div>
  ${Object.keys(g).sort().reverse().map((d) => `<div class="grp"><h3>${d}<small>Total Trades: ${g[d].length}</small></h3>${g[d].map((t) =>
    `<div class="tr"><b>${esc(t.pair || "-")}</b><span class="side-tag ${t.side}">${t.side}</span><b class="${t.amount >= 0 ? "pos" : "neg"}">${sg(t.amount)}</b><button class="x" data-act="delTrade" data-v="${t.id}" aria-label="Hapus">&times;</button></div>`).join("")}</div>`).join("")
    || '<div class="empty">Belum ada trade.</div>'}`;
}

function pDetail(id, tab) {
  const a = S.accounts.find((x) => x.id == id); if (!a) return (location.hash = "#/accounts");
  const c = calc(a), body = tab === "calendar" ? pCalendar(a, c) : tab === "history" ? pHistory(a, c) : pOverview(a, c);
  return `<div class="crumb"><a href="#/accounts">Accounts</a> / Account Overview</div>
  <div class="head"><div><h1>${esc(a.name)}</h1><span class="tag ${c.status}">${c.status}</span> <span class="muted">Saldo awal ${idr(a.start)}</span></div>
  <div><button class="btn" data-act="addTrade" data-id="${a.id}">+ Catat trade</button> <button class="link" data-act="delAcc" data-id="${a.id}">Hapus akun</button></div></div>${tabs(a.id, tab)}${body}`;
}

const SEAL = `<svg class="seal" viewBox="0 0 100 120" aria-hidden="true"><polygon points="30,80 18,118 38,108 50,118 50,84" fill="#8a1c2b"/><polygon points="70,80 82,118 62,108 50,118 50,84" fill="#a82a3b"/><circle cx="50" cy="48" r="44" fill="#c9a24b"/><circle cx="50" cy="48" r="38" fill="none" stroke="#fff6d6" stroke-width="1.5" stroke-dasharray="2 3"/><circle cx="50" cy="48" r="31" fill="#e3c372"/><polygon points="50,24 56,40 73,41 60,52 64,69 50,60 36,69 40,52 27,41 44,40" fill="#fff6d6" stroke="#a37d2a" stroke-width="1"/></svg>`;

function pCerts() {
  const ok = S.accounts.map((a) => ({ a, c: calc(a) })).filter((x) => x.c.status === "Passed"), nm = esc(S.trader || "Nama Trader");
  return `<div class="head"><h1>Certificates</h1><button class="btn ghost" data-act="setName">${S.trader ? "Ubah" : "Atur"} nama trader</button></div>` + (ok.length ? ok.map(({ a, c }) => `
  <section class="cert"><i class="co k1"></i><i class="co k2"></i><i class="co k3"></i><i class="co k4"></i><div class="cin">
   <span class="eyebrow">Jurnal Trading &middot; Prop Challenge</span>
   <h2 class="ctitle">Certificate of Achievement</h2>
   <p class="csub">Dengan bangga diberikan kepada</p>
   <div class="cname">${nm}</div><div class="cline"></div>
   <p class="csub">atas keberhasilan mencapai target profit ${a.profP}% pada akun <b>${esc(a.name)}</b><br>tanpa melanggar batas daily loss maupun max loss.</p>
   <div class="cstats"><div><b>${cu(c.profit, "sg")}</b><span>Total profit</span></div><div><b>${c.nd}</b><span>Hari trading</span></div><div><b>${cu(c.bal, "idr")}</b><span>Saldo akhir</span></div></div>
   <div class="cfoot"><div><b>${c.passDate || "-"}</b><span>Tanggal lolos</span></div>${SEAL}<div><b>JT-${String(a.id).slice(-6)}</b><span>Nomor sertifikat</span></div></div></div></section>`).join("") + '<button class="btn" data-act="print">Simpan PDF / Cetak</button>'
    : '<div class="empty">Belum ada sertifikat. Akun yang mencapai profit target dan min trading days tanpa breach akan muncul di sini.</div>');
}

function pRules() {
  return `<div class="head"><h1>Rules Trading</h1></div><form class="rform" data-form="rule"><input name="r" placeholder="Tulis aturan trading kamu…" autocomplete="off" required><button class="btn">Tambah</button></form>
  ${S.rules.map((r, i) => `<div class="rule"><b>${i + 1}.</b><span>${esc(r.text)}</span><button class="link" data-act="delRule" data-v="${r.id}">Hapus</button></div>`).join("") || '<div class="empty">Belum ada aturan. Tulis aturan pribadi kamu, misalnya “Maksimal 3 trade per hari”.</div>'}`;
}

/* ---------- Router ---------- */
function route() {
  const [, p = "accounts", id, tab = "overview"] = location.hash.split("/");
  document.querySelectorAll("#nav a").forEach((l) => l.classList.toggle("on", l.dataset.p === (p === "account" ? "accounts" : p)));
  $("#view").innerHTML = p === "account" ? pDetail(id, tab) : p === "certificates" ? pCerts() : p === "rules" ? pRules() : pAccounts();
  fx();
}
addEventListener("hashchange", route);

/* ---------- Event ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const v = b.dataset.v, a = S.accounts.find((x) => x.id == (b.dataset.id || location.hash.split("/")[2]));
  ({
    close: () => dlg.close(), newAcc: newAccount, setName: () => openDlg("Nama trader", fld("Nama lengkap", "n", `value="${esc(S.trader || "")}" autocomplete="off"`), "Simpan", (f) => { S.trader = f.get("n").trim(); save(); route(); }), print: () => print(),
    filt: () => { filt = v; route(); },
    prev: () => { cal.setMonth(cal.getMonth() - 1); route(); }, next: () => { cal.setMonth(cal.getMonth() + 1); route(); },
    addTrade: () => addTrade(a), dayAdd: () => addTrade(a, v),
    delTrade: () => { a.trades = a.trades.filter((t) => t.id != v); save(); route(); },
    delAcc: () => { if (confirm("Hapus akun ini beserta semua trade-nya?")) { S.accounts = S.accounts.filter((x) => x !== a); save(); location.hash = "#/accounts"; } },
    delRule: () => { S.rules = S.rules.filter((r) => r.id != v); save(); route(); },
  })[b.dataset.act]?.();
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "f") { if (onSub(new FormData(e.target)) !== false) dlg.close(); }
  else if (e.target.dataset.form === "rule") { S.rules.push({ id: Date.now(), text: new FormData(e.target).get("r").trim() }); save(); route(); }
});
document.addEventListener("input", (e) => {
  if (e.target.dataset.money !== undefined) { const d = e.target.value.replace(/\D/g, ""); e.target.value = d ? Number(d).toLocaleString("id-ID") : ""; }
});
route();

/* ===== PWA: tombol install + service worker ===== */
let dip = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); dip = e; $("#install").hidden = false; });
$("#install").addEventListener("click", async () => { if (!dip) return; dip.prompt(); await dip.userChoice; dip = null; $("#install").hidden = true; });
addEventListener("appinstalled", () => { $("#install").hidden = true; });
const iosDev = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (iosDev && !standalone) $("#iosHint").hidden = false;
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
