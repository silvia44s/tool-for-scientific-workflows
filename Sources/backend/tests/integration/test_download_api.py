from __future__ import annotations

from pathlib import Path
import io
import zipfile

from fastapi.testclient import TestClient

from workflow_backend.api import app


client = TestClient(app)


def test_download_invalid_run_dir_returns_400():
    resp = client.get("/api/download", params={"run_dir": "/definitely/not/existing"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid run_dir."


def test_download_missing_results_dir_returns_404(tmp_path):
    run_dir = tmp_path / "run1"
    run_dir.mkdir()

    resp = client.get("/api/download", params={"run_dir": str(run_dir)})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Results directory not found."


def test_download_returns_zip_with_results(tmp_path):
    run_dir = tmp_path / "run1"
    results_dir = run_dir / "results"
    results_dir.mkdir(parents=True)

    file1 = results_dir / "out.txt"
    file1.write_text("hello", encoding="utf-8")

    nested = results_dir / "nested"
    nested.mkdir()
    file2 = nested / "data.json"
    file2.write_text('{"ok": true}', encoding="utf-8")

    resp = client.get("/api/download", params={"run_dir": str(run_dir)})

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"

    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    names = sorted(zf.namelist())

    assert "results/out.txt" in names
    assert "results/nested/data.json" in names