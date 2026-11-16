#!/usr/bin/env python3
"""A sitemap.xml összeállítása: a fix oldalak + a generált albumoldalak (sitemap_landing.xml)."""
import re
APP = "https://csereljokosan.hu/"
fixed = [APP, APP + "gyik.html", APP + "szotar.html", APP + "adatkezeles.html", APP + "aszf.html", APP + "impresszum.html",
         APP + "lutra-album-matrica-csere", APP + "lutra-album-matricak-listaja", APP + "hol-kaphato-lutra-album"]
land = re.findall(r"<loc>([^<]+)</loc>", open("sitemap_landing.xml", encoding="utf-8").read())
urls = list(dict.fromkeys(fixed + land))
open("sitemap.xml", "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"<url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
print(len(urls), "cím a sitemapben")
