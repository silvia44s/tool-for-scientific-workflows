"""
Simple backend service for running workflows.

This API receives a workflow definition from the frontend,
validates it, generates a run script and executes it.

"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from workflow_backend.models import WorkflowDoc
from workflow_backend.validate import validate_workflow, WorkflowValidationError
from workflow_backend.generate.planner import plan_tasks
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.run_script import generate_run_script
from workflow_backend.generate.slurm_script import generate_slurm_scripts
from workflow_backend.generate.pbs_script import generate_pbs_scripts


# create FastAPI app
app = FastAPI()

# allow frontend dev server to call this API
# mostly needed during development when Vite runs on another port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
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
    Make a string safe for filesystem paths.
    """
    s = (name or "workflow").strip().replace(" ", "_")
    s = "".join(ch for ch in s if ch.isalnum() or ch in ("_", "-", "."))
    return s or "workflow"

@app.get("/api/health")
def health() -> dict:
    """
    Checking if the backend is running.
    """
    return {"ok": True}

class SubmitRequest(BaseModel):
    """
    Request body for /api/run endpoint.
    """
    run_dir: str


class SubmitResponse(BaseModel):
    """
    Response body for /api/run endpoint."""
    ok: bool
    message: str
    stdout: str = ""
    stderr: str = ""
    returncode: int | None = None
    submit_script: str | None = None

def _find_submit_script(run_dir: Path) -> Path:
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
    Main endpoint for executing workflows.

    Steps roughly:
    1. create a run directory
    2. validate workflow structure
    3. generate execution plan
    4. generate shell script
    5. run it and return results
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

    # run custom validation logic
    try:
        validate_workflow(wf)
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

       # figure out execution order of tasks
    ordered = [t.node_id for t in plan_tasks(wf)]

    # build full execution plan (commands, env, etc.)
    plan = build_execution_plan(wf, ordered)

    backend = getattr(getattr(wf, "run", None), "backend", "local")

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

@app.post("/api/submit", response_model=SubmitResponse)
def submit_workflow(req: SubmitRequest) -> SubmitResponse:
    """
    Submit previously generated slurm/pbs workflow scripts.
    """
    run_dir = Path(req.run_dir).resolve()

    if not run_dir.exists() or not run_dir.is_dir():
        raise HTTPException(status_code=400, detail="Invalid run_dir.")

    try:
        submit_script = _find_submit_script(run_dir)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))

    proc = subprocess.run(
        ["bash", str(submit_script)],
        cwd=run_dir,
        capture_output=True,
        text=True,
    )

    return SubmitResponse(
        ok=(proc.returncode == 0),
        message="Workflow submitted successfully." if proc.returncode == 0 else "Workflow submission failed.",
        stdout=proc.stdout,
        stderr=proc.stderr,
        returncode=proc.returncode,
        submit_script=str(submit_script),
    )