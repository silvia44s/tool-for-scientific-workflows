#!/usr/bin/env python3
import argparse
import csv
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--filtered-dir", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    filtered_dir = Path(args.filtered_dir)
    lengths = []
    qualities = []

    for path in sorted(filtered_dir.glob("filtered_*.tsv")):
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                lengths.append(int(row["length"]))
                qualities.append(int(row["quality"]))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    count = len(lengths)
    avg_len = sum(lengths) / count if count else 0
    avg_q = sum(qualities) / count if count else 0

    out_path.write_text(
        "pbs_summary_status: ok\n"
        f"passed_reads: {count}\n"
        f"avg_length: {avg_len:.2f}\n"
        f"avg_quality: {avg_q:.2f}\n",
        encoding="utf-8",
    )
    print(f"[pbs_summarize_reads] wrote {out_path}")


if __name__ == "__main__":
    main()
