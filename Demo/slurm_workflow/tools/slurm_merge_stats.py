#!/usr/bin/env python3
import argparse
import csv
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks", required=True, help="Directory with chunk_*.tsv files")
    parser.add_argument("--out", required=True, help="Output summary file")
    args = parser.parse_args()

    chunk_dir = Path(args.chunks)
    values_by_group: dict[str, list[float]] = {}
    records = 0

    for path in sorted(chunk_dir.glob("chunk_*.tsv")):
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                records += 1
                values_by_group.setdefault(row["group"], []).append(float(row["value"]))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    lines = ["slurm_summary_status: ok", f"records: {records}"]
    for group in sorted(values_by_group):
        vals = values_by_group[group]
        avg = sum(vals) / len(vals)
        lines.append(f"group_{group}_count: {len(vals)}")
        lines.append(f"group_{group}_avg: {avg:.2f}")

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[slurm_merge_stats] wrote {out_path}")


if __name__ == "__main__":
    main()
