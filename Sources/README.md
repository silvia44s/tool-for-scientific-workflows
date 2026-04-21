# Workflow Editor 

This project is a visual workflow editor built with **React**, **TypeScript**, and **Vite**.  
It allows users to create workflows composed of executable tasks connected by data-flow edges.

The application communicates with a **Python backend** that validates the workflow, generates an execution plan and runs the workflow.

---

## Requirements

Before running the project make sure the following tools are installed:

- **Node.js** (recommended version 18 or newer)
- **npm** (comes with Node.js)
- **Python 3.10+**
- **pip**
- **venv** (recommended)

You can check your installation:

```bash
node -v
npm -v
python3 --version
```

---

## Getting the project
Clone the repository from GitLab:

```bash
git clone https://sc-nas.fit.vutbr.cz:10443/theses/2025/tool-for-scientific-workflows.git
cd Sources
```

Or download the repository as a ZIP file and extract it.

Project structure overview:

```bash
Sources/
│
├── src/                 # React frontend source code
├── backend/             # Python backend service
├── public/              # Static assets
├── package.json         # frontend dependencies
└── README.md
```

---

## Installing dependencies (frontend)
After downloading the project you need to install all required packages.

Run:
```bash
npm install
```

This will install all dependencies defined in ``package.json``.

---

## Running the frontend
To start the application in development mode:

```bash
npm run dev
```

After starting the server, Vite will show a local URL such as:

```bash
http://localhost:5173/
```
Open this address in your browser.

---

## Backend setup
The backend is implemented using FastAPI and is located in the ``backend/`` directory.

Navigate to the backend directory:
```bash
cd backend
```

Create a virtual environment:
```bash
python3 -m venv venv
```

Activate the environment.

Linux / macOS:
```bash
source venv/bin/activate
```

Windows:
```bash
venv\Scripts\activate
```

---

## Installing backend dependencies
Install required packages:
```bash
pip install -r requirements.txt
```

Current backend dependencies:
- fastapi
- uvicorn
- pydantic

---

## Running the backend server
Start the FastAPI server:
```bash
uvicorn workflow_backend.api:app --reload
```

The backend will start on:
```bash
http://127.0.0.1:8000
```

---

## Running the full system

**1.** Start the backend

```bash
cd backend
source venv/bin/activate
uvicorn workflow_backend.api:app --reload
```

**2.** Start the frontend
```bash
npm run dev
```

**3**. Open the application
```bash
http://localhost:5173
```

---

## Workflow execution
When the user clicks RUN in the editor (for now backend supports only local run):

**1.** The workflow JSON is sent to the backend.

**2.** The backend validates the workflow.

**3.** Tasks are ordered using a DAG planner.

**4.** An execution plan is generated.

**5.** A ``run.sh`` script is created.

**6.** The script is executed using ``subprocess``.

Execution results are stored in:

```bash
backend/runs/
```

Each run creates a timestamped directory containing:

- ``workflow.json``

- ``run.sh``

- execution outputs

---

## Building the frontend
To build the application for production:

```bash
npm run build
```
The compiled files will be generated inside the ``dist/`` directory.