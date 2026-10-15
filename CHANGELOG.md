# Changelog — Analyse Match

## v6.0.38 — 2026-10-15
- Championnats alignés sur l’offre Unibet FR. Retirés (`EXCLUDED_LEAGUES`, réversible) : League One (41), League Two (42), AFC Champions League Elite (17), et leurs matchs retirés du bilan publié (`state/settled.json` intact).
- Ajoutés : Afrique du Sud (288), Chypre (318), Israël (383), Irlande (357), Irlande du Nord (408), Paraguay Apertura/Clausura (250/252), Slovaquie (332), Ukraine (333), Bosnie (315), Azerbaïdjan (419), Biélorussie (116), Géorgie (327), Estonie (329), Islande (164), Algérie (186), Émirats arabes unis (301), Liga Portugal 2 (95), Coupe de Suisse (209). Historique 2023-2026 chargé ; compos/scores ESPN pour rsa.1, cyp.1, isr.1, irl.1, nir.1, par.1. Équipes promues (< 20 matchs) en SKIP.

## v6.0.37 — 2026-10-15
- Bilan publié à partir du 13/10 (`BILAN_START`, réversible) : les matchs du 12/10 (ancienne logique de choix, surtout +/−2,5 et BTTS) sont retirés des tickets, du Bilan SKIP, de Kelly, du CLV et des combinés. `state/settled.json` intact. Note affichée sur la page Bilan.

## v6.0.36 — 2026-10-15
- En-tête : jauge du quota API-Football du jour (% restant, utilisé/limite, plan et date de fin lus via /status à chaque publication, heure de mise à jour), vert/orange/rouge.
- Bouton « 🔄 Tout relire » : copie une demande de relecture complète à coller à Grok Bot (aucun appel serveur).

## v6.0.35 — 2026-10-15
- Affiches : plus de scores à égalité. L’`affiche_score` garde la base de tier (80/60/40/20) et un petit bonus d’historique, et y ajoute la force moyenne des deux équipes (att − déf Dixon-Coles du modèle déjà utilisé pour le pick ; coupes = modèle inter-compétitions), plafonnée pour qu’un tier inférieur ne dépasse jamais un tier supérieur. Affichage seulement — règles dc-v1 / TICKET / SKIP inchangées.

## v6.0.34 — 2026-10-15
- AFC Champions League Two retirée (non jouable chez Unibet) : plus couverte, plus affichée, et ses matchs sont sortis du Bilan tickets et du Bilan SKIP (liste d'exclusion réversible, historique conservé).
- Ajout D1 Lettonie (Virsliga) et D1 Arabie saoudite (Saudi Pro League). Compos/scores : ESPN pour l'Arabie saoudite, API-Football pour la Lettonie (pas couverte par ESPN). Modèle inchangé.

## v6.0.33 — 2026-10-14
- Compos officielles : ESPN (gratuit) devient la source principale, API-Football en repli seulement si ESPN n'a rien (économise le quota ; marche aussi sans le plan Pro pour les ligues couvertes). Source affichée : « compo ESPN » / « compo API ». Modèle inchangé.

## v6.0.32 — 2026-10-14
- Relectures à heures fixes (1h, 4h, 7h, 10h, 13h, 16h, 19h, 22h) ; la lecture du matin de 7h compte comme relecture 7h.
- Relecture dans les 2 sens : ticket annulé (⚠️ « Annulé (relecture HHh) », raison, hors bilan) si les règles dc-v1 échouent nettement ou info web/X contradictoire ; SKIP → 🆕 ticket si toutes les règles passent nettement (marge 1 pt EV / 1 pt écart). Un ticket annulé ne redevient jamais ticket.

## v6.0.31 — 2026-10-14
- Relecture toutes les 3 h (jour et nuit) des matchs non commencés débutant dans les 24 h : « Relecture HHh ». Relectures inchangées regroupées (« inchangée ×N »). Tickets toujours verrouillés.
- Prochaine lecture affichée selon le rythme 3 h.

## v6.0.30 — 2026-10-14
- Combiné fun : sélections classées par datetime de coup d'envoi (date+heure), pour que 18h45 aujourd'hui apparaisse avant 1h30 demain. Affichage seulement.

## v6.0.28 — 2026-10-14
- Agenda : indicateur compos officielles affiché « compo » (vert) sans la coche ✓, pour ne pas la confondre avec un pick gagné. Les marques ✓/✗ de résultat restent inchangées. Affichage seulement.

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
