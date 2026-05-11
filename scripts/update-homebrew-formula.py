#!/usr/bin/env python3
"""Bump quire-io/homebrew-quire/Formula/quire.rb to a new release.

Replaces `brew bump-formula-pr`, which is single-URL by design — our formula
has four platform-specific URL+sha256 blocks (darwin-arm64, darwin-x64,
linux-arm64, linux-x64) and brew's tool only knows how to update the one
matching the runner's host platform. v0.1.2's auto-bump shipped only the
linux-x64 entry, leaving mac/linux-arm64 users on v0.1.1 binaries.

Reads the SHA256SUMS file produced by .github/workflows/release.yml's
release job (one `<sha256>  quire-<platform>` line per binary) and rewrites
every URL + sha256 pair in the formula, plus the top-level version line.

Usage:
    update-homebrew-formula.py <formula-path> <version> <sha256sums-path>

Exits non-zero on any unexpected formula shape so a malformed bump fails
loudly in CI instead of silently producing a broken PR.
"""
import re
import sys
from pathlib import Path

PLATFORMS = [
    "quire-darwin-arm64",
    "quire-darwin-x64",
    "quire-linux-arm64",
    "quire-linux-x64",
]


def parse_sums(path: Path) -> dict[str, str]:
    shas: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        sha, name = line.split(None, 1)
        shas[name.strip()] = sha
    return shas


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 64

    formula_path = Path(sys.argv[1])
    version = sys.argv[2]
    sums_path = Path(sys.argv[3])

    shas = parse_sums(sums_path)
    missing = [p for p in PLATFORMS if p not in shas]
    if missing:
        print(f"SHA256SUMS missing entries for: {missing}", file=sys.stderr)
        return 1

    text = formula_path.read_text()

    text, n = re.subn(
        r'^(\s*version\s+")[^"]+(")',
        rf"\g<1>{version}\g<2>",
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if n != 1:
        print('could not find `version "..."` line', file=sys.stderr)
        return 1

    for plat in PLATFORMS:
        url_pat = rf"(releases/download/)v[^/]+(/{re.escape(plat)})"
        text, nu = re.subn(url_pat, rf"\g<1>v{version}\g<2>", text)
        if nu != 1:
            print(f"expected one URL match for {plat}, got {nu}", file=sys.stderr)
            return 1

        sha_pat = rf'(/{re.escape(plat)}"\s*\n\s*sha256\s+")[0-9a-f]{{64}}(")'
        text, ns = re.subn(sha_pat, rf"\g<1>{shas[plat]}\g<2>", text)
        if ns != 1:
            print(f"expected one sha256 match for {plat}, got {ns}", file=sys.stderr)
            return 1

    formula_path.write_text(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
