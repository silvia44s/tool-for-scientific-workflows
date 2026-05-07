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

    numbers = []
    for line in in_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        numbers.append(int(line))

    result = [n * args.factor for n in numbers]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(str(v) for v in result) + "\n", encoding="utf-8")

    print(f"[multiply_numbers] read {in_path}")
    print(f"[multiply_numbers] factor={args.factor}")
    print(f"[multiply_numbers] wrote {out_path}")

if __name__ == "__main__":
    main()