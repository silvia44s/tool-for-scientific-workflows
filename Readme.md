# A Comprehensive Tool for Creating Scientific Workflows

## Introduction

This repository contains a master’s thesis developing a comprehensive tool for creating scientific workflows

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

After startup:

Frontend:
```text
http://localhost:5173
```

Backend:
```text
http://127.0.0.1:8000
```


### Workflow execution outputs

Workflow execution results are stored in `runs/`.


### Windows support

The application is primarily designed for Linux environments.

On Windows, it is recommended to use WSL (Windows Subsystem for Linux), because local workflow execution relies on generated Bash scripts.


## Usage instruction


## Author information

 * Name: Silvia Šlachtovská 
 * Phone: +421 944936670
 * Email: silviaslachtovska@gmail.com
 * Date: 2025/2026


