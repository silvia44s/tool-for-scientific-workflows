"""
Command-line interface for backned development and testing.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from workflow_backend.models import WorkflowDoc
from workflow_backend.validate import WorkflowValidationError, validate_workflow
from workflow_backend.generate.planner import plan_tasks

from workflow_backend.generate.planner import plan_tasks
from workflow_backend.generate.execution_planner import build_execution_plan
from workflow_backend.generate.run_script import generate_run_script

from dataclasses import asdict


def _load(path: str) -> WorkflowDoc:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return WorkflowDoc.model_validate(data)


def main() -> None:
    ap = argparse.ArgumentParser(prog="wf")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_val = sub.add_parser("validate", help="Validate workflow JSON")
    p_val.add_argument("--in", dest="infile", required=True)

    p_info = sub.add_parser("info", help="Print short summary")
    p_info.add_argument("--in", dest="infile", required=True)

    p_plan = sub.add_parser("plan", help="Print planned tasks in execution order")
    p_plan.add_argument("--in", dest="infile", required=True)

    p_exec = sub.add_parser("exec-plan", help="Compute execution plan (resolved params/paths)")
    p_exec.add_argument("--in", dest="infile", required=True)
    p_exec.add_argument("--out", dest="outfile", required=False)

    p_run = sub.add_parser("gen-run", help="Generate local run script")
    p_run.add_argument("--in", dest="infile", required=True)
    p_run.add_argument("--out", dest="outfile", required=True)

    args = ap.parse_args()

    if args.cmd == "validate":
        wf = _load(args.infile)
        try:
            validate_workflow(wf)
            print("OK")
        except WorkflowValidationError as e:
            print("INVALID")
            print(str(e))
            raise SystemExit(2)

    if args.cmd == "info":
        wf = _load(args.infile)
        task_count = sum(1 for n in wf.nodes.values() if getattr(n, "type", None) == "task")
        data_count = sum(1 for n in wf.nodes.values() if getattr(n, "type", None) == "data")
        print(f"name: {wf.name}")
        print(f"nodes: {len(wf.nodes)} (task={task_count})")
        print(f"edges: {len(wf.edges)}")
        print(f"resultsRoot: {getattr(wf.run, 'resultsRoot', None)}")

    if args.cmd == "plan":
        wf = _load(args.infile)
        try:
            validate_workflow(wf)
        except WorkflowValidationError as e:
            print("INVALID")
            print(str(e))
            raise SystemExit(2)

        tasks = plan_tasks(wf)
        for i, t in enumerate(tasks, start=1):
            node = wf.nodes[t.node_id]
            print(i, node.name, node.id)

    if args.cmd == "exec-plan":
        wf = _load(args.infile)
        try:
            validate_workflow(wf)
        except WorkflowValidationError as e:
            print("INVALID")
            print(str(e))
            raise SystemExit(2)

        ordered = [t.node_id for t in plan_tasks(wf)]
        
        plan = build_execution_plan(wf, ordered)
        
        payload = asdict(plan)
        Path(args.outfile).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    if args.cmd == "gen-run":
        wf = _load(args.infile)

        try:
            validate_workflow(wf)
        except WorkflowValidationError as e:
            print("INVALID")
            print(str(e))
            raise SystemExit(2)

        ordered = [t.node_id for t in plan_tasks(wf)]
        plan = build_execution_plan(wf, ordered)

        generate_run_script(plan, args.outfile)

        print(f"Run script written to {args.outfile}")