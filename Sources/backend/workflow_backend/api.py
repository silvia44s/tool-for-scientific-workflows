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


@app.get("/api/health")
def health() -> dict:
    """
    Checking if the backend is running.
    """
    return {"ok": True}


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
    temp_name = payload.get("name", "workflow")
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

    # generate shell script that runs the workflow
    script_path = run_dir / "run.sh"
    generate_run_script(plan, str(script_path))
    script_path.chmod(0o755)  # make it executable

    # execute the script
    # this runs everything synchronously for now
    proc = subprocess.run(
        ["bash", str(script_path)],
        cwd=run_dir,
        capture_output=True,
        text=True,
    )

    # return execution result
    return RunResponse(
        ok=(proc.returncode == 0),
        message="Workflow finished successfully." if proc.returncode == 0 else "Workflow execution failed.",
        run_dir=str(run_dir),
        script_path=str(script_path),
        stdout=proc.stdout,
        stderr=proc.stderr,
        returncode=proc.returncode,
    )