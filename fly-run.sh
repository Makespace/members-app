#!/bin/bash

# I had a lots of backwards/forwards on how to handle doing some work in the background
# and decided on this approach as a balance between simplicity and ease to reason about.

set -m
node --import ./instrument.mjs build/src/index.js &
node --import ./instrument.mjs build/src/sync-worker/index.js &
fg %1
