#!/usr/bin/env bash

calidad="$1"
largo="$2"
ancho="$3"
zona="$4"

case "$calidad" in
  economico) material_m2=18000; mano_m2=22000 ;;
  medio) material_m2=28000; mano_m2=35000 ;;
  premium) material_m2=45000; mano_m2=55000 ;;
  *) echo '{"total":0}'; exit 1 ;;
esac

case "$zona" in
  caba) factor=1.3 ;;
  gba) factor=1.1 ;;
  interior) factor=1 ;;
  *) factor=1 ;;
esac

m2=$(echo "$largo * $ancho" | bc)

materiales=$(printf "%.0f" $(echo "$m2 * $material_m2" | bc))
mano=$(printf "%.0f" $(echo "$m2 * $mano_m2" | bc))

subtotal=$(echo "$materiales + $mano" | bc)
total=$(echo "$subtotal * $factor" | bc)

margen=$(printf "%.0f" $(echo "$total * 0.15" | bc))
total=$(echo "$total + $margen + 10000" | bc)

echo "{\"total\": $total}"
