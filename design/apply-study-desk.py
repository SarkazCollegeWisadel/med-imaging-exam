"""Inline the approved desk theme into the standalone help pages."""

import argparse
import html
import re
from pathlib import Path


DESIGN = Path(__file__).resolve().parent
ROOT = DESIGN.parent
PAGES = {
    "premed/environment.html": "premed-environment",
    "index.html": "imaging-desk",
    "learn/index.html": "learn",
    "oral-finals/index.html": "oral-index",
    "oral-finals/plan.html": "oral-plan",
    "oral-finals/practice.html": "oral-practice",
    "oral-finals/materials.html": "oral-materials",
    "diagnostics-finals/index.html": "diagnosis-index",
    "diagnostics-finals/plan.html": "diagnosis-plan",
    "diagnostics-finals/practice.html": "diagnosis-practice",
    "diagnostics-finals/materials.html": "diagnosis-materials",
    "真题卡片.html": "imaging-exam",
    "阅片列表.html": "imaging-list",
    "阅片速记.html": "imaging-notes",
    "quiz/index.html": "imaging-quiz",
    "patho/index.html": "patho",
    "odontogenic/index.html": "odontogenic",
    "premed/index.html": "premed-guide",
    "premed/quiz.html": "premed-quiz",
    "epi/index.html": "epi-guide",
    "epi/quiz.html": "epi-quiz",
    "pharm/index.html": "pharm",
    "pharm/guide/index.html": "pharm-guide",
    "pharm/mock/index.html": "pharm-mock",
    "pharm/endodontic/index.html": "pharm-endodontic",
    "pharm/perio/index.html": "pharm-perio",
}
STYLE_BLOCK = re.compile(r'<style id="study-desk-theme">.*?</style>\n?', re.S)
BODY = re.compile(r"<body\b([^>]*)>")


def mark_body(match, page_id):
    attrs = match[1]
    classes = re.search(r'\bclass="([^"]*)"', attrs)
    if classes:
        value = " ".join(dict.fromkeys([*classes[1].split(), "study-page"]))
        attrs = attrs[:classes.start(1)] + value + attrs[classes.end(1):]
    else:
        attrs += ' class="study-page"'
    if 'data-desk-page="' not in attrs:
        attrs += f' data-desk-page="{page_id}"'
    return "<body" + attrs + ">"


def apply_theme(source, page_id, theme):
    source = STYLE_BLOCK.sub("", source, count=1)
    source, bodies = BODY.subn(lambda match: mark_body(match, page_id), source, count=1)
    if bodies != 1 or "</head>" not in source:
        raise ValueError(f"{page_id}: expected a complete HTML document")
    return source.replace("</head>", theme + "</head>", 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if a page needs regeneration")
    parser.add_argument("--page", choices=PAGES, help="Regenerate one page instead of all pages")
    args = parser.parse_args()
    css = (DESIGN / "study-desk.css").read_text(encoding="utf-8").strip()
    theme = f'<style id="study-desk-theme">\n{css}\n</style>\n'
    stale = []
    pages = [args.page] if args.page else PAGES
    for name in pages:
        file = ROOT / name
        before = file.read_bytes()
        # Retain original newlines for untouched source and existing payloads.
        source = before.decode("utf-8")
        newline = "\r\n" if "\r\n" in source else "\n"
        updated = apply_theme(source.replace("\r\n", "\n"), PAGES[name], theme)
        after = updated.replace("\n", newline).encode("utf-8")
        if before != after:
            stale.append(name)
            if not args.check:
                file.write_bytes(after)
    for name in stale:
        print(name)
    return int(args.check and bool(stale))


if __name__ == "__main__":
    raise SystemExit(main())
