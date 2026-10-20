/* Analyse Match v6 — logique pure (sans DOM, testable sous Node). */
(function (root) {
  "use strict";
  const TZ = "Europe/Paris";
  const fmtParts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  function paris(d) {
    const p = {}; for (const x of fmtParts.formatToParts(d instanceof Date ? d : new Date(d))) p[x.type] = x.value;
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, hour: +p.hour, minute: +p.minute };
  }
  const WD = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function addDays(dateStr, n) { const d = new Date(dateStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dayLabel(dateStr) { const d = new Date(dateStr + "T12:00:00Z"); return { wd: WD[d.getUTCDay()], day: d.getUTCDate(), month: MO[d.getUTCMonth()] }; }
  function dateBar(now) { const t = paris(now).date; return [-2, -1, 0, 1, 2, 3, 4, 5].map(i => addDays(t, i)); }
  // ---- formats FR ----
  const nf = (x, d) => x.toFixed(d).replace(".", ",").replace("-", "−");
  const pct = (x, d = 1) => x == null ? "—" : nf(x * 100, d) + " %";
  const units = x => x == null ? "—" : (x > 0 ? "+" : x < 0 ? "" : "") + nf(x, 2) + " u";
  const odds = x => x == null ? "—" : nf(x, 2);
  const signedPct = x => x == null ? "—" : (x > 0 ? "+" : "") + nf(x * 100, 1) + " %";
  // ---- sélection courte ----
  function shortSel(market, sel) {
    if (market === "1X2") return { "1": "1", "X": "N", "2": "2" }[sel] || sel;
    if (market === "DC") return { "1X": "1N", "X2": "N2", "12": "12" }[sel] || sel;
    if (market === "HT1X2") return "MT " + ({ "1": "1", "X": "N", "2": "2" }[sel] || sel);
    if (/^OU/.test(market)) return (sel === "over" ? "+" : "−") + market.slice(2).replace(".", ",");
    if (market === "BTTS") return sel === "yes" ? "BTTS oui" : "BTTS non";
    const m = /^(1X|X2|12)_(O1\.5|O2\.5|U3\.5|BTTS)$/.exec(market);
    if (m) return { "1X": "1N", "X2": "N2", "12": "12" }[m[1]] + " & " + { "O1.5": "+1,5", "O2.5": "+2,5", "U3.5": "−3,5", "BTTS": "BTTS" }[m[2]];
    return { "BTTS_O2.5": "BTTS & +2,5" }[market] || market;
  }
  // ---- vues agenda ----
  const kick = f => Date.parse(f.kickoff);
  const byTime = (a, b) => kick(a) - kick(b) || String(a.league && a.league.name).localeCompare(String(b.league && b.league.name)) || a.fixture_id - b.fixture_id;
  function regionFilter(list, region) { return !region || region === "toutes" ? list : list.filter(f => f.region === region); }
  function onDate(list, date) { return list.filter(f => f.bettable === true && paris(f.kickoff).date === date); }
  function affiches(list, date, region, n) {
    const c = regionFilter(onDate(list, date), region).filter(f => paris(f.kickoff).hour >= 8);
    const ranked = c.slice().sort((a, b) => (b.affiche_score - a.affiche_score) || (a.tier - b.tier) || (kick(a) - kick(b)) || (a.fixture_id - b.fixture_id));
    const top = ranked.slice(0, n);
    return { rows: top.slice().sort(byTime), une: top.length ? top[0].fixture_id : null, available: c.length, requested: n, ranked };
  }
  function heure(list, date, region) { return regionFilter(onDate(list, date), region).slice().sort(byTime); }
  function nuit(list, date, region) { return heure(list, date, region).filter(f => paris(f.kickoff).hour < 8); }
  // ---- vérification X des SKIP quasi-ticket (info) ----
  function skipTag(sc) {
    if (!sc) return null;
    if (sc.status === "confirmed") return { text: "Vérifié ✓", cls: "ok" };
    if (sc.status === "cancelled") return { text: `Annulé (info : ${sc.reason_fr || "info contradictoire"})`, cls: "ko" };
    return { text: "Vérification X en attente", cls: "wait" };
  }
  // ---- relecture d'un match à TICKET publié : pick du ticket réévalué ----
  // ---- bandeau d'annulation lisible (v6.0.40) ----
  function cancelBanner(c) {
    if (!c) return "";
    const h = c.at ? paris(c.at).hour + "h" : null;
    let t = `Ticket ${c.ticket_pick_fr || ""} annulé${h ? ` à la relecture ${h}` : ""}`;
    if (c.odds_to != null && c.odds_from != null && c.odds_changed) t += ` — la cote est passée de ${odds(c.odds_from)} à ${odds(c.odds_to)}`;
    if (c.ev_to != null) t += ` (EV ${signedPct(c.ev_to)} < 5 %)`; else if (c.reason_fr) t += ` — ${c.reason_fr}`;
    if (c.model_changed === false) t += `, le modèle n'a pas changé (${pct(c.p_to)})`;
    else if (c.model_changed === true) t += `, le modèle a changé (${pct(c.p_from)} → ${pct(c.p_to)})`;
    return t;
  }
  function recheckText(t, time) {
    const crit = t.still_ok ? "critères toujours OK" : `critères plus OK : ${(t.reasons_fr || []).join(", ")}`;
    return `Relecture (info)${time ? " " + time : ""} : ${shortSel(t.market, t.selection)} ${pct(t.model_probability)} · cote ${t.odds != null ? odds(t.odds) : "—"}${t.ev != null ? " · EV " + signedPct(t.ev) : ""} · ${crit}`;
  }
  // ---- apprentissage ligne Valeur ----
  function valeurFamilies(vl) {
    return Object.entries((vl && vl.families) || {}).map(([name, s]) => ({ name, ...s, ci80: s.ci80 || [null, null] }))
      .sort((a, b) => (b.excluded - a.excluded) || (b.n - a.n));
  }
  // ---- suivi des lectures ----
  const SKIP_RULE_TS = Date.parse("2026-10-13T10:00:00+02:00"); // titre SKIP = plus probable (avant : EV max)
  function histChange(prev, r) {
    if (!prev) return null;
    const pc = prev.pick.market !== r.pick.market || prev.pick.selection !== r.pick.selection, lc = prev.label !== r.label;
    if (!pc && !lc) return null;
    const parts = [];
    if (pc) {
      const m = prev.pick.market, s = prev.pick.selection, p1 = prev.model_probability, p2 = r.probabilities && r.probabilities[m] ? r.probabilities[m][s] : null;
      parts.push(`${shortSel(m, s)} ${pct(p1)} → ${p2 != null ? pct(p2) : "—"}`);
    }
    if (lc) parts.push(`${prev.label} → ${r.label}`);
    const rule = pc && !lc && r.label === "SKIP" && Date.parse(prev.timestamp) < SKIP_RULE_TS && Date.parse(r.timestamp) >= SKIP_RULE_TS;
    const title = pc ? `titre : ${shortSel(r.pick.market, r.pick.selection)}` : "";
    return { text: parts.join(" · "), title, reason: rule ? "Changement d'affichage (règle SKIP du 13/10)" : (lc ? "Nouvelle lecture" : "Nouvelle sélection en tête"), rule };
  }
  function histWhen(ts, refDate) { const p = paris(ts); return p.date !== refDate ? `${p.date.slice(8, 10)}/${p.date.slice(5, 7)} ${p.time}` : p.time; }
  // ---- v6.0.41 : SKIP à historique insuffisant (< 20 matchs pour une équipe, même seuil que les tickets) ----
  function histo(r, rules) {
    if (!r || r.label !== "SKIP" || r.cancelled) return null;
    if (r.history_cross) return null; // v6.0.44 : historique complété avec la division précédente (promu/relégué)
    if (r.history_insufficient) return r.history_insufficient;
    const ts = r.team_samples; const c = rules && rules.ticket_criteria; const mn = c && c.min_team_matches != null ? c.min_team_matches : 20;
    if (!ts || ts.home == null || ts.away == null || Math.min(ts.home, ts.away) >= mn) return null;
    return { home: ts.home, away: ts.away, min: mn, label_fr: "Historique insuffisant", text_fr: `⚠️ Historique insuffisant (${ts.home} / ${ts.away} matchs)` };
  }
  // ---- lecture finale ----
  function finalReading(entry, kickoff) {
    const rs = (entry && entry.readings || []).slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const ko = Date.parse(kickoff);
    const before = rs.filter(r => Date.parse(r.timestamp) < ko);
    const conf = before.filter(r => r.lineups_confirmed);
    const tk = before.filter(r => r.label === "TICKET"); // verrou : un TICKET publié reste officiel
    if (tk.length && entry && entry.cancelled) { // annulé : ticket d'origine gardé (historique/bilan), affichage = DERNIÈRE lecture (v6.0.40)
      const why = entry.cancel_reason_fr || "info contradictoire"; const lab = entry.cancel_label_fr || "Annulé — info de dernière heure";
      const t0 = tk[0]; const last = before[before.length - 1] || t0;
      const cr = before.find(r => Date.parse(r.timestamp) > Date.parse(t0.timestamp) && r.ticket_recheck && r.ticket_recheck.still_ok === false) || null;
      const tr = cr && cr.ticket_recheck; const o0 = t0.odds_seen && t0.odds_seen.value;
      const cancel = { label_fr: lab, reason_fr: why, ticket_pick_fr: t0.pick && t0.pick.label_fr, ticket_market: t0.pick && t0.pick.market, ticket_selection: t0.pick && t0.pick.selection,
        ticket_reading_id: t0.reading_id, cancel_reading_id: cr ? cr.reading_id : null, at: cr ? cr.timestamp : null,
        p_from: t0.model_probability, p_to: tr ? tr.model_probability : null, odds_from: o0 != null ? o0 : null, odds_to: tr ? tr.odds : null, ev_from: t0.ev, ev_to: tr ? tr.ev : null };
      cancel.model_changed = tr && cancel.p_from != null && tr.model_probability != null ? Math.abs(tr.model_probability - cancel.p_from) >= 0.005 : null;
      cancel.odds_changed = tr && cancel.odds_from != null && tr.odds != null ? Math.abs(tr.odds - cancel.odds_from) >= 0.005 : null;
      const lt = entry.late_after_cancel_reading_id && before.find(r => r.reading_id === entry.late_after_cancel_reading_id && r.label === "TICKET");
      if (lt) return { reading: { ...lt, prev_cancel: cancel }, anomaly: null, readings: rs }; // v6.0.46 : nouveau pick B ticket tardif, bandeau de l'annulation de A à part
      const base = last === t0 ? { ...t0, skip_reasons_fr: [] } : last;
      return { reading: { ...base, label: "SKIP", cancelled: true, cancel_reason_fr: why, cancel_label_fr: lab, cancel, ticket_reading: t0,
        skip_reasons_fr: [`⚠️ ${lab} : ${why}`, ...((base.skip_reasons_fr) || [])] }, anomaly: null, readings: rs };
    }
    const rule = tk.length ? tk[0] : conf.length ? conf[conf.length - 1] : (before.length ? before[before.length - 1] : null);
    const pub = entry && entry.final_reading_id ? rs.find(r => r.reading_id === entry.final_reading_id) : null;
    if (!entry || !entry.final_reading_id) return { reading: rule, anomaly: "final_reading_id absent : lecture finale déterminée par la règle", readings: rs };
    if (!pub) return { reading: rule, anomaly: `final_reading_id ${entry.final_reading_id} inexistant : règle appliquée`, readings: rs };
    return { reading: pub, anomaly: null, readings: rs };
  }
  function laterReadings(fr) { const r = fr && fr.reading; if (!r) return []; return (fr.readings || []).filter(x => Date.parse(x.timestamp) > Date.parse(r.timestamp) && x.reading_id !== r.reading_id); }
  // ---- statut ESPN -> statut du site (même règle que live_tick.py) ----
  function espnStatus(ev) {
    const st = ev.status || {}, ty = st.type || {}, name = ty.name || "", per = st.period || 0; const m = /(\d+)/.exec(st.displayClock || ""); const el = m ? +m[1] : null;
    if (ty.state === "pre") return null;
    if (ty.state === "post" || ty.completed) return { short: /PEN/.test(name) ? "PEN" : /AET|EXTRA/.test(name) ? "AET" : "FT", elapsed: /AET|PEN/.test(name) ? 120 : 90 };
    if (/HALFTIME/.test(name)) return { short: "HT", elapsed: 45 };
    if (/SHOOTOUT/.test(name)) return { short: "P", elapsed: 120 };
    if (/POSTPONED|CANCELED|SUSPENDED|ABANDONED/.test(name)) return null;
    return { short: per <= 1 ? "1H" : per === 2 ? "2H" : "ET", elapsed: el };
  }
  // ---- combiné du jour (TICKETs officiels uniquement) ----
  function combineInfo(c) {
    if (!c || !(c.legs || []).length || c.legs.length < 2) return { none: true, text: "Pas de combiné aujourd'hui : moins de 2 tickets validés" };
    const act = c.legs.filter(l => !l.cancelled); // v6.0.45 : jambe dont le ticket est annulé = cote 1 (void)
    const odds = act.reduce((a, l) => a * l.odds, 1), p = act.reduce((a, l) => a * l.prob, 1);
    return { none: false, legs: c.legs, odds, p, ev: p * odds - 1, outcome: c.outcome || null, cancelled: c.legs.length - act.length };
  }
  // Affichage : classer les jambes par datetime de coup d'envoi (pas seulement HH:MM)
  function sortLegsByKickoff(legs) {
    return (legs || []).slice().sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || (a.fixture_id - b.fixture_id));
  }
  // ---- revérification cohérence (COH-01, 02, 03, 04, 07) ----
  function recheck(r, rules) {
    const fails = []; const P = r.probabilities || {}; const m = r.pick && r.pick.market, s = r.pick && r.pick.selection;
    const v = P[m] && P[m][s];
    if (v == null || Math.abs(v - r.model_probability) > 0.0005) fails.push({ id: "COH-01", detail_fr: `probabilité du pick ${pct(r.model_probability)} ≠ probabilités ${v == null ? "absente" : pct(v)}` });
    try {
      const x = P["1X2"], e = (a, b, t) => Math.abs(a - b) <= t; let ok = e(x["1"] + x["X"] + x["2"], 1, 0.005);
      if (P.DC) ok = ok && e(P.DC["1X"], x["1"] + x["X"], 0.005) && e(P.DC["X2"], x["X"] + x["2"], 0.005) && e(P.DC["12"], x["1"] + x["2"], 0.005);
      for (const l of ["OU1.5", "OU2.5", "OU3.5"]) if (P[l]) ok = ok && e(P[l].over + P[l].under, 1, 0.005);
      if (P.BTTS) ok = ok && e(P.BTTS.yes + P.BTTS.no, 1, 0.005);
      if (P["OU1.5"] && P["OU2.5"] && P["OU3.5"]) ok = ok && P["OU1.5"].over >= P["OU2.5"].over && P["OU2.5"].over >= P["OU3.5"].over;
      if (!ok) fails.push({ id: "COH-02", detail_fr: "probabilités internes incohérentes" });
    } catch (e) { fails.push({ id: "COH-02", detail_fr: "probabilités incomplètes" }); }
    const allowed = rules && rules.allowed_markets || [];
    if (!r.pick || !m || (allowed.length && !allowed.includes(m))) fails.push({ id: "COH-03", detail_fr: "marché absent des marchés autorisés" });
    if (r.label === "TICKET" && rules && rules.ticket_criteria) {
      const c = rules.ticket_criteria, why = [];
      if (c.min_ev != null && !(r.ev != null && r.ev >= c.min_ev)) why.push(`EV ${r.ev == null ? "absente" : signedPct(r.ev)} < ${pct(c.min_ev, 0)}`);
      if (c.max_odds != null && !(r.odds_seen && r.odds_seen.value <= c.max_odds)) why.push("cote hors critère");
      if (c.min_prob != null && !(r.model_probability >= c.min_prob)) why.push("probabilité sous le seuil");
      if (c.max_gap_market != null && !(r.market_probability != null && Math.abs(r.model_probability - r.market_probability) <= c.max_gap_market + 1e-9)) why.push("écart marché hors critère");
      if (c.min_team_matches != null && r.team_samples && Math.min(r.team_samples.home, r.team_samples.away) < c.min_team_matches) why.push("échantillon équipes insuffisant");
      if (why.length) fails.push({ id: "COH-04", detail_fr: why.join(", ") });
    }
    if (!(r.model_probability >= 0.5)) fails.push({ id: "COH-07", detail_fr: "probabilité < 50 %" });
    const published = (r.coherence_check && r.coherence_check.checks || []).filter(c => !c.passed).map(c => ({ id: c.id, detail_fr: c.detail_fr || "" }));
    const all = published.slice(); for (const f of fails) if (!all.find(x => x.id === f.id)) all.push(f);
    return { ok: all.length === 0 && !(r.coherence_check && r.coherence_check.passed === false), fails: all, siteFails: fails };
  }
  // ---- résultat d'un pick ----
  function outcome(market, sel, hg, ag, ht) {
    if (hg == null || ag == null) return null; const t = hg + ag;
    if (market === "HT1X2") { if (!ht || ht.home == null) return null; return ({ "1": ht.home > ht.away, "X": ht.home === ht.away, "2": ht.home < ht.away }[sel]) ? "won" : "lost"; }
    const cm = /^(1X|X2|12)_(O1\.5|O2\.5|U3\.5|BTTS)$/.exec(market);
    if (cm) { const d = { "1X": hg >= ag, "X2": hg <= ag, "12": hg !== ag }[cm[1]], g = { "O1.5": t >= 2, "O2.5": t >= 3, "U3.5": t <= 3, "BTTS": hg > 0 && ag > 0 }[cm[2]]; return d && g ? "won" : "lost"; }
    const m = { "1X2|1": hg > ag, "1X2|X": hg === ag, "1X2|2": hg < ag, "DC|1X": hg >= ag, "DC|X2": hg <= ag, "DC|12": hg !== ag,
      "BTTS|yes": hg > 0 && ag > 0, "BTTS|no": !(hg > 0 && ag > 0), "1X_O1.5|yes": hg >= ag && t >= 2, "1X_BTTS|yes": hg >= ag && hg > 0 && ag > 0, "BTTS_O2.5|yes": hg > 0 && ag > 0 && t >= 3 };
    const k = market + "|" + sel; if (k in m) return m[k] ? "won" : "lost";
    if (/^OU/.test(market)) { const l = parseFloat(market.slice(2)); return (sel === "over" ? t > l : t < l) ? "won" : "lost"; }
    return null;
  }
  // Statut d'une jambe de combiné : résultat réglé, sinon score final/en direct (décision anticipée si elle est déjà certaine)
  function legStatus(l, f) {
    if (l.outcome === "won" || l.outcome === "lost" || l.outcome === "void") return l.outcome;
    if (!f) return "pending"; const s = f.status && f.status.short, sc = f.score || {};
    if (["CANC", "ABD", "AWD", "WO", "PST"].includes(s)) return "pending";
    const hg = sc.home, ag = sc.away;
    if (FINISHED.includes(s)) return outcome(l.market, l.selection, hg, ag, sc.ht || f.ht) || "pending";
    if (!LIVE.includes(s) || hg == null || ag == null) return "pending";
    const t = hg + ag, both = hg > 0 && ag > 0;
    if (/^OU/.test(l.market)) { const x = parseFloat(l.market.slice(2)); if (t > x) return l.selection === "over" ? "won" : "lost"; return "live"; }
    if (l.market === "BTTS" && both) return l.selection === "yes" ? "won" : "lost";
    const cm = /_(O1\.5|O2\.5|U3\.5)$/.exec(l.market); if (cm && cm[1] === "U3.5" && t > 3) return "lost";
    if (l.market === "BTTS_O2.5" || l.market === "1X_BTTS") { /* rien d'anticipé côté gain */ }
    return "live";
  }
  function legsSummary(sts) {
    const w = sts.filter(x => x === "won").length, lo = sts.filter(x => x === "lost").length, v = sts.filter(x => x === "void").length, p = sts.length - w - lo - v;
    const status = lo ? "lost" : p ? "pending" : "won";
    return { won: w, lost: lo, void: v, pending: p, status, text: `${w} ✅ · ${lo} ❌${v ? ` · ${v} annulé(s)` : ""} · ${p} en cours` };
  }
  const FINISHED = ["FT", "AET", "PEN"], LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
  function mergeLive(f, liveEntry, fixturesGen) {
    if (!liveEntry) return f;
    if (fixturesGen && Date.parse(liveEntry.updated_at) <= Date.parse(fixturesGen)) return f;
    const o = Object.assign({}, f); o.status = liveEntry.status; o.score = Object.assign({}, f.score, liveEntry.score); return o;
  }
  function statusText(f) {
    const s = f.status && f.status.short, el = f.status && f.status.elapsed, sc = f.score || {};
    if (FINISHED.includes(s)) return `${sc.home}-${sc.away}`;
    const hs = sc.home != null && sc.away != null ? `${sc.home}-${sc.away} ` : "";
    if (s === "HT") return `${hs}MT`;
    if (LIVE.includes(s)) return hs + (el != null ? `${el}'` : "En cours");
    if (s === "PST") return "Reporté"; if (s === "CANC") return "Annulé"; if (s === "ABD") return "Arrêté";
    if (s === "AWD" || s === "WO") return "Tapis vert";
    return hm(f.kickoff);
  }
  function hm(k) { const p = paris(k); return `${p.hour}h${String(p.minute).padStart(2, "0")}`; }
  // ---- suivis ----
  function suivisSplit(suivis, now) {
    const today8 = Date.parse(paris(now).date + "T08:00:00" + offsetFor(paris(now).date));
    const nowMs = now.getTime(); const active = [], archived = [], purge = [];
    for (const [id, s] of Object.entries(suivis || {})) {
      const k = Date.parse(s.kickoff); const o = Object.assign({ fixture_id: +id }, s);
      if (k < nowMs - 30 * 864e5) purge.push(+id); else if (k < today8) { if (k >= nowMs - 7 * 864e5) archived.push(o); } else active.push(o);
    }
    const c = (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.fixture_id - b.fixture_id;
    return { active: active.sort(c), archived: archived.sort(c), purge };
  }
  function at(dateStr, hh) { return new Date(`${dateStr}T${String(hh).padStart(2, "0")}:00:00${offsetFor(dateStr)}`); }
  // Prochaine lecture prévue : matin 07:00 + relecture toutes les 3 h (01, 04, 10, 13, 16, 19, 22 h, vers HH:13), matchs dans les 24 h
  const RELECO_H = [1, 4, 7, 10, 13, 16, 19, 22];
  function nextReading(kickoff, now) {
    const k = new Date(kickoff), n = now || new Date(); const d0 = paris(n).date; const c = [];
    for (const dd of [addDays(d0, -1), d0, addDays(d0, 1)]) for (const h of RELECO_H) c.push(at(dd, h));
    const ok = c.filter(r => r >= n && k - r >= 10 * 60e3 && k - r < 24 * 3600e3).sort((a, b) => a - b);
    return ok[0] || null;
  }
  function trigLabel(r, TRIG) {
    if (r.trigger === "releco") return `Relecture ${paris(new Date(r.timestamp)).hour}h` + (r.releco_count > 1 ? ` (inchangée ×${r.releco_count})` : "");
    return (TRIG && TRIG[r.trigger]) || r.trigger;
  }
  function offsetFor(dateStr) { // décalage Europe/Paris à midi ce jour-là
    const d = new Date(dateStr + "T12:00:00Z"); const p = paris(d); const diff = (p.hour - 12) * 60 + p.minute;
    const sgn = diff >= 0 ? "+" : "-", a = Math.abs(diff); return `${sgn}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
  }
  function apiGauge(u) {
    if (!u || !u.limit) return null;
    const left = Math.max(0, u.limit - u.used), pct = Math.round(100 * left / u.limit);
    return { pct, left, limit: u.limit, level: pct >= 50 ? "ok" : pct >= 20 ? "mid" : "low", plan: u.plan || null, end: u.plan_expires ? paris(new Date(u.plan_expires)).date.slice(5).split("-").reverse().join("/") : null };
  }
  function relecAllText(d) { const p = paris(d); return `Relis tous les matchs à venir (relecture complète) — demandé le ${p.date.slice(5).split("-").reverse().join("/")} ${p.time.replace(":", "h")}`; }
  function exportSuivis(suivis) { return Object.entries(suivis || {}).map(([id, s]) => ({ fixture_id: +id, kickoff: s.kickoff, home: s.home, away: s.away, league: s.league, region: s.region })); }
  function importSuivis(suivis, list, now) {
    const out = Object.assign({}, suivis); let added = 0;
    for (const x of list || []) { if (!x || x.fixture_id == null || !x.kickoff) continue; if (!out[x.fixture_id]) { out[x.fixture_id] = { kickoff: x.kickoff, added_at: now.toISOString(), home: x.home, away: x.away, league: x.league, region: x.region }; added++; } }
    return { suivis: out, added };
  }
  // ---- bilan ----
  function isoWeek(dateStr) {
    const d = new Date(dateStr + "T12:00:00Z"); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
    const y = d.getUTCFullYear(); const f = new Date(Date.UTC(y, 0, 4)); const w = 1 + Math.round(((d - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7);
    return `${y}-W${String(w).padStart(2, "0")}`;
  }
  const r2 = x => Math.round(x * 100) / 100;
  function summarize(xs) {
    const won = xs.filter(x => x.outcome === "won").length, lost = xs.filter(x => x.outcome === "lost").length;
    const voids = xs.filter(x => x.outcome === "void" || x.outcome === "push").length;
    const decided = xs.filter(x => x.outcome === "won" || x.outcome === "lost");
    const wo = decided.filter(x => x.odds != null); const pl = r2(wo.reduce((a, x) => a + (x.outcome === "won" ? x.odds - 1 : -1), 0));
    return { n: xs.length, won, lost, void: voids, no_odds: decided.length - wo.length, hit_rate: won + lost ? won / (won + lost) : null,
      pl_units: pl, roi: wo.length ? pl / wo.length : null, avg_odds: wo.length ? wo.reduce((a, x) => a + x.odds, 0) / wo.length : null, staked: wo.length };
  }
  function filterSettled(settled, method, from, to) { return (settled || []).filter(s => s.method_version === method && (!from || s.date >= from) && (!to || s.date <= to)); }
  function breakdown(xs, keyf) {
    const g = new Map(); for (const x of xs) { const k = keyf(x); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
    return [...g.entries()].map(([k, v]) => ({ key: k, T: summarize(v.filter(x => x.label === "TICKET")), S: summarize(v.filter(x => x.label === "SKIP")) }));
  }
  function bucketOf(p) { const b = Math.min(95, Math.floor(p * 100 / 5 + 1e-9) * 5); return `${b}-${b + 5}`; }
  function calibration(xs) {
    const d = xs.filter(x => x.outcome === "won" || x.outcome === "lost"); const g = {};
    for (const x of d) { const b = bucketOf(x.model_probability); (g[b] = g[b] || []).push(x); }
    const rows = Object.keys(g).sort().map(b => ({ bucket: b, n: g[b].length, mean_predicted: g[b].reduce((a, x) => a + x.model_probability, 0) / g[b].length, observed: g[b].filter(x => x.outcome === "won").length / g[b].length }));
    const brier = d.length ? d.reduce((a, x) => a + Math.pow(x.model_probability - (x.outcome === "won" ? 1 : 0), 2), 0) / d.length : null;
    return { rows, brier, n: d.length };
  }
  function cumulative(xs) {
    const s = xs.filter(x => x.odds != null && (x.outcome === "won" || x.outcome === "lost")).slice().sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.fixture_id - b.fixture_id);
    const out = { TICKET: [], SKIP: [] }, acc = { TICKET: 0, SKIP: 0 };
    for (const x of s) { if (!out[x.label]) continue; acc[x.label] = r2(acc[x.label] + (x.outcome === "won" ? x.odds - 1 : -1)); out[x.label].push({ t: x.kickoff, v: acc[x.label] }); }
    return out;
  }
  function valueSentence(T, S, minN) {
    const nt = T.won + T.lost, ns = S.won + S.lost;
    if (nt < minN || ns < minN) return `Échantillon trop petit pour conclure (${nt} tickets, ${ns} skips)`;
    const dh = (T.hit_rate - S.hit_rate) * 100, du = T.pl_units - S.pl_units;
    if (dh > 0 && du > 0) return `Les tickets font ${dh > 0 ? "+" : ""}${nf(dh, 1)} points de réussite et ${du > 0 ? "+" : ""}${nf(du, 2)} u de mieux que les skips`;
    return "Les tickets ne font pas mieux que les skips : la sélection n'apporte pas de valeur pour l'instant";
  }
  function compareAggregates(T, S, agg) {
    if (!agg) return [{ field: "aggregates", detail: "agrégats publiés absents pour cette méthode" }];
    const diffs = [];
    for (const [lab, mine] of [["TICKET", T], ["SKIP", S]]) {
      const p = agg[lab]; if (!p) { diffs.push({ field: lab, detail: "absent" }); continue; }
      for (const k of ["n", "won", "lost", "void", "no_odds"]) if (p[k] !== mine[k]) diffs.push({ field: `${lab}.${k}`, detail: `publié ${p[k]} / calculé ${mine[k]}` });
      if (Math.abs((p.pl_units || 0) - mine.pl_units) > 0.005) diffs.push({ field: `${lab}.pl_units`, detail: `publié ${p.pl_units} / calculé ${mine.pl_units}` });
    }
    return diffs;
  }
  function paperCount(settled, method) { return (settled || []).filter(s => s.method_version === method && s.label === "TICKET" && (s.outcome === "won" || s.outcome === "lost")).length; }
  function schemaOk(o) { return o && typeof o.schema_version === "string" && o.schema_version.split(".")[0] === "6"; }
  const REQ_FIX = ["fixture_id", "kickoff", "timezone", "league", "region", "tier", "affiche_score", "bettable", "home", "away", "status", "score", "has_details"];
  function validFixture(f) { const miss = REQ_FIX.filter(k => !(k in (f || {}))); return miss; }
  function staleText(now, gen) {
    if (!gen) return null; const p = paris(now); if (p.hour < 8) return null;
    const ms = now.getTime() - Date.parse(gen); if (ms <= 3 * 3600e3) return null; return durationText(ms);
  }
  function durationText(ms) { const m = Math.round(ms / 60000); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`; }
  const API = { histo, paris, addDays, dateBar, dayLabel, pct, units, odds, signedPct, nf, shortSel, affiches, heure, nuit, regionFilter, finalReading, recheck, outcome, mergeLive, statusText, hm, nextReading, trigLabel, laterReadings, combineInfo, espnStatus, skipTag, histChange, histWhen, recheckText, cancelBanner, valeurFamilies,
    suivisSplit, apiGauge, relecAllText, exportSuivis, importSuivis, isoWeek, summarize, filterSettled, breakdown, calibration, cumulative, valueSentence, compareAggregates, paperCount, bucketOf,
    schemaOk, validFixture, staleText, durationText, offsetFor, FINISHED, LIVE, legStatus, legsSummary, sortLegsByKickoff };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.AMLogic = API;
})(typeof self !== "undefined" ? self : this);
