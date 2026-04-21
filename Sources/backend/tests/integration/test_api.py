from __future__ import annotations

from pathlib import Path
import zipfile

from fastapi.testclient import TestClient

from workflow_backend.api import app


client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_run_endpoint_generates_slurm_scripts(slurm_single_task_dict):
    resp = client.post("/api/run", json=slurm_single_task_dict)

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["message"] == "Slurm scripts generated successfully."
    assert data["script_path"].endswith("submit_slurm.sh")
    assert Path(data["script_path"]).exists()


def test_run_endpoint_generates_pbs_scripts(pbs_single_task_dict):
    resp = client.post("/api/run", json=pbs_single_task_dict)

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["message"] == "PBS scripts generated successfully."
    assert data["script_path"].endswith("submit_pbs.sh")
    assert Path(data["script_path"]).exists()


def test_run_endpoint_rejects_invalid_workflow(invalid_cycle_dict):
    resp = client.post("/api/run", json=invalid_cycle_dict)

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["message"] == "Workflow planning failed."
    assert "cycle" in data["stderr"].lower()


def test_download_invalid_run_dir_returns_400():
    resp = client.get("/api/download", params={"run_dir": "/definitely/not/existing"})
    assert resp.status_code == 400