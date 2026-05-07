#!/usr/bin/env python3
import argparse
import csv
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    total = 0.0
    rows_count = 0
    category_totals = {}

    with in_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            value = float(row["price"]) * int(row["quantity"])
            total += value
            rows_count += 1
            category_totals[row["category"]] = category_totals.get(row["category"], 0.0) + value

    with out_path.open("w", encoding="utf-8") as f:
        f.write(f"records={rows_count}\n")
        f.write(f"total_sales={total:.2f}\n")
        for category in sorted(category_totals):
            f.write(f"category_{category}={category_totals[category]:.2f}\n")

    print(f"[compute_sales] wrote statistics to {out_path}")


if __name__ == "__main__":
    main()
