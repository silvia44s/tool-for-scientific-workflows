#!/usr/bin/env python3
import argparse
from pathlib import Path


def read_kv(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stats", required=True)
    parser.add_argument("--validation", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    stats = read_kv(Path(args.stats))
    validation = read_kv(Path(args.validation))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", encoding="utf-8") as f:
        f.write("summary_status=" + validation.get("status", "unknown") + "\n")
        f.write("records=" + stats.get("records", "0") + "\n")
        f.write("total_sales=" + stats.get("total_sales", "0.00") + "\n")
        f.write("record_count_checked=" + validation.get("record_count", "0") + "\n")
        for key in sorted(k for k in stats if k.startswith("category_")):
            f.write(f"{key}={stats[key]}\n")

    print(f"[merge_summary] wrote merged summary to {out_path}")


if __name__ == "__main__":
    main()
