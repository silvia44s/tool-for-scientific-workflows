/**
 * @file model.ts
 * @brief Type definitions for the workflow editor data model.
 * @author Silvia Šlachtovská
 *
 * This file defines the core data structures used by the workflow editor.
 * It describes how workflows, nodes, edges, parameters and execution
 * configuration are represented in memory and when exported to JSON.
 *
 * The types defined here are shared across the UI, state management
 * and backend communication.
 */


// 2D vector used for positioning nodes on the canvas
export type Vec2 = { x: number; y: number };


// Types of nodes supported in the workflow graph
export type NodeType = 'task' | 'subworkflow';


// Supported parameter types for task execution.
// These correspond to typical CLI argument types.
export type ParamKind =
  | 'string'
  | 'number'
  | 'bool'
  | 'choice'
  | 'file'
  | 'directory';


// Environment variable definition (KEY=VALUE pair)
export type EnvVar = {
  id: string;
  key: string;
  value: string;
};


// Data types that can be transferred between nodes through ports
export type PortDataType =
  | 'file'
  | 'directory'
  | 'string'
  | 'number'
  | 'boolean';


// Base properties shared by all node types
export type NodeBase = {
  id: string;          // unique identifier
  type: NodeType;      // node category
  position: Vec2;      // position on canvas
  name: string;        // user-friendly label
};


// Definition of a task parameter (CLI argument or input value)
export type TaskParam = {
  id: string;

  // logical name used in UI and templates
  name: string;

  // CLI flag (e.g. "--input" or "-i"), optional
  flag?: string;

  kind: ParamKind;

  // stored as string for simpler UI handling and serialization
  value: string;

  // allowed options for "choice" type parameters
  options?: string[];

  // indicates whether the parameter must be provided
  required?: boolean;

  // optional help text
  description?: string;

  // if true, parameter is exposed as an input port
  exposeAsInput?: boolean;

  // if true, parameter is exposed as an output port
  exposeAsOutput?: boolean;
};


// Environment configuration for running tasks
export type EnvironmentConfig = {
  // environment variables exported before execution
  variables: EnvVar[];

  // module system entries (commonly used in HPC environments)
  modules: string[];

  // additional library paths (e.g. LD_LIBRARY_PATH)
  libraries: string[];
};


// Port direction in the workflow graph
export type PortDirection = 'input' | 'output';


// Defines how an output port obtains its value
export type OutputSource =
  | { kind: 'fromParam'; paramId: string }
  | { kind: 'template'; template: string };
// TODO: support extracting values from command output
// | { kind: 'fromCommand'; command: string; parser?: 'stdout' }


// Definition of an input or output port on a node
export type IOPort = {
  id: string;
  name: string;
  direction: PortDirection;
  dataType: PortDataType;
  description?: string;

  // for INPUT ports: which parameter receives the value
  inputBind?: { kind: 'param'; paramId: string };

  // for OUTPUT ports: how the value is produced
  outputSource?: OutputSource;
};


// Task input/output interface
export type TaskIO = {
  inputs: IOPort[];
  outputs: IOPort[];
};

export type WorkflowBackend = 'local' | 'slurm' | 'pbs';

// Batch array configuration for HPC workloads
export type BatchArray = {
  enabled: boolean;
  start?: number;
  end?: number;
  step?: number;
};


// Batch execution configuration
export type TaskBatchConfig = {
  cpus?: number;
  memMB?: number;
  timeMin?: number;
  partitionOrQueue?: string;
  account?: string;
  qos?: string;
  array?: BatchArray;
  custom?: string;
  customDirectives?: string;
  prologue?: string;
  epilogue?: string;
};


// Task execution configuration
export type TaskConfig = {
  binaryPath: string;   // path to executable
  workdir?: string;     // working directory
  argsTemplate?: string; // template used to construct CLI arguments
};


// Task node representing an executable workflow step
export type TaskNode = NodeBase & {
  type: 'task';
  task: {
    config: TaskConfig;

    // CLI parameters
    params: TaskParam[];

    // environment setup
    environment: EnvironmentConfig;

    // data flow interface
    io: TaskIO;

    // batch execution configuration
    batch: TaskBatchConfig;
  };
};


// Union type for all workflow node variants
export type WorkflowNode = TaskNode | SubworkflowNode;


// Edge connecting two nodes in the workflow graph
export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;

  // optional port identifiers
  sourceHandle?: string;
  targetHandle?: string;
};


// Canvas viewport state (pan + zoom)
export type CanvasInfo = {
  viewport: { x: number; y: number; zoom: number };
};


// Workflow execution configuration
export type WorkflowRunConfig = {
  resultsRoot?: string;
  backend: WorkflowBackend;
};


// Root workflow document structure
export type Workflow = {
  schemaVersion: 1;
  id: string;
  name: string;

  run: WorkflowRunConfig;

  canvas: CanvasInfo;

  // nodes in the workflow graph
  nodes: Record<string, WorkflowNode>;

  // edges connecting nodes
  edges: Record<string, WorkflowEdge>;
};

// Preset definition for creating task nodes from predefined templates
export type TaskNodePreset = {
  schemaVersion: 1;
  kind: 'taskPreset';
  presetName: string;
  node: {
    type: 'task';
    name: string;
    task: TaskNode['task'];
  };
};

export type SubworkflowBoundary = {
  inputs: Array<{
    portId: string;         // input port on subworkflow node
    targetNodeId: string;   // internal node id
    targetPortId: string;   // internal input port id
  }>;
  outputs: Array<{
    portId: string;         // output port on subworkflow node
    sourceNodeId: string;   // internal node id
    sourcePortId: string;   // internal output port id
  }>;
};

export type SubworkflowNode = NodeBase & {
  type: 'subworkflow';
  description?: string;
  subworkflow: {
    workflow: Workflow;
    io: TaskIO;
    boundary: SubworkflowBoundary;
  };
};