#!/usr/bin/env python3
"""Generate a webOS Homebrew package manifest from appinfo.json + IPK."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Literal, Union

RootRequired = Union[bool, Literal["optional"]]


def parse_root_required(value: str) -> RootRequired:
    lowered = value.strip().lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    if lowered == "optional":
        return "optional"
    raise argparse.ArgumentTypeError("root-required must be one of: true, false, optional")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--appinfo", required=True, type=Path, help="Path to appinfo.json")
    parser.add_argument("--ipk", required=True, type=Path, help="Path to generated .ipk file")
    parser.add_argument("--output", required=True, type=Path, help="Where manifest JSON is written")
    parser.add_argument("--ipk-url", required=True, help="ipkUrl value to write into manifest")
    parser.add_argument("--icon-uri", required=True, help="iconUri value to write into manifest")
    parser.add_argument("--source-url", required=True, help="sourceUrl value to write into manifest")
    parser.add_argument("--app-description", default="", help="appDescription value")
    parser.add_argument(
        "--root-required",
        default="false",
        type=parse_root_required,
        help="Root requirement flag: true, false, or optional",
    )
    args = parser.parse_args()

    appinfo = json.loads(args.appinfo.read_text(encoding="utf-8"))
    required_keys = ("id", "version", "type", "title")
    missing = [key for key in required_keys if key not in appinfo]
    if missing:
        raise SystemExit(f"Missing keys in {args.appinfo}: {', '.join(missing)}")

    manifest: dict[str, object] = {
        "id": appinfo["id"],
        "version": appinfo["version"],
        "type": appinfo["type"],
        "title": appinfo["title"],
        "iconUri": args.icon_uri,
        "sourceUrl": args.source_url,
        "rootRequired": args.root_required,
        "ipkUrl": args.ipk_url,
        "ipkHash": {"sha256": sha256_file(args.ipk)},
    }

    app_description = args.app_description.strip() or appinfo.get("appDescription", "").strip()
    if app_description:
        manifest["appDescription"] = app_description

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"id={manifest['id']}")
    print(f"version={manifest['version']}")
    print(f"sha256={manifest['ipkHash']['sha256']}")
    print(f"manifest_path={args.output.as_posix()}")


if __name__ == "__main__":
    main()
