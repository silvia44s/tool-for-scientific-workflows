#!/usr/bin/env python3
import argparse
from pathlib import Path

def read_numbers(path: Path) -> list[int]:
    numbers = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        numbers.append(int(line))
    return numbers

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--left", required=True)
    parser.add_argument("--right", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    left_path = Path(args.left)
    right_path = Path(args.right)
    out_path = Path(args.out)

    left = read_numbers(left_path)
    right = read_numbers(right_path)

    if len(left) != len(right):
        raise ValueError(
            f"Input lengths differ: left={len(left)}, right={len(right)}"
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{a},{b}" for a, b in zip(left, right)]
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"[merge_pairs] read {left_path}")
    print(f"[merge_pairs] read {right_path}")
    print(f"[merge_pairs] wrote {out_path}")

if __name__ == "__main__":
    main()