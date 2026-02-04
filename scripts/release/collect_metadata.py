#!/usr/bin/env python3
"""Read release metadata from appinfo.json and package.json."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def clean_single_line(value: str) -> str:
    return " ".join(value.replace("\r", "\n").split())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--appinfo", required=True, type=Path, help="Path to appinfo.json")
    parser.add_argument("--package-json", required=True, type=Path, help="Path to package.json")
    parser.add_argument(
        "--append-version-suffix",
        default="",
        help="Suffix appended to appinfo version as '.<suffix>'",
    )
    args = parser.parse_args()

    appinfo = json.loads(args.appinfo.read_text(encoding="utf-8"))
    package_info = json.loads(args.package_json.read_text(encoding="utf-8"))

    version = str(appinfo["version"])
    suffix = args.append_version_suffix.strip()
    if suffix:
        version = f"{version}.{suffix}"
        appinfo["version"] = version
        args.appinfo.write_text(json.dumps(appinfo, indent=4) + "\n", encoding="utf-8")

    description = clean_single_line(str(package_info.get("description", "")))

    print(f"app_id={appinfo['id']}")
    print(f"version={version}")
    print(f"description={description}")


if __name__ == "__main__":
    main()
