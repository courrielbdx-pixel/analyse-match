"""Tests d'acceptation TA-01..TA-47 (Playwright Chromium headless, serveur local)."""
import json, os, re, subprocess, sys, time, glob, traceback
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); BASE = os.environ.get("AM_BASE", "http://localhost:8765/")
ids = json.load(open(os.path.join(ROOT, "tests/ids.json"))); R = {}
def U(now="2026-10-12T12:00:00+02:00", extra="", h="#/agenda"): return f"{BASE}?data=sample&now={now.replace('+', '%2B')}{extra}{h}"
def rec(i, ok, how, note=""): R[i] = (("OK" if ok else "KO") if ok is not None else "non testé", how, note); print(i, R[i][0], note)
def run(i, how, fn):
    try: ok, note = fn(); rec(i, ok, how, note)
    except Exception as e: rec(i, False, how, "exception: " + str(e)[:200])
AUTO = "test automatisé Playwright (Chromium 390×844)"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 844}, timezone_id="Europe/Paris", permissions=["clipboard-read", "clipboard-write"])
    pg = ctx.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    def go(url, sel=".row, .empty, .card"):
        pg.goto(url); pg.wait_for_selector(sel, timeout=10000); pg.wait_for_timeout(150)
    def rows(): return pg.query_selector_all("#list li.row")
    def times(): return [r.query_selector(".time").inner_text() for r in rows()]
    def view(v): pg.click(f"[data-view={v}]"); pg.wait_for_timeout(150)
    def region(v): pg.select_option("#region", v); pg.wait_for_timeout(150)
    def count(v): return int(pg.inner_text(f"[data-view={v}] .cnt"))
    go(U()); pg.evaluate("localStorage.clear()"); go(U())
    run("TA-01", AUTO, lambda: (pg.inner_text(".dt.sel").replace("\n", " ") == "lun. 12" and len(pg.query_selector_all(".dt")) == 8 and pg.inner_text(".dt >> nth=0").startswith("sam.") and pg.inner_text(".dt >> nth=7").replace("\n"," ") == "sam. 17" and "DONNÉES D'EXEMPLE" in pg.inner_text("body"), pg.inner_text(".dates").replace("\n", " ")))
    def ta02():
        view("affiches"); t = times(); ok = len(t) == 10 and count("affiches") == 10 and t == sorted(t) and all("08:00" <= x <= "23:59" for x in t)
        une = pg.query_selector_all("#list .une"); return ok and len(une) == 1, f"{len(t)} lignes {t}"
    run("TA-02", AUTO, ta02)
    def ta03():
        sets = []
        for n in (10, 20, 30):
            pg.click(f"[data-n='{n}']"); pg.wait_for_timeout(150); sets.append({r.get_attribute("data-open") for r in rows()})
        ok = [len(s) for s in sets] == [10, 20, 30] and sets[0] <= sets[1] <= sets[2]; pg.click("[data-n='10']"); return ok, str([len(s) for s in sets])
    run("TA-03", AUTO, ta03)
    def ta04():
        region("france"); ok = len(rows()) == 8 and "8 affiches disponibles (sur 10 demandées)" in pg.inner_text("#list"); region("toutes"); return ok, f"{len(rows())}"
    run("TA-04", AUTO, ta04)
    def ta05():
        res = []
        for _ in range(2):
            pg.click("[data-n='30']"); pg.wait_for_timeout(100); r = pg.evaluate("window.AMLogic.affiches(window.__AM.state.data['2026-10-12'].fixtures.fixtures,'2026-10-12','toutes',30).ranked.map(f=>f.fixture_id)"); res.append(r); pg.reload(); pg.wait_for_selector(".row")
        pg.click("[data-n='10']"); r = res[0]; return res[0] == res[1] and r.index(ids["TIE_T1"]) < r.index(ids["TIE_T3"]), "tier 1 devant tier 3, ordre stable"
    run("TA-05", AUTO, ta05)
    def ta06():
        view("nuit"); t = times(); return t == ["00:00", "01:10", "02:30", "03:15", "05:00", "07:59"] and count("nuit") == 6, str(t)
    run("TA-06", AUTO, ta06)
    def ta07():
        pg.click("[data-date='2026-10-13']"); pg.wait_for_timeout(300); t = times(); ok = "02:30" in t and "00:00" not in t; pg.click("[data-date='2026-10-12']"); pg.wait_for_timeout(200); return ok, str(t)
    run("TA-07", AUTO, ta07)
    def ta08():
        view("heure"); t = times(); names = pg.inner_text("#list"); seps = pg.query_selector_all("#list .sep")
        return len(rows()) == 45 and count("heure") == 45 and len(seps) > 5 and "Non pariable" not in names, f"{len(rows())} lignes, {len(seps)} séparateurs"
    run("TA-08", AUTO, ta08)
    def ta09():
        c = {}
        for r in ("france", "uefa", "europe", "ameriques", "asie_oceanie", "monde"): region(r); c[r] = len(rows())
        region("toutes"); return c == {"france": 8, "uefa": 6, "europe": 15, "ameriques": 9, "asie_oceanie": 4, "monde": 3}, str(c)
    run("TA-09", AUTO, ta09)
    def ta10():
        txt = pg.inner_text("#list"); ok = "Premier League · Angleterre" in txt and "Premier League · Ukraine" in txt
        long = pg.query_selector(f"li[data-open='{ids['LONG']}']"); nm = long.query_selector(".nm")
        trunc = pg.evaluate("e => getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth", nm)
        tbox = long.query_selector(".time").bounding_box(); other = rows()[0].query_selector(".time").bounding_box()
        ini = long.query_selector(".ini") is not None
        return ok and trunc and abs(tbox["x"] - other["x"]) < 1 and ini, f"homonymes {ok}, troncature {trunc}, initiales {ini}"
    run("TA-10", AUTO, ta10)
    def ta11():
        g = lambda i: pg.query_selector(f"li[data-open='{i}']")
        pst = g(ids["PST"]).query_selector(".time").inner_text(); ft = g(ids["FT"]); lv = g(ids["LIVE"])
        return pst == "Reporté" and ft.query_selector(".time").inner_text() == "2-0" and ft.query_selector(".res") is not None and lv.query_selector(".time").inner_text() == "62'", f"PST={pst}, FT={ft.query_selector('.time').inner_text()}, live={lv.query_selector('.time').inner_text()}"
    run("TA-11", AUTO, ta11)
    def ta12():
        n_none = len(pg.query_selector_all("#list .badge.none")); tk = pg.query_selector_all("#list .badge.tk"); sk = pg.query_selector_all("#list .badge.sk")
        paper = all("papier" in b.inner_text() for b in tk); a = pg.query_selector(f"li[data-open='{ids['A']}'] .badge").inner_text()
        return n_none == 15 and len(tk) == 8 and len(sk) == 22 and paper and a.startswith("SKIP"), f"pas lus {n_none}, TICKET {len(tk)}, SKIP {len(sk)}"
    run("TA-12", AUTO, ta12)
    def ta13():
        c2 = br.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/New_York"); q = c2.new_page()
        q.goto(U("2026-10-25T10:00:00+01:00")); q.wait_for_selector(".row, .empty"); q.click("[data-view=heure]"); q.wait_for_timeout(200)
        t = [x.inner_text() for x in q.query_selector_all("#list .time")]; c2.close(); return t == ["15:00", "15:00"], f"fuseau New York : {t}"
    run("TA-13", AUTO + ", fuseau America/New_York", ta13)
    # Suivis
    def star(i): pg.click(f"button[data-star='{i}']"); pg.wait_for_timeout(150)
    def ta14():
        view("heure"); star(ids["F12_2100"]); star(ids["A"]); pg.click("[data-date='2026-10-13']"); pg.wait_for_timeout(300); star(ids["F13_0110"]); pg.click("[data-date='2026-10-12']"); pg.wait_for_timeout(200)
        pg.close(); q = ctx.new_page(); q.goto(U()); q.wait_for_selector(".row"); n = int(q.inner_text("[data-view=suivis] .cnt")); return q, n == 3, f"compteur Suivis après réouverture = {n}"
    try:
        pg2, ok, note = ta14(); pg = pg2; pg.on("pageerror", lambda e: errors.append(str(e))); rec("TA-14", ok, AUTO + " (nouvel onglet, même profil)", note)
    except Exception as e: rec("TA-14", False, AUTO, str(e)[:200])
    def ta15():
        view("suivis"); t = [r.inner_text() for r in rows()]; i21 = next(k for k, x in enumerate(t) if "21:00" in x); i01 = next(k for k, x in enumerate(t) if "01:10" in x)
        return i21 < i01 and len(t) == 3, " | ".join(x.split("\n")[0] + " " + x.split("\n")[1] for x in t)
    run("TA-15", AUTO, ta15)
    def ta16():
        q = ctx.new_page(); q.goto(U("2026-10-13T09:00:00+02:00")); q.wait_for_selector(".views"); q.click("[data-view=suivis]"); q.wait_for_timeout(150)
        act = len(q.query_selector_all("#list > ul.list:not(.past) li.row")); q.check("#showPast"); q.wait_for_timeout(150); past = len(q.query_selector_all("#list ul.past li.row"))
        q.uncheck("#showPast"); q.close(); return act == 0 and past == 3, f"actifs {act}, passés {past}"
    run("TA-16", AUTO, ta16)
    def ta17():
        view("suivis")
        with pg.expect_download() as d: pg.click("#exp")
        path = d.value.path(); data = json.load(open(path)); clip = pg.evaluate("navigator.clipboard.readText()")
        pg.evaluate("localStorage.removeItem('am.v6.suivis')"); pg.reload(); pg.wait_for_selector(".views"); pg.click("[data-view=suivis]"); n0 = count("suivis")
        pg.set_input_files("#imp", path); pg.wait_for_timeout(300); n1 = count("suivis"); pg.set_input_files("#imp", path); pg.wait_for_timeout(300); n2 = count("suivis")
        return len(data) == 3 and json.loads(clip) == data and n0 == 0 and n1 == 3 and n2 == 3, f"export {len(data)}, après vidage {n0}, import {n1}, 2e import {n2}"
    run("TA-17", AUTO, ta17)
    def ta18():
        region("ameriques"); n = len(rows()); exp = pg.evaluate("Object.values(JSON.parse(localStorage.getItem('am.v6.suivis'))).filter(s=>s.region==='ameriques').length"); region("toutes"); return n == exp and n >= 1, f"{n} suivis Amériques (attendu {exp})"
    run("TA-18", AUTO, ta18)
    # Page match
    def M(i): go(U(h=f"#/match/{i}?d=2026-10-12"), ".card, .empty")
    def ta19():
        M(ids["A"]); h = pg.inner_text(".hist"); lis = pg.query_selector_all(".hist li"); fin = pg.inner_text(".hist li.final")
        rap = pg.inner_text(".rap"); return len(lis) == 4 and "Manuel · 07:50" in fin and "SKIP → TICKET" in h and "TICKET → SKIP" in h and "Cote passée" in h and "4 lectures" in pg.inner_text("body") and rap.count("SKIP") >= 1, fin
    run("TA-19", AUTO, ta19)
    run("TA-20", AUTO, lambda: (M(ids["B"]) or "Compo" in pg.inner_text(".hist li.final"), pg.inner_text(".hist li.final")))
    def ta21():
        M(ids["C"]); ok1 = pg.query_selector(".hist li.final") is not None; go(U(h="#/diagnostic"), ".card"); d = pg.inner_text("body"); return ok1 and str(ids["C"]) in d and "final_reading_id absent" in d, "anomalie listée dans /diagnostic"
    run("TA-21", AUTO, ta21)
    def ta22():
        M(ids["D"]); k = pg.query_selector(".coh.ko"); col = pg.evaluate("e=>getComputedStyle(e).color", k) if k else ""; return k is not None and "COH-01" in k.inner_text() and pg.query_selector(".rap") is not None and col.startswith("rgb(224"), k.inner_text() if k else "absent"
    run("TA-22", AUTO, ta22)
    run("TA-23", AUTO, lambda: (M(ids["F"]) or any("COH-04" in x.inner_text() for x in pg.query_selector_all(".coh.ko")), " / ".join(x.inner_text() for x in pg.query_selector_all(".coh.ko"))))
    def ta24():
        M(ids["B"]); body = pg.inner_text("body").lower(); code = subprocess.run(["grep", "-ril", "rien de neuf", ROOT, "--include=*.js", "--include=*.html", "--include=*.css", "--exclude-dir=tests"], capture_output=True, text=True).stdout.strip()
        return "rien de neuf" not in body and pg.query_selector(".web") is None and code == "", "0 occurrence dans le code livré"
    run("TA-24", AUTO + " + grep", ta24)
    def ta25():
        M(ids["A"]); t = pg.inner_text(".rap"); tip = pg.get_attribute(".tip", "title"); probs_open = pg.evaluate("document.querySelector('details.probs').open")
        pg.click("details.probs summary"); ts = pg.inner_text("details.probs")
        return "Probabilité du modèle : 78,0 %" in t and "Ce n'est pas une garantie" in tip and not probs_open and "indicatif" in ts and "confiance" not in pg.inner_text("body").lower() and "score prédit" not in pg.inner_text("body").lower(), "proba 78,0 %, bloc fermé par défaut, 3 scores indicatifs"
    run("TA-25", AUTO, ta25)
    run("TA-26", AUTO, lambda: (M(ids["A"]) or len(pg.query_selector_all(".rap .rb")) == 1, "une seule sélection dans le Rapport"))
    def ta27():
        M(ids["B"]); a = pg.query_selector("h2:has-text('Classement')") is None; b = "Contexte" in pg.inner_text("body")
        M(ids["NOREAD_NODETAIL"]); c = pg.query_selector("h2:has-text('Contexte')") is None and pg.query_selector("h2:has-text('Classement')") is None
        return a and b and c and not errors, f"sans standings : Classement absent ; sans details : Contexte/Classement absents ; erreurs JS {len(errors)}"
    run("TA-27", AUTO, ta27)
    def ta28():
        go(U()); view("heure"); region("europe"); pg.evaluate("window.scrollTo(0, 600)"); pg.wait_for_timeout(100); y0 = pg.evaluate("scrollY")
        el = [r for r in rows() if 200 < r.bounding_box()["y"] < 600][0]; el.query_selector("a").click(); pg.wait_for_selector(".rap, .card"); pg.click("#back"); pg.wait_for_selector(".row"); pg.wait_for_timeout(300)
        y1 = pg.evaluate("scrollY"); v = pg.get_attribute(".vt.sel", "data-view"); r = pg.eval_on_selector("#region", "e=>e.value"); region("toutes")
        return v == "heure" and r == "europe" and abs(y1 - y0) < 5, f"vue {v}, région {r}, défilement {y0}→{y1}"
    run("TA-28", AUTO, ta28)
    def ta29():
        M(ids["NOREAD_NODETAIL"]); b = pg.inner_text("body"); bad = [w for w in ("Analyser", "Relancer", "Tout analyser") if re.search(r"\b" + w + r"\b", " ".join(x.inner_text() for x in pg.query_selector_all("button")))]
        reqs = []; pg.on("request", lambda r: reqs.append(r.url)); pg.click("button.copy"); pg.wait_for_timeout(300); clip = pg.evaluate("navigator.clipboard.readText()")
        return not bad and clip.startswith(f"Relance l'analyse du match {ids['NOREAD_NODETAIL']}") and not reqs, f"boutons interdits {bad}, requêtes au clic {len(reqs)}"
    run("TA-29", AUTO, ta29)
    # Bilan
    def B(extra=""): go(U(extra=extra, h="#/bilan"), ".kpi, .empty")
    def kpi(cls, k): return pg.inner_text(f".kpi.{cls} dd[data-k={k}]")
    def ta30():
        B(); t = [kpi("tk", k) for k in ("n", "won", "lost", "void", "noodds", "hit", "pl", "roi", "avg")]; s = [kpi("sk", k) for k in ("n", "won", "lost", "hit", "pl", "roi", "avg")]
        ok = t[:5] == ["6", "4", "1", "1", "1"] and t[5].startswith("80,0 %") and t[6] == "+0,50 u" and t[7].startswith("+12,5 %") and t[8] == "1,65" and s[:3] == ["4", "2", "2"] and s[3].startswith("50,0 %") and s[4] == "−1,00 u" and s[5].startswith("−25,0 %") and s[6] == "1,80"
        return ok and "Écart entre le bilan" not in pg.inner_text("body"), f"T {t} / S {s}"
    run("TA-30", AUTO, ta30)
    run("TA-31", AUTO, lambda: ("5 / 300 tickets réglés" in pg.inner_text(".banner.paper") and pg.query_selector(".prog i") is not None, pg.inner_text(".banner.paper").split("\n")[0]))
    run("TA-32", AUTO, lambda: ("Échantillon trop petit pour conclure (5 tickets, 4 skips)" in pg.inner_text(".vs"), pg.inner_text(".vs")))
    def ta33():
        a = pg.inner_text("main"); okv1 = "Pick V" not in a and kpi("tk", "n") == "6"; pg.select_option("#method", "dc-v0"); pg.wait_for_selector(".kpi"); pg.wait_for_timeout(200)
        r = [kpi("tk", "n"), kpi("tk", "hit"), kpi("tk", "pl")]; pg.select_option("#method", "dc-v1"); pg.wait_for_timeout(200)
        return okv1 and r[0] == "3" and r[1].startswith("100,0 %") and r[2] == "+1,50 u", f"dc-v0 : {r}"
    run("TA-33", AUTO, ta33)
    def ta34():
        t = pg.query_selector("table[data-table='Par semaine']"); g = lambda w, s: t.query_selector(f"tr[data-key='{w}'] td[data-pl={s}]").inner_text()
        v = [g("2026-W41", "T"), g("2026-W41", "S"), g("2026-W42", "T"), g("2026-W42", "S")]; return v == ["+1,30 u", "+0,60 u", "−0,80 u", "−1,60 u"], str(v) + " ; somme T = +0,50 u = total"
    run("TA-34", AUTO, ta34)
    def ta35():
        B("&variant=mismatch"); a = "Écart entre le bilan calculé et le bilan publié" in pg.inner_text("body"); go(U(extra="&variant=mismatch", h="#/diagnostic"), ".card"); d = pg.inner_text("body")
        return a and "TICKET.pl_units : publié 0.7" in d, "bandeau + détail dans /diagnostic"
    run("TA-35", AUTO, ta35)
    # Réseau, sécurité
    def ta36():
        files = [f for f in glob.glob(ROOT + "/**/*", recursive=True) if os.path.isfile(f) and "/tests/" not in f and "/sample-data/" not in f and not f.endswith(".png")]
        pats = ["x-apisports-key", "api-sports.io", "api-football", "rapidapi", "espn", "apikey", "secret"]; hits = []
        for f in files:
            s = open(f, encoding="utf-8", errors="ignore").read()
            for pt in pats:
                for m in re.finditer(re.escape(pt), s, re.I): hits.append(f"{os.path.relpath(f, ROOT)}:{pt}:{s[max(0,m.start()-25):m.end()+5]!r}")
            for m in re.finditer(r"\b[0-9a-fA-F]{32}\b", s): hits.append(f"{os.path.relpath(f, ROOT)}:hex32")
        logo_only = all("media.api-sports.io" in h for h in hits)
        return (len(hits) == 0, "0 résultat") if not hits else (False, f"{len(hits)} résultat(s), {'uniquement l’hôte des logos media.api-sports.io (ALLOWED_IMAGE_HOSTS/CSP)' if logo_only else hits[:5]}")
    run("TA-36", "grep automatisé sur le code livré", ta36)
    def ta37_38():
        c3 = br.new_context(viewport={"width": 390, "height": 844}); q = c3.new_page(); q.clock.install(); reqs = []
        q.on("request", lambda r: reqs.append((time.time(), r.url))); fails = []; q.on("requestfailed", lambda r: fails.append(r.url))
        q.goto(U()); q.wait_for_selector(".row"); start = len(reqs)
        for _ in range(30): q.clock.run_for(30000)
        vis = [u for _, u in reqs[start:]]; metas = [u for u in vis if u.endswith("meta.json") or "meta.json" in u]
        hosts = {re.sub(r"^https?://([^/]+)/.*$", r"\1", u) for _, u in reqs}
        # onglet masqué
        q.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))"); n0 = len(reqs)
        for _ in range(30): q.clock.run_for(30000)
        hidden = len(reqs) - n0
        q.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'))"); q.wait_for_timeout(500)
        back = [u for _, u in reqs[n0 + hidden:] if "meta.json" in u]; c3.close()
        return (hosts <= {"localhost:8765"} and 1 <= len(metas) <= 4, f"15 min simulées (horloge Playwright), mode exemple : {len(metas)} lectures de meta.json (dont {len([f for f in fails if "meta.json" in f])} échouées), , hôtes {sorted(hosts)}"), (hidden == 0 and len(back) == 1, f"masqué 15 min : {hidden} requête ; au retour : {len(back)} meta.json")
    try:
        (a, an), (b, bn) = ta37_38(); rec("TA-37", a, "Playwright + horloge simulée (pas 15 min réelles ; mode exemple, pas mode réel)", an); rec("TA-38", b, "Playwright + horloge simulée, visibilityState forcé", bn)
    except Exception as e: rec("TA-37", False, AUTO, str(e)[:150]); rec("TA-38", False, AUTO, str(e)[:150])
    def ta39():
        c4 = br.new_context(viewport={"width": 390, "height": 844}); q = c4.new_page(); q.goto(U()); q.wait_for_selector(".row"); q.wait_for_timeout(1500)
        q.reload(); q.wait_for_selector(".row"); q.wait_for_timeout(500); c4.set_offline(True); q.reload(); q.wait_for_selector(".row, .empty", timeout=10000)
        t = q.inner_text("body"); n = len(q.query_selector_all("#list li.row")); c4.close(); return "Hors ligne — données du" in t and n > 0, f"hors ligne : {n} lignes affichées"
    run("TA-39", AUTO + " (context.set_offline + service worker)", ta39)
    def ta40():
        c5 = br.new_context(); q = c5.new_page(); errs = []; q.on("pageerror", lambda e: errs.append(e)); q.goto(BASE + "?data=empty#/agenda"); q.wait_for_selector(".empty"); t = q.inner_text("body"); c5.close()
        return "Données pas encore publiées" in t and not errs, t.split("\n")[3] if len(t.split("\n")) > 3 else t
    run("TA-40", AUTO + " (?data=empty → dossier inexistant, 404)", ta40)
    def ta41():
        go(U("2026-10-12T15:00:00+02:00")); return "Dernière mise à jour il y a 5 h" in pg.inner_text("body"), "meta.generated_at 10:00, now 15:00"
    run("TA-41", AUTO, ta41)
    def ta42():
        go(U()); go(U(extra="&variant=v7"), ".row, .empty"); t = pg.inner_text("body"); n = len(rows()); return "Format de données non reconnu" in t and n > 0, f"E3 affiché, {n} lignes des dernières données valides"
    run("TA-42", AUTO + " (&variant=v7)", ta42)
    def layout(w, h):
        c6 = br.new_context(viewport={"width": w, "height": h}, is_mobile=w < 500, has_touch=w < 500); q = c6.new_page(); res = {}
        for hsh in ("#/agenda", f"#/match/{ids['A']}?d=2026-10-12", "#/bilan", "#/regles", "#/diagnostic"):
            q.goto(U(h=hsh)); q.wait_for_selector(".card, .row, .empty"); q.wait_for_timeout(200)
            res[hsh] = q.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        q.goto(U()); q.wait_for_selector(".row")
        small = q.evaluate("""[...document.querySelectorAll('.tabbar a, button.star, .vt, .dt, .nsel button, select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<44||r.width<40)}).map(e=>e.className||e.tagName)""")
        mainw = q.evaluate("document.querySelector('main').getBoundingClientRect().width"); c6.close(); return res, small, mainw
    def ta43():
        res, small, _ = layout(390, 844); man = os.path.exists(os.path.join(ROOT, "manifest.webmanifest")) and os.path.exists(os.path.join(ROOT, "icons/icon-180.png"))
        return all(res.values()) and not small and man, f"pas de défilement horizontal {all(res.values())}, cibles < 44 px {small[:5]}, manifeste + apple-touch-icon {man} ; Safari iOS réel non testé"
    run("TA-43", "simulation Chromium mobile 390×844 (pas d'iPhone réel)", ta43)
    def ta44():
        a, _, _ = layout(320, 640); b, _, w = layout(1440, 900); return all(a.values()) and all(b.values()) and w <= 720, f"320 px ok {all(a.values())}, 1440 px colonne {w:.0f} px"
    run("TA-44", AUTO, ta44)
    def ta45():
        c7 = br.new_context(viewport={"width": 390, "height": 844}); q = c7.new_page(); t0 = time.time(); q.goto(U(extra="&variant=big")); q.wait_for_selector(".row"); q.click("[data-view=heure]"); q.wait_for_timeout(100)
        n = len(q.query_selector_all("#list li.row")); t1 = time.time() - t0
        st = time.time(); [q.mouse.wheel(0, 800) for _ in range(40)]; q.wait_for_timeout(200); sc = time.time() - st; c7.close(); return n == 300 and t1 < 3 and sc < 5, f"{n} lignes, rendu {t1:.2f} s, 40 défilements {sc:.2f} s"
    run("TA-45", AUTO + " (Chromium headless, pas iPhone)", ta45)
    def ta46():
        go(U()); f = pg.inner_text("#foot"); cfg = re.search(r'APP_VERSION:\s*"([^"]+)"', open(os.path.join(ROOT, "config.js")).read()).group(1)
        cl = re.search(r"^## v(\S+)", open(os.path.join(ROOT, "CHANGELOG.md")).read(), re.M).group(1); return f.startswith("v6.0.0") and cfg == "6.0.0" and cl == "6.0.0", f"pied {f.split(' ·')[0]}, APP_VERSION {cfg}, CHANGELOG v{cl}"
    run("TA-46", AUTO, ta46)
    br.close()
r = subprocess.run(["node", "--test", os.path.join(ROOT, "tests")], capture_output=True, text=True); m = re.search(r"# pass (\d+)\n# fail (\d+)", r.stdout)
rec("TA-47", m and m.group(2) == "0", "node --test tests/logic.test.js", f"{m.group(1)} tests passés, {m.group(2)} échec(s)" if m else r.stdout[-300:])
with open(os.path.join(ROOT, "tests/RAPPORT.md"), "w") as f:
    f.write("# Rapport de tests d'acceptation — v6.0.0\n\nExécuté le " + time.strftime("%d/%m/%Y %H:%M") + " (Europe/Paris), mode exemple sauf mention.\n\n| ID | Résultat | Méthode | Détail |\n|---|---|---|---|\n")
    for k in sorted(R): f.write(f"| {k} | {R[k][0]} | {R[k][1]} | {R[k][2].replace('|', '/')} |\n")
print("OK", sum(v[0] == "OK" for v in R.values()), "KO", sum(v[0] == "KO" for v in R.values()))
