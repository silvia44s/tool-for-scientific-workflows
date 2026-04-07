cwlVersion: v1.2
class: CommandLineTool
label: "Scale pairs"
baseCommand: "/home/silvia/workflow_editor/workflow-editor/Sources/backend/tests/demo_pairs/tools/scale_pairs.py"
inputs:
  input:
    type: File
    inputBinding:
      prefix: "--input"
      position: 1
  factor:
    type: double
    default: 3
    doc: "External scale factor"
    inputBinding:
      prefix: "--factor"
      position: 2
  out:
    type: string
    default: "out/scaled_pairs.txt"
    inputBinding:
      prefix: "--out"
      position: 3
outputs:
  out_file:
    type: File
    outputBinding:
      glob: $(inputs.out)
