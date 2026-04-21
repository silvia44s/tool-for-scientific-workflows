#!/usr/bin/env python3
import argparse
import csv
from pathlib import Path

def load_blacklist(path: Path) -> set[str]:
    blocked = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            blocked.add(line)
    return blocked

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sales", required=True)
    parser.add_argument("--blacklist", required=True)
    parser.add_argument("--min-amount", required=True, type=int)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    sales_path = Path(args.sales)
    blacklist_path = Path(args.blacklist)
    out_path = Path(args.out)

    blocked = load_blacklist(blacklist_path)

    rows_out = []
    with sales_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            category = row["category"].strip()
            amount = int(row["amount"])

            if category in blocked:
                continue
            if amount < args.min_amount:
                continue

            rows_out.append({
                "order_id": row["order_id"].strip(),
                "category": category,
                "amount": str(amount),
            })

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["order_id", "category", "amount"])
        writer.writeheader()
        writer.writerows(rows_out)

    print(f"[filter_sales] read sales={sales_path}")
    print(f"[filter_sales] read blacklist={blacklist_path}")
    print(f"[filter_sales] min_amount={args.min_amount}")
    print(f"[filter_sales] kept {len(rows_out)} rows")
    print(f"[filter_sales] wrote {out_path}")

if __name__ == "__main__":
    main()