#!/usr/bin/env python3
"""Az albumok letöltése a Firestore nyilvános REST felületéről (a szabályok szerint az albums gyűjtemény mindenkinek olvasható).
Használat: python3 tools/fetch_albums.py albums.json"""
import json, sys, urllib.request, urllib.parse
PROJECT = "lutra-csereplatform"
KEY = "AIzaSyDatTdD6Ggcf7LbWZ0zBAyXf1JkspM6CEs"   # a webes Firebase-kulcs nyilvános, az app is ezt használja

def val(v):
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "nullValue" in v: return None
    if "arrayValue" in v: return [val(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None

out, token = [], None
while True:
    q = {"pageSize": 300, "key": KEY}
    if token: q["pageToken"] = token
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/albums?" + urllib.parse.urlencode(q)
    with urllib.request.urlopen(url, timeout=60) as r:
        d = json.load(r)
    for doc in d.get("documents", []):
        f = {k: val(v) for k, v in doc.get("fields", {}).items()}
        f.setdefault("id", doc["name"].rsplit("/", 1)[-1])
        if f.get("active") is False: continue
        out.append({k: f.get(k) for k in ("id", "title", "subtitle", "publisher", "year", "totalItems", "type", "typeLabel", "featured", "description", "descOriginal", "customChaptersList")})
    token = d.get("nextPageToken")
    if not token: break
if len(out) < 5:
    sys.exit("Gyanúsan kevés album (" + str(len(out)) + "), nem írom felül a kimenetet.")
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False)
print(len(out), "album letöltve")
