cwlVersion: v1.2
class: CommandLineTool
label: "Merge pairs"
baseCommand: "/home/silvia/workflow_editor/workflow-editor/Sources/backend/tests/demo_pairs/tools/merge_pairs.py"
inputs:
  left:
    type: File
    inputBinding:
      prefix: "--left"
      position: 1
  right:
    type: File
    inputBinding:
      prefix: "--right"
      position: 2
  out:
    type: string
    default: "out/pairs.txt"
    inputBinding:
      prefix: "--out"
      position: 3
outputs:
  out_file:
    type: File
    outputBinding:
      glob: $(inputs.out)
