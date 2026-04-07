#!/usr/bin/env python3
import argparse
from pathlib import Path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    values = list(range(args.start, args.end + 1))
    out_path.write_text("\n".join(str(v) for v in values) + "\n", encoding="utf-8")

    print(f"[gen_numbers] wrote {len(values)} numbers to {out_path}")

if __name__ == "__main__":
    main()