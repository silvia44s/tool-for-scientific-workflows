#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()

    in_path = Path(args.input)
    report_path = Path(args.report)

    left_values = []
    right_values = []

    for line in in_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        left_str, right_str = line.split(",")
        left_values.append(int(left_str))
        right_values.append(int(right_str))

    if not left_values:
        data = {
            "count": 0,
            "left_sum": 0,
            "right_sum": 0,
            "left_min": None,
            "left_max": None,
            "right_min": None,
            "right_max": None
        }
    else:
        data = {
            "count": len(left_values),
            "left_sum": sum(left_values),
            "right_sum": sum(right_values),
            "left_min": min(left_values),
            "left_max": max(left_values),
            "right_min": min(right_values),
            "right_max": max(right_values)
        }

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    print(f"[summarize_pairs] read {in_path}")
    print(f"[summarize_pairs] wrote {report_path}")

if __name__ == "__main__":
    main()