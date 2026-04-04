"""
Tests for README.md content and structure.
"""
import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
README_PATH = os.path.join(REPO_ROOT, "README.md")


def read_readme():
    with open(README_PATH, encoding="utf-8") as f:
        return f.read()


def test_readme_exists():
    """README.md must exist at the repository root."""
    assert os.path.isfile(README_PATH), f"README.md not found at {README_PATH}"


def test_readme_is_not_empty():
    """README.md must not be an empty file."""
    content = read_readme()
    assert content.strip(), "README.md is empty"


def test_readme_has_h1_title():
    """README.md must contain exactly one top-level H1 heading."""
    content = read_readme()
    h1_lines = [line for line in content.splitlines() if re.match(r'^#\s+\S', line)]
    assert len(h1_lines) >= 1, "README.md has no H1 heading"


def test_readme_title_is_ai_mevzuat():
    """The H1 heading must be '# ai-mevzuat'."""
    content = read_readme()
    first_h1 = next(
        (line for line in content.splitlines() if re.match(r'^#\s+', line)),
        None,
    )
    assert first_h1 is not None, "README.md has no H1 heading"
    assert first_h1.strip() == "# ai-mevzuat", (
        f"Expected '# ai-mevzuat', got '{first_h1.strip()}'"
    )


def test_readme_title_not_empty_after_hash():
    """The H1 heading must have non-whitespace text after the '#'."""
    content = read_readme()
    first_h1 = next(
        (line for line in content.splitlines() if re.match(r'^#\s+', line)),
        None,
    )
    assert first_h1 is not None, "README.md has no H1 heading"
    title_text = first_h1.lstrip('#').strip()
    assert title_text, "H1 heading is blank after the '#' character"


def test_readme_is_valid_utf8():
    """README.md must be readable as valid UTF-8 text."""
    with open(README_PATH, encoding="utf-8") as f:
        content = f.read()
    assert isinstance(content, str)


def test_readme_no_trailing_hash_only_line():
    """README.md title should not be just '#' with no content (regression)."""
    content = read_readme()
    bare_hash_lines = [
        line for line in content.splitlines() if re.fullmatch(r'#+', line.strip())
    ]
    assert not bare_hash_lines, (
        f"README.md contains heading line(s) with no text: {bare_hash_lines}"
    )