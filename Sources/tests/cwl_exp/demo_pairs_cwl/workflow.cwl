cwlVersion: v1.2
class: Workflow
label: "demo_pairs"
requirements:
  SubworkflowFeatureRequirement: {}
inputs: {}
steps:
  generate_a:
    run: tools/generate_a.cwl
    in: {}
    out:
      - out_file
  generate_b:
    run: tools/generate_b.cwl
    in: {}
    out:
      - out_file
  new_subworkflow:
    run: subworkflows/new_subworkflow.cwl
    in:
      left: generate_a/out_file
      right: generate_b/out_file
    out:
      - out
  summarize_pairs:
    run: tools/summarize_pairs.cwl
    in:
      input: new_subworkflow/out
    out:
      - report_file
outputs:
  report:
    type: File
    outputSource: summarize_pairs/report_file
