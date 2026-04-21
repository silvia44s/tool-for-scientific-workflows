"""
@file api.py
@author Silvia Šlachtovská
@brief FastAPI entry point for workflow execution and result download.

This module exposes the backend HTTP API used by the workflow editor.
It validates submitted workflow documents, prepares execution artifacts,
runs workflows locally or generates scheduler scripts, and serves stored
run outputs to the frontend.

It also provides a fallback route for serving the built frontend bundle
in deployed environments.
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime
from pathlib import Path
import posixpath

import tempfile
import zipfile

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from pydantic import BaseModel

from workflow_backend.models import WorkflowDoc
from workflow_backend.validate import validate_workflow, WorkflowValidationError
from workflow_backend.generate.planner import plan_tasks, PlanError
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.run_script import generate_run_script
from workflow_backend.generate.slurm_script import generate_slurm_scripts
from workflow_backend.generate.pbs_script import generate_pbs_scripts
from workflow_backend.metadata import (
    write_run_metadata,
    update_run_metadata,
)

from workflow_backend.flatten import flatten_workflow
from workflow_backend.remote_upload import _open_ssh_client, _sftp_mkdirs, _upload_dir

# create FastAPI app
app = FastAPI()

# allow frontend dev server to call this API
# mostly needed during development when Vite runs on another port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# directory where workflow runs will be stored
RUNS_ROOT = Path("runs").resolve()

# create it if it does not exist yet
RUNS_ROOT.mkdir(parents=True, exist_ok=True)


class RunResponse(BaseModel):
    """
    Response returned after attempting to run a workflow.

    Contains basic execution info plus stdout/stderr so the UI
    can show errors to the user.
    """
    ok: bool
    message: str
    run_dir: str | None = None
    script_path: str | None = None
    stdout: str = ""
    stderr: str = ""
    returncode: int | None = None

def _sanitize_for_path(name: str) -> str:
    """
    @brief Converts a workflow name into a filesystem-safe path fragment.

    Replaces spaces with underscores and removes characters that are not
    suitable for generated run directory names.

    @param name Original workflow name.
    @return Sanitized string safe to use in a directory name.
    """
    s = (name or "workflow").strip().replace(" ", "_")
    s = "".join(ch for ch in s if ch.isalnum() or ch in ("_", "-", "."))
    return s or "workflow"

@app.get("/api/health")
def health() -> dict:
    """
    @brief Returns a simple backend health status.

    Used by the frontend or development tooling to verify that the backend
    process is running and reachable.

    @return Dictionary containing the backend status flag.
    """
    return {"ok": True}


class SubmitResponse(BaseModel):
    """
    Response body for /api/run endpoint."""
    ok: bool
    message: str
    stdout: str = ""
    stderr: str = ""
    returncode: int | None = None
    submit_script: str | None = None


class RemoteUploadRequest(BaseModel):
    run_dir: str
    username: str
    hostname: str
    remote_path: str

    # auth options
    password: str | None = None
    key_path: str | None = None
    key_passphrase: str | None = None

def _find_submit_script(run_dir: Path) -> Path:
    """
    @brief Finds the generated scheduler submission script in a run directory.

    The function checks the known submission script names for supported
    scheduler backends and returns the first existing match.

    @param run_dir Path to the workflow run directory.
    @return Path to the submission script.
    @raises FileNotFoundError If no supported submit script is present.
    """
    candidates = [
        run_dir / "submit_slurm.sh",
        run_dir / "submit_pbs.sh",
    ]
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError("No submit script found in run directory.")


@app.post("/api/run", response_model=RunResponse)
def run_workflow(payload: dict) -> RunResponse:
    """
    @brief Validates, prepares and executes a workflow run.

    The endpoint creates a dedicated run directory, injects runtime-specific
    configuration, validates the submitted workflow, flattens nested
    subworkflows, builds an execution plan and then either runs the workflow
    locally or generates scheduler submission scripts for HPC backends.

    @param payload Raw workflow document received from the frontend.
    @return Execution result including status, run directory, script path and
        collected stdout/stderr output.
    @raises HTTPException If the workflow JSON is invalid or the selected
        backend is not supported.
    """

    # create unique run directory using timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_name = _sanitize_for_path(payload.get("name", "workflow"))
    run_dir = RUNS_ROOT / f"{temp_name}_{timestamp}"
    run_dir.mkdir(parents=True, exist_ok=True)

    # results will go here
    runtime_results_root = run_dir / "results"

    # inject runtime results path into workflow config
    payload = dict(payload)
    payload["run"] = dict(payload.get("run") or {})
    payload["run"]["resultsRoot"] = str(runtime_results_root)

    # parse workflow using pydantic model
    # this checks the structure a bit
    try:
        wf = WorkflowDoc.model_validate(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid workflow JSON: {e}")

    # flatten workflow (handle subworkflows)
    try:
        flat_wf = flatten_workflow(wf)
    except Exception as e:
        return RunResponse(
            ok=False,
            message="Workflow flattening failed.",
            run_dir=str(run_dir),
            stderr=str(e),
            returncode=2,
        )
    
    # run custom validation logic
    try:
        validate_workflow(flat_wf)
    except WorkflowValidationError as e:
        return RunResponse(
            ok=False,
            message="Workflow validation failed.",
            run_dir=str(run_dir),
            stderr=str(e),
            returncode=2,
        )

    # save the workflow JSON for debugging / reproducibility
    workflow_path = run_dir / "workflow.json"
    workflow_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    try:
        ordered = [t.node_id for t in plan_tasks(flat_wf)]
        plan = build_execution_plan(flat_wf, ordered)
    except PlanError as e:
        return RunResponse(
            ok=False,
            message="Workflow planning failed.",
            run_dir=str(run_dir),
            stderr=str(e),
            returncode=2,
        )
    except Exception as e:
        return RunResponse(
            ok=False,
            message="Execution planning failed.",
            run_dir=str(run_dir),
            stderr=str(e),
            returncode=2,
        )

    backend = getattr(getattr(wf, "run", None), "backend", "local")

    write_run_metadata(run_dir, flat_wf, backend)
    ##write_task_metadata(run_dir, plan)

    if backend == "local":
        # generate shell script that runs the workflow locally
        script_path = run_dir / "run.sh"
        generate_run_script(plan, str(script_path))
        script_path.chmod(0o755)

        proc = subprocess.run(
            ["bash", str(script_path)],
            cwd=run_dir,
            capture_output=True,
            text=True,
        )

        if proc.returncode == 0:
            update_run_metadata(
                run_dir,
                status="finished",
                finishedAt=datetime.now().isoformat(),
            )
        else:
            update_run_metadata(
                run_dir,
                status="failed",
                finishedAt=datetime.now().isoformat(),
            )

        return RunResponse(
            ok=(proc.returncode == 0),
            message="Workflow finished successfully." if proc.returncode == 0 else "Workflow execution failed.",
            run_dir=str(run_dir),
            script_path=str(script_path),
            stdout=proc.stdout,
            stderr=proc.stderr,
            returncode=proc.returncode,
        )

    if backend == "slurm":
        submit_path = generate_slurm_scripts(plan, str(run_dir))
        update_run_metadata(
            run_dir,
            status="scripts_generated",
        )
        return RunResponse(
            ok=True,
            message="Slurm scripts generated successfully.",
            run_dir=str(run_dir),
            script_path=submit_path,
            stdout="",
            stderr="",
            returncode=0,
        )

    if backend == "pbs":
        submit_path = generate_pbs_scripts(plan, str(run_dir))
        update_run_metadata(
            run_dir,
            status="scripts_generated",
        )
        return RunResponse(
            ok=True,
            message="PBS scripts generated successfully.",
            run_dir=str(run_dir),
            script_path=submit_path,
            stdout="",
            stderr="",
            returncode=0,
        )

    raise HTTPException(status_code=400, detail=f"Unsupported backend '{backend}'.")

@app.get("/api/download")
def download_run_results(run_dir: str):
    """
    @brief Creates and returns a ZIP archive with workflow run results.

    Only the contents of the run's results directory are included in the
    generated archive. The ZIP file is created in a temporary directory
    and returned as a downloadable response.

    @param run_dir Absolute or relative path to the stored run directory.
    @return File response containing the generated ZIP archive.
    @raises HTTPException If the run directory or results directory does not exist.
    """
    run_path = Path(run_dir).resolve()

    if not run_path.exists() or not run_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid run_dir.")

    results_dir = run_path / "results"
    if not results_dir.exists() or not results_dir.is_dir():
        raise HTTPException(status_code=404, detail="Results directory not found.")

    tmp_dir = Path(tempfile.mkdtemp(prefix="workflow_zip_"))
    zip_path = tmp_dir / f"{run_path.name}.zip"

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in results_dir.rglob("*"):
            if file_path.is_file():
                arcname = file_path.relative_to(run_path)
                zf.write(file_path, arcname)

    return FileResponse(
        path=zip_path,
        filename=f"{run_path.name}.zip",
        media_type="application/zip",
    )


@app.get("/api/download-scripts")
def download_run_scripts(run_dir: str):
    run_path = Path(run_dir).resolve()

    if not run_path.exists() or not run_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid run_dir.")

    tmp_dir = Path(tempfile.mkdtemp(prefix="workflow_scripts_zip_"))
    zip_path = tmp_dir / f"{run_path.name}_scripts.zip"

    include_names = {
        "submit_slurm.sh",
        "submit_pbs.sh",
        "workflow.json",
        "run_metadata.json",
    }

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in run_path.rglob("*"):
            if not file_path.is_file():
                continue

            rel = file_path.relative_to(run_path)

            if rel.parts and rel.parts[0] == "jobs":
                zf.write(file_path, rel)
                continue

            if file_path.name in include_names:
                zf.write(file_path, rel)

    return FileResponse(
        path=zip_path,
        filename=f"{run_path.name}_scripts.zip",
        media_type="application/zip",
    )

@app.post("/api/upload", response_model=SubmitResponse)
def submit_workflow(req: RemoteUploadRequest) -> SubmitResponse:
    run_dir = Path(req.run_dir).resolve()

    if not run_dir.exists() or not run_dir.is_dir():
        raise HTTPException(status_code=400, detail="Invalid run_dir.")

    try:
        submit_script = _find_submit_script(run_dir)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))

    jobs_dir = run_dir / "jobs"
    if not jobs_dir.exists() or not jobs_dir.is_dir():
        raise HTTPException(status_code=400, detail="Jobs directory not found.")

    if not req.password and not req.key_path:
        raise HTTPException(
            status_code=400,
            detail="Provide either password or key_path."
        )

    remote_base = req.remote_path.rstrip("/")
    remote_run_dir = posixpath.join(remote_base, run_dir.name)
    remote_jobs_dir = posixpath.join(remote_run_dir, "jobs")
    remote_submit_script = posixpath.join(remote_run_dir, submit_script.name)

    try:
        client = _open_ssh_client(
            hostname=req.hostname,
            username=req.username,
            password=req.password,
            key_path=req.key_path,
            key_passphrase=req.key_passphrase,
        )

        sftp = client.open_sftp()

        _sftp_mkdirs(sftp, remote_run_dir)

        # upload jobs/
        _upload_dir(sftp, jobs_dir, remote_jobs_dir)

        # upload submit script
        sftp.put(str(submit_script), remote_submit_script)

        # optional metadata
        for extra_name in ("workflow.json", "run_metadata.json"):
            extra_path = run_dir / extra_name
            if extra_path.exists() and extra_path.is_file():
                sftp.put(
                    str(extra_path),
                    posixpath.join(remote_run_dir, extra_name),
                )

        sftp.close()
        client.close()

        update_run_metadata(
            run_dir,
            status="uploaded_remote",
            submittedAt=datetime.now().isoformat(),
        )

        return SubmitResponse(
            ok=True,
            message="Workflow scripts uploaded to remote server successfully.",
            stdout=f"Uploaded to {req.username}@{req.hostname}:{remote_run_dir}",
            stderr="",
            returncode=0,
            submit_script=remote_submit_script,
        )

    except Exception as e:
        update_run_metadata(
            run_dir,
            status="remote_upload_failed",
        )

        return SubmitResponse(
            ok=False,
            message="Remote upload failed.",
            stdout="",
            stderr=str(e),
            returncode=2,
            submit_script=None,
        )


FRONTEND_DIST = Path("/app/dist")

@app.get("/")
def serve_frontend_root():
    """
    @brief Serves the built frontend entry page.

    This route is used in deployed environments where the backend also serves
    the built single-page application bundle.

    @return Frontend index file response.
    @raises HTTPException If the frontend build is not available.
    """
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend not built")


@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    """
    @brief Serves static frontend files and SPA fallback routes.

    Requests targeting API paths are rejected here. Existing static files are
    returned directly, while unknown frontend routes fall back to index.html
    so the client-side router can handle them.

    @param full_path Requested relative frontend path.
    @return File response for the requested asset or SPA entry page.
    @raises HTTPException If the frontend build is not available.
    """
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    requested = FRONTEND_DIST / full_path

    if requested.exists() and requested.is_file():
        return FileResponse(requested)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Frontend not built")