"""
@file metadata.py
@author Silvia Šlachtovská
@brief Helpers for storing workflow run metadata on disk.

This module creates and updates the JSON metadata file associated with each
workflow run directory so the backend can track run status and timestamps.
"""
import json
from datetime import datetime
from pathlib import Path


def write_run_metadata(run_dir: Path, wf, backend: str) -> None:
    """
    @brief Creates the metadata file for a new workflow run.

    Stores basic workflow identification, selected backend, initial run status
    and timestamp information in a JSON file inside the run directory.

    @param run_dir Target run directory.
    @param wf Workflow document or object containing workflow id and name.
    @param backend Selected execution backend.
    @return None
    """
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
    """
    @brief Updates selected fields in an existing run metadata file.

    Reads the current metadata JSON from disk, applies the provided field
    updates and writes the updated document back to the same file.

    @param run_dir Run directory containing the metadata file.
    @param fields Arbitrary metadata fields to update.
    @return None
    """
    path = run_dir / "run_meta.json"

    if not path.exists():
        return

    meta = json.loads(path.read_text(encoding="utf-8"))

    for key, value in fields.items():
        meta[key] = value

    path.write_text(json.dumps(meta, indent=2), encoding="utf-8")