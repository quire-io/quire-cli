"""Unit tests for scripts/update-homebrew-formula.py.

Subprocess-invokes the script so the real CLI surface is exercised.
"""
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "update-homebrew-formula.py"

FORMULA_V011 = """\
class Quire < Formula
  desc "Command-line interface to the Quire API"
  homepage "https://github.com/quire-io/quire-cli"
  version "0.1.1"
  license "ISC"

  on_macos do
    on_arm do
      url "https://github.com/quire-io/quire-cli/releases/download/v0.1.1/quire-darwin-arm64"
      sha256 "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    end
    on_intel do
      url "https://github.com/quire-io/quire-cli/releases/download/v0.1.1/quire-darwin-x64"
      sha256 "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/quire-io/quire-cli/releases/download/v0.1.1/quire-linux-arm64"
      sha256 "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    end
    on_intel do
      url "https://github.com/quire-io/quire-cli/releases/download/v0.1.1/quire-linux-x64"
      sha256 "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
    end
  end
end
"""

SUMS_V012 = """\
1111111111111111111111111111111111111111111111111111111111111111  quire-darwin-arm64
2222222222222222222222222222222222222222222222222222222222222222  quire-darwin-x64
3333333333333333333333333333333333333333333333333333333333333333  quire-linux-arm64
4444444444444444444444444444444444444444444444444444444444444444  quire-linux-x64
5555555555555555555555555555555555555555555555555555555555555555  quire-win-x64.exe
"""


class UpdateFormulaTests(unittest.TestCase):
    def _run(self, formula_text, version, sums_text):
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            f = d / "quire.rb"
            s = d / "SHA256SUMS"
            f.write_text(formula_text)
            s.write_text(sums_text)
            proc = subprocess.run(
                ["python3", str(SCRIPT), str(f), version, str(s)],
                capture_output=True,
                text=True,
            )
            out = f.read_text() if proc.returncode == 0 else None
            return proc.returncode, out, proc.stderr

    def test_happy_path_updates_all_four_platforms(self):
        rc, out, _ = self._run(FORMULA_V011, "0.1.2", SUMS_V012)
        self.assertEqual(rc, 0)

        for plat in (
            "quire-darwin-arm64",
            "quire-darwin-x64",
            "quire-linux-arm64",
            "quire-linux-x64",
        ):
            self.assertIn(f"releases/download/v0.1.2/{plat}", out, f"{plat} URL not bumped")
            self.assertNotIn(
                f"releases/download/v0.1.1/{plat}", out, f"{plat} URL still on v0.1.1"
            )

        for sha in (
            "1" * 64,
            "2" * 64,
            "3" * 64,
            "4" * 64,
        ):
            self.assertIn(f'sha256 "{sha}"', out)

        self.assertIn('version "0.1.2"', out)
        self.assertNotIn('version "0.1.1"', out)

    def test_missing_platform_sha_errors(self):
        sums_no_arm = (
            "\n".join(l for l in SUMS_V012.splitlines() if "linux-arm64" not in l) + "\n"
        )
        rc, _, err = self._run(FORMULA_V011, "0.1.2", sums_no_arm)
        self.assertNotEqual(rc, 0)
        self.assertIn("quire-linux-arm64", err)

    def test_malformed_formula_errors(self):
        broken = FORMULA_V011.replace(
            "releases/download/v0.1.1/quire-darwin-arm64", "WRONG"
        )
        rc, _, err = self._run(broken, "0.1.2", SUMS_V012)
        self.assertNotEqual(rc, 0)
        self.assertIn("quire-darwin-arm64", err)

    def test_idempotent_when_already_current(self):
        rc, after_bump, _ = self._run(FORMULA_V011, "0.1.2", SUMS_V012)
        self.assertEqual(rc, 0)

        rc2, after_second_bump, _ = self._run(after_bump, "0.1.2", SUMS_V012)
        self.assertEqual(rc2, 0)
        self.assertEqual(after_bump, after_second_bump)


if __name__ == "__main__":
    unittest.main()
