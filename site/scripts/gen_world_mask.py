"""Generate equirectangular land mask PNG from Natural Earth 110m GeoJSON."""
import json
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = r"C:\Users\rootp\.cursor\projects\c-Users-rootp-Desktop-Vectr\agent-tools\0f6be764-a88d-469f-b7fd-d39c525dfbf1.txt"
OUT = os.path.join(ROOT, "assets", "world-mask.png")

W, H = 720, 360


def lonlat_to_xy(lon, lat):
    x = (lon + 180.0) / 360.0 * W
    y = (90.0 - lat) / 180.0 * H
    return (x, y)


def draw_ring(draw, ring, fill):
    if len(ring) < 3:
        return
    pts = [lonlat_to_xy(p[0], p[1]) for p in ring]
    draw.polygon(pts, fill=fill)


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(img)

    with open(SRC, "r", encoding="utf-8") as f:
        data = json.load(f)

    for feat in data["features"]:
        geom = feat["geometry"]
        gtype = geom["type"]
        coords = geom["coordinates"]
        if gtype == "Polygon":
            draw_ring(draw, coords[0], 255)
            for hole in coords[1:]:
                draw_ring(draw, hole, 0)
        elif gtype == "MultiPolygon":
            for poly in coords:
                draw_ring(draw, poly[0], 255)
                for hole in poly[1:]:
                    draw_ring(draw, hole, 0)

    # slight dilate so thin land (Central America, etc.) still hits the grid
    img = img.filter(ImageFilter.MaxFilter(3))
    img.save(OUT, optimize=True)
    land = sum(1 for p in img.getdata() if p > 127)
    print(f"saved {OUT} size={img.size} land_px={land}")


if __name__ == "__main__":
    main()
