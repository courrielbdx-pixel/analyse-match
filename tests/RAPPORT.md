# Rapport de tests d'acceptation — v6.0.0

Exécuté le 13/10/2026 23:34 (Europe/Paris), mode exemple sauf mention.

| ID | Résultat | Méthode | Détail |
|---|---|---|---|
| TA-01 | OK | test automatisé Playwright (Chromium 390×844) | sam. 10 dim. 11 lun. 12 mar. 13 mer. 14 jeu. 15 ven. 16 sam. 17 |
| TA-02 | KO | test automatisé Playwright (Chromium 390×844) | 12 lignes ['13h30', '15h15', '15h30', '16h30', '20h00', '21h00', '22h00', '22h15', '23h30', '23h59', '1h10', '2h30'] |
| TA-03 | KO | test automatisé Playwright (Chromium 390×844) | [12, 22, 32] |
| TA-04 | OK | test automatisé Playwright (Chromium 390×844) | 12 |
| TA-05 | OK | test automatisé Playwright (Chromium 390×844) | tier 1 devant tier 3, ordre stable |
| TA-06 | KO | test automatisé Playwright (Chromium 390×844) | ['1h10', '2h30'] |
| TA-07 | KO | test automatisé Playwright (Chromium 390×844) | [] |
| TA-08 | KO | test automatisé Playwright (Chromium 390×844) | 47 lignes, 45 séparateurs |
| TA-09 | KO | test automatisé Playwright (Chromium 390×844) | {'france': 8, 'uefa': 6, 'europe': 15, 'ameriques': 11, 'asie_oceanie': 4, 'monde': 3} |
| TA-10 | OK | test automatisé Playwright (Chromium 390×844) | homonymes True, troncature True, initiales True |
| TA-11 | KO | test automatisé Playwright (Chromium 390×844) | PST=Reporté, FT=2-0
8h30, live=1-0
62'
14h00 |
| TA-12 | KO | test automatisé Playwright (Chromium 390×844) | pas lus 17, TICKET 8, SKIP 22 |
| TA-13 | KO | test automatisé Playwright (Chromium 390×844), fuseau America/New_York | fuseau New York : ['15h00', '15h00'] |
| TA-14 | OK | test automatisé Playwright (Chromium 390×844) (nouvel onglet, même profil) | compteur Suivis après réouverture = 3 |
| TA-15 | OK | test automatisé Playwright (Chromium 390×844) | 09:00 lun. 12 · Ligue 1 · France / 21:00 lun. 12 · Serie A · Italie / 01:10 mar. 13 · Liga Profesional · Argentine |
| TA-16 | OK | test automatisé Playwright (Chromium 390×844) | actifs 0, passés 3 |
| TA-17 | OK | test automatisé Playwright (Chromium 390×844) | export 3, après vidage 0, import 3, 2e import 3 |
| TA-18 | OK | test automatisé Playwright (Chromium 390×844) | 1 suivis Amériques (attendu 1) |
| TA-19 | KO | test automatisé Playwright (Chromium 390×844) | Manuel · 07:50 — 1N · SKIP · 78,0 % — Lecture finale
TICKET → SKIP — Nouvelle lecture |
| TA-20 | OK | test automatisé Playwright (Chromium 390×844) | Compo · 07:20 — 1N · TICKET · 78,0 % — Lecture finale |
| TA-21 | OK | test automatisé Playwright (Chromium 390×844) | anomalie listée dans /diagnostic |
| TA-22 | OK | test automatisé Playwright (Chromium 390×844) | Incohérence détectée : COH-01 — probabilité du pick 61,2 % ≠ probabilités 58,7 % |
| TA-23 | OK | test automatisé Playwright (Chromium 390×844) | Incohérence détectée : COH-04 — EV +3,1 % < 5 % |
| TA-24 | OK | test automatisé Playwright (Chromium 390×844) + grep | 0 occurrence dans le code livré |
| TA-25 | OK | test automatisé Playwright (Chromium 390×844) | proba 78,0 %, bloc fermé par défaut, 3 scores indicatifs |
| TA-26 | OK | test automatisé Playwright (Chromium 390×844) | une seule sélection dans le Rapport |
| TA-27 | OK | test automatisé Playwright (Chromium 390×844) | sans standings : Classement absent ; sans details : Contexte/Classement absents ; erreurs JS 0 |
| TA-28 | OK | test automatisé Playwright (Chromium 390×844) | vue heure, région europe, défilement 600→600 |
| TA-29 | OK | test automatisé Playwright (Chromium 390×844) | boutons interdits [], requêtes au clic 0 |
| TA-30 | OK | test automatisé Playwright (Chromium 390×844) | T ['6', '4', '1', '1', '1', '80,0 % sur 5', '+0,50 u', '+12,5 % sur 4', '1,65'] / S ['4', '2', '2', '50,0 % sur 4', '−1,00 u', '−25,0 % sur 4', '1,80'] |
| TA-31 | OK | test automatisé Playwright (Chromium 390×844) | Mode papier — échantillon insuffisant : 5 / 300 tickets réglés. Ne pas considérer ces résultats comme une preuve. |
| TA-32 | OK | test automatisé Playwright (Chromium 390×844) | Échantillon trop petit pour conclure (5 tickets, 4 skips) |
| TA-33 | OK | test automatisé Playwright (Chromium 390×844) | dc-v0 : ['3', '100,0 % sur 3', '+1,50 u'] |
| TA-34 | OK | test automatisé Playwright (Chromium 390×844) | ['+1,30 u', '+0,60 u', '−0,80 u', '−1,60 u'] ; somme T = +0,50 u = total |
| TA-35 | OK | test automatisé Playwright (Chromium 390×844) | bandeau + détail dans /diagnostic |
| TA-36 | KO | grep automatisé sur le code livré | 14 résultat(s), ["index.html:api-sports.io:'ata: blob: https://media.api-sports.io; sty'", "index.html:espn:'ent.com https://site.api.espn.com;'", "logic.js:espn:'_id); }\\n  // ---- statut ESPN -> s'", "logic.js:espn:'tick.py) ----\\n  function espnStatu'", "logic.js:espn:'erReadings, combineInfo, espnStatu'"] |
| TA-37 | KO | Playwright + horloge simulée (pas 15 min réelles ; mode exemple, pas mode réel) | 15 min simulées (horloge Playwright), mode exemple : 16 lectures de meta.json (dont 8 échouées), , hôtes ['localhost:8765'] |
| TA-38 | OK | Playwright + horloge simulée, visibilityState forcé | masqué 15 min : 0 requête ; au retour : 1 meta.json |
| TA-39 | OK | test automatisé Playwright (Chromium 390×844) (context.set_offline + service worker) | hors ligne : 12 lignes affichées |
| TA-40 | OK | test automatisé Playwright (Chromium 390×844) (?data=empty → dossier inexistant, 404) | 11 |
| TA-41 | OK | test automatisé Playwright (Chromium 390×844) | meta.generated_at 10:00, now 15:00 |
| TA-42 | OK | test automatisé Playwright (Chromium 390×844) (&variant=v7) | E3 affiché, 47 lignes des dernières données valides |
| TA-43 | OK | simulation Chromium mobile 390×844 (pas d'iPhone réel) | pas de défilement horizontal True, cibles < 44 px [], manifeste + apple-touch-icon True ; Safari iOS réel non testé |
| TA-44 | OK | test automatisé Playwright (Chromium 390×844) | 320 px ok True, 1440 px colonne 720 px |
| TA-45 | KO | test automatisé Playwright (Chromium 390×844) (Chromium headless, pas iPhone) | 302 lignes, rendu 0.62 s, 40 défilements 1.50 s |
| TA-46 | KO | test automatisé Playwright (Chromium 390×844) | pied v6.0.27, APP_VERSION 6.0.27, CHANGELOG v6.0.0 |
| TA-47 | OK | node --test tests/logic.test.js | 38 tests passés, 0 échec(s) |
