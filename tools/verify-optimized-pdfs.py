from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
POPPLER = Path(r"C:\Users\matta\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe")
NAMES = [
    "2011_State_Bowling_Program.pdf",
    "2019_State_Bowling_Program.pdf",
    "StateTournament2013.pdf",
    "StateTournament2018_straightened.pdf",
    "2022_State_Bowling_Program.pdf",
]
SOURCE_DIRS = {
    "2022_State_Bowling_Program.pdf": ROOT / "public/wp-content/uploads/2026/08",
}
DEFAULT_SOURCE = ROOT / "public/wp-content/uploads/2026/07"
OUTPUT = ROOT / "output/pdf"
PREVIEW = ROOT / "tmp/pdfs/verification"


def render(pdf: Path, page_number: int, destination: Path) -> Path:
    prefix = destination.with_suffix("")
    subprocess.run(
        [str(POPPLER), "-f", str(page_number), "-l", str(page_number), "-scale-to", "800", "-png", "-singlefile", str(pdf), str(prefix)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return prefix.with_suffix(".png")


def main() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        source = SOURCE_DIRS.get(name, DEFAULT_SOURCE) / name
        optimized = OUTPUT / name
        source_pages = len(PdfReader(source).pages)
        optimized_pages = len(PdfReader(optimized).pages)
        if source_pages != optimized_pages:
            raise RuntimeError(f"Page count mismatch for {name}: {source_pages} vs {optimized_pages}")
        samples = sorted({1, (source_pages + 1) // 2, source_pages})
        rows = []
        for page in samples:
            original_png = render(source, page, PREVIEW / f"{source.stem}-p{page}-original.png")
            optimized_png = render(optimized, page, PREVIEW / f"{source.stem}-p{page}-optimized.png")
            with Image.open(original_png) as original_image, Image.open(optimized_png) as optimized_image:
                original = original_image.convert("RGB")
                revised = optimized_image.convert("RGB")
            height = max(original.height, revised.height)
            row = Image.new("RGB", (original.width + revised.width + 30, height + 42), "white")
            row.paste(original, (0, 42))
            row.paste(revised, (original.width + 30, 42))
            draw = ImageDraw.Draw(row)
            draw.text((8, 10), f"Original - page {page}", fill="black")
            draw.text((original.width + 38, 10), f"Optimized - page {page}", fill="black")
            rows.append(row)
        sheet = Image.new("RGB", (max(row.width for row in rows), sum(row.height for row in rows) + 20 * (len(rows) - 1)), "#dddddd")
        y = 0
        for row in rows:
            sheet.paste(row, (0, y))
            y += row.height + 20
        sheet.save(PREVIEW / f"{source.stem}-comparison.jpg", quality=88)
        print(f"Verified {name}: {source_pages} pages; comparison sheet created")


if __name__ == "__main__":
    main()
