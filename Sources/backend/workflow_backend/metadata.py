import json
from datetime import datetime
from pathlib import Path


def write_run_metadata(run_dir: Path, wf, backend: str) -> None:
    meta = {
        "workflowId": wf.id,
        "workflowName": wf.name,
        "backend": backend,
        "status": "created",
        "createdAt": datetime.now().isoformat(),
        "submittedAt": None,
        "finishedAt": None,
        "runDir": str(run_dir),
    }

    path = run_dir / "run_meta.json"
    path.write_text(json.dumps(meta, indent=2), encoding="utf-8")


def update_run_metadata(run_dir: Path, **fields) -> None:
    path = run_dir / "run_meta.json"

    if not path.exists():
        return

    meta = json.loads(path.read_text(encoding="utf-8"))

    for key, value in fields.items():
        meta[key] = value

    path.write_text(json.dumps(meta, indent=2), encoding="utf-8")