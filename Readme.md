# A Comprehensive Tool for Creating Scientific Workflows

## Introduction

This repository contains a bachelors’s thesis developing a comprehensive tool for creating scientific workflows. 

The application allows users to visually create workflows using a node-based interface, configure command-line tasks, connect data dependencies between tasks and execute workflows locally or prepare them for execution in HPC environments such as Slurm or PBS.

The system also supports workflow export to CWL (Common Workflow Language), reusable task presets and hierarchical workflow composition using subworkflows.

## Assignment

1. Familiarize yourself with tools for creating and sharing workflows and with techniques for visualizing large-scale diagrams.
2. Familiarize yourself with the software design methodology used by the SC@FIT research group.
3. Design a graphical application for creating and viewing large-scale workflows.
4. Implement the proposed application and test it.
5. Document the solution and demonstrate it on a set of examples.

## Repository structure

    .
    +--Demo            - Demonstration examples.
    +--Sources         - Root folder for the sources.
    +--Thesis          - Latex sources of the thesis.
    +--projekt.pdf     - Thesis.
    Readme.md          - Read me file


## Build instruction
### Requirements

The following tools must be installed on the system:

- Node.js (18+ recommended)
- npm
- Python 3.10+
- pip
- Python venv module

Check installed versions:

```bash
node -v
npm -v
python3 --version
```

### Installing dependencies (WSL)

Install NOde.js and npm:

```bash
sudo apt update
sudo apt install nodejs npm
```

Install Python and virtual environment support

```bash
sudo apt install python3 python3-pip python3-venv
```



### Running the application

Navigate to the `Sources/` directory:

```bash
cd Sources
```

Make the startup script executable:

```bash
chmod +x run.sh
```

Run the application:

```bash
./run.sh
```

The script automatically:

- installs frontend dependencies,
- creates a Python virtual environment,
- installs backend dependencies,
- starts the FastAPI backend,
- starts the frontend Vite server.

After startup, open the editor in your browser:

```text
http://localhost:5173
```


### Workflow execution outputs

Workflow execution results are stored in `runs/`.

Each workflow run creates a separate folder containing:

- generated scripts,
- workflow metadata,
- execution outputs,
- logs and temporary files.

### Windows support

The application is primarily designed for Linux environments.

On Windows, it is recommended to use WSL (Windows Subsystem for Linux), because local workflow execution relies on generated Bash scripts.


## Usage instruction

The workflow editor is based on a **node-based workflow model**, where each node represents a single executable operation.  
In practice, a task node usually corresponds to one command executed in the terminal.

For example, the following command:

```bash
python3 multiply_numbers.py --input numbers.txt --factor 10 --out multiplied.txt
```

can be represented in the editor as a single workflow node with configured parameters.



### Creating a task node

New task nodes can be added from the left panel using drag-and-drop.

After selecting a node, its configuration becomes available in the right panel.

Each task node contains:

- executable program configuration,
- command-line parameters,
- input and output ports,
- environment settings,
- optional batch configuration for Slurm/PBS execution.



### Binary path

The **Binary Path** field specifies the executable program or script that should be executed.

Example:

```text
/home/user/scripts/process_data.py
```


depending on how the task should be executed.



### Adding parameters

Parameters represent command-line arguments passed to the executable program.

For each parameter you can configure:

- **Name** – logical parameter name shown in the UI,
- **Flag** – command-line flag (`--input`, `--out`, `-i`, ...),
- **Value** – parameter value,
- **Role** – determines whether the parameter is local, input, or output.

Example configuration:

| UI field | Value |
|---|---|
| Name | numbers |
| Flag | --num |
| Type | file |
| Value | numbers.txt |

corresponds to:

```bash
--num numbers.txt
```

in the generated command.



### Input and output parameters

If a parameter should be connected to another node, it must be exposed as:

- **Input** – value comes from another node,
- **Output** – value produced by this node.

After marking a parameter as input or output, a corresponding port appears on the node and can be connected in the workflow graph.

Connections between nodes define the data flow of the workflow.

For input parameters connected to another node, the parameter value may remain empty.  
During workflow execution, the editor automatically fills the value with the path to the corresponding output produced by the connected node.

If the input represents an external file that is not produced inside the workflow, the parameter value must contain the path to the file explicitly.



### Running workflow

Workflow execution can be started using the **RUN** button in the top toolbar.

Depending on the selected backend, the editor can:

- execute workflow locally,
- generate Slurm scripts,
- generate PBS scripts.

Generated outputs and scripts are stored in the `runs/` directory.



### Additional functionality

The editor also provides several additional workflow management features:

- **New** – creates a new empty workflow,
- **Save As** – exports workflow either as:
  - internal JSON workflow format,
  - CWL workflow,
- **Import** – imports workflow from previously exported JSON file,
- **Group** – groups selected nodes into a subworkflow node,
- **Save Preset** – saves current node configuration as reusable preset  
  (available at the bottom of the right panel),
- **Import Task Preset** – imports previously exported task preset  
  (available in the left panel).

Saved presets can later be reused and inserted multiple times into different workflows.



### Online demo

A demonstration deployment of the application is also available online:

https://tool-for-scientific-workflows.onrender.com/

The online version is intended mainly for demonstration purposes.  
For full functionality, especially local workflow execution and script generation, local deployment is recommended.


## Author information

 * Name: Silvia Šlachtovská 
 * Phone: +421 944936670
 * Email: silviaslachtovska@gmail.com
 * Date: 2025/2026


