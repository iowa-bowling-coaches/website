from pathlib import Path
import shutil
import subprocess

from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
POPPLER = Path(r"C:\Users\matta\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe")
SOURCES = [
    ROOT / "public/wp-content/uploads/2026/07/2011_State_Bowling_Program.pdf",
    ROOT / "public/wp-content/uploads/2026/07/2019_State_Bowling_Program.pdf",
    ROOT / "public/wp-content/uploads/2026/07/StateTournament2013.pdf",
    ROOT / "public/wp-content/uploads/2026/07/StateTournament2018_straightened.pdf",
    ROOT / "public/wp-content/uploads/2026/08/2022_State_Bowling_Program.pdf",
]
OUTPUT = ROOT / "output/pdf"
TEMP = ROOT / "tmp/pdfs"
MAX_BYTES = 25 * 1024 * 1024
DPI = 120
JPEG_QUALITY = 72


def optimize(source: Path) -> Path:
    work = TEMP / source.stem
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)
    prefix = work / "page"
    subprocess.run(
        [
            str(POPPLER),
            "-jpeg",
            "-r",
            str(DPI),
            "-jpegopt",
            f"quality={JPEG_QUALITY},optimize=y,progressive=y",
            str(source),
            str(prefix),
        ],
        check=True,
    )
    pages = sorted(work.glob("page-*.jpg"))
    if not pages:
        raise RuntimeError(f"No pages rendered from {source}")

    destination = OUTPUT / source.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(destination), pageCompression=1)
    for page in pages:
        with Image.open(page) as image:
            width_px, height_px = image.size
        width_pt = width_px * 72 / DPI
        height_pt = height_px * 72 / DPI
        pdf.setPageSize((width_pt, height_pt))
        pdf.drawImage(ImageReader(str(page)), 0, 0, width=width_pt, height=height_pt)
        pdf.showPage()
    pdf.save()
    shutil.rmtree(work)

    size = destination.stat().st_size
    if size > MAX_BYTES:
        raise RuntimeError(f"Optimized file remains above 25 MiB: {destination} ({size:,} bytes)")
    print(f"{source.name}: {source.stat().st_size:,} -> {size:,} bytes ({len(pages)} pages)")
    return destination


def main() -> None:
    TEMP.mkdir(parents=True, exist_ok=True)
    outputs = [optimize(source) for source in SOURCES]
    print(f"Created {len(outputs)} optimized PDFs in {OUTPUT}")


if __name__ == "__main__":
    main()
