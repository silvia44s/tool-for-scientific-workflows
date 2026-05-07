#!/usr/bin/env python3
import argparse
from pathlib import Path


def read_numbers(path: Path) -> list[int]:
    numbers: list[int] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            numbers.append(int(line))
    return numbers


def main() -> None:
    parser = argparse.ArgumentParser(description="Node D: merge outputs from Node B and Node C.")
    parser.add_argument("--left", required=True, help="Output from Node B")
    parser.add_argument("--right", required=True, help="Output from Node C")
    parser.add_argument("--operation", choices=["sum", "difference", "product"], default="sum")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    left_path = Path(args.left)
    right_path = Path(args.right)
    out_path = Path(args.out)

    left = read_numbers(left_path)
    right = read_numbers(right_path)

    if len(left) != len(right):
        raise ValueError(f"Input lengths differ: {len(left)} vs {len(right)}")

    if args.operation == "sum":
        result = [a + b for a, b in zip(left, right)]
    elif args.operation == "difference":
        result = [a - b for a, b in zip(left, right)]
    else:
        result = [a * b for a, b in zip(left, right)]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(str(v) for v in result) + "\n", encoding="utf-8")

    print(f"[node_d_merge_results] read left={left_path}")
    print(f"[node_d_merge_results] read right={right_path}")
    print(f"[node_d_merge_results] operation={args.operation}")
    print(f"[node_d_merge_results] wrote {out_path}")


if __name__ == "__main__":
    main()
