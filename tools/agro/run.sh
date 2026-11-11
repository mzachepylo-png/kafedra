#!/usr/bin/env bash
# Режим задається в tools/agro/mode.txt: «search ключі», «final», «pages» (через пробіл можна кілька рядків)
set -u
while read -r line; do
  [ -z "$line" ] && continue
  case "$line" in
    pages*) python tools/agro/pages.py ;;
    *) python tools/agro/fetch.py $line ;;
  esac
done < tools/agro/mode.txt
