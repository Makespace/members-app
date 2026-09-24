#!/bin/bash
# One-off: record the equipment guide address for every machine that has a
# page on equipment.makespace.org, as collated on 2026-09-24 by crawling the
# guide site and matching it against the machines in the app.
#
# Three machines are deliberately absent because the guide site has no page
# for them: Parrot Server, Metal CNC - Tormach PCNC 440, and the Belt sander.
# Their signs print without a "Learn" code until a guide page exists.
#
# Usage:
#   BASE_URL=https://app.makespace.org TOKEN=<admin api token> ./scripts/seed-guide-urls.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TOKEN="${TOKEN:?set TOKEN to the admin api bearer token}"

guide() {
  local id="$1" url="$2"
  printf '%s ' "$url"
  curl -fsS -o /dev/null -w '%{http_code}\n' \
    -X POST "$BASE_URL/api/equipment/set-guide-url" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    --data "{\"equipmentId\":\"$id\",\"guideUrl\":\"$url\"}"
}

guide "be613ddb-f959-4c07-9dab-a714c1d9dcfd" "https://equipment.makespace.org/3d-printers/bambu-lab-x1"  # 3D Printers / Bambu X1
guide "2a96f797-4e3b-4778-9eb8-bf7cd600edd6" "https://equipment.makespace.org/3d-printers/form-3-resin-printer"  # 3D Printers / Form 3 Resin Printer
guide "dccca823-4a09-4f65-8ca5-b4bbbd3a118b" "https://equipment.makespace.org/3d-printers/markforged-mark-ii"  # 3D Printers / Markforged Mark II
guide "16f53337-ecf6-4476-a854-c1f4f341a356" "https://equipment.makespace.org/orange-equipment/3d-scanner"  # 3D Scanner / 3D Scanner
guide "38137289-f97b-4c9c-8aed-00e2b82f8d9a" "https://equipment.makespace.org/cnc-model-mill"  # CNC / CNC Model Mill
guide "44295217-416c-436e-a7ed-c4ff2d3e0bd5" "https://equipment.makespace.org/wood-shop/cnc-router"  # CNC / CNC Router
guide "1178c538-04b0-4ef9-8419-34e73f90648d" "https://equipment.makespace.org/craft-room-art-space/embroidery-machine"  # Craftroom / Embroidery Machine
guide "0f2dd455-096d-418e-9508-dd2c880a7ed3" "https://equipment.makespace.org/craft-room-art-space/pfaff-industrial-sewing-machine"  # Craftroom / Pfaff 591 industrial sewing machine
guide "8aea8e2f-acb9-4b31-9c1a-7f34c16e5ce0" "https://equipment.makespace.org/electronics-space"  # Electronics Bench / Electrical Working Policy
guide "d053cd2c-1ba3-483c-bdb9-338b14ffc753" "https://equipment.makespace.org/fine-metals-and-glass-work/fine-metals-bench"  # Fine Metals Bench / Fine Metals Bench
guide "3c6b1a58-472d-4f46-9c98-0301f64b97a9" "https://equipment.makespace.org/fine-metals-and-glass-work/glass-working-and-kiln"  # Glass Working and Kiln / Glass Bead
guide "26a9f079-5a86-4014-85af-15dfebdf73ea" "https://equipment.makespace.org/fine-metals-and-glass-work/glass-working-and-kiln"  # Glass Working and Kiln / Glass Working Kiln
guide "9b930554-c63a-4f2f-b4db-6d622ddfb78b" "https://equipment.makespace.org/fine-metals-and-glass-work/stained-glass-foil"  # Glass Working and Kiln / Stained glass station
guide "dbc3d9b6-4152-413d-8768-835a5d3d9d2e" "https://equipment.makespace.org/laser-cutter"  # Laser Cutters / HPC Laser Cutter
guide "7fb37d96-56f2-4ffa-a213-135f0e5bd0ba" "https://equipment.makespace.org/laser-cutter"  # Laser Cutters / Trotec
guide "079bba13-2f32-4b31-9da1-e8c5f030b958" "https://equipment.makespace.org/metal-shop/metal-lathe"  # Metal Shop / Metal Lathe
guide "b0dc0a6d-e342-4be7-a9c7-2cc21615a705" "https://equipment.makespace.org/metal-shop/metal-mill"  # Metal Shop / Metal Mill
guide "c351ba85-2514-413e-8257-63c1d846ddd3" "https://equipment.makespace.org/metal-shop/metal-grinder"  # Metal Shop / Tool Grinder
guide "6c905f4c-3467-4a9f-90c3-d5d622dee0fd" "https://equipment.makespace.org/riso-printer"  # Risograph / MH9350
guide "72a373b3-cb24-4797-8ba4-5b007e0a45d0" "https://equipment.makespace.org/wood-shop/wood-lathe"  # Wood Lathe / Wood Lathe
guide "4fda0066-5c6f-4043-9b2e-4ca1fda44057" "https://equipment.makespace.org/wood-shop/band-saw"  # Wood Shop / Band Saw
guide "22aeae84-31ad-4a60-ab5b-c973ddf5d4a3" "https://equipment.makespace.org/wood-shop/domino-joiner"  # Wood Shop / Domino Joiner
guide "f857639d-78dd-49eb-81db-33b48a9092fe" "https://equipment.makespace.org/wood-shop/festool-of1010-router"  # Wood Shop / Festool OF1010 Router
guide "6ff03684-04b6-4d10-9df8-7020b0955fb6" "https://equipment.makespace.org/wood-shop/mitre-saw"  # Wood Shop / Mitre Saw
guide "ea9f1ed0-1044-4cbe-b58d-12bc2416acec" "https://equipment.makespace.org/wood-shop/hammer-a3-31-planerthicknesser"  # Wood Shop / Planer/Thicknesser  Hammer A3-31
guide "a33d672e-c433-4a82-a322-ceba1fa72d47" "https://equipment.makespace.org/wood-shop/plunge-saw"  # Wood Shop / Plunge Saw  Festool TS75
guide "de26bff7-a0e3-4fcb-809d-abebaaea3a07" "https://equipment.makespace.org/wood-shop/tormek"  # Wood Shop / Tormek
guide "b4d82654-05b4-4f7e-ae59-88ff8734fd98" "https://equipment.makespace.org/wood-shop/woodworking-handtools-cabinet"  # Wood Shop / Woodworking Handtools
