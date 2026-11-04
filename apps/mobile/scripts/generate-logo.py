"""Genera el logo de Élite Trainer: ondas suaves abajo, fondo casi blanco y una É salmón-rosa grande en el centro.

    python apps/mobile/scripts/generate-logo.py

Escribe los SVG en apps/mobile/assets/branding y los PNG (renderizados con Chrome) donde los
necesita la PWA y la app. Se puede repetir: sobrescribe todo.
"""
import math
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # apps/mobile
BRANDING = os.path.join(ROOT, "assets", "branding")
TMP = tempfile.gettempdir()
# Chrome solo se usa para convertir el SVG a PNG. Se puede fijar con la variable CHROME.
CHROME = os.environ.get("CHROME") or next(
    (
        p
        for p in (
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            "/usr/bin/google-chrome",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
        if os.path.exists(p)
    ),
    None,
)
if CHROME is None:
    raise SystemExit("No encuentro Chrome: indica su ruta en la variable CHROME")
os.makedirs(BRANDING, exist_ok=True)

# Color de la É: "salmon" (degradado salmón-rosa, el de la app) o "dark" (gris oscuro, el del texto).
#   python apps/mobile/scripts/generate-logo.py [salmon|dark]
MARKS = {
    "salmon": {"top": "#FF8F7E", "bottom": "#F86A8E", "shadow": "#F2708A", "shadow_opacity": 0.28},
    "dark": {"top": "#3A2F34", "bottom": "#2B2024", "shadow": "#2B2024", "shadow_opacity": 0.10},
}
VARIANT = sys.argv[1] if len(sys.argv) > 1 else "salmon"
if VARIANT not in MARKS:
    raise SystemExit(f"Variante desconocida: {VARIANT}. Usa: {', '.join(MARKS)}")
MARK = MARKS[VARIANT]

# Las ondas van en la parte baja, translúcidas como las de la app: se superponen y sus colores se
# mezclan donde se cruzan. Eso solo queda limpio sobre un fondo casi blanco (sobre salmón se
# mezclaba en tonos apagados). El cielo entra desvaneciéndose desde transparente, sin cruzarse con
# el salmón: mezclados dan un malva grisáceo. Una primera versión con ondas intensas por todo el
# cuadrado y azules fuertes parecía de playa más que de gimnasio.
SPAN = 1024
ORIGIN = 0
TILT = 0

# (y_base, amplitud, ciclos, fase, degradado, opacidad) de atrás adelante.
LAYERS = [
    (712, 64, 1.2, 4.5, "gSky", 0.60),
    (770, 60, 0.9, 0.6, "gPeach", 0.48),
    (828, 56, 1.1, 2.4, "gPink", 0.42),
    (892, 50, 1.5, 4.1, "gSalmon", 0.36),
]

GRADIENTS = {
    # nombre: (color de inicio, alfa de inicio, color de fin, alfa de fin)
    "gSky": ("#8ED3F2", 0.0, "#8ED3F2", 1.0),
    "gPeach": ("#FFB98A", 1.0, "#FFA9BA", 1.0),
    "gPink": ("#FFA9BA", 1.0, "#FF8F7E", 1.0),
    "gSalmon": ("#FF8F7E", 1.0, "#FFB98A", 1.0),
}


def wave_path(base, amp, cycles, phase, step=8):
    """Área bajo una curva suave, hasta muy por debajo del icono."""
    pts = []
    x = ORIGIN
    while x <= ORIGIN + SPAN:
        t = (x - ORIGIN) / SPAN * math.pi * 2 * cycles + phase
        y = base + amp * (math.sin(t) + 0.12 * math.sin(t * 1.7 + 1))
        pts.append((x, y))
        x += step
    bottom = 2000
    return (
        f"M{ORIGIN},{bottom} L"
        + " L".join(f"{px},{py:.1f}" for px, py in pts)
        + f" L{ORIGIN + SPAN},{bottom} Z"
    )


def logo_svg(mark_scale=1.0):
    """mark_scale < 1 deja más margen alrededor de la É (para el icono «maskable»)."""
    gradient_defs = "\n".join(
        f'    <linearGradient id="{name}" x1="0" y1="0" x2="1" y2="0">\n'
        f'      <stop offset="0" stop-color="{a}" stop-opacity="{aa}"/>\n'
        f'      <stop offset="1" stop-color="{b}" stop-opacity="{ba}"/>\n'
        f"    </linearGradient>"
        for name, (a, aa, b, ba) in GRADIENTS.items()
    )
    paths = "\n".join(
        f'      <path d="{wave_path(base, amp, cycles, phase)}" fill="url(#{g})" fill-opacity="{op}"/>'
        for base, amp, cycles, phase, g, op in LAYERS
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#FFF4F0"/>
    </linearGradient>
    <!-- La É: degradado de arriba a abajo (según la variante). Coordenadas del propio trazo. -->
    <linearGradient id="mark" gradientUnits="userSpaceOnUse" x1="350" y1="140" x2="690" y2="770">
      <stop offset="0" stop-color="{MARK['top']}"/>
      <stop offset="1" stop-color="{MARK['bottom']}"/>
    </linearGradient>
{gradient_defs}
    <!-- Región fija (no relativa al trazo): si no, la sombra se recorta y deja un borde visible. -->
    <filter id="shadow" filterUnits="userSpaceOnUse" x="150" y="40" width="750" height="900">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="{MARK['shadow']}" flood-opacity="{MARK['shadow_opacity']}"/>
    </filter>
    <clipPath id="square"><rect width="1024" height="1024"/></clipPath>
  </defs>
  <g clip-path="url(#square)">
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <g transform="rotate({TILT} 512 512)">
{paths}
    </g>
  </g>
  <g transform="translate(512 478) scale({mark_scale}) translate(-512 -512)" filter="url(#shadow)"
     fill="none" stroke="url(#mark)" stroke-width="76" stroke-linecap="round" stroke-linejoin="round">
    <!-- E: un solo trazo redondeado, con la barra del medio más corta -->
    <path d="M652 372 H388 V722 H652"/>
    <path d="M388 547 H596"/>
    <!-- Acento de la É -->
    <path d="M472 262 L586 214" stroke-width="64"/>
  </g>
</svg>
"""


def write(path, text):
    with open(path, "w", encoding="utf8", newline="\n") as f:
        f.write(text)


write(os.path.join(BRANDING, "logo.svg"), logo_svg(1.0))
write(os.path.join(BRANDING, "logo-maskable.svg"), logo_svg(0.78))


def render(svg_name, size, out_path):
    """Renderiza el SVG a PNG con Chrome, a `size` x `size` píxeles."""
    svg = open(os.path.join(BRANDING, svg_name), encoding="utf8").read()
    html = (
        "<!doctype html><meta charset=utf-8>"
        "<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:%dpx;height:%dpx}</style>%s"
        % (size, size, svg)
    )
    page = os.path.join(TMP, f"logo-{size}.html")
    write(page, html)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    subprocess.run(
        [
            CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--force-device-scale-factor=1", f"--window-size={size},{size}",
            f"--screenshot={out_path}", "file:///" + page.replace("\\", "/"),
        ],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(f"{size:>5} px -> {os.path.relpath(out_path, ROOT)}")


PUBLIC = os.path.join(ROOT, "public")
IMAGES = os.path.join(ROOT, "assets", "images")

render("logo.svg", 1024, os.path.join(IMAGES, "icon.png"))
render("logo.svg", 512, os.path.join(PUBLIC, "icon-512.png"))
render("logo.svg", 192, os.path.join(PUBLIC, "icon-192.png"))
render("logo.svg", 180, os.path.join(PUBLIC, "apple-touch-icon.png"))
render("logo.svg", 48, os.path.join(IMAGES, "favicon.png"))
render("logo-maskable.svg", 512, os.path.join(PUBLIC, "icon-maskable-512.png"))
print("listo")
