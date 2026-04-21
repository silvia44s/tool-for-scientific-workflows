#!/usr/bin/env python3
import argparse
from pathlib import Path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--factor", required=True, type=int)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.out)

    lines_out = []
    for line in in_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        left_str, right_str = line.split(",")
        left = int(left_str)
        right = int(right_str)
        lines_out.append(f"{left * args.factor},{right * args.factor}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")

    print(f"[scale_pairs] read {in_path}")
    print(f"[scale_pairs] factor={args.factor}")
    print(f"[scale_pairs] wrote {out_path}")

if __name__ == "__main__":
    main()