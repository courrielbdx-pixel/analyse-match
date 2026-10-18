// node --test tests/  — tests de la logique pure sur /sample-data
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const L = require("../logic.js");
const SD = p => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sample-data", p)));
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, "ids.json")));
const F12 = SD("fixtures/2026-10-12.json").fixtures, F13 = SD("fixtures/2026-10-13.json").fixtures, F11 = SD("fixtures/2026-10-11.json").fixtures;
const picks = Object.fromEntries(SD("picks/2026-10-12.json").picks.map(p => [p.fixture_id, p]));
const meta = SD("meta.json"), bilan = SD("results/bilan.json");
const kick = id => F12.find(f => f.fixture_id === id).kickoff;
test("barre des dates J-2..J+5", () => assert.deepStrictEqual(L.dateBar(new Date("2026-10-12T12:00:00+02:00")), ["2026-10-10","2026-10-11","2026-10-12","2026-10-13","2026-10-14","2026-10-15","2026-10-16","2026-10-17"]));
test("affiches 10/20/30 exactes et emboîtées", () => {
  const a = [10, 20, 30].map(n => L.affiches(F12, "2026-10-12", "toutes", n));
  assert.deepStrictEqual(a.map(x => x.rows.length), [10, 20, 30]);
  for (const x of a) for (const f of x.rows) assert.ok(L.paris(f.kickoff).hour >= 8);
  const s = x => new Set(x.rows.map(f => f.fixture_id)); for (const id of s(a[0])) assert.ok(s(a[1]).has(id)); for (const id of s(a[1])) assert.ok(s(a[2]).has(id));
  const t = a[0].rows.map(f => Date.parse(f.kickoff)); assert.deepStrictEqual(t, t.slice().sort((x, y) => x - y));
});
test("affiches France = 8 disponibles", () => { const a = L.affiches(F12, "2026-10-12", "france", 10); assert.strictEqual(a.rows.length, 8); assert.strictEqual(a.available, 8); });
test("égalité affiche_score : tier le plus petit devant", () => { const r = L.affiches(F12, "2026-10-12", "toutes", 30).ranked.map(f => f.fixture_id); assert.ok(r.indexOf(ids.TIE_T1) < r.indexOf(ids.TIE_T3)); });
test("nuit 12/10 = 6 matchs", () => assert.deepStrictEqual(L.nuit(F12, "2026-10-12", "toutes").map(f => L.paris(f.kickoff).time), ["00:00","01:10","02:30","03:15","05:00","07:59"]));
test("nuit 13/10 contient 02:30 et pas ceux du 12", () => { const n = L.nuit(F13, "2026-10-13", "toutes").map(f => L.paris(f.kickoff).time); assert.ok(n.includes("02:30")); assert.strictEqual(L.nuit(F11, "2026-10-12", "toutes").length, 0); });
test("heure = 45 pariables, régions", () => { const h = L.heure(F12, "2026-10-12", "toutes"); assert.strictEqual(h.length, 45); const c = {}; h.forEach(f => c[f.region] = (c[f.region] || 0) + 1);
  assert.deepStrictEqual(c, { ameriques: 9, asie_oceanie: 4, europe: 15, france: 8, uefa: 6, monde: 3 }); });
test("changement d'heure 25/10 : deux matchs à 15:00", () => SD("fixtures/2026-10-25.json").fixtures.forEach(f => assert.strictEqual(L.paris(f.kickoff).time, "15:00")));
test("lecture finale : 4 lectures -> 2e manuel", () => { const r = L.finalReading(picks[ids.A], kick(ids.A)); assert.strictEqual(r.reading.reading_id, `${ids.A}-r4`); assert.strictEqual(r.reading.label, "SKIP"); });
test("lecture finale : compo puis manuel sans compo -> compo", () => assert.strictEqual(L.finalReading(picks[ids.B], kick(ids.B)).reading.trigger, "compo"));
test("lecture finale : final_reading_id absent -> règle + anomalie", () => { const r = L.finalReading(picks[ids.C], kick(ids.C)); assert.ok(r.reading); assert.ok(r.anomaly); });
test("COH-01 détecté malgré passed:true", () => { const r = picks[ids.D].readings[0]; assert.ok(L.recheck(r, meta.rules).fails.some(f => f.id === "COH-01")); });
test("COH-04 détecté (ev 0,031)", () => { const r = picks[ids.F].readings[0]; assert.ok(L.recheck(r, meta.rules).fails.some(f => f.id === "COH-04")); });
test("lecture normale cohérente", () => { const r = picks[ids.B].readings[0]; assert.ok(L.recheck(r, meta.rules).ok); });
test("bilan dc-v1 valeurs 14.2", () => {
  const xs = L.filterSettled(bilan.settled, "dc-v1"); const T = L.summarize(xs.filter(x => x.label === "TICKET")), S = L.summarize(xs.filter(x => x.label === "SKIP"));
  assert.deepStrictEqual([T.n, T.won, T.lost, T.void, T.no_odds], [6, 4, 1, 1, 1]); assert.strictEqual(L.pct(T.hit_rate), "80,0 %"); assert.strictEqual(L.units(T.pl_units), "+0,50 u");
  assert.strictEqual(L.signedPct(T.roi), "+12,5 %"); assert.strictEqual(L.odds(T.avg_odds), "1,65");
  assert.strictEqual(L.pct(S.hit_rate), "50,0 %"); assert.strictEqual(L.units(S.pl_units), "−1,00 u"); assert.strictEqual(L.signedPct(S.roi), "−25,0 %"); assert.strictEqual(L.odds(S.avg_odds), "1,80");
  assert.strictEqual(L.paperCount(bilan.settled, "dc-v1"), 5);
  assert.strictEqual(L.valueSentence(T, S, 30), "Échantillon trop petit pour conclure (5 tickets, 4 skips)");
  assert.deepStrictEqual(L.compareAggregates(T, S, bilan.aggregates["dc-v1"]), []);
  const mm = SD("results/bilan_mismatch.json"); assert.ok(L.compareAggregates(T, S, mm.aggregates["dc-v1"]).length > 0);
});
test("bilan par semaine", () => { const w = Object.fromEntries(L.breakdown(L.filterSettled(bilan.settled, "dc-v1"), x => L.isoWeek(x.date)).map(r => [r.key, [r.T.pl_units, r.S.pl_units]]));
  assert.deepStrictEqual(w, { "2026-W41": [1.3, 0.6], "2026-W42": [-0.8, -1.6] }); });
test("méthodes séparées dc-v0", () => { const T = L.summarize(L.filterSettled(bilan.settled, "dc-v0").filter(x => x.label === "TICKET")); assert.deepStrictEqual([T.n, T.hit_rate, T.pl_units], [3, 1, 1.5]); });
test("suivis : archivage à 08:00 et tri", () => {
  const s = { 1: { kickoff: "2026-10-12T21:00:00+02:00" }, 2: { kickoff: "2026-10-13T01:10:00+02:00" }, 3: { kickoff: "2026-10-12T15:00:00+02:00" } };
  assert.deepStrictEqual(L.suivisSplit(s, new Date("2026-10-12T12:00:00+02:00")).active.map(x => x.fixture_id), [3, 1, 2]);
  const z = L.suivisSplit(s, new Date("2026-10-13T09:00:00+02:00")); assert.strictEqual(z.active.length, 0); assert.strictEqual(z.archived.length, 3);
});
test("import sans doublon", () => { const n = new Date(); const ex = [{ fixture_id: 5, kickoff: "2026-10-12T21:00:00+02:00", home: "a", away: "b", league: "x" }];
  const a = L.importSuivis({}, ex, n); const b = L.importSuivis(a.suivis, ex, n); assert.strictEqual(a.added, 1); assert.strictEqual(b.added, 0); assert.strictEqual(Object.keys(b.suivis).length, 1); });
test("statuts", () => { assert.strictEqual(L.statusText({ status: { short: "PST" }, kickoff: "2026-10-12T15:00:00+02:00" }), "Reporté"); assert.strictEqual(L.statusText({ status: { short: "2H", elapsed: 62 }, score: {} }), "62'"); });
test("résultat d'un pick", () => { assert.strictEqual(L.outcome("DC", "1X", 2, 0), "won"); assert.strictEqual(L.outcome("OU2.5", "over", 1, 1), "lost"); assert.strictEqual(L.outcome("1X_BTTS", "yes", 1, 1), "won"); });
test("données anciennes", () => { assert.strictEqual(L.staleText(new Date("2026-10-12T15:00:00+02:00"), "2026-10-12T10:00:00+02:00"), "5 h"); assert.strictEqual(L.staleText(new Date("2026-10-12T12:00:00+02:00"), "2026-10-12T10:00:00+02:00"), null); });
test("schema_version", () => { assert.ok(L.schemaOk({ schema_version: "6.0" })); assert.ok(!L.schemaOk({ schema_version: "7.0" })); });
test("heure exacte 16h15", () => { assert.strictEqual(L.hm("2026-10-12T16:15:00+02:00"), "16h15"); assert.strictEqual(L.statusText({ status: { short: "NS" }, kickoff: "2026-10-12T09:05:00+02:00" }), "9h05"); });
test("live : score + minute", () => { assert.strictEqual(L.statusText({ status: { short: "2H", elapsed: 50 }, score: { home: 1, away: 0 } }), "1-0 50'"); assert.strictEqual(L.statusText({ status: { short: "HT" }, score: { home: 0, away: 0 } }), "0-0 MT"); });
test("prochaine lecture : relecture toutes les 3 h (heures fixes HH:00)", () => {
  const n = new Date("2026-10-12T19:05:00+02:00");
  assert.strictEqual(L.nextReading("2026-10-13T01:10:00+02:00", n).toISOString(), new Date("2026-10-12T22:00:00+02:00").toISOString());
  assert.strictEqual(L.nextReading("2026-10-13T20:45:00+02:00", n).toISOString(), new Date("2026-10-12T22:00:00+02:00").toISOString());
  assert.strictEqual(L.nextReading("2026-10-12T19:20:00+02:00", n), null);
  assert.strictEqual(L.nextReading("2026-10-13T10:05:00+02:00", new Date("2026-10-13T06:00:00+02:00")).toISOString(), new Date("2026-10-13T07:00:00+02:00").toISOString());
  assert.strictEqual(L.trigLabel({ trigger: "releco", timestamp: "2026-10-13T16:00:00+02:00", releco_count: 3 }, {}), "Relecture 16h (inchangée ×3)");
});
test("verrou TICKET : une relecture SKIP ne remplace pas le ticket publié", () => {
  const rs = [{ reading_id: "a-r1", timestamp: "2026-10-12T16:48:00+02:00", label: "TICKET", lineups_confirmed: false, pick: {} },
              { reading_id: "a-r2", timestamp: "2026-10-12T20:25:00+02:00", label: "SKIP", lineups_confirmed: true, pick: {} }];
  const fr = L.finalReading({ readings: rs }, "2026-10-12T20:45:00+02:00");
  assert.strictEqual(fr.reading.reading_id, "a-r1");
  assert.strictEqual(L.laterReadings(fr)[0].reading_id, "a-r2");
  const c = L.finalReading({ readings: rs, cancelled: true, cancel_reason_fr: "gardien blessé" }, "2026-10-12T20:45:00+02:00").reading;
  assert.strictEqual(c.reading_id, "a-r2"); assert.strictEqual(c.ticket_reading.reading_id, "a-r1"); assert.strictEqual(c.label, "SKIP"); assert.ok(c.cancelled && /Annulé — info de dernière heure : gardien blessé/.test(c.skip_reasons_fr[0]));
});
test("annulation relecture : bandeau clair, lecture actuelle = dernière lecture (v6.0.40)", () => {
  const rs = [{ reading_id: "b-r1", timestamp: "2026-10-15T19:04:00+02:00", label: "TICKET", model_probability: 0.568, ev: 0.057, odds_seen: { value: 1.86 }, pick: { market: "OU2.5", selection: "under", label_fr: "Moins de 2,5 buts" }, reasoning_fr: ["Tous les critères dc-v1 sont remplis (EV +5,7 %)."] },
    { reading_id: "b-r8", timestamp: "2026-10-16T16:10:00+02:00", label: "SKIP", model_probability: 0.78, pick: { market: "DC", selection: "1X", label_fr: "Radnik ou nul (1N)" }, reasoning_fr: ["Modèle 78,0 %"], skip_reasons_fr: ["Écart"],
      ticket_recheck: { market: "OU2.5", selection: "under", model_probability: 0.568, odds: 1.79, ev: 0.017, still_ok: false, reasons_fr: ["EV +1,7 % < 5 %"] } }];
  const c = L.finalReading({ readings: rs, cancelled: true, cancel_reason_fr: "EV +1,7 % < 5 %", cancel_label_fr: "Annulé (relecture 16h)" }, "2026-10-16T17:00:00+02:00").reading;
  assert.strictEqual(c.reading_id, "b-r8"); assert.strictEqual(c.pick.selection, "1X"); assert.ok(!c.reasoning_fr.join(" ").includes("Tous les critères"));
  assert.strictEqual(L.cancelBanner(c.cancel), "Ticket Moins de 2,5 buts annulé à la relecture 16h — la cote est passée de 1,86 à 1,79 (EV +1,7 % < 5 %), le modèle n'a pas changé (56,8 %)");
});
test("version : config.js = index.html (?v=) = sw.js par défaut", () => {
  const fs = require("fs"), p = require("path"), dir = p.join(__dirname, "..");
  const v = /APP_VERSION: "([^"]+)"/.exec(fs.readFileSync(p.join(dir, "config.js"), "utf8"))[1];
  const html = fs.readFileSync(p.join(dir, "index.html"), "utf8");
  for (const f of ["config.js", "logic.js", "app.js"]) assert.ok(html.includes(`${f}?v=${v}`), f);
  assert.ok(fs.readFileSync(p.join(dir, "sw.js"), "utf8").includes(`"${v}"`));
});
test("combos double chance + buts", () => { assert.strictEqual(L.shortSel("X2_U3.5", "yes"), "N2 & −3,5"); assert.strictEqual(L.shortSel("1X_O1.5", "yes"), "1N & +1,5"); assert.strictEqual(L.shortSel("12_BTTS", "yes"), "12 & BTTS"); });
test("résultats combos et mi-temps", () => {
  assert.strictEqual(L.outcome("X2_U3.5", "yes", 1, 1), "won"); assert.strictEqual(L.outcome("12_O2.5", "yes", 2, 2), "lost");
  assert.strictEqual(L.outcome("HT1X2", "1", 1, 2, { home: 1, away: 0 }), "won"); assert.strictEqual(L.outcome("HT1X2", "X", 0, 0, null), null);
  assert.strictEqual(L.shortSel("HT1X2", "X"), "MT N");
});
test("combiné : moins de 2 tickets → message ; sinon produit des probas et des cotes", () => {
  assert.strictEqual(L.combineInfo(null).text, "Pas de combiné aujourd'hui : moins de 2 tickets validés");
  assert.ok(L.combineInfo({ legs: [{ prob: 0.6, odds: 1.8 }] }).none);
  const c = L.combineInfo({ legs: [{ prob: 0.6, odds: 1.8 }, { prob: 0.6, odds: 1.7 }] });
  assert.ok(Math.abs(c.odds - 3.06) < 1e-9 && Math.abs(c.p - 0.36) < 1e-9 && Math.abs(c.ev - (0.36 * 3.06 - 1)) < 1e-9);
});
test("SKIP : 2e ligne résultat/BTTS (libellé court)", () => { assert.strictEqual(L.shortSel("DC", "12"), "12"); assert.strictEqual(L.shortSel("BTTS", "no"), "BTTS non"); });
test("statut ESPN", () => {
  assert.deepStrictEqual(L.espnStatus({ status: { period: 2, displayClock: "62'", type: { state: "in", name: "STATUS_SECOND_HALF" } } }), { short: "2H", elapsed: 62 });
  assert.deepStrictEqual(L.espnStatus({ status: { type: { state: "in", name: "STATUS_HALFTIME" } } }), { short: "HT", elapsed: 45 });
  assert.strictEqual(L.espnStatus({ status: { type: { state: "pre", name: "STATUS_SCHEDULED" } } }), null);
});

test("tag vérification X SKIP", () => {
  assert.strictEqual(L.skipTag(null), null);
  assert.strictEqual(L.skipTag({ status: "confirmed" }).text, "Vérifié ✓");
  assert.strictEqual(L.skipTag({ status: "cancelled", reason_fr: "gardien titulaire forfait" }).text, "Annulé (info : gardien titulaire forfait)");
  assert.strictEqual(L.skipTag({ status: "pending" }).cls, "wait");
});

test("suivi : même marché comparé, changement de règle SKIP, date", () => {
  const P = (x2, o15) => ({ DC: { "1X": 0.6, X2: x2, "12": 0.7 }, "OU1.5": { over: o15, under: 1 - o15 } });
  const a = { timestamp: "2026-10-13T07:09:33+02:00", label: "SKIP", pick: { market: "DC", selection: "X2" }, model_probability: 0.589, probabilities: P(0.589, 0.75) };
  const b = { timestamp: "2026-10-13T11:21:56+02:00", label: "SKIP", pick: { market: "OU1.5", selection: "over" }, model_probability: 0.757, probabilities: P(0.613, 0.757) };
  const c = L.histChange(a, b);
  assert.strictEqual(c.text, "N2 58,9 % → 61,3 %"); assert.ok(c.rule); assert.strictEqual(c.reason, "Changement d'affichage (règle SKIP du 13/10)");
  assert.strictEqual(L.histChange(a, a), null);
  assert.strictEqual(L.histWhen("2026-10-12T17:42:08+02:00", "2026-10-13"), "12/10 17:42");
  assert.strictEqual(L.histWhen("2026-10-13T07:09:33+02:00", "2026-10-13"), "07:09");
});

test("relecture d'un ticket : pick du ticket réévalué", () => {
  const t = { market: "DC", selection: "1X", model_probability: 0.574, odds: 1.88, ev: 0.079, still_ok: false, reasons_fr: ["Écart modèle/marché 5,8 pts > 5"] };
  assert.strictEqual(L.recheckText(t), "Relecture (info) : 1N 57,4 % · cote 1,88 · EV +7,9 % · critères plus OK : Écart modèle/marché 5,8 pts > 5");
  assert.ok(L.recheckText({ ...t, still_ok: true, reasons_fr: [] }, "20:42").endsWith("critères toujours OK"));
});

test("apprentissage Valeur : familles exclues en tête", () => {
  const f = L.valeurFamilies({ families: { "OU2.5 plus": { n: 300, roi: -0.02, ci80: [-0.09, 0.04], excluded: false }, "1N2": { n: 300, roi: -0.16, ci80: [-0.24, -0.09], excluded: true }, "BTTS": { n: 1, roi: 0.5, excluded: false } } });
  assert.deepStrictEqual(f.map(x => x.name), ["1N2", "OU2.5 plus", "BTTS"]); assert.deepStrictEqual(f[2].ci80, [null, null]);
});


test("legStatus combiné fun : réglé, direct anticipé, en attente", () => {
  const fx = (st, h, a) => ({ status: { short: st }, score: { home: h, away: a } });
  const o15 = { market: "OU1.5", selection: "over" }, u35 = { market: "OU3.5", selection: "under" }, dc = { market: "DC", selection: "1X" };
  assert.strictEqual(L.legStatus({ ...o15, outcome: "lost" }, fx("2H", 3, 0)), "lost");
  assert.strictEqual(L.legStatus(o15, fx("1H", 1, 1)), "won");
  assert.strictEqual(L.legStatus(o15, fx("1H", 1, 0)), "live");
  assert.strictEqual(L.legStatus(u35, fx("2H", 3, 1)), "lost");
  assert.strictEqual(L.legStatus(u35, fx("2H", 2, 1)), "live");
  assert.strictEqual(L.legStatus(dc, fx("2H", 0, 2)), "live");
  assert.strictEqual(L.legStatus(dc, fx("FT", 0, 2)), "lost");
  assert.strictEqual(L.legStatus(dc, fx("NS", null, null)), "pending");
  assert.strictEqual(L.legStatus(dc, undefined), "pending");
  const s = L.legsSummary(["won", "won", "lost", "live"]);
  assert.strictEqual(s.text, "2 ✅ · 1 ❌ · 1 en cours"); assert.strictEqual(s.status, "lost");
  assert.strictEqual(L.legsSummary(["won", "void"]).status, "won");
});

test("combiné fun : jambes classées par datetime de coup d'envoi (pas HH:MM)", () => {
  // 1h30 demain avant 18h45 aujourd'hui si on ne regarde que l'heure → faux
  const legs = [
    { fixture_id: 3, kickoff: "2026-10-15T01:30:00+02:00", home: "A", away: "B" },
    { fixture_id: 1, kickoff: "2026-10-14T18:45:00+02:00", home: "C", away: "D" },
    { fixture_id: 2, kickoff: "2026-10-14T20:00:00+02:00", home: "E", away: "F" },
    { fixture_id: 4, kickoff: "2026-10-14T18:45:00+02:00", home: "G", away: "H" },
  ];
  const s = L.sortLegsByKickoff(legs);
  assert.deepStrictEqual(s.map(l => l.fixture_id), [1, 4, 2, 3]);
  assert.strictEqual(legs[0].fixture_id, 3); // entrée non mutée
});
test("jauge API et texte Tout relire", () => {
  const g = L.apiGauge({ used: 450, limit: 7500, plan: "Pro", plan_expires: "2026-11-16T17:01:00+01:00" });
  assert.deepStrictEqual([g.pct, g.left, g.level, g.end], [94, 7050, "ok", "16/11"]);
  assert.strictEqual(L.apiGauge({ used: 7000, limit: 7500 }).level, "low"); assert.strictEqual(L.apiGauge(null), null);
  assert.strictEqual(L.relecAllText(new Date("2026-10-15T19:45:00Z")), "Relis tous les matchs à venir (relecture complète) — demandé le 15/10 21h45");
});
test("v6.0.41 historique insuffisant : seuil tickets, SKIP seulement", () => {
  const rules = { ticket_criteria: { min_team_matches: 20 } };
  const r = { label: "SKIP", team_samples: { home: 4, away: 33 } };
  assert.deepStrictEqual(L.histo(r, rules).text_fr, "⚠️ Historique insuffisant (4 / 33 matchs)");
  assert.strictEqual(L.histo({ ...r, team_samples: { home: 20, away: 20 } }, rules), null);
  assert.strictEqual(L.histo({ ...r, label: "TICKET" }, rules), null);
  assert.strictEqual(L.histo({ ...r, cancelled: true }, rules), null);
  const flag = { home: 1, away: 2, min: 20, text_fr: "x" };
  assert.strictEqual(L.histo({ label: "SKIP", history_insufficient: flag }, rules), flag);
  assert.strictEqual(L.histo({ label: "SKIP" }, rules), null);
});
test("v6.0.44 historique inter-divisions : SKIP débloqué, plus de bandeau", () => {
  const rules = { ticket_criteria: { min_team_matches: 20 } };
  const r = { label: "SKIP", team_samples: { home: 6, away: 38 }, history_cross: { text_fr: "Historique complété avec la division précédente (relégué)" } };
  assert.strictEqual(L.histo(r, rules), null);
  assert.ok(L.histo({ ...r, history_cross: undefined }, rules));
});
test("v6.0.45 combiné : jambe de ticket annulé comptée à cote 1", () => {
  const c = { legs: [{ fixture_id: 1, odds: 1.86, prob: 0.565, cancelled: true }, { fixture_id: 2, odds: 1.84, prob: 0.577 }] };
  const ci = L.combineInfo(c); assert.strictEqual(ci.cancelled, 1); assert.ok(Math.abs(ci.odds - 1.84) < 1e-9 && Math.abs(ci.p - 0.577) < 1e-9);
});
