cwlVersion: v1.2
class: Workflow
label: "New subworkflow"
inputs:
  left: File
  right: File
steps:
  merge_pairs:
    run: ../tools/merge_pairs.cwl
    in:
      left: left
      right: right
    out:
      - out_file
  scale_pairs:
    run: ../tools/scale_pairs.cwl
    in:
      input: merge_pairs/out_file
    out:
      - out_file
outputs:
  out:
    type: File
    outputSource: scale_pairs/out_file
