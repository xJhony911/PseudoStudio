"""Package the corresponding source without build caches or development dependencies."""
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / 'PseudoStudio-0.3.0-source.zip'
excluded_roots = {'node_modules', 'dist', 'release', 'test-results', 'playwright-report', '.git'}
with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for item in root.rglob('*'):
        relative = item.relative_to(root)
        if relative.parts[0] in excluded_roots or item.is_symlink() or not item.is_file():
            continue
        if item.name.startswith('.env') or item.suffix == '.log':
            continue
        archive.write(item, Path('PseudoStudio') / relative)
print(destination)
