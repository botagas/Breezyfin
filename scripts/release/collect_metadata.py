#!/usr/bin/env python3
"""Read release metadata from appinfo.json and package.json."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

WEBOS_VERSION_RE = re.compile(r"^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$")


def clean_single_line(value: str) -> str:
    return " ".join(value.replace("\r", "\n").split())


def parse_webos_version(version: str) -> tuple[str, str, str]:
    match = WEBOS_VERSION_RE.fullmatch(version)
    if not match:
        raise SystemExit(
            "Invalid appinfo version. webOS requires X.X.X where each segment is a non-negative "
            "integer up to 9 digits with no leading zeroes."
        )
    return match.group(1), match.group(2), match.group(3)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--appinfo", required=True, type=Path, help="Path to appinfo.json")
    parser.add_argument("--package-json", required=True, type=Path, help="Path to package.json")
    parser.add_argument(
        "--append-version-suffix",
        default="",
        help="When set, replaces patch version with this numeric suffix (keeps webOS X.X.X format).",
    )
    args = parser.parse_args()

    appinfo = json.loads(args.appinfo.read_text(encoding="utf-8"))
    package_info = json.loads(args.package_json.read_text(encoding="utf-8"))

    version = str(appinfo["version"])
    major, minor, _ = parse_webos_version(version)
    suffix = args.append_version_suffix.strip()
    if suffix:
        if not suffix.isdigit():
            raise SystemExit("--append-version-suffix must be numeric for webOS versioning.")
        if len(suffix) > 9:
            raise SystemExit("--append-version-suffix must be at most 9 digits.")

        patch = str(int(suffix))
        version = f"{major}.{minor}.{patch}"
        appinfo["version"] = version
        args.appinfo.write_text(json.dumps(appinfo, indent=4) + "\n", encoding="utf-8")

    description = clean_single_line(str(package_info.get("description", "")))

    print(f"app_id={appinfo['id']}")
    print(f"version={version}")
    print(f"description={description}")


if __name__ == "__main__":
    main()
