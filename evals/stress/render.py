#!/usr/bin/env python3
"""Render each scenario's Tony placements over real ESRI satellite imagery.
One PNG per scenario (uses the LAST turn that returned zones/stands, i.e. the
fullest map state), boundary in yellow, zones color-coded, stands as dots,
access routes as dashed lines."""
import json, glob, io, os, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, 'results')
OUT = os.path.join(HERE, 'renders')
os.makedirs(OUT, exist_ok=True)

W, H = 1280, 960
COLORS = {
    'food_plot': (76, 217, 100), 'kill_plot': (255, 204, 0), 'bedding': (175, 82, 222),
    'stand_site': (255, 59, 48), 'stand': (255, 59, 48), 'staging_area': (255, 149, 0),
    'sanctuary': (90, 200, 250), 'access_route': (255, 255, 255), 'access_trail': (255, 255, 255),
    'water': (0, 122, 255),
}

def bounds_of(ring, pad=0.25):
    lngs = [p[0] for p in ring]; lats = [p[1] for p in ring]
    w, e, s, n = min(lngs), max(lngs), min(lats), max(lats)
    pw, ph = (e - w) * pad, (n - s) * pad
    return w - pw, s - ph, e + pw, n + ph

def px(lng, lat, bb):
    w, s, e, n = bb
    return ((lng - w) / (e - w) * W, (n - lat) / (n - s) * H)

def draw_geom(draw, geom, color, label, bb, lbl_list):
    t = geom.get('type'); c = geom.get('coordinates')
    if t == 'Polygon':
        pts = [px(x, y, bb) for x, y in c[0]]
        draw.polygon(pts, outline=color, width=4)
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        lbl_list.append((cx, cy, label, color))
    elif t == 'LineString':
        pts = [px(x, y, bb) for x, y in c]
        draw.line(pts, fill=color, width=3)
        lbl_list.append((pts[len(pts)//2][0], pts[len(pts)//2][1], label, color))
    elif t == 'Point':
        x, y = px(c[0], c[1], bb)
        draw.ellipse([x-8, y-8, x+8, y+8], outline=color, width=4)
        lbl_list.append((x + 12, y - 6, label, color))

def main():
    # group result files by scenario
    files = sorted(glob.glob(os.path.join(RES, '*.json')))
    by_sc = {}
    for f in files:
        d = json.load(open(f))
        by_sc.setdefault(d['scenario'], []).append(d)

    # scenario rings from scenarios.mjs are embedded in request bounds; re-derive
    # boundary ring from the boundary feature echoed nowhere — so re-import via node
    import subprocess
    rings = json.loads(subprocess.check_output(
        ['node', '-e', "import('./scenarios.mjs').then(m=>console.log(JSON.stringify(Object.fromEntries(m.SCENARIOS.map(s=>[s.id,s.ring])))))"],
        cwd=HERE))

    for sc, turns in by_sc.items():
        ring = rings[sc]
        bb = bounds_of(ring)
        url = (f"https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export"
               f"?bbox={bb[0]},{bb[1]},{bb[2]},{bb[3]}&bboxSR=4326&imageSR=4326&size={W},{H}&format=png&f=image")
        img = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=30).read())).convert('RGB')
        draw = ImageDraw.Draw(img)
        # boundary
        draw.line([px(x, y, bb) for x, y in ring], fill=(255, 230, 0), width=5)
        try:
            font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 20)
        except Exception:
            font = ImageFont.load_default()

        # last turn with zones
        best = None
        for t in turns:
            j = t.get('json') or {}
            if (j.get('zones') or j.get('stand_sites')):
                best = t
        if not best:
            img.save(os.path.join(OUT, f'{sc}.png')); print(sc, 'no zones'); continue
        j = best['json']
        lbls = []
        for z in j.get('zones', []):
            g = z.get('geometry')
            if g: draw_geom(draw, g, COLORS.get(z.get('type'), (255,255,255)), f"{z.get('id','?')} {z.get('type','?')}", bb, lbls)
        for s in j.get('stand_sites', []):
            g = s.get('geometry')
            if g: draw_geom(draw, g, COLORS['stand'], f"{s.get('id','?')} STAND w:{s.get('wind_direction','?')}", bb, lbls)
        for (x, y, txt, color) in lbls:
            draw.text((x+1, y+1), txt, fill=(0,0,0), font=font)
            draw.text((x, y), txt, fill=color, font=font)
        img.save(os.path.join(OUT, f'{sc}.png'))
        print(sc, f"turn {best['turn']}", len(j.get('zones', [])), 'zones', len(j.get('stand_sites', [])), 'stands')

main()
