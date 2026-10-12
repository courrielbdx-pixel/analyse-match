"""Génère /sample-data/ conforme à la section 14 du cahier des charges."""
import json, os, copy, random
OUT = os.path.join(os.path.dirname(__file__), "..", "sample-data")
SV = "6.0"; GEN = "2026-10-12T10:00:00+02:00"
def w(rel, o):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w"), ensure_ascii=False, indent=1)
LOGO = "sample-data/logos/team.svg"
os.makedirs(os.path.join(OUT, "logos"), exist_ok=True)
open(os.path.join(OUT, "logos/team.svg"), "w").write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#3a3f4b" stroke="#8a93a6" stroke-width="2"/></svg>')
REG = {"france": ("Ligue 1", "France", "FR"), "uefa": ("Ligue des champions", "Europe", "EU"), "europe": ("Serie A", "Italie", "IT"),
       "ameriques": ("Liga Profesional", "Argentine", "AR"), "asie_oceanie": ("J1 League", "Japon", "JP"), "monde": ("Amical international", "Monde", "WW")}
nid = [1000]
def fx(date, time, region, score, tier=2, league=None, home=None, away=None, status="NS", sc=None, bettable=True, logo=LOGO, has_details=False, off="+02:00"):
    nid[0] += 1; fid = nid[0]; ln, lc, cc = league or REG[region]
    return {"fixture_id": fid, "kickoff": f"{date}T{time}:00{off}", "timezone": "Europe/Paris",
            "league": {"id": 100 + list(REG).index(region), "name": ln, "country": lc, "country_code": cc, "round": "Journée 7", "logo": LOGO},
            "region": region, "tier": tier, "affiche_score": score, "bettable": bettable,
            "home": {"id": fid*10, "name": home or f"Domicile {fid}", "logo": logo}, "away": {"id": fid*10+1, "name": away or f"Extérieur {fid}", "logo": LOGO},
            "venue": "Stade d'exemple, Ville", "status": {"short": status, "elapsed": None}, "score": {"home": sc[0] if sc else None, "away": sc[1] if sc else None},
            "has_details": has_details}
D = "2026-10-12"; F12 = []
night = [("00:00","ameriques"),("01:10","ameriques"),("02:30","asie_oceanie"),("03:15","ameriques"),("05:00","asie_oceanie"),("07:59","ameriques")]
for i, (t, r) in enumerate(night): F12.append(fx(D, t, r, 30 + i))
F12.append(fx(D, "08:00", "europe", 41.0))
day_regions = ["france"]*8 + ["uefa"]*6 + ["europe"]*14 + ["ameriques"]*5 + ["asie_oceanie"]*2 + ["monde"]*3  # 38
times = [f"{h:02d}:{m:02d}" for h, m in [(8,30),(9,0),(10,15),(11,0),(12,0),(12,30),(13,0),(13,30),(14,0),(14,30),(15,0),(15,15),(15,30),(16,0),(16,30),(17,0),(17,30),(18,0),(18,30),(18,45),(19,0),(19,30),(20,0),(20,15),(20,30),(20,45),(21,0),(21,0),(21,15),(21,30),(21,45),(22,0),(22,15),(22,30),(23,0),(23,15),(23,30),(23,59)]]
random.seed(42); order = list(range(38)); random.shuffle(order)
scores = [round(95 - k*1.3, 1) for k in range(38)]
for k, (t, r) in enumerate(zip(times, day_regions)):
    s = scores[order[k]]
    F12.append(fx(D, t, r, s, tier=1 if r in ("france", "uefa") else 2))
# égalité : deux matchs même score, tiers différents
a = next(f for f in F12 if f["kickoff"].endswith("19:00:00+02:00")); b = next(f for f in F12 if f["kickoff"].endswith("13:00:00+02:00"))
b["affiche_score"] = a["affiche_score"]; a["tier"] = 3; b["tier"] = 1; a["home"]["name"] = "Égalité tier 3"; b["home"]["name"] = "Égalité tier 1"
# homonymes
pl_e = next(f for f in F12 if f["region"] == "europe" and f["kickoff"] > f"{D}T08:01"); pl_e["league"].update(name="Premier League", country="Angleterre", country_code="GB")
pl_u = [f for f in F12 if f["region"] == "europe" and f["kickoff"] > f"{D}T08:01"][1]; pl_u["league"].update(name="Premier League", country="Ukraine", country_code="UA")
# nom long + logo manquant
lg = [f for f in F12 if f["region"] == "europe"][3]; lg["home"]["name"] = "Borussia Verein für Leibesübungen Mönchengladbach-Rheydt Sportfreunde 1900"; lg["away"]["logo"] = None; lg["away"]["name"] = "Sans Logo FC"
# statuts
pst = [f for f in F12 if f["region"] == "monde"][0]; pst["status"]["short"] = "PST"
ft = [f for f in F12 if f["region"] == "france"][0]; ft["status"] = {"short": "FT", "elapsed": 90}; ft["score"] = {"home": 2, "away": 0, "ft": {"home": 2, "away": 0}}
lv = [f for f in F12 if f["region"] == "uefa"][0]; lv["status"] = {"short": "1H", "elapsed": 30}; lv["score"] = {"home": 0, "away": 0}
assert len(F12) == 45
F12.append(fx(D, "15:45", "europe", 99.0, bettable=False, home="Non pariable A")); F12.append(fx(D, "20:10", "france", 98.0, bettable=False, home="Non pariable B"))
# ---- picks ----
P = {"1X2": {"1": 0.52, "X": 0.26, "2": 0.22}, "DC": {"1X": 0.78, "X2": 0.48, "12": 0.74}, "OU1.5": {"over": 0.75, "under": 0.25},
     "OU2.5": {"over": 0.51, "under": 0.49}, "OU3.5": {"over": 0.28, "under": 0.72}, "BTTS": {"yes": 0.5, "no": 0.5},
     "1X_O1.5": {"yes": 0.56}, "1X_BTTS": {"yes": 0.34}, "BTTS_O2.5": {"yes": 0.4}}
CHK = {"passed": True, "checks": [{"id": f"COH-0{i}", "passed": True, "detail_fr": None} for i in range(1, 8)]}
def rd(fid, n, trig, ts, label, sel=("DC", "1X"), prob=0.78, lc=False, ev=0.06, odds=1.40, mp=0.75, change=None, items=None, probs=None):
    r = {"reading_id": f"{fid}-r{n}", "timestamp": ts, "trigger": trig, "method_version": "dc-v1", "lineups_confirmed": lc,
         "pick": {"market": sel[0], "selection": sel[1], "label_fr": {"1X": "Domicile ou nul (1N)", "over": "Plus de 1,5 buts"}.get(sel[1], sel[1])},
         "label": label, "skip_reasons_fr": [] if label == "TICKET" else ["EV +2,1 % < 5 %"], "model_probability": prob,
         "probabilities": copy.deepcopy(probs or P), "expected_goals": {"home": 1.62, "away": 1.05},
         "top_scores": [{"score": "1-0", "p": 0.121}, {"score": "1-1", "p": 0.113}, {"score": "2-1", "p": 0.094}],
         "confidence": {"value": prob, "source": "model_probability", "bucket": f"{int(prob*20)*5}-{int(prob*20)*5+5}"},
         "market_probability": mp, "ev": ev, "odds_seen": {"value": odds, "bookmaker": "Pinnacle", "captured_at": ts} if odds else None,
         "reasoning_fr": ["Modèle 78,0 % pour 1N contre 75,0 % pour le marché."], "web_check": {"status": "ok", "items_fr": items or []},
         "coherence_check": copy.deepcopy(CHK), "change_from_previous": change, "team_samples": {"home": 40, "away": 38}}
    return r
bett = [f for f in F12 if f["bettable"] and f["status"]["short"] != "PST"]
withr = [f for f in bett if f["kickoff"] > f"{D}T08:00"][:30]
# garantir le FT et le live dans les lus
for x in (ft, lv):
    if x not in withr: withr[-1 if x is ft else -2] = x
picks = []; ticket_count = 0
special = {}
A, B, C, Dm, F = withr[2], withr[3], withr[4], withr[5], withr[6]
special[A["fixture_id"]] = "A"; special[B["fixture_id"]] = "B"; special[C["fixture_id"]] = "C"; special[Dm["fixture_id"]] = "D"; special[F["fixture_id"]] = "F"
A["has_details"] = True; B["has_details"] = True
labels = {}
for f in withr:
    fid = f["fixture_id"]; ko = f["kickoff"]; s = special.get(fid)
    if s == "A":
        rs = [rd(fid, 1, "matin", f"{D}T07:04:00+02:00", "SKIP", ev=0.021),
              rd(fid, 2, "compo", f"{D}T07:30:00+02:00", "TICKET", lc=True, change={"pick_changed": False, "label_changed": True, "reason_fr": "Compos officielles : absences confirmées."}, items=["Domicile : buteur titulaire absent."]),
              rd(fid, 3, "manuel", f"{D}T07:40:00+02:00", "TICKET", lc=True, change={"pick_changed": False, "label_changed": False, "reason_fr": None}),
              rd(fid, 4, "manuel", f"{D}T07:50:00+02:00", "SKIP", lc=True, ev=0.02, change={"pick_changed": False, "label_changed": True, "reason_fr": "Cote passée de 1,40 à 1,31 : EV sous 5 %."})]
        # coup d'envoi après les lectures
        picks.append({"fixture_id": fid, "final_reading_id": f"{fid}-r4", "readings": rs}); labels[fid] = "SKIP"; continue
    if s == "B":
        rs = [rd(fid, 1, "compo", f"{D}T07:20:00+02:00", "TICKET", lc=True), rd(fid, 2, "manuel", f"{D}T07:45:00+02:00", "SKIP", lc=False, ev=0.02, change={"pick_changed": False, "label_changed": True, "reason_fr": "Relecture demandée par Bruno."})]
        picks.append({"fixture_id": fid, "final_reading_id": f"{fid}-r1", "readings": rs}); labels[fid] = "TICKET"; ticket_count += 1; continue
    if s == "C":
        picks.append({"fixture_id": fid, "readings": [rd(fid, 1, "matin", f"{D}T07:04:00+02:00", "SKIP", ev=0.01)]}); labels[fid] = "SKIP"; continue
    if s == "D":
        pr = copy.deepcopy(P); pr["DC"]["1X"] = 0.587
        picks.append({"fixture_id": fid, "final_reading_id": f"{fid}-r1", "readings": [rd(fid, 1, "matin", f"{D}T07:04:00+02:00", "SKIP", prob=0.612, probs=pr, ev=0.01)]}); labels[fid] = "SKIP"; continue
    if s == "F":
        picks.append({"fixture_id": fid, "final_reading_id": f"{fid}-r1", "readings": [rd(fid, 1, "matin", f"{D}T07:04:00+02:00", "TICKET", ev=0.031)]}); labels[fid] = "TICKET"; ticket_count += 1; continue
    lab = "TICKET" if ticket_count < 8 and len(labels) % 3 == 0 else "SKIP"
    if lab == "TICKET": ticket_count += 1
    picks.append({"fixture_id": fid, "final_reading_id": f"{fid}-r1", "readings": [rd(fid, 1, "matin", f"{D}T07:04:00+02:00", lab, ev=0.06 if lab == "TICKET" else 0.02)]}); labels[fid] = lab
# compléter à 8 tickets
for p in picks:
    if ticket_count >= 8: break
    if labels[p["fixture_id"]] == "SKIP" and p["fixture_id"] not in special and len(p["readings"]) == 1:
        r = p["readings"][0]; r["label"] = "TICKET"; r["skip_reasons_fr"] = []; r["ev"] = 0.06; labels[p["fixture_id"]] = "TICKET"; ticket_count += 1
assert len(picks) == 30 and sum(v == "TICKET" for v in labels.values()) == 8, (len(picks), ticket_count)
for f in F12:
    if f["fixture_id"] in (A["fixture_id"], B["fixture_id"]): f["has_details"] = True
w(f"fixtures/{D}.json", {"schema_version": SV, "generated_at": "2026-10-12T07:03:00+02:00", "date": D, "timezone": "Europe/Paris", "fixtures": F12})
w(f"picks/{D}.json", {"schema_version": SV, "generated_at": "2026-10-12T07:50:30+02:00", "date": D, "picks": picks})
w(f"live/{D}.json", {"schema_version": SV, "generated_at": "2026-10-12T11:58:00+02:00", "date": D,
    "live": [{"fixture_id": lv["fixture_id"], "status": {"short": "2H", "elapsed": 62}, "score": {"home": 1, "away": 0}, "updated_at": "2026-10-12T11:58:00+02:00"}]})
# details
w(f"details/{A['fixture_id']}.json", {"schema_version": SV, "generated_at": GEN, "fixture_id": A["fixture_id"],
  "form": {"home": {"last5": ["V","V","N","D","V"], "home_record": {"w": 3, "d": 0, "l": 0}}, "away": {"last5": ["D","D","N","D","V"], "away_record": {"w": 0, "d": 1, "l": 2}}},
  "rest_days": {"home": 3, "away": 6}, "absences": {"home": [], "away": [{"player": "Joueur X", "reason_fr": "Blessure", "importance": "titulaire"}]},
  "lineups": {"confirmed": True, "home": [f"Dom {i}" for i in range(1, 12)], "away": [f"Ext {i}" for i in range(1, 12)], "formation_home": "4-3-3", "formation_away": "3-5-2"},
  "h2h": [{"date": "2025-03-02", "home": A["away"]["name"], "away": A["home"]["name"], "score": "0-0", "competition": A["league"]["name"]}],
  "standings": {"league_name": A["league"]["name"], "season": 2026, "table": [
      {"rank": 1, "team_id": A["home"]["id"], "team": A["home"]["name"], "played": 6, "points": 14, "gd": 8, "form": "VVNDV"},
      {"rank": 2, "team_id": 7, "team": "Autre équipe", "played": 6, "points": 12, "gd": 5, "form": "VNVVD"},
      {"rank": 9, "team_id": A["away"]["id"], "team": A["away"]["name"], "played": 6, "points": 6, "gd": -3, "form": "DDNDV"}]}})
w(f"details/{B['fixture_id']}.json", {"schema_version": SV, "generated_at": GEN, "fixture_id": B["fixture_id"], "rest_days": {"home": 4, "away": 4}})
# autres dates
F11 = [fx("2026-10-11", "15:00", "europe", 70), fx("2026-10-11", "21:00", "france", 80), fx("2026-10-11", "23:59", "ameriques", 60)]
F13 = [fx("2026-10-13", "01:10", "ameriques", 50), fx("2026-10-13", "02:30", "ameriques", 51), fx("2026-10-13", "18:00", "europe", 70), fx("2026-10-13", "20:45", "france", 85), fx("2026-10-13", "21:00", "uefa", 90)]
F25 = [fx("2026-10-25", "15:00", "europe", 70, off="+01:00"), fx("2026-10-25", "14:00", "france", 72, off="+00:00")]
for d, L in (("2026-10-11", F11), ("2026-10-13", F13), ("2026-10-25", F25), ("2026-10-10", []), ("2026-10-14", []), ("2026-10-15", []), ("2026-10-16", []), ("2026-10-17", [])):
    w(f"fixtures/{d}.json", {"schema_version": SV, "generated_at": GEN, "date": d, "timezone": "Europe/Paris", "fixtures": L})
# big (TA-45)
big = []
for i in range(300):
    h = 8 + (i * 16 // 300); big.append(fx(D, f"{h:02d}:{(i*7)%60:02d}", list(REG)[i % 6], 10 + (i * 0.29) % 89))
w(f"fixtures/{D}_big.json", {"schema_version": SV, "generated_at": GEN, "date": D, "timezone": "Europe/Paris", "fixtures": big})
# meta
dates = [f"2026-10-{d}" for d in range(10, 18)] + ["2026-10-25"]
meta = {"schema_version": SV, "generated_at": GEN, "run": {"id": "2026-10-12T07:00-matin", "type": "matin", "finished_at": GEN},
 "engine_status": {"level": "ok", "message_fr": None},
 "method": {"version": "dc-v1", "name": "Dixon-Coles v1", "since": "2026-10-12", "description_fr": "Modèle Dixon-Coles sans cotes en entrée."},
 "methods_history": [{"version": "dc-v0", "from": "2026-09-01", "to": "2026-10-11", "description_fr": "Version d'essai"}, {"version": "dc-v1", "from": "2026-10-12", "to": None, "description_fr": "Dixon-Coles v1"}],
 "rules": {"text_fr": ["Probabilités : modèle Dixon-Coles uniquement, sans les cotes en entrée.", "Un seul pick par match et par lecture."],
           "ticket_criteria": {"min_ev": 0.05, "max_gap_market": 0.05, "min_prob": 0.55, "max_odds": 3.5, "min_team_matches": 20},
           "allowed_markets": ["1X2", "DC", "OU1.5", "OU2.5", "OU3.5", "BTTS", "1X_O1.5", "1X_BTTS", "BTTS_O2.5"]},
 "thresholds": {"paper_min_tickets": 300, "min_sample_display": 30}, "dates_available": dates,
 "files": {d: {"fixtures": GEN} for d in dates}, "next_runs": {"matin": "2026-10-13T07:00:00+02:00", "calendrier": "2026-10-12T19:00:00+02:00"},
 "api_usage": {"date": D, "used": 1840, "limit": 7500, "plan_expires": "2026-10-16"}, "exclusions": ["Afrique", "Moyen-Orient"]}
meta["files"][D] = {"fixtures": "2026-10-12T07:03:00+02:00", "picks": "2026-10-12T07:50:30+02:00", "live": "2026-10-12T11:58:00+02:00"}
w("meta.json", meta); m7 = copy.deepcopy(meta); m7["schema_version"] = "7.0"; w("meta_v7.json", m7)
# bilan
def st(ref, mv, date, label, odds, oc, fid):
    pl = None if odds is None else (round(odds - 1, 2) if oc == "won" else (-1.0 if oc == "lost" else 0.0))
    return {"fixture_id": fid, "date": date, "kickoff": f"{date}T18:00:00+02:00", "league": {"name": "Serie A", "country": "Italie"}, "region": "europe",
            "method_version": mv, "reading_id": f"{fid}-r1", "trigger": "matin", "lineups_confirmed": False, "market": "DC", "selection": "1X",
            "label_fr": f"Pick {ref}", "label": label, "model_probability": 0.72, "confidence_bucket": "70-75", "odds": odds, "bookmaker": "Pinnacle" if odds else None,
            "final_score": "1-0", "outcome": oc, "pl_units": pl, "matin": {"selection": "1X", "label": label, "outcome": oc}}
rows = [("T1","dc-v1","2026-10-11","TICKET",1.80,"won"),("T2","dc-v1","2026-10-11","TICKET",1.50,"won"),("T3","dc-v1","2026-10-12","TICKET",2.10,"lost"),
        ("T4","dc-v1","2026-10-12","TICKET",1.20,"won"),("T5","dc-v1","2026-10-12","TICKET",1.90,"void"),("T6","dc-v1","2026-10-12","TICKET",None,"won"),
        ("S1","dc-v1","2026-10-11","SKIP",1.60,"won"),("S2","dc-v1","2026-10-12","SKIP",1.70,"lost"),("S3","dc-v1","2026-10-12","SKIP",2.50,"lost"),
        ("S4","dc-v1","2026-10-12","SKIP",1.40,"won"),("V1","dc-v0","2026-10-05","TICKET",1.50,"won"),("V2","dc-v0","2026-10-05","TICKET",1.50,"won"),("V3","dc-v0","2026-10-05","TICKET",1.50,"won")]
settled = [st(*r, 9000 + i) for i, r in enumerate(rows)]
agg = {"dc-v1": {"TICKET": {"n": 6, "won": 4, "lost": 1, "void": 1, "no_odds": 1, "hit_rate": 0.8, "pl_units": 0.5, "roi": 0.125, "avg_odds": 1.65},
                  "SKIP": {"n": 4, "won": 2, "lost": 2, "void": 0, "no_odds": 0, "hit_rate": 0.5, "pl_units": -1.0, "roi": -0.25, "avg_odds": 1.8}},
       "dc-v0": {"TICKET": {"n": 3, "won": 3, "lost": 0, "void": 0, "no_odds": 0, "hit_rate": 1.0, "pl_units": 1.5, "roi": 0.5, "avg_odds": 1.5},
                  "SKIP": {"n": 0, "won": 0, "lost": 0, "void": 0, "no_odds": 0, "hit_rate": None, "pl_units": 0.0, "roi": None, "avg_odds": None}}}
w("results/bilan.json", {"schema_version": SV, "generated_at": "2026-10-12T06:46:00+02:00", "settled": settled, "aggregates": agg})
agg2 = copy.deepcopy(agg); agg2["dc-v1"]["TICKET"]["pl_units"] = 0.70
w("results/bilan_mismatch.json", {"schema_version": SV, "generated_at": "2026-10-12T06:46:00+02:00", "settled": settled, "aggregates": agg2})
print("ok", len(F12), "special", {v: k for k, v in special.items()}, "ft", ft["fixture_id"], "live", lv["fixture_id"], "pst", pst["fixture_id"], "long", lg["fixture_id"])
json.dump({"A": A["fixture_id"], "B": B["fixture_id"], "C": C["fixture_id"], "D": Dm["fixture_id"], "F": F["fixture_id"], "FT": ft["fixture_id"], "LIVE": lv["fixture_id"], "PST": pst["fixture_id"], "LONG": lg["fixture_id"],
           "TIE_T1": b["fixture_id"], "TIE_T3": a["fixture_id"], "F13_0110": F13[0]["fixture_id"], "F12_2100": next(f["fixture_id"] for f in F12 if f["kickoff"].endswith("21:00:00+02:00")),
           "NOREAD_NODETAIL": next(f["fixture_id"] for f in F12 if f["bettable"] and not f["has_details"] and f["fixture_id"] not in [p["fixture_id"] for p in picks])},
          open(os.path.join(os.path.dirname(__file__), "ids.json"), "w"))
