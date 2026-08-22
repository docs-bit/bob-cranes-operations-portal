from pathlib import Path
from PIL import Image

assets_dir = Path(__file__).resolve().parents[1] / "client" / "public" / "assets" / "cranes"
images = [
    "capability-wind-component-lift.jpeg",
    "capability-highrise-lift.jpeg",
    "capability-residential-lift.jpeg",
]
widths = [640, 1280]

for image_name in images:
    source = assets_dir / image_name
    stem = source.stem
    with Image.open(source) as original:
        image = original.convert("RGB")
        for width in widths:
            if image.width <= width:
                resized = image.copy()
            else:
                height = round(image.height * width / image.width)
                resized = image.resize((width, height), Image.Resampling.LANCZOS)
            output = assets_dir / f"{stem}-{width}.webp"
            resized.save(output, "WEBP", quality=78, method=6)
            print(f"{output.name}: {resized.width}x{resized.height}, {output.stat().st_size} bytes")
