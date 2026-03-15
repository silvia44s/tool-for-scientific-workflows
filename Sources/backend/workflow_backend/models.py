"""
Data models for the workflow document.

These models describe the structure of the workflow JSON that comes
from the frontend. Pydantic is used here mainly for validation and
automatic parsing.

"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, ConfigDict


# ---------- core primitives ----------

# simple 2D position used for node placement in the UI
class Vec2(BaseModel):
    x: float
    y: float


# parameter types supported by tasks
# roughly matching what the UI allows for CLI arguments
ParamKind = Literal["string", "number", "bool", "choice", "file", "directory"]

# types that can flow between nodes through ports
PortDataType = Literal["file", "directory", "string", "number", "boolean"]

# direction of a port
PortDirection = Literal["input", "output"]


# simple environment variable definition
class EnvVar(BaseModel):
    id: str
    key: str
    value: str


# ---------- task params ----------

# definition of a task parameter (basically a CLI argument)
class TaskParam(BaseModel):
    id: str
    name: str

    # optional CLI flag (example: --input)
    flag: Optional[str] = None

    kind: ParamKind

    # values are stored as strings for easier serialization
    value: str

    # possible options for "choice" type
    options: Optional[List[str]] = None

    required: Optional[bool] = False
    description: Optional[str] = ""

    # when enabled the parameter becomes a workflow port
    exposeAsInput: Optional[bool] = False
    exposeAsOutput: Optional[bool] = False


# ---------- IO ports ----------

# describes how an input port maps to a parameter
class InputBindParam(BaseModel):
    kind: Literal["param"] = "param"
    paramId: str


# output value comes directly from a parameter
class OutputSourceFromParam(BaseModel):
    kind: Literal["fromParam"] = "fromParam"
    paramId: str


# output value generated using a template string
class OutputSourceTemplate(BaseModel):
    kind: Literal["template"] = "template"
    template: str


# possible output source variants
OutputSource = Union[OutputSourceFromParam, OutputSourceTemplate]


# port definition used by nodes
class IOPort(BaseModel):
    id: str
    name: str
    direction: PortDirection
    dataType: PortDataType
    description: Optional[str] = None

    # used only for input ports
    inputBind: Optional[InputBindParam] = None

    # used only for output ports
    outputSource: Optional[OutputSource] = None


# container for all ports on a task
class TaskIO(BaseModel):
    inputs: List[IOPort] = Field(default_factory=list)
    outputs: List[IOPort] = Field(default_factory=list)


# ---------- environment ----------

# describes environment setup before running a task
class EnvironmentConfig(BaseModel):
    variables: List[EnvVar] = Field(default_factory=list)

    # modules are mostly for HPC environments
    modules: List[str] = Field(default_factory=list)

    # additional library paths (like LD_LIBRARY_PATH)
    libraries: List[str] = Field(default_factory=list)


# ---------- batch ----------

# batch array configuration (mainly useful for HPC schedulers)
class BatchArray(BaseModel):
    enabled: bool
    start: Optional[int] = None
    end: Optional[int] = None
    step: Optional[int] = None


# execution settings for different backends
class BatchConfig(BaseModel):
    cpus: Optional[int] = None
    memMB: Optional[int] = None
    timeMin: Optional[int] = None

    partitionOrQueue: Optional[str] = None
    account: Optional[str] = None
    qos: Optional[str] = None

    array: Optional[BatchArray] = None

    # fallback
    custom: Optional[str] = ""

    # extra raw scheduler flags/directives
    customDirectives: Optional[str] = ""

    # shell code before / after command
    prologue: Optional[str] = ""
    epilogue: Optional[str] = ""


# ---------- task config ----------

# basic task execution configuration
class TaskConfig(BaseModel):
    binaryPath: str

    # working directory for execution
    workdir: Optional[str] = None

    # template used to generate CLI arguments
    argsTemplate: Optional[str] = ""


# ---------- nodes ----------

# common node fields
class NodeBase(BaseModel):
    id: str
    position: Vec2
    name: str


# actual task configuration
class TaskInner(BaseModel):
    config: TaskConfig

    # CLI parameters
    params: List[TaskParam] = Field(default_factory=list)

    # environment setup
    environment: EnvironmentConfig = Field(default_factory=EnvironmentConfig)

    # input/output ports
    io: TaskIO = Field(default_factory=TaskIO)

    # batch execution settings
    batch: BatchConfig = Field(default_factory=BatchConfig)


# task node used in the workflow graph
class TaskNode(NodeBase):
    type: Literal["task"] = "task"
    task: TaskInner

# ---------- subworkflow ----------

class SubworkflowBoundaryInput(BaseModel):
    portId: str
    targetNodeId: str
    targetPortId: str


class SubworkflowBoundaryOutput(BaseModel):
    portId: str
    sourceNodeId: str
    sourcePortId: str


class SubworkflowBoundary(BaseModel):
    inputs: List[SubworkflowBoundaryInput] = Field(default_factory=list)
    outputs: List[SubworkflowBoundaryOutput] = Field(default_factory=list)


class SubworkflowInner(BaseModel):
    workflow: "WorkflowDoc"
    io: TaskIO = Field(default_factory=TaskIO)
    boundary: SubworkflowBoundary = Field(default_factory=SubworkflowBoundary)


class SubworkflowNode(NodeBase):
    type: Literal["subworkflow"] = "subworkflow"
    description: Optional[str] = ""
    subworkflow: SubworkflowInner


WorkflowNode = Union[TaskNode, SubworkflowNode]

# ---------- edges ----------

# connection between two nodes in the workflow graph
class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str

    # optional port ids
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


# ---------- canvas + run ----------

# viewport state from the frontend
class Viewport(BaseModel):
    x: float
    y: float
    zoom: float


class CanvasInfo(BaseModel):
    viewport: Viewport


# runtime configuration injected by backend
class WorkflowRunConfig(BaseModel):
    resultsRoot: Optional[str] = None
    backend: Literal["local", "slurm", "pbs"] = "local"



# ---------- root document ----------

# full workflow document coming from the frontend
class WorkflowDoc(BaseModel):

    # forbid unknown fields so bad JSON doesn't silently pass
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal[1] = 1
    id: str
    name: str

    run: Optional[WorkflowRunConfig] = None
    canvas: CanvasInfo

    # workflow graph
    nodes: Dict[str, WorkflowNode] = Field(default_factory=dict)
    edges: Dict[str, WorkflowEdge] = Field(default_factory=dict)


WorkflowDoc.model_rebuild()
SubworkflowInner.model_rebuild()