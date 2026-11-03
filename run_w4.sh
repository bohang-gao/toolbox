#!/bin/bash
cd /e/code/toolbox || exit 1
echo "=== W4 START $(date '+%F %T') ===" >> _pipeline.log
claude -p "Read E:/code/toolbox/_task_spec_W4.md and implement it fully in the project at E:/code/toolbox (your cwd). Do not run git. Verify with: node src/lib/portrait.test.mjs and D:/node/npm.cmd run build." \
  --dangerously-skip-permissions --max-turns 160 > _w4_result.txt 2> _w4_stderr.log
echo "=== W4 END rc=$? $(date '+%F %T') ===" >> _pipeline.log
