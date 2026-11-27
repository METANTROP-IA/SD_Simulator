"""Simulador de diversidad de espacio (SD) · Rec. ITU-R P.530-19.

Un solo programa con dos herramientas:
    /calculadora    separación de antenas S = θ/2 (ec. 151 y 152)
    /interferencia  patrón de interferencia en la torre (espejo de Lloyd)

Ejecutar:
    python app.py               -> abre http://127.0.0.1:5001 en el navegador
    python app.py --port 8080   -> usa otro puerto
    python app.py --no-browser  -> no abre el navegador
"""

from __future__ import annotations

import argparse
import math
import threading
import webbrowser

from flask import Flask, jsonify, redirect, render_template, request, url_for

import fisica

app = Flask(__name__)


def _numero(nombre: str, defecto: float | None = None) -> float:
    valor = request.args.get(nombre)
    if valor is None or valor.strip() == "":
        if defecto is None:
            raise ValueError(f"Falta el valor de {nombre}.")
        return defecto
    texto = valor.strip().lower().replace(",", ".")
    if texto in ("inf", "∞"):
        return math.inf
    try:
        return float(texto)
    except ValueError as exc:
        raise ValueError(f"El valor de {nombre} no es un número.") from exc


# ----------------------------------------------------------------- páginas

@app.get("/")
def inicio():
    return redirect(url_for("calculadora"))


@app.get("/calculadora")
def calculadora():
    return render_template("calculadora.html", activa="calculadora")


@app.get("/interferencia")
def interferencia():
    return render_template("interferencia.html", activa="interferencia")


# --------------------------------------------------------------------- API

@app.get("/api/separacion")
def api_separacion():
    try:
        r = fisica.calcular_separacion(
            d_km=_numero("d"),
            f_ghz=_numero("f"),
            h1_m=_numero("h1"),
            d1_km=_numero("d1"),
            k=fisica.leer_k(request.args.get("k")),
        )
    except ValueError as exc:
        return jsonify(ok=False, error=str(exc)), 400
    return jsonify(ok=True, **r)


@app.get("/api/escenario")
def api_escenario():
    return jsonify(ok=True, **fisica.ESCENARIO_DEFECTO)


@app.get("/api/patron")
def api_patron():
    e = fisica.ESCENARIO_DEFECTO
    try:
        r = fisica.simular_interferencia(
            k=_numero("k", fisica.K_REFERENCIA),
            rho=_numero("rho", 0.9),
            d=_numero("d", e["d"]),
            f=_numero("f", e["f"]),
            h1=_numero("h1", e["h1"]),
            d1=_numero("d1", e["d1"]),
            h2=_numero("h2", e["h2"]),
        )
    except ValueError as exc:
        return jsonify(ok=False, error=str(exc)), 400
    return jsonify(ok=True, **r)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulador de diversidad de espacio (P.530-19).")
    parser.add_argument("--host", default="127.0.0.1", help="Dirección de escucha (por defecto 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5001, help="Puerto (por defecto 5001)")
    parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador automáticamente")
    args = parser.parse_args()

    url = f"http://{'127.0.0.1' if args.host == '0.0.0.0' else args.host}:{args.port}"
    print(f"Simulador SD corriendo en {url}  (Ctrl+C para detener)")
    if not args.no_browser:
        threading.Timer(1.0, webbrowser.open, args=(url,)).start()
    app.run(host=args.host, port=args.port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
