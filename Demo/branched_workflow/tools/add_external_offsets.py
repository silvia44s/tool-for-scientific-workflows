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
    parser = argparse.ArgumentParser(description="Node C: combine Node A numbers with an external offsets file.")
    parser.add_argument("--input", required=True, help="Numbers produced by Node A")
    parser.add_argument("--offsets", required=True, help="External file placed in Demo/branched_workflow/input")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    in_path = Path(args.input)
    offsets_path = Path(args.offsets)
    out_path = Path(args.out)

    numbers = read_numbers(in_path)
    offsets = read_numbers(offsets_path)

    if not offsets:
        raise ValueError("Offsets file is empty")

    result = [n + offsets[i % len(offsets)] for i, n in enumerate(numbers)]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(str(v) for v in result) + "\n", encoding="utf-8")

    print(f"[node_c_add_external_offsets] read numbers from {in_path}")
    print(f"[node_c_add_external_offsets] read offsets from {offsets_path}")
    print(f"[node_c_add_external_offsets] wrote {out_path}")


if __name__ == "__main__":
    main()
