cwlVersion: v1.2
class: CommandLineTool
label: "Generate A"
baseCommand: "/home/silvia/workflow_editor/workflow-editor/Sources/backend/tests/demo_numbers/tools/gen_numbers.py"
inputs:
  start:
    type: double
    default: 1
    inputBinding:
      prefix: "--start"
      position: 1
  end:
    type: double
    default: 5
    inputBinding:
      prefix: "--end"
      position: 2
  out:
    type: string
    default: "out/a.txt"
    inputBinding:
      prefix: "--out"
      position: 3
outputs:
  out_file:
    type: File
    outputBinding:
      glob: $(inputs.out)
