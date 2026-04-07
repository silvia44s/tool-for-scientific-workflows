cwlVersion: v1.2
class: CommandLineTool
label: "Summarize pairs"
baseCommand: "/home/silvia/workflow_editor/workflow-editor/Sources/backend/tests/demo_pairs/tools/summarize_pairs.py"
inputs:
  input:
    type: File
    inputBinding:
      prefix: "--input"
      position: 1
  report:
    type: string
    default: "out/report.json"
    inputBinding:
      prefix: "--report"
      position: 2
outputs:
  report_file:
    type: File
    outputBinding:
      glob: $(inputs.report)
