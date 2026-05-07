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

    with in_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    for row in rows:
        row["name"] = row["name"].strip().title()
        row["category"] = row["category"].strip().lower()
        row["price"] = f"{float(row['price']):.2f}"
        row["quantity"] = str(int(row["quantity"]))

    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "name", "category", "price", "quantity"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"[normalize_products] wrote {len(rows)} records to {out_path}")


if __name__ == "__main__":
    main()
