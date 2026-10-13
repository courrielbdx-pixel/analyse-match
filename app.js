/* Analyse Match v6 — interface. Aucune clé, aucun appel hors DATA_BASE_URL. */
(function () {
  "use strict";
  const L = window.AMLogic, C = window.AM_CONFIG;
  const Q = new URLSearchParams(location.search);
  const SAMPLE = Q.get("data") === "sample", EMPTY = Q.get("data") === "empty", VARIANT = Q.get("variant") || "";
  const BASE = SAMPLE ? "sample-data" : EMPTY ? "sample-data/vide" : C.DATA_BASE_URL;
  const MODE = SAMPLE ? "sample" : EMPTY ? "empty" : "real";
  const NOW_FIXED = Q.get("now") ? Date.parse(Q.get("now")) : null, T0 = Date.now();
  const now = () => new Date(NOW_FIXED != null ? NOW_FIXED + (Date.now() - T0) : Date.now());
  const $app = document.getElementById("app");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const REGIONS = [["toutes", "Toutes"], ["france", "France"], ["uefa", "UEFA"], ["europe", "Europe"], ["ameriques", "Amériques"], ["asie_oceanie", "Asie / Océanie"], ["monde", "Monde"]];
  const TRIG = { matin: "Matin", soir: "Soir", compo: "Compo", manuel: "Manuel" };
  // ---------------- stockage ----------------
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { diag.anomalies.push("Stockage local plein : " + e.message); } }
  };
  const prefs = Object.assign({ view: "affiches", region: "toutes", n: 10, date: null }, LS.get("am.v6.prefs", {}));
  const savePrefs = () => LS.set("am.v6.prefs", prefs);
  let suivis = LS.get("am.v6.suivis", {});
  const saveSuivis = () => LS.set("am.v6.suivis", suivis);
  // ---------------- diagnostic ----------------
  const diag = { files: {}, hosts: {}, anomalies: [], finalAnomalies: [], cohAnomalies: [], bilanDiff: [], validation: [] };
  // ---------------- données ----------------
  const state = { meta: null, metaErr: null, offline: false, e3: false, data: {}, lastMetaAt: 0, loadedStamps: {} };
  function mapPath(p) {
    if (VARIANT === "mismatch" && p === "results/bilan.json") return "results/bilan_mismatch.json";
    if (VARIANT === "v7" && p === "meta.json") return "meta_v7.json";
    if (VARIANT === "big" && /^fixtures\/2026-10-12\.json$/.test(p)) return "fixtures/2026-10-12_big.json";
    return p;
  }
  const cacheKey = p => `am.v6.cache.${MODE === "real" ? "real" : MODE}.${p}`;
  async function fetchJSON(path) {
    const bust = /^https?:/.test(BASE) && (path === "meta.json" || path.startsWith("live/") || path.startsWith("combine/")) ? `?t=${Math.floor(Date.now() / 60e3)}` : "";
    const url = `${BASE}/${mapPath(path)}${bust}`; let host;
    try { host = new URL(url, location.href).host; } catch (e) { host = "?"; }
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 10000);
      try {
        diag.hosts[host] = (diag.hosts[host] || 0) + 1;
        const r = await fetch(url, { cache: "no-cache", signal: ctl.signal }); clearTimeout(to);
        if (r.status === 404) { diag.files[path] = { url, status: 404, at: new Date().toISOString() }; return { status: 404, data: cached(path) }; }
        if (!r.ok) throw new Error("HTTP " + r.status);
        let j; try { j = await r.json(); } catch (e) { diag.files[path] = { url, status: r.status, at: new Date().toISOString(), error: "JSON illisible" }; return { status: "e3", data: cached(path) }; }
        diag.files[path] = { url, status: r.status, generated_at: j && j.generated_at, at: new Date().toISOString() };
        if (!L.schemaOk(j)) return { status: "e3", data: cached(path), got: j && j.schema_version };
        LS.set(cacheKey(path), { at: Date.now(), data: j }); state.offline = false;
        return { status: 200, data: j };
      } catch (e) { clearTimeout(to); lastErr = e; }
    }
    diag.files[path] = { url, status: "réseau", at: new Date().toISOString(), error: String(lastErr) };
    state.offline = true; return { status: "offline", data: cached(path) };
  }
  function cached(path) { const c = LS.get(cacheKey(path), null); return c ? c.data : null; }
  function cachedAt(path) { const c = LS.get(cacheKey(path), null); return c ? c.at : null; }
  async function loadMeta() {
    const r = await fetchJSON("meta.json"); state.lastMetaAt = Date.now();
    state.e3 = r.status === "e3"; state.metaStatus = r.status; state.meta = r.data;
    return r;
  }
  async function loadDate(d, force) {
    const m = state.meta; const stamps = m && m.files && m.files[d] || {};
    const cur = state.data[d] || {}; const out = Object.assign({}, cur);
    for (const kind of ["fixtures", "picks", "live", "combine"]) {
      const key = `${kind}/${d}.json`;
      if (!force && cur[kind + "_loaded"] && state.loadedStamps[key] === stamps[kind]) continue;
      if (kind !== "fixtures" && m && m.files && m.files[d] && !stamps[kind] && !force) { out[kind] = null; out[kind + "_status"] = 404; out[kind + "_loaded"] = true; continue; }
      const r = await fetchJSON(key);
      out[kind] = r.data; out[kind + "_status"] = r.status; out[kind + "_loaded"] = true; state.loadedStamps[key] = stamps[kind];
      if (r.status === "e3") state.e3 = true;
    }
    state.data[d] = out; return out;
  }
  function fixturesOf(d) {
    const x = state.data[d] || {}; const fx = x.fixtures && x.fixtures.fixtures || [];
    const live = {}; for (const l of (x.live && x.live.live) || []) live[l.fixture_id] = l;
    const picks = {}; for (const p of (x.picks && x.picks.picks) || []) picks[p.fixture_id] = p;
    const out = [];
    for (const f of fx) {
      const miss = L.validFixture(f);
      if (miss.length) { note(diag.validation, `fixtures/${d} : match ${f && f.fixture_id} ignoré (champs manquants : ${miss.join(", ")})`); continue; }
      if (f.bettable !== true) continue;
      const g = L.mergeLive(f, live[f.fixture_id], x.fixtures.generated_at);
      g._pick = picks[f.fixture_id] || null; g._date = d; out.push(g);
    }
    return out;
  }
  const note = (arr, s) => { if (!arr.includes(s)) arr.push(s); };
  function finalOf(f) {
    if (!f._pick) return null; const fr = L.finalReading(f._pick, f.kickoff);
    if (fr.anomaly) note(diag.finalAnomalies, `Match ${f.fixture_id} : ${fr.anomaly}`);
    return fr;
  }
  // ---------------- composants ----------------
  function logo(t, cls) {
    const ok = t && t.logo && allowedImg(t.logo);
    const ini = esc((t && t.name || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase());
    return ok ? `<img class="${cls || "lg"}" src="${esc(t.logo)}" alt="" loading="lazy" width="20" height="20" data-ini="${ini}">`
      : `<span class="${cls || "lg"} ini" aria-hidden="true">${ini}</span>`;
  }
  function allowedImg(u) { try { const x = new URL(u, location.href); return x.host === location.host || (C.ALLOWED_IMAGE_HOSTS || []).includes(x.host); } catch (e) { return false; } }
  const paperOn = () => { const m = state.meta; const b = state.bilan; if (!m) return true; const th = m.thresholds && m.thresholds.paper_min_tickets || 300; return b ? L.paperCount(b.settled, m.method.version) < th : true; };
  function badge(r, small) {
    if (!r) return `<span class="badge none">pas encore lu</span>`;
    const t = r.label === "TICKET";
    return `<span class="badge ${t ? "tk" : "sk"}">${t ? "TICKET" : "SKIP"}${t && paperOn() ? ` <em>papier</em>` : ""}</span>` +
      (small ? ` <span class="sel">${esc(L.shortSel(r.pick.market, r.pick.selection))} ${L.pct(r.model_probability)}</span>` : "");
  }
  function star(f) {
    const on = !!suivis[f.fixture_id]; const nm = `${f.home.name} – ${f.away.name}`;
    return `<button class="star${on ? " on" : ""}" data-star="${f.fixture_id}" aria-pressed="${on}" aria-label="${on ? "Ne plus suivre" : "Suivre"} ${esc(nm)}">${on ? "★" : "☆"}</button>`;
  }
  function leagueLabel(f) { return `${esc(f.league.name)} · ${esc(f.league.country)}`; }
  function row(f, une) {
    const fr = finalOf(f); const r = fr && fr.reading;
    const fin = L.FINISHED.includes(f.status.short), live = L.LIVE.includes(f.status.short);
    let res = "";
    if (fin && r) { const o = L.outcome(r.pick.market, r.pick.selection, f.score.home, f.score.away, f.score.ht); res = o === "won" ? `<span class="res ok" aria-label="pick gagné">✓</span>` : o === "lost" ? `<span class="res ko" aria-label="pick perdu">✗</span>` : ""; }
    return `<li class="row" data-open="${f.fixture_id}" data-date="${f._date}">
      <a class="rowlink" href="#/match/${f.fixture_id}?d=${f._date}">
        <span class="time${live ? " live" : ""}${fin ? " fin" : ""}">${live && f.score && f.score.home != null ? `<span class="sc">${f.score.home}-${f.score.away}</span><span class="mn">${f.status.short === "HT" ? "MT" : f.status.elapsed != null ? f.status.elapsed + "'" : ""}</span>` : esc(L.statusText(f))}${(live || fin || f.status.short === "HT") ? `<span class="ko">${L.hm(f.kickoff)}</span>` : ""}</span>
        <span class="mid">
          <span class="lgl"><span class="cc">${esc(f.league.country_code || "")}</span> ${leagueLabel(f)}${une ? ` <span class="une">À la une</span>` : ""}</span>
          <span class="tm">${logo(f.home)}<span class="nm">${esc(f.home.name)}</span></span>
          <span class="tm">${logo(f.away)}<span class="nm">${esc(f.away.name)}</span></span>
          <span class="bd">${badge(r, true)}${r && r.lineups_confirmed ? ` <span class="compo">compo ✓</span>` : ""}${res}</span>${altLine(r, true)}${valLine(r, true)}
        </span>
      </a>${star(f)}</li>`;
  }
  function banners() {
    const out = []; const m = state.meta;
    if (SAMPLE) out.push(`<div class="banner sample">DONNÉES D'EXEMPLE</div>`);
    if (state.offline) { const at = cachedAt("meta.json"); out.push(`<div class="banner warn" role="status">Hors ligne — données du ${at ? fmtDT(new Date(at)) : "—"}.</div>`); }
    if (state.e3) { const at = cachedAt("meta.json"); out.push(`<div class="banner err" role="alert">Format de données non reconnu — affichage des dernières données valides du ${at ? fmtDT(new Date(at)) : "—"}.</div>`); }
    if (m && !state.offline) { const st = L.staleText(now(), m.generated_at); if (st) out.push(`<div class="banner warn">Dernière mise à jour il y a ${st}.</div>`); }
    if (m && m.engine_status && m.engine_status.level !== "ok") out.push(`<div class="banner warn">Moteur d'analyse : ${esc(m.engine_status.message_fr || m.engine_status.level)}</div>`);
    return out.join("");
  }
  const fmtDT = d => { const p = L.paris(d); const dl = L.dayLabel(p.date); return `${dl.day} ${dl.month} ${p.time}`; };
  const RUNT = { matin: "matin", compo: "compo", live: "live", reglement: "règlement", calendrier: "calendrier", manuel: "manuel", soir: "soir" };
  function header() {
    const m = state.meta; let upd = "";
    if (m) { const g = new Date(m.generated_at); const ago = L.durationText(Math.max(0, now() - g)); upd = `Données mises à jour à ${L.paris(g).time} (${esc(RUNT[m.run && m.run.type] || m.run && m.run.type || "")}) · il y a ${ago}`; }
    return `<header class="top"><h1>Analyse Match</h1><div class="sub">Bureau · v${esc(C.APP_VERSION)}</div><div class="upd">${upd}</div></header>${banners()}`;
  }
  // ---------------- Agenda ----------------
  async function agenda() {
    const m = state.meta; const bar = L.dateBar(now()); const today = L.paris(now()).date;
    const avail = m && m.dates_available || [];
    if (!prefs.date || !avail.includes(prefs.date) || !bar.includes(prefs.date)) prefs.date = today;
    const d = prefs.date;
    if (m) await loadDate(d);
    const fx = fixturesOf(d); const reg = prefs.region;
    const d1 = L.addDays(d, 1); if (m && avail.includes(d1)) await loadDate(d1);
    const aff = L.affiches(fx, d, reg, prefs.n), hr = L.heure(fx, d, reg), nt = L.nuit(fixturesOf(d1), d1, reg); // « Nuit » = la nuit qui suit (00h–08h du lendemain)
    const dl1 = L.dayLabel(d1); const nuitTitle = `Cette nuit (${dl1.wd} ${dl1.day} ${dl1.month}, 00h–08h)`;
    const sp = L.suivisSplit(suivis, now()); if (sp.purge.length) { for (const id of sp.purge) delete suivis[id]; saveSuivis(); }
    const regOK = s => reg === "toutes" || s.region === reg;
    const act = sp.active.filter(regOK), arch = sp.archived.filter(regOK);
    const counts = { affiches: aff.rows.length, heure: hr.length, nuit: nt.length, suivis: act.length };
    const dates = bar.map(x => { const l = L.dayLabel(x); const on = avail.includes(x);
      return `<button class="dt${x === d ? " sel" : ""}${x === today ? " today" : ""}" ${on ? `data-date="${x}"` : "disabled"} aria-pressed="${x === d}"><span>${l.wd}</span><b>${l.day}</b></button>`; }).join("");
    const views = [["affiches", "Affiches"], ["heure", "Heure"], ["nuit", "Nuit"], ["suivis", "Suivis"]].map(([k, n]) =>
      `<button class="vt${prefs.view === k ? " sel" : ""}" data-view="${k}" aria-pressed="${prefs.view === k}">${n} <span class="cnt">${counts[k]}</span></button>`).join("");
    const regs = `<select class="reg" id="region" aria-label="Région">${REGIONS.map(([k, n]) => `<option value="${k}"${k === reg ? " selected" : ""}>${n}</option>`).join("")}</select>`;
    let body = "";
    const x = state.data[d] || {};
    if (!m) body = `<p class="empty">Données pas encore publiées. Dernière mise à jour : —.</p>`;
    else if (x.fixtures_status === 404 && !x.fixtures) body = `<p class="empty">Données pas encore publiées pour le ${fmtDate(d)}. Dernière mise à jour : ${L.paris(new Date(m.generated_at)).time}.</p>`;
    else if (prefs.view === "affiches") {
      body = `<div class="nsel" role="group" aria-label="Nombre d'affiches">${[10, 20, 30].map(n => `<button data-n="${n}" class="${prefs.n === n ? "sel" : ""}" aria-pressed="${prefs.n === n}">${n}</button>`).join("")}</div>`;
      if (aff.available < prefs.n) body += `<p class="note">${aff.available} affiches disponibles (sur ${prefs.n} demandées)</p>`;
      body += list(aff.rows, aff.une);
    } else if (prefs.view === "heure") {
      let h = ""; body = `<ul class="list">` + hr.map(f => { const hh = L.hm(f.kickoff); const sep = hh !== h ? `<li class="sep">${hh}</li>` : ""; h = hh; return sep + row(f); }).join("") + `</ul>`;
      if (!hr.length) body += `<p class="empty">Aucun match.</p>`;
    } else if (prefs.view === "nuit") body = nt.length ? `<p class="sep">${nuitTitle}</p>` + list(nt) : "";
    else body = suivisView(act, arch);
    if ((prefs.view === "heure" || prefs.view === "affiches") && nt.length) body += `<h3 class="sep nuit">${nuitTitle}</h3>` + list(nt);
    if ((prefs.view === "nuit" && !nt.length) || (prefs.view === "affiches" && !aff.rows.length)) body += `<p class="empty">Aucun match.</p>`;
    if ((prefs.view === "affiches" || prefs.view === "heure") && x.fixtures) body = combineCard(x.combine && x.combine.combine) + body + funCard(x.combine && x.combine.fun);
    if (x.picks_status === 404 && prefs.view !== "suivis" && x.fixtures) body = `<p class="note">Lectures pas encore publiées pour le ${fmtDate(d)}.</p>` + body;
    $app.innerHTML = header() + `<nav class="dates" aria-label="Dates">${dates}</nav><div class="views">${views}</div><div class="filters">${regs}</div><section id="list">${body}</section>`;
    restoreScroll();
  }
  const fmtDate = d => { const l = L.dayLabel(d); return `${l.wd} ${l.day} ${l.month}`; };
  function list(rows, une) { return rows.length ? `<ul class="list">${rows.map(f => row(f, une === f.fixture_id)).join("")}</ul>` : ""; }
  function suivisView(act, arch) {
    const showPast = !!prefs.showPast;
    const item = s => { const p = L.paris(s.kickoff); const dl = L.dayLabel(p.date);
      return `<li class="row"><a class="rowlink" href="#/match/${s.fixture_id}?d=${p.date}"><span class="time">${p.time}</span><span class="mid"><span class="lgl">${dl.wd} ${dl.day} · ${esc(s.league || "")}</span><span class="tm"><span class="nm">${esc(s.home)}</span></span><span class="tm"><span class="nm">${esc(s.away)}</span></span></span></a>
      <button class="star on" data-star="${s.fixture_id}" aria-pressed="true" aria-label="Ne plus suivre ${esc(s.home)} – ${esc(s.away)}">★</button></li>`; };
    let h = act.length ? `<ul class="list">${act.map(item).join("")}</ul>` : `<p class="empty">Aucun suivi actif.</p>`;
    h += `<label class="sw"><input type="checkbox" id="showPast"${showPast ? " checked" : ""}> Voir les suivis passés (7 jours)</label>`;
    if (showPast) h += arch.length ? `<ul class="list past">${arch.map(item).join("")}</ul>` : `<p class="empty">Aucun suivi passé.</p>`;
    h += `<div class="io"><button id="exp">Exporter mes suivis</button><label class="btn">Importer<input type="file" id="imp" accept="application/json,.json" hidden></label></div><p class="note" id="iomsg"></p>`;
    return h;
  }
  // ---------------- Page match ----------------
  async function matchPage(id, d) {
    const fid = +id; if (state.meta) await loadDate(d);
    const f = fixturesOf(d).find(x => x.fixture_id === fid);
    if (!f) { $app.innerHTML = header() + `<button class="back" id="back">← Retour</button><p class="empty">Match introuvable pour le ${fmtDate(d)}.</p>`; return; }
    let det = null;
    if (f.has_details) { const r = await fetchJSON(`details/${fid}.json`); det = r.status === 200 || r.data ? r.data : null; }
    const fr = finalOf(f); const r = fr && fr.reading; const p = L.paris(f.kickoff);
    const sc = (L.FINISHED.includes(f.status.short) || L.LIVE.includes(f.status.short)) ? `<div class="score">${f.score.home} - ${f.score.away}</div>` : "";
    let h = `<button class="back" id="back">← Retour</button>
      <section class="mh"><div class="lgl">${leagueLabel(f)}${f.league.round ? " · " + esc(f.league.round) : ""}</div>
      <div class="when">${fmtDate(p.date)} · ${p.time}</div>
      <div class="teams"><div>${logo(f.home, "lgb")}<b>${esc(f.home.name)}</b></div>${sc}<div>${logo(f.away, "lgb")}<b>${esc(f.away.name)}</b></div></div>
      <div class="st">${esc(L.statusText(f))}${f.venue ? " · " + esc(f.venue) : ""}</div>${star(f)}</section>`;
    if (!r) {
      const begun = f.status.short !== "NS" && f.status.short !== "TBD" || Date.parse(f.kickoff) <= now().getTime();
      const nx = begun ? null : L.nextReading(f.kickoff, now());
      const txt = begun ? "Non analysé (match commencé avant la lecture)." : `Pas encore analysé.${nx ? ` Prochaine lecture prévue : ${fmtDT(nx)}.` : ""}`;
      h += `<section class="card"><p>${txt}</p>${copyBtn(f)}</section>`;
    } else {
      h += rapport(f, r, fr);
      h += history(fr.readings, r);
    }
    if (det) h += contexte(f, det) + classement(f, det);
    $app.innerHTML = header() + h; window.scrollTo(0, 0);
  }
  function altLine(r, short) {
    const x = r && r.label === "SKIP" && r.alt_pick; if (!x) return "";
    const o = x.odds ? ` · cote ${L.odds(x.odds)}` : "";
    return short ? `<span class="alt">Résultat : ${esc(L.shortSel(x.market, x.selection))} ${L.pct(x.model_probability)}${o}</span>`
                 : `<p class="alt">Côté résultat / BTTS : <b>${esc(x.label_fr)}</b> · ${L.pct(x.model_probability)} (marché ${L.pct(x.market_probability)})${x.odds ? ` · cote ${L.odds(x.odds)} (${esc(x.bookmaker)})` : ""}</p>`;
  }
  function valLine(r, short) {
    const x = r && r.label === "SKIP" && r.value_pick; if (!x) return "";
    const t = `${L.pct(x.model_probability)} · cote ${L.odds(x.odds)} · EV ${L.signedPct(x.ev)}`;
    return short ? `<span class="alt val">Valeur (info) : ${esc(L.shortSel(x.market, x.selection))} ${t}</span>`
                 : `<p class="alt val">Valeur (information, pas un ticket) : <b>${esc(x.label_fr)}</b> · ${t} (${esc(x.bookmaker)}) · marché ${L.pct(x.market_probability)}</p>`;
  }
  function combineCard(c) {
    const ci = L.combineInfo(c); const note = `<p class="muted cbn">Construit uniquement avec les TICKETs validés : la marge du bookmaker se multiplie à chaque sélection, un combiné de picks faibles perd donc plus vite.</p>`;
    if (ci.none) return `<section class="card combi"><h3>Combiné du jour</h3><p>${ci.text}.</p>${note}</section>`;
    const res = ci.outcome === "won" ? " · gagné ✓" : ci.outcome === "lost" ? " · perdu ✗" : "";
    const legs = ci.legs.map(l => `<li><a href="#/match/${l.fixture_id}?d=${esc(prefs.date || "")}">${L.hm(l.kickoff)} ${esc(l.home)} – ${esc(l.away)}</a><br><b>${esc(l.label_fr)}</b> · ${L.pct(l.prob)} · cote ${L.odds(l.odds)} (${esc(l.bookmaker)})${l.outcome === "won" ? " ✓" : l.outcome === "lost" ? " ✗" : ""}</li>`).join("");
    return `<section class="card combi"><h3>Combiné du jour 🔒${res}</h3><ul class="legs">${legs}</ul><p>Proba modèle combinée : <b>${L.pct(ci.p)}</b> · Cote totale : <b>${L.odds(ci.odds)}</b> · EV ${L.signedPct(ci.ev)}</p>${note}</section>`;
  }
  function funCard(fu) {
    if (fu && fu.none) return `<section class="card fun"><h3>Combiné fun 🎲</h3><p>Pas de combiné fun pour l'instant : ${fu.eligible} match(s) seulement passent les garde-fous (5 minimum : ≥ 20 matchs d'historique par équipe, modèle à ≤ 10 pts du marché).</p></section>`;
    if (!fu || !(fu.legs || []).length) return "";
    const ci = L.combineInfo(fu); const res = fu.outcome === "won" ? " · gagné ✓" : fu.outcome === "lost" ? " · perdu ✗" : "";
    const legs = fu.legs.map(l => `<li>${L.hm(l.kickoff)} ${esc(l.home)} – ${esc(l.away)} : <b>${esc(L.shortSel(l.market, l.selection))}</b> · ${l.market_prob != null ? L.pct(l.market_prob) : L.pct(l.prob)} · ${L.odds(l.odds)}${l.outcome === "won" ? " ✓" : l.outcome === "lost" ? " ✗" : ""}</li>`).join("");
    const gain = (fu.stake_eur || 0.1) * ci.odds;
    return `<section class="card fun"><h3>Combiné fun 🎲 🔒${res}</h3><p class="funlab">Pour le fun — mise symbolique ${L.nf(fu.stake_eur || 0.1, 2)} €. Hors bilan des tickets.</p>
      <details><summary>${fu.legs.length} sélections · cote totale ${L.nf(ci.odds, 1)} · gain possible ${L.nf(gain, 2)} €</summary><ul class="legs">${legs}</ul></details>
      ${fu.market_probability != null ? `<p>Chances de tout gagner : <b>${fu.market_probability < 0.001 ? "< 0,1 %" : L.pct(fu.market_probability)}</b> (selon les cotes sans marge)</p>` : ""}
      <p class="muted">Modèle : ${ci.p < 0.001 ? "< 0,1 %" : L.pct(ci.p)}</p></section>`;
  }
  function copyBtn(f) { return `<button class="copy" data-copy="Relance l'analyse du match ${f.fixture_id} ${esc(f.home.name)}–${esc(f.away.name)} (${esc(f.kickoff)}) — raison : ">Copier une demande de relecture</button>`; }
  function rapport(f, r, fr) {
    const chk = L.recheck(r, state.meta && state.meta.rules);
    if (!chk.ok) note(diag.cohAnomalies, `Match ${f.fixture_id} (${r.reading_id}) : ${chk.fails.map(x => x.id).join(", ")}`);
    const fin = L.FINISHED.includes(f.status.short);
    const ko = Date.parse(f.kickoff) - now();
    const hasCompo = fr.readings.some(x => x.trigger === "compo");
    let h = `<section class="card rap"><h2>Rapport</h2><div class="rb">${badge(r)} <b>${esc(r.pick.label_fr)}</b></div>
      <p><span class="tip" title="Probabilité calculée par le modèle Dixon-Coles pour cette sélection. Ce n'est pas une garantie.">Probabilité du modèle : ${L.pct(r.model_probability)}</span></p>
      <p class="muted">${esc(TRIG[r.trigger] || r.trigger)} · ${L.paris(r.timestamp).time} · Compos officielles : ${r.lineups_confirmed ? "oui" : "non"}</p>`;
    if (!hasCompo && ko > 0 && ko < 90 * 60e3 && fr.readings.some(x => x.trigger === "matin")) h += `<p class="note">En attente des compos officielles (relecture automatique par Grok Bot)</p>`;
    h += altLine(r, false) + valLine(r, false);
    const lat = r.label === "TICKET" ? L.laterReadings(fr) : [];
    if (lat.length) { const x = lat[lat.length - 1]; h += `<p class="muted relect">Relecture (info) ${L.paris(x.timestamp).time} : ${x.label} ${esc(x.pick.label_fr)} (${L.pct(x.model_probability)}) — le ticket officiel reste ${esc(r.pick.label_fr)}.</p>`; }
    if (r.label === "SKIP" && (r.skip_reasons_fr || []).length) h += `<ul class="reasons">${r.skip_reasons_fr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
    if ((r.reasoning_fr || []).length) h += `<ul class="reasoning">${r.reasoning_fr.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
    if (r.web_check && (r.web_check.items_fr || []).length) h += `<div class="web"><h3>Vérification web</h3><ul>${r.web_check.items_fr.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    if (r.odds_seen) h += `<p class="odds">cote vue ${L.odds(r.odds_seen.value)} (${esc(r.odds_seen.bookmaker)}) — information${r.ev != null ? ` · EV ${L.signedPct(r.ev)}` : ""}</p>`;
    if (fin) { const o = L.outcome(r.pick.market, r.pick.selection, f.score.home, f.score.away, f.score.ht); h += `<p class="final">Score final ${f.score.home}-${f.score.away} · Pick ${o === "won" ? "gagné ✓" : o === "lost" ? "perdu ✗" : "—"}</p>`; }
    else if (["CANC", "ABD", "AWD", "WO"].includes(f.status.short)) h += `<p class="final">Pick annulé</p>`;
    h += chk.ok ? `<p class="coh ok">Cohérence : ✓ contrôles passés</p>` : chk.fails.map(x => `<p class="coh ko">Incohérence détectée : ${esc(x.id)} — ${esc(x.detail_fr)}</p>`).join("");
    h += probaBlock(r);
    if (!hasCompo && !fin) h += copyBtn(f);
    return h + `</section>`;
  }
  function probaBlock(r) {
    const P = r.probabilities || {}; const lab = { "1X2": "1X2", "DC": "Double chance", "OU1.5": "± 1,5 buts", "OU2.5": "± 2,5 buts", "OU3.5": "± 3,5 buts", "BTTS": "Les deux marquent", "1X_O1.5": "1N & +1,5", "1X_BTTS": "1N & BTTS", "BTTS_O2.5": "BTTS & +2,5" };
    const rows = Object.keys(P).map(m => `<tr><th>${esc(lab[m] || m)}</th>${Object.entries(P[m]).map(([s, v]) => `<td class="${m === r.pick.market && s === r.pick.selection ? "hl" : ""}">${esc(L.shortSel(m, s))} ${L.pct(v)}</td>`).join("")}</tr>`).join("");
    const xg = r.expected_goals ? `<p>Buts attendus : ${L.nf(r.expected_goals.home, 2)} – ${L.nf(r.expected_goals.away, 2)}</p>` : "";
    const ts = (r.top_scores || []).length ? `<p>Scores les plus probables (indicatif) : ${r.top_scores.map(x => `${esc(x.score)} (${L.pct(x.p)})`).join(", ")}</p>` : "";
    return `<details class="probs"><summary>Probabilités du modèle</summary><div class="hscroll"><table>${rows}</table></div>${xg}${ts}</details>`;
  }
  function history(rs, fin) {
    let prev = null;
    const li = rs.map(r => {
      const sel = L.shortSel(r.pick.market, r.pick.selection);
      let ch = "";
      if (prev) { const pc = prev.pick.market !== r.pick.market || prev.pick.selection !== r.pick.selection, lc = prev.label !== r.label;
        if (pc || lc) ch = `<div class="chg">${pc ? `${esc(L.shortSel(prev.pick.market, prev.pick.selection))} → ${esc(sel)}` : ""}${pc && lc ? " · " : ""}${lc ? `${prev.label} → ${r.label}` : ""}${r.change_from_previous && r.change_from_previous.reason_fr ? ` — ${esc(r.change_from_previous.reason_fr)}` : ""}</div>`; }
      prev = r;
      return `<li${r === fin ? ' class="final"' : ""}>${esc(TRIG[r.trigger] || r.trigger)} · ${L.paris(r.timestamp).time} — ${esc(sel)} · ${r.label} · ${L.pct(r.model_probability)}${r === fin ? " — <i>Lecture finale</i>" : ""}${ch}</li>`;
    }).join("");
    return `<section class="card"><h2>Suivi des lectures <span class="cnt">${rs.length} lecture${rs.length > 1 ? "s" : ""}</span></h2><ol class="hist">${li}</ol></section>`;
  }
  function contexte(f, d) {
    const parts = [];
    if (d.form && (d.form.home || d.form.away)) {
      const fm = (x, rec, lab) => x ? `<div><b>${esc(lab)}</b> ${(x.last5 || []).map(c => `<span class="fm ${c}">${esc(c)}</span>`).join("")}${rec ? ` <span class="muted">${rec.w}V ${rec.d}N ${rec.l}D</span>` : ""}</div>` : "";
      parts.push(`<h3>Forme (5 derniers)</h3>${fm(d.form.home, d.form.home && d.form.home.home_record, f.home.name + " (dom.)")}${fm(d.form.away, d.form.away && d.form.away.away_record, f.away.name + " (ext.)")}`);
    }
    if (d.rest_days && (d.rest_days.home != null || d.rest_days.away != null)) parts.push(`<h3>Jours de repos</h3><p>${esc(f.home.name)} ${d.rest_days.home ?? "—"} · ${esc(f.away.name)} ${d.rest_days.away ?? "—"}</p>`);
    if (d.absences && ((d.absences.home || []).length || (d.absences.away || []).length)) {
      const a = (xs, n) => xs && xs.length ? `<p><b>${esc(n)}</b> : ${xs.map(x => `${esc(x.player)} (${esc(x.reason_fr || "")}${x.importance ? ", " + esc(x.importance) : ""})`).join(", ")}</p>` : "";
      parts.push(`<h3>Absences</h3>${a(d.absences.home, f.home.name)}${a(d.absences.away, f.away.name)}`);
    }
    if (d.lineups && d.lineups.confirmed) parts.push(`<h3>Compos officielles</h3><p><b>${esc(f.home.name)}</b>${d.lineups.formation_home ? " (" + esc(d.lineups.formation_home) + ")" : ""} : ${(d.lineups.home || []).map(esc).join(", ")}</p><p><b>${esc(f.away.name)}</b>${d.lineups.formation_away ? " (" + esc(d.lineups.formation_away) + ")" : ""} : ${(d.lineups.away || []).map(esc).join(", ")}</p>`);
    if ((d.h2h || []).length) parts.push(`<h3>Confrontations directes</h3><ul>${d.h2h.map(x => `<li>${esc(x.date)} · ${esc(x.home)} ${esc(x.score)} ${esc(x.away)}${x.competition ? " · " + esc(x.competition) : ""}</li>`).join("")}</ul>`);
    return parts.length ? `<section class="card ctx"><h2>Contexte</h2>${parts.join("")}</section>` : "";
  }
  function classement(f, d) {
    const s = d.standings; if (!s || !(s.table || []).length) return "";
    const ids = [f.home.id, f.away.id];
    return `<section class="card"><h2>Classement</h2><div class="hscroll"><table class="tbl"><thead><tr><th>#</th><th>Équipe</th><th>J</th><th>Diff.</th><th>Pts</th><th>Forme</th></tr></thead><tbody>${s.table.map(r =>
      `<tr class="${ids.includes(r.team_id) ? "hl" : ""}"><td>${r.rank}</td><td>${esc(r.team)}</td><td>${r.played}</td><td>${r.gd > 0 ? "+" : ""}${r.gd}</td><td><b>${r.points}</b></td><td>${esc(r.form || "")}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  // ---------------- Bilan ----------------
  async function bilanPage() {
    const r = await fetchJSON("results/bilan.json"); state.bilan = r.data; const m = state.meta;
    if (!m || !r.data) { $app.innerHTML = header() + `<h2 class="pt">Bilan</h2><p class="empty">Bilan pas encore publié.</p>`; return; }
    const hist = m.methods_history || [{ version: m.method.version, from: m.method.since, to: null }];
    const mv = prefs.method && hist.find(x => x.version === prefs.method) ? prefs.method : m.method.version;
    const mh = hist.find(x => x.version === mv) || { from: m.method.since };
    const today = L.paris(now()).date; const per = prefs.period || "debut";
    let from = null, to = null; // « depuis le début » = tous les picks réglés de la méthode
    if (per === "7") from = L.addDays(today, -6); if (per === "30") from = L.addDays(today, -29);
    if (per === "perso") { from = prefs.pfrom || from; to = prefs.pto || to; }
    const xs = L.filterSettled(r.data.settled, mv, from, to);
    const T = L.summarize(xs.filter(x => x.label === "TICKET")), S = L.summarize(xs.filter(x => x.label === "SKIP"));
    const th = m.thresholds || { paper_min_tickets: 300, min_sample_display: 30 }; const minN = th.min_sample_display || 30;
    const paperN = L.paperCount(r.data.settled, mv);
    const sel = `<div class="bsel"><label>Méthode <select id="method">${hist.map(x => `<option value="${esc(x.version)}"${x.version === mv ? " selected" : ""}>${esc(x.version)} (depuis le ${fmtFr(x.from)}${x.to ? " au " + fmtFr(x.to) : ""})</option>`).join("")}</select></label>
      <label>Période <select id="period">${[["7", "7 jours"], ["30", "30 jours"], ["debut", "Depuis le début de la méthode"], ["perso", "Plage personnalisée"]].map(([k, n]) => `<option value="${k}"${k === per ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      ${per === "perso" ? `<label>Du <input type="date" id="pfrom" value="${esc(prefs.pfrom || mh.from)}"></label><label>Au <input type="date" id="pto" value="${esc(prefs.pto || today)}"></label>` : ""}</div>`;
    let h = `<h2 class="pt">Bilan</h2>${sel}`;
    if (paperN < th.paper_min_tickets) h += `<div class="banner paper">Mode papier — échantillon insuffisant : ${paperN} / ${th.paper_min_tickets} tickets réglés. Ne pas considérer ces résultats comme une preuve.<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${th.paper_min_tickets}" aria-valuenow="${paperN}"><i data-w="${Math.min(100, paperN / th.paper_min_tickets * 100)}"></i></div></div>`;
    const sl = r.data.skip_lines; if (sl) {
      const nm = { probable: "Probable (ligne 1)", resultat: "Résultat (ligne 2)", valeur: "Valeur (ligne 3)" };
      const rows = ["probable", "resultat", "valeur"].map(k => { const x = sl[k] || {}; return `<tr><th>${nm[k]}</th><td>${x.n || 0}</td><td>${x.hit_rate == null ? "—" : L.pct(x.hit_rate)}</td><td>${x.avg_odds == null ? "—" : L.odds(x.avg_odds)}</td><td>${x.with_odds ? `${x.profit_eur >= 0 ? "+" : ""}${L.nf(x.profit_eur, 2)} € (${L.signedPct(x.roi)})` : "—"}</td></tr>`; }).join("");
      h += `<section class="card skipb"><h3>Bilan SKIP (info)</h3><p class="muted">Lignes affichées sur les matchs SKIP, figées au coup d'envoi. Simulation à 1 € par ligne, à part : ce n'est pas le bilan des tickets.</p><div class="hscroll"><table><tr><th></th><th>Paris</th><th>Réussite</th><th>Cote moy.</th><th>Profit / ROI</th></tr>${rows}</table></div><p class="muted">Profit calculé seulement quand une cote existait ; sinon la ligne compte pour la réussite uniquement.</p></section>`;
    }
    const fa = r.data.fun_aggregate; if (fa) h += `<section class="card fun"><h3>Combiné fun 🎲 (hors stats tickets)</h3><p>${fa.played} joué(s) · ${fa.won} gagné(s) sur ${fa.settled} réglé(s) · P/L papier à ${L.nf(fa.stake_eur, 2)} € : ${fa.pl_eur >= 0 ? "+" : ""}${L.nf(fa.pl_eur, 2)} €</p></section>`;
    const ca = r.data.combines_aggregate; if (ca) h += `<section class="card"><h3>Combiné du jour</h3><p>${ca.settled} réglé(s) sur ${ca.n} · réussite ${ca.hit_rate == null ? "—" : L.pct(ca.hit_rate)} · ROI papier ${ca.roi == null ? "—" : L.signedPct(ca.roi)} (${ca.pl_units >= 0 ? "+" : ""}${L.nf(ca.pl_units, 2)} u)</p></section>`;
    if (per === "debut") {
      const diffs = L.compareAggregates(L.summarize(L.filterSettled(r.data.settled, mv, null, null).filter(x => x.label === "TICKET")), L.summarize(L.filterSettled(r.data.settled, mv, null, null).filter(x => x.label === "SKIP")), r.data.aggregates && r.data.aggregates[mv]);
      diag.bilanDiff = diffs.map(x => `${mv} ${x.field} : ${x.detail}`);
      if (diffs.length) h += `<div class="banner err">Écart entre le bilan calculé et le bilan publié — voir <a href="#/diagnostic">/diagnostic</a></div>`;
    }
    // résumé du jour
    const all = L.filterSettled(r.data.settled, mv, null, null); const yd = L.addDays(today, -1);
    const day = d => { const z = all.filter(x => x.date === d); if (!z.length) return "Aucun pick réglé"; const t = L.summarize(z.filter(x => x.label === "TICKET")), s = L.summarize(z.filter(x => x.label === "SKIP"));
      return `Tickets ${t.n} (${t.won} G / ${t.lost} P, ${L.units(t.pl_units)}) · Skips ${s.n} (${s.won} G / ${s.lost} P, ${L.units(s.pl_units)})`; };
    h += `<section class="card"><p><b>Hier (${fmtFr(yd)})</b> : ${day(yd)}</p><p><b>Aujourd'hui</b> : ${day(today)}</p></section>`;
    if (!xs.length) { h += `<p class="empty">Aucun pick réglé pour ${esc(mv)} depuis le ${fmtFr(from || mh.from)}. Le bilan se remplira après les premiers matchs.</p>`; $app.innerHTML = header() + h + howTo(); setW(); return; }
    const card = (t, s, cls) => `<div class="kpi ${cls}"><h3>${t}</h3><dl>
      <dt>Réglés</dt><dd data-k="n">${s.n}</dd><dt>Gagnés</dt><dd data-k="won">${s.won}</dd><dt>Perdus</dt><dd data-k="lost">${s.lost}</dd><dt>Annulés</dt><dd data-k="void">${s.void}</dd>
      <dt>Réussite</dt><dd data-k="hit">${L.pct(s.hit_rate)} <small>sur ${s.won + s.lost}</small></dd><dt>P/L</dt><dd data-k="pl">${L.units(s.pl_units)}</dd>
      <dt>ROI</dt><dd data-k="roi">${s.roi == null ? "—" : L.signedPct(s.roi)} <small>sur ${s.staked}</small></dd><dt>Cote moy.</dt><dd data-k="avg">${L.odds(s.avg_odds)}</dd><dt>n sans cote</dt><dd data-k="noodds">${s.no_odds}</dd></dl></div>`;
    h += `<div class="kpis">${card("Tickets", T, "tk")}${card("Skips (non joués, mise virtuelle 1 u)", S, "sk")}</div>`;
    const dh = T.hit_rate != null && S.hit_rate != null ? (T.hit_rate - S.hit_rate) : null;
    h += `<section class="card"><h3>Valeur de la sélection</h3><p>Écart de réussite : ${dh == null ? "—" : (dh > 0 ? "+" : "") + L.nf(dh * 100, 1) + " pts"} · Écart de ROI : ${T.roi != null && S.roi != null ? L.signedPct(T.roi - S.roi) : "—"}</p><p class="vs">${esc(L.valueSentence(T, S, minN))}</p></section>`;
    h += plChart(L.cumulative(xs)) + calChart(L.calibration(xs));
    const tb = (title, rows, label) => table(title, rows, label, minN);
    h += tb("Par compétition", L.breakdown(xs, x => `${x.league.name} · ${x.league.country}`), "Compétition");
    h += tb("Par marché", L.breakdown(xs, x => x.market), "Marché");
    h += tb("Par tranche de probabilité", L.breakdown(xs, x => x.confidence_bucket || L.bucketOf(x.model_probability)), "Tranche");
    h += tb("Par déclencheur", L.breakdown(xs, x => TRIG[x.trigger] || x.trigger), "Déclencheur");
    const withM = xs.filter(x => x.matin && x.trigger !== "matin");
    if (withM.length) { const chg = withM.filter(x => x.matin.selection !== x.selection || x.matin.label !== x.label); const mw = withM.filter(x => x.matin.outcome === "won").length, fw = withM.filter(x => x.outcome === "won").length;
      h += `<section class="card"><h3>Relecture compo vs matin</h3><p>${withM.length} matchs relus : pick ou label changé ${chg.length} fois ; lecture du matin gagnante ${mw} fois, lecture finale ${fw} fois.</p></section>`; }
    h += tb("Par jour", L.breakdown(xs, x => x.date), "Jour");
    h += tb("Par semaine", L.breakdown(xs, x => L.isoWeek(x.date)), "Semaine");
    h += settledList(xs) + howTo();
    $app.innerHTML = header() + h; setW();
  }
  const maxd = (a, b) => (!a ? b : a > b ? a : b);
  const fmtFr = d => d ? d.split("-").reverse().join("/") : "—";
  function table(title, rows, label, minN) {
    const sk = prefs.sorts && prefs.sorts[title] || { k: "key", dir: 1 };
    const val = (r, k) => k === "key" ? r.key : k === "Tn" ? r.T.n : k === "Tpl" ? r.T.pl_units : k === "Sn" ? r.S.n : k === "Spl" ? r.S.pl_units : k === "Th" ? (r.T.hit_rate ?? -1) : (r.S.hit_rate ?? -1);
    rows.sort((a, b) => { const x = val(a, sk.k), y = val(b, sk.k); return (x > y ? 1 : x < y ? -1 : 0) * sk.dir; });
    const th = (k, n) => `<th><button data-sort="${esc(title)}" data-k="${k}" aria-label="Trier par ${n}">${n}${sk.k === k ? (sk.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
    const cell = s => s.n ? `${s.n} · ${s.won}/${s.lost} · ${L.pct(s.hit_rate, 0)} · ${L.units(s.pl_units)}` : "—";
    return `<section class="card"><h3>${esc(title)}</h3><div class="hscroll"><table class="tbl" data-table="${esc(title)}"><thead><tr>${th("key", label)}${th("Tn", "Tickets n")}${th("Th", "Tickets réussite")}${th("Tpl", "Tickets P/L")}${th("Sn", "Skips n")}${th("Sh", "Skips réussite")}${th("Spl", "Skips P/L")}</tr></thead><tbody>${rows.map(r => {
      const ind = (r.T.n < minN) || (r.S.n < minN);
      return `<tr class="${ind ? "ind" : ""}" data-key="${esc(r.key)}"><td>${esc(r.key)}${ind ? ` <small>indicatif</small>` : ""}</td><td>${r.T.n}</td><td>${L.pct(r.T.hit_rate)} <small>sur ${r.T.won + r.T.lost}</small></td><td data-pl="T">${L.units(r.T.pl_units)}</td><td>${r.S.n}</td><td>${L.pct(r.S.hit_rate)} <small>sur ${r.S.won + r.S.lost}</small></td><td data-pl="S">${L.units(r.S.pl_units)}</td></tr>`; }).join("")}</tbody></table></div></section>`;
  }
  function settledList(xs) {
    const fl = prefs.sfilter || {}; const lgs = [...new Set(xs.map(x => x.league.name))].sort(), mks = [...new Set(xs.map(x => x.market))].sort();
    const ys = xs.filter(x => (!fl.label || x.label === fl.label) && (!fl.league || x.league.name === fl.league) && (!fl.market || x.market === fl.market)).sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff));
    const s = (id, opts, cur, lab) => `<select id="${id}" aria-label="${lab}"><option value="">${lab} : tous</option>${opts.map(o => `<option${o === cur ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    return `<section class="card"><h3>Picks réglés</h3><div class="filters">${s("fl-label", ["TICKET", "SKIP"], fl.label, "Label")}${s("fl-league", lgs, fl.league, "Compétition")}${s("fl-market", mks, fl.market, "Marché")}</div>
      <div class="hscroll"><table class="tbl"><thead><tr><th>Date</th><th>Match</th><th>Sélection</th><th>Label</th><th>Proba</th><th>Cote</th><th>Score</th><th>Résultat</th><th>P/L</th></tr></thead><tbody>${ys.map(x =>
      `<tr data-open="${x.fixture_id}" data-date="${x.date}"><td>${fmtFr(x.date)}</td><td><a href="#/match/${x.fixture_id}?d=${x.date}">${esc(x.label_fr)}</a></td><td>${esc(L.shortSel(x.market, x.selection))}</td><td>${x.label}</td><td>${L.pct(x.model_probability)}</td><td>${L.odds(x.odds)}</td><td>${esc(x.final_score || "")}</td><td>${{ won: "gagné", lost: "perdu", void: "annulé", push: "remboursé" }[x.outcome] || ""}</td><td>${x.pl_units == null ? "—" : L.units(x.pl_units)}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  function plChart(c) {
    const pts = [...c.TICKET, ...c.SKIP]; if (!pts.length) return "";
    const ts = pts.map(p => Date.parse(p.t)), vs = pts.map(p => p.v).concat([0]);
    const t0 = Math.min(...ts), t1 = Math.max(...ts) || t0 + 1, v0 = Math.min(...vs), v1 = Math.max(...vs);
    const W = 320, H = 140, X = t => 30 + (t1 === t0 ? 0.5 : (Date.parse(t) - t0) / (t1 - t0)) * (W - 40), Y = v => 10 + (v1 === v0 ? 0.5 : (v1 - v) / (v1 - v0)) * (H - 30);
    const line = (a, cls) => a.length ? `<polyline class="${cls}" points="${a.map(p => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}"/>` : "";
    return `<section class="card"><h3>P/L cumulé (unités)</h3><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="P/L cumulé tickets et skips"><line class="zero" x1="30" x2="${W - 10}" y1="${Y(0)}" y2="${Y(0)}"/>${line(c.TICKET, "lt")}${line(c.SKIP, "ls")}<text x="2" y="${Y(v1) + 4}">${L.nf(v1, 1)}</text><text x="2" y="${Y(v0)}">${L.nf(v0, 1)}</text></svg><p class="legend"><span class="lt">— Tickets</span> <span class="ls">— Skips</span></p></section>`;
  }
  function calChart(c) {
    if (!c.rows.length) return "";
    const W = 300, H = 300, P = v => 30 + v * 250, Yp = v => 280 - v * 250;
    const dots = c.rows.map(r => `<circle cx="${P(r.mean_predicted).toFixed(1)}" cy="${Yp(r.observed).toFixed(1)}" r="${Math.min(12, 3 + Math.sqrt(r.n))}"><title>${r.bucket} % : annoncé ${L.pct(r.mean_predicted)}, observé ${L.pct(r.observed)} (n = ${r.n})</title></circle><text x="${P(r.mean_predicted) + 6}" y="${Yp(r.observed) - 6}">n=${r.n}</text>`).join("");
    return `<section class="card"><h3>Calibration (tickets et skips)</h3><svg viewBox="0 0 ${W} ${H}" class="chart cal" role="img" aria-label="Calibration"><line class="diag" x1="${P(0)}" y1="${Yp(0)}" x2="${P(1)}" y2="${Yp(1)}"/><text x="${P(0.55)}" y="${Yp(0.62)}">calibration parfaite</text>${dots}<text x="30" y="296">annoncé →</text></svg>
      <table class="tbl"><thead><tr><th>Tranche</th><th>n</th><th>Annoncé</th><th>Observé</th></tr></thead><tbody>${c.rows.map(r => `<tr class="${r.n < 30 ? "ind" : ""}"><td>${r.bucket} %</td><td>${r.n}</td><td>${L.pct(r.mean_predicted)}</td><td>${L.pct(r.observed)}</td></tr>`).join("")}</tbody></table>
      <p>Score de Brier : ${c.brier == null ? "—" : L.nf(c.brier, 3)} (sur ${c.n}). Plus il est bas, mieux les probabilités annoncées collent aux résultats ; 0,25 correspond à répondre toujours 50 %.</p></section>`;
  }
  function howTo() {
    return `<details class="card how"><summary>Comment lire ce bilan</summary><ul>
      <li><b>Ticket</b> : pick validé par la règle de la méthode (joué). <b>Skip</b> : meilleur pick du modèle non validé, suivi avec une mise virtuelle pour comparer.</li>
      <li><b>Unité (u)</b> : mise fixe de 1 par pick. <b>P/L</b> : gain ou perte en unités (cote − 1 si gagné, −1 si perdu, 0 si annulé).</li>
      <li><b>ROI</b> : P/L divisé par le nombre de picks misés avec une cote. <b>Taux de réussite</b> : gagnés / (gagnés + perdus).</li>
      <li><b>Calibration</b> : les matchs annoncés à 70 % doivent être gagnés environ 7 fois sur 10.</li>
      <li><b>Pourquoi 300 tickets</b> : en dessous, le hasard peut expliquer un bon ou un mauvais résultat.</li>
      <li><b>Méthodes séparées</b> : chaque version du modèle a son propre bilan ; elles ne sont jamais additionnées.</li></ul></details>`;
  }
  // ---------------- Règles et diagnostic ----------------
  function reglesPage() {
    const m = state.meta; let h = `<h2 class="pt">Règles et à propos</h2>`;
    if (m) {
      h += `<section class="card"><h3>Méthode en cours : ${esc(m.method.name)} (${esc(m.method.version)})</h3><p>${esc(m.method.description_fr || "")}</p><ul>${(m.rules.text_fr || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
      const c = m.rules.ticket_criteria || {};
      h += `<h3>Critères TICKET</h3><ul><li>EV ≥ ${L.pct(c.min_ev, 0)}</li><li>Écart modèle / marché ≤ ${L.nf((c.max_gap_market || 0) * 100, 0)} points</li><li>Probabilité du modèle ≥ ${L.pct(c.min_prob, 0)}</li><li>Cote ≤ ${L.odds(c.max_odds)}</li><li>≥ ${c.min_team_matches} matchs par équipe</li></ul>
        <h3>Marchés autorisés</h3><p>${(m.rules.allowed_markets || []).map(k => esc(({ "1X2": "1N2", "DC": "Double chance (1N, N2, 12)", "OU1.5": "+/−1,5", "OU2.5": "+/−2,5", "OU3.5": "+/−3,5", "BTTS": "Les deux marquent", "HT1X2": "Résultat à la mi-temps" })[k] || L.shortSel(k, "yes"))).join(", ")}</p></section>`;
      h += `<section class="card"><h3>Versions de la méthode</h3><ul>${(m.methods_history || []).map(x => `<li>${esc(x.version)} : du ${fmtFr(x.from)}${x.to ? " au " + fmtFr(x.to) : " à aujourd'hui"} — ${esc(x.description_fr || "")}</li>`).join("")}</ul><p>Remettre le bilan à zéro n'est pas un bouton du site : c'est la publication d'une nouvelle version de la méthode par Grok Bot. Les anciennes versions restent consultables dans le Bilan, sans jamais être additionnées.</p></section>`;
      h += `<section class="card"><h3>Compétitions et zones exclues</h3><p>${(m.exclusions || []).map(esc).join(", ")}</p></section>`;
    }
    h += `<section class="card"><h3>À propos</h3><p>Le site affiche les lectures publiées par Grok Bot ; il n'analyse rien, ne modifie aucun pick et n'appelle aucune API de football. Les suivis (étoiles) restent sur cet appareil.</p><p><b>Ce n'est pas un conseil de pari.</b></p></section>`;
    $app.innerHTML = header() + h; setW();
  }
  function diagPage() {
    let size = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); size += (k.length + (localStorage.getItem(k) || "").length) * 2; } } catch (e) {}
    const m = state.meta;
    const li = a => a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>Aucune.</p>";
    $app.innerHTML = header() + `<h2 class="pt">Diagnostic</h2><section class="card"><p>Version du site : v${esc(C.APP_VERSION)}</p><p>DATA_BASE_URL : <code>${esc(BASE)}</code></p><p>Mode : ${SAMPLE ? "exemple" : EMPTY ? "dossier vide (test)" : "réel"}${VARIANT ? " · variante " + esc(VARIANT) : ""}</p><p>Heure simulée : ${NOW_FIXED != null ? esc(Q.get("now")) : "non"}</p><p>LIVE_API_ENABLED : ${C.LIVE_API_ENABLED}</p></section>
      <section class="card"><h3>Fichiers lus</h3><div class="hscroll"><table class="tbl"><thead><tr><th>Fichier</th><th>Statut</th><th>generated_at</th><th>Lu à</th></tr></thead><tbody>${Object.entries(diag.files).map(([k, v]) => `<tr><td title="${esc(v.url)}">${esc(k)}</td><td>${esc(v.status)}${v.error ? " " + esc(v.error) : ""}</td><td>${esc(v.generated_at || "")}</td><td>${esc(v.at ? L.paris(v.at).time : "")}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="card"><h3>Requêtes de la session par hôte</h3>${li(Object.entries(diag.hosts).map(([h, n]) => `${h} : ${n}`))}</section>
      <section class="card"><h3>Anomalies de validation</h3>${li(diag.validation)}<h3>Lecture finale</h3>${li(diag.finalAnomalies)}<h3>Cohérence</h3>${li(diag.cohAnomalies)}<h3>Écart de bilan</h3>${li(diag.bilanDiff)}</section>
      <section class="card"><h3>Moteur</h3><p>engine_status : ${esc(m && m.engine_status && m.engine_status.level)} ${esc(m && m.engine_status && m.engine_status.message_fr || "")}</p><p>api_usage : ${m && m.api_usage ? `${m.api_usage.used} / ${m.api_usage.limit} le ${esc(m.api_usage.date)} (plan : ${esc(m.api_usage.plan_expires)})` : "—"}</p></section>
      <section class="card"><p>Stockage local : ${(size / 1024).toFixed(0)} Ko</p><button id="clearcache">Vider le cache local</button></section>`;
  }
  // ---------------- routeur ----------------
  let lastAgendaScroll = LS.get("am.v6.scroll", 0), wantRestore = false;
  function restoreScroll() { if (wantRestore) { wantRestore = false; requestAnimationFrame(() => window.scrollTo(0, lastAgendaScroll)); } }
  let current = "";
  async function route() {
    const h = location.hash || "#/agenda"; const [path, qs] = h.slice(1).split("?"); const parts = path.split("/").filter(Boolean);
    if (current === "agenda" && parts[0] !== "agenda") { lastAgendaScroll = window.scrollY; LS.set("am.v6.scroll", lastAgendaScroll); }
    if (parts[0] === "agenda" && current && current !== "agenda") wantRestore = true;
    current = parts[0] || "agenda";
    document.querySelectorAll(".tabbar a").forEach(a => a.setAttribute("aria-current", a.dataset.tab === (current === "match" ? "agenda" : current) ? "page" : "false"));
    try {
      if (!state.meta && !state.loading) { state.loading = true; await loadMeta(); state.loading = false; }
      if (!state.bilan && current !== "bilan") { fetchJSON("results/bilan.json").then(r => { state.bilan = r.data; }); }
      if (current === "match") await matchPage(parts[1], new URLSearchParams(qs || "").get("d") || L.paris(now()).date);
      else if (current === "bilan") await bilanPage();
      else if (current === "regles") reglesPage();
      else if (current === "diagnostic") diagPage();
      else { current = "agenda"; await agenda(); }
    } catch (e) { $app.innerHTML = header() + `<p class="empty">Erreur d'affichage : ${esc(e.message)}</p>`; diag.anomalies.push(String(e.stack || e)); console.error(e); }
    footer();
  }
  function footer() {
    const m = state.meta;
    document.getElementById("foot").innerHTML = `v${esc(C.APP_VERSION)} · ${m ? "données " + L.paris(new Date(m.generated_at)).time : "pas de données"} · <a href="#/diagnostic">diagnostic</a>`;
  }
  // ---------------- événements ----------------
  document.addEventListener("click", async e => {
    const t = e.target.closest("button, [data-copy]"); if (!t) return;
    if (t.dataset.star) {
      e.preventDefault(); e.stopPropagation(); const id = +t.dataset.star;
      if (suivis[id]) delete suivis[id];
      else { let f = null; for (const d of Object.keys(state.data)) { f = fixturesOf(d).find(x => x.fixture_id === id); if (f) break; }
        if (f) suivis[id] = { kickoff: f.kickoff, added_at: new Date().toISOString(), home: f.home.name, away: f.away.name, league: `${f.league.name} · ${f.league.country}`, region: f.region }; }
      saveSuivis(); const y = window.scrollY; await route(); window.scrollTo(0, y); return;
    }
    if (t.dataset.date) { prefs.date = t.dataset.date; savePrefs(); return route(); }
    if (t.dataset.view) { prefs.view = t.dataset.view; savePrefs(); return route(); }
    if (t.dataset.n) { prefs.n = +t.dataset.n; savePrefs(); return route(); }
    if (t.dataset.sort) { prefs.sorts = prefs.sorts || {}; const cur = prefs.sorts[t.dataset.sort] || { k: "key", dir: 1 }; prefs.sorts[t.dataset.sort] = { k: t.dataset.k, dir: cur.k === t.dataset.k ? -cur.dir : 1 }; savePrefs(); const y = window.scrollY; await route(); window.scrollTo(0, y); return; }
    if (t.id === "back") { const prev = state.prevHash && !/^#\/match/.test(state.prevHash) ? state.prevHash : "#/agenda"; location.hash = prev; return; }
    if (t.dataset.copy) { try { await navigator.clipboard.writeText(t.dataset.copy); t.textContent = "Copié ✓"; } catch (err) { t.textContent = "Copie impossible"; } return; }
    if (t.id === "exp") {
      const list = L.exportSuivis(suivis); const txt = JSON.stringify(list, null, 1);
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" })); a.download = `suivis-${L.paris(now()).date}.json`; a.click();
      try { await navigator.clipboard.writeText(txt); } catch (err) {}
      document.getElementById("iomsg").textContent = `${list.length} suivis exportés (fichier + presse-papiers).`; return;
    }
    if (t.id === "clearcache") { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("am.v6.cache.")) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); t.textContent = "Cache vidé ✓"; return; }
  });
  document.addEventListener("change", async e => {
    const t = e.target;
    if (t.id === "region") { prefs.region = t.value; savePrefs(); return route(); }
    if (t.id === "showPast") { prefs.showPast = t.checked; savePrefs(); return route(); }
    if (t.id === "method") { prefs.method = t.value; savePrefs(); return route(); }
    if (t.id === "period") { prefs.period = t.value; savePrefs(); return route(); }
    if (t.id === "pfrom" || t.id === "pto") { prefs[t.id] = t.value; savePrefs(); return route(); }
    if (t.id && t.id.startsWith("fl-")) { prefs.sfilter = prefs.sfilter || {}; prefs.sfilter[t.id.slice(3)] = t.value || null; savePrefs(); const y = window.scrollY; await route(); window.scrollTo(0, y); return; }
    if (t.id === "imp" && t.files[0]) {
      try { const list = JSON.parse(await t.files[0].text()); const r = L.importSuivis(suivis, Array.isArray(list) ? list : [], now()); suivis = r.suivis; saveSuivis(); await route(); document.getElementById("iomsg").textContent = `${r.added} suivis importés.`; }
      catch (err) { document.getElementById("iomsg").textContent = "Fichier illisible."; }
    }
  });
  window.addEventListener("hashchange", e => { const o = e.oldURL && e.oldURL.indexOf("#") >= 0 ? e.oldURL.slice(e.oldURL.indexOf("#")) : ""; if (!/^#\/match/.test(o)) state.prevHash = o; route(); });
  // ---------------- rafraîchissement (EXG-71) ----------------
  function setW() { document.querySelectorAll("[data-w]").forEach(e => { e.style.width = e.dataset.w + "%"; }); }
  async function refresh() {
    if (document.visibilityState !== "visible") return;
    const before = state.meta && state.meta.files ? JSON.stringify(state.meta.files) : ""; const prevGen = state.meta && state.meta.generated_at;
    await loadMeta();
    const changed = !state.meta || JSON.stringify(state.meta.files || {}) !== before || state.meta.generated_at !== prevGen;
    if (changed && (current === "agenda" || current === "match")) { const y = window.scrollY; await route(); window.scrollTo(0, y); } else { footer(); const hd = document.querySelector("header.top"); if (hd) { const tmp = document.createElement("div"); tmp.innerHTML = header(); hd.replaceWith(tmp.firstElementChild); } }
  }
  function interval() {
    const d = prefs.date || L.paris(now()).date; const fx = fixturesOf(d); const t = now().getTime();
    const hot = fx.some(f => L.LIVE.includes(f.status.short) || (Date.parse(f.kickoff) > t && Date.parse(f.kickoff) - t < 2 * 3600e3));
    return fx.some(f => L.LIVE.includes(f.status.short)) ? 60e3 : hot ? 5 * 60e3 : 15 * 60e3;
  }
  setInterval(() => { if (document.visibilityState === "visible" && Date.now() - state.lastMetaAt >= interval()) refresh(); }, 30e3);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - state.lastMetaAt > 60e3) refresh(); });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    const hadCtl = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadCtl && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register("sw.js?v=" + C.APP_VERSION, { updateViaCache: "none" }).then(reg => {
      reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
  }
  document.addEventListener("error", e => { const i = e.target; if (i && i.tagName === "IMG" && i.dataset.ini != null) { const sp = document.createElement("span"); sp.className = i.className + " ini"; sp.textContent = i.dataset.ini; i.replaceWith(sp); } }, true);
  window.__AM = { state, diag, prefs, route };
  route();
})();
