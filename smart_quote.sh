#!/data/data/com.termux/files/usr/bin/bash

# =========================
# INPUT
# =========================
calidad="$1"
largo="$2"
ancho="$3"
zona="$4"
shift 4
extras=("$@")

# =========================
# DEFAULTS AUTOMATICOS
# =========================
[ -z "$calidad" ] && calidad="medio"
[ -z "$largo" ] && largo="2.5"
[ -z "$ancho" ] && ancho="1.8"
[ -z "$zona" ] && zona="caba"

# SI NO HAY EXTRAS → BAÑO COMPLETO AUTOMATICO
if [ ${#extras[@]} -eq 0 ]; then
  extras=("ducha" "wc" "mampara" "lavabo")
fi

# =========================
# CONFIG
# =========================
case "$calidad" in
  economico) material_m2=18000; mano_m2=22000 ;;
  medio) material_m2=28000; mano_m2=35000 ;;
  premium) material_m2=45000; mano_m2=55000 ;;
  *) echo '{"total":0}'; exit 1 ;;
esac

case "$zona" in
  caba) factor=1.3 ;;
  gba) factor=1.1 ;;
  interior) factor=1.0 ;;
  *) factor=1 ;;
esac

# =========================
# CALCULO
# =========================
m2=$(echo "$largo * $ancho" | bc)

materiales=$(printf "%.0f" $(echo "$m2 * $material_m2" | bc))
mano=$(printf "%.0f" $(echo "$m2 * $mano_m2" | bc))

total_extras=0
for extra in "${extras[@]}"; do
  case "$extra" in
    ducha) val=120000 ;;
    wc) val=80000 ;;
    lavabo) val=70000 ;;
    mampara) val=90000 ;;
    iluminacion) val=40000 ;;
    ventilacion) val=30000 ;;
    pintura) val=50000 ;;
    durlock) val=25000 ;;
    *) val=0 ;;
  esac
  total_extras=$((total_extras + val))
done

subtotal=$(echo "$materiales + $mano + $total_extras" | bc)
total=$(echo "$subtotal * $factor" | bc)

margen=$(printf "%.0f" $(echo "$total * 0.15" | bc))
total=$(echo "$total + $margen + 10000" | bc)

# =========================
# OUTPUT
# =========================
echo "{\"total\": $total}"
#!/data/data/com.termux/files/usr/bin/bash

# Logs para depuración
echo "DEBUG INPUT -> $*"

# Defaults
calidad="${1:-medio}"
largo="${2:-2.5}"
ancho="${3:-1.8}"
zona="${4:-caba}"

# Si no hay extras pero se menciona "baño"
extras=("${@:5}")
texto_completo="$*"
if [[ "$texto_completo" == *"baño"* ]]; then
  extras=("ducha" "wc" "mampara" "lavabo")
fi

echo "DEBUG -> calidad=$calidad largo=$largo ancho=$ancho zona=$zona extras=${extras[*]}"

case "$calidad" in
  economico) material_m2=18000; mano_m2=22000 ;;
  medio) material_m2=28000; mano_m2=35000 ;;
  premium) material_m2=45000; mano_m2=55000 ;;
  *) echo '{"total":0}'; exit 1 ;;
esac

case "$zona" in
  caba) factor=1.3 ;;
  gba) factor=1.1 ;;
  interior) factor=1.0 ;;
  *) factor=1 ;;
esac

m2=$(echo "$largo * $ancho" | bc)

materiales=$(printf "%.0f" $(echo "$m2 * $material_m2" | bc))
mano=$(printf "%.0f" $(echo "$m2 * $mano_m2" | bc))

total_extras=0
for extra in "${extras[@]}"; do
  case "$extra" in
    ducha) val=120000 ;;
    wc) val=80000 ;;
    lavabo) val=70000 ;;
    mampara) val=90000 ;;
    iluminacion) val=40000 ;;
    ventilacion) val=30000 ;;
    pintura) val=50000 ;;
    durlock) val=25000 ;;
    *) val=0 ;;
  esac
  total_extras=$((total_extras + val))
done

subtotal=$(echo "$materiales + $mano + $total_extras" | bc)
total=$(echo "$subtotal * $factor" | bc)

margen=$(printf "%.0f" $(echo "$total * 0.15" | bc))
total=$(echo "$total + $margen + 10000" | bc)

# Log final
echo "DEBUG OUTPUT -> total=$total"

echo "{\"total\": $total}"
