# Changelog — Analyse Match

## v6.0.0 — 2026-10-12
- **Demande d'origine** : construction complète du site v6 à partir du cahier des charges `cahier_des_charges_analyse_match_v6.md` (Bruno, via Grok Bot).
- **Ce qui a changé** : nouveau site statique (HTML/CSS/JS sans framework) : Agenda (Affiches 10/20/30, Heure, Nuit, Suivis), page match, Bilan, Règles et à propos, Diagnostic, cache hors ligne, mode exemple `?data=sample&now=…&variant=mismatch|v7|big`.
- **Fichiers touchés** : index.html, styles.css, config.js, logic.js, app.js, sw.js, manifest.webmanifest, icons/, sample-data/, tests/.
- **Tests rejoués** : tests/logic.test.js (node --test) et tests/ta.py (Playwright, TA-01 à TA-47), voir tests/RAPPORT.md.

## v6.0.22 — 2026-10-13
- **Demande** : idées GitHub (penaltyblog, sports-betting, scikit-learn) validées par Bruno.
- **Ce qui a changé** : Bilan → cartes « Cote de clôture (CLV) », « Bankroll simulée (Kelly 1/4, plafond 2 %) » et section « Fiabilité du modèle » (calibration, Brier, log-loss vs bookmakers, backtest + matchs réels). Page match : poids des absents (part des xG+xA, Understat, Big 5). Aucun ticket ni règle modifié.

## v6.0.23 — 2026-10-13
- Bankroll Kelly 1/4 : 4 lignes (Tickets, SKIP Probable, Résultat, Valeur), colonnes paris misés / sans mise, note explicative.

## v6.0.24 — 2026-10-13
- Agenda : « Masquer les matchs terminés » (mémorisé) et filtre « En direct » avec compteur mis à jour toutes les 30 s.

## v6.0.25 — 2026-10-13
- Tickets tardifs (badge 🆕 TICKET tardif, bilan séparé, ligne Kelly) et annulations H-1 (badge ⚠️ Annulé — info de dernière heure, journal des annulés).

## v6.0.27 — 2026-10-13
- Combiné fun : statut de chaque sélection au fur et à mesure (✅ gagné, ❌ perdu, ⏳ en cours/à venir), avec score en direct ; décision anticipée en direct quand elle est certaine (+1,5 gagné dès 2 buts, −3,5 perdu dès 4 buts, BTTS). Ligne résumé « X ✅ · Y ❌ · Z en cours » et combiné perdu dès la première sélection perdue. Affichage seulement.
