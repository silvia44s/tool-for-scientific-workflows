from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from workflow_backend.api import app


client = TestClient(app)


def test_submit_api_invalid_run_dir_returns_400():
    resp = client.post("/api/submit", json={"run_dir": "/definitely/not/existing"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid run_dir."


def test_submit_api_missing_submit_script_returns_400(tmp_path):
    resp = client.post("/api/submit", json={"run_dir": str(tmp_path)})
    assert resp.status_code == 400
    assert "No submit script found" in resp.json()["detail"]


def test_submit_api_executes_submit_script(monkeypatch, tmp_path):
    run_dir = tmp_path / "run1"
    run_dir.mkdir()

    submit_script = run_dir / "submit_slurm.sh"
    submit_script.write_text("#!/bin/bash\necho submitted\n", encoding="utf-8")
    submit_script.chmod(0o755)

    metadata_path = run_dir / "run_metadata.json"
    metadata_path.write_text("{}", encoding="utf-8")

    class DummyProc:
        returncode = 0
        stdout = "submitted\n"
        stderr = ""

    def fake_run(*args, **kwargs):
        return DummyProc()

    monkeypatch.setattr("workflow_backend.api.subprocess.run", fake_run)

    resp = client.post("/api/submit", json={"run_dir": str(run_dir)})

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["message"] == "Workflow submitted successfully."
    assert data["stdout"] == "submitted\n"
    assert data["returncode"] == 0
    assert data["submit_script"].endswith("submit_slurm.sh")