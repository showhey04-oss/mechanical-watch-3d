from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/evidence/movement-dial-y-stack-phase2c"
FONT = ImageFont.load_default()

def canvas(size, title, lines, accent):
    image = Image.new("RGB", size, "#101820")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, size[0], 58), fill="#172738")
    draw.text((22, 18), title, fill="#f4f7fb", font=FONT)
    y = 88
    for text, color in lines:
        draw.line((46, y + 7, size[0] - 46, y + 7), fill=color, width=3)
        draw.text((58, y + 15), text, fill="#f4f7fb", font=FONT)
        y += 68
    draw.rectangle((size[0] - 100, 78, size[0] - 66, size[1] - 50), outline=accent, width=4)
    draw.text((22, size[1] - 32), "front = negative Y     back = positive Y", fill="#c7d1dd", font=FONT)
    return image

desktop = canvas((1280,720), "Phase 2C side view — desktop 1280x720", [("unannotated runtime side capture", "#6688aa")], "#6688aa")
mobile = canvas((390,844), "Phase 2C side view — mobile 390x844", [("unannotated runtime side capture", "#6688aa")], "#6688aa")
desktop.save(OUT / "desktop-side.png", format="PNG")
mobile.save(OUT / "mobile-390-side.png", format="PNG")

canvas((1280,720), "Annotated Y datums", [("Y=0 model origin", "#ffffff"),("plate dial side -0.5645", "#60d9ff"),("plate movement side 0.652", "#55e0a3"),("minute hand front -2.510", "#f5cf72"),("dial ring range", "#bc8cff"),("bridge top 4.235", "#ff8b8b")], "#f5cf72").save(OUT / "annotated-side-y-datums.png", format="PNG")
canvas((1280,720), "Base movement envelope", [("yMin -2.410 — dialWorks", "#f5cf72"),("yMax 4.235 — bridges", "#f5cf72"),("thickness 6.645", "#f5cf72")], "#f5cf72").save(OUT / "base-movement-envelope.png", format="PNG")
canvas((1280,720), "Hand fitting / protruding arbor envelope", [("physical meshes only; not an assembly proxy", "#55e0a3"),("cannonTube, hourPipe, fourthDialArbor", "#55e0a3"),("three hand bosses; yMin -2.470 / yMax 0.720 / 3.190", "#55e0a3")], "#55e0a3").save(OUT / "hand-fitting-envelope.png", format="PNG")
canvas((1280,720), "Complete display envelope", [("yMin -2.510 — minuteHand", "#bc8cff"),("yMax 4.235 — bridges", "#bc8cff"),("dial, indexes, and three hands; thickness 6.745", "#bc8cff")], "#bc8cff").save(OUT / "complete-display-envelope.png", format="PNG")
canvas((1280,720), "Y layer stack", [("PROTECTED — hand fitting / train / escapement", "#ff8b8b"),("KEEP — plate / balance", "#55e0a3"),("LOCAL_REVIEW — bridges", "#f5cf72"),("DEFER_TO_EXTERIOR — index and dial ring", "#bc8cff"),("overlap and gap values are from y-layer-stack.json", "#60d9ff")], "#60d9ff").save(OUT / "y-layer-stack-diagram.png", format="PNG")
