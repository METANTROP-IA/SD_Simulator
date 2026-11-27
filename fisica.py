"""Física del simulador de diversidad de espacio (SD).

Basado en la Rec. ITU-R P.530-19, § 6.2.1, ecuaciones (151) y (152).

Unidades:
    d, d1   -> km
    f       -> GHz
    alturas -> m
    k       -> adimensional (factor de radio efectivo de la Tierra)

Modelo de interferencia (espejo de Lloyd):
    La reflexión en una superficie lisa equivale a una "antena imagen" bajo la
    superficie. La antena real y su imagen son dos fuentes coherentes separadas
    2·h1, como las rendijas del experimento de Young; la torre del sitio 2 es la
    pantalla.

    δ = 2·h1_ef·h / d          diferencia de trayecto
    φ = 2π·δ / λ               fase
    E = 1 − ρ·e^(jφ)           la reflexión invierte la fase
    |E|² = 1 + ρ² − 2ρ·cos φ   intensidad relativa al rayo directo

    La distancia entre franjas oscuras es θ = λ·d / (2·h1_ef) = 150·d / (f·h1_ef),
    que es la ec. (151).
"""

from __future__ import annotations

import math
from fractions import Fraction

K_REFERENCIA = 4 / 3  # k mediano con el que se diseña la separación
PISO_DB = -40.0

# Valores de k para la tabla comparativa de la calculadora.
K_TABLA: list[tuple[str, float]] = [
    ("2/3", 2 / 3),
    ("1", 1.0),
    ("4/3 (normal)", 4 / 3),
    ("∞", math.inf),
]

# Escenario que carga por defecto el simulador de interferencia.
ESCENARIO_DEFECTO = {
    "d": 40.0,     # km
    "f": 6.0,      # GHz
    "h1": 60.0,    # m, antena del sitio 1 sobre el agua
    "d1": 15.0,    # km, del sitio 1 al punto de reflexión
    "h2": 85.56,   # m, antena main del sitio 2 (cae en un nulo con k = 4/3)
}


# ---------------------------------------------------------------- comunes

def leer_k(valor: str | None) -> float:
    """Convierte texto a k. Acepta '4/3', '1.333', 'inf' o '∞'."""
    if valor is None or str(valor).strip() == "":
        return K_REFERENCIA
    texto = str(valor).strip().lower().replace(",", ".")
    if texto in ("inf", "infinito", "∞"):
        return math.inf
    try:
        k = float(Fraction(texto))
    except (ValueError, ZeroDivisionError) as exc:
        raise ValueError("El valor de k no es válido. Usa por ejemplo 4/3, 1.33 o inf.") from exc
    if not k > 0:
        raise ValueError("k tiene que ser mayor que cero.")
    return k


def correccion_curvatura(d1_km: float, k: float) -> float:
    """Metros que la curvatura terrestre resta a la altura: d1² / (12.74·k)."""
    if math.isinf(k):
        return 0.0
    return d1_km**2 / (12.74 * k)


def altura_efectiva(h_m: float, d1_km: float, k: float) -> float:
    """Altura de la antena sobre el plano de reflexión, corregida por curvatura."""
    return h_m - correccion_curvatura(d1_km, k)


def distancia_entre_minimos(d_km: float, f_ghz: float, h_ef_m: float) -> float:
    """Ec. (151): distancia vertical entre mínimos (o máximos) consecutivos, en m."""
    return 150.0 * d_km / (f_ghz * h_ef_m)


def separaciones_optimas(theta_m: float, cantidad: int = 3) -> list[float]:
    """Ec. (152): múltiplos impares de θ/2 (θ/2, 3θ/2, 5θ/2, ...)."""
    return [(2 * i + 1) * theta_m / 2 for i in range(cantidad)]


def _validar_positivos(**valores: float) -> None:
    for nombre, valor in valores.items():
        if not (isinstance(valor, (int, float)) and math.isfinite(valor) and valor > 0):
            raise ValueError(f"{nombre} tiene que ser un número mayor que cero.")


# ------------------------------------------------------------- calculadora

def calcular_separacion(d_km: float, f_ghz: float, h1_m: float, d1_km: float, k: float) -> dict:
    """Separación recomendada S = θ/2 y datos auxiliares."""
    _validar_positivos(d=d_km, f=f_ghz, h1=h1_m, d1=d1_km)
    if d1_km >= d_km:
        raise ValueError("d1 tiene que ser menor que d.")

    correccion = correccion_curvatura(d1_km, k)
    h_ef = h1_m - correccion
    if h_ef <= 0:
        raise ValueError(
            "La altura efectiva da cero o negativa: con estos datos la curvatura "
            "terrestre tapa el punto de reflexión."
        )
    theta = distancia_entre_minimos(d_km, f_ghz, h_ef)

    tabla = []
    for etiqueta, k_i in K_TABLA:
        h_ef_i = altura_efectiva(h1_m, d1_km, k_i)
        if h_ef_i > 0:
            theta_i = distancia_entre_minimos(d_km, f_ghz, h_ef_i)
            tabla.append({"k": etiqueta, "altura_efectiva_m": round(h_ef_i, 2),
                          "theta_m": round(theta_i, 2), "separacion_m": round(theta_i / 2, 2)})
        else:
            tabla.append({"k": etiqueta, "altura_efectiva_m": None, "theta_m": None, "separacion_m": None})

    return {
        "correccion_m": round(correccion, 2),
        "altura_efectiva_m": round(h_ef, 2),
        "theta_m": round(theta, 2),
        "separacion_m": round(theta / 2, 2),
        "separaciones_optimas_m": [round(s, 2) for s in separaciones_optimas(theta)],
        "tabla_k": tabla,
    }


# ----------------------------------------------------------- interferencia

def longitud_onda(f_ghz: float) -> float:
    return 0.3 / f_ghz


def intensidad(h_m: float, h1_ef: float, d_km: float, f_ghz: float, rho: float) -> float:
    """|E|² relativo al rayo directo solo, a la altura h de la torre del sitio 2."""
    fase = 2 * math.pi * (2 * h1_ef * h_m / (d_km * 1000)) / longitud_onda(f_ghz)
    re = 1 - rho * math.cos(fase)
    im = -rho * math.sin(fase)
    return re * re + im * im


def nivel_db(i: float) -> float:
    if i <= 0:
        return PISO_DB
    return max(PISO_DB, 10 * math.log10(i))


def simular_interferencia(k: float, rho: float, d: float, f: float, h1: float, d1: float, h2: float,
                          puntos: int = 240) -> dict:
    """Patrón de franjas en la torre del sitio 2 y señal en las antenas main y diversidad."""
    _validar_positivos(d=d, f=f, h1=h1, d1=d1, h2=h2)
    if not k > 0:
        raise ValueError("k tiene que ser mayor que cero.")
    if not (0 <= rho <= 1):
        raise ValueError("La fuerza de la reflexión tiene que estar entre 0 y 1.")
    if d1 >= d:
        raise ValueError("d1 tiene que ser menor que d.")
    h1_ef_ref = altura_efectiva(h1, d1, K_REFERENCIA)
    if h1_ef_ref <= 0:
        raise ValueError("Con k = 4/3 la altura efectiva de h1 da cero o negativa. Revisa h1 y d1.")

    # Separación de diseño: θ/2 calculada con el k mediano (4/3).
    separacion = distancia_entre_minimos(d, f, h1_ef_ref) / 2
    h_div = h2 - separacion
    if h_div <= 0:
        raise ValueError("La antena de diversidad quedaría bajo la superficie. Sube la antena main (h2).")

    h1_ef = altura_efectiva(h1, d1, k)
    altura_torre = max(1.4 * h2, 1.2 * h1)

    if h1_ef <= 0:
        # Con este k la curvatura tapa la reflexión: solo llega el rayo directo.
        patron = [1.0] * puntos
        i_main = i_div = 1.0
        theta = None
    else:
        norma = (1 + rho) ** 2 if rho > 0 else 1.0
        paso = altura_torre / puntos
        patron = [round(intensidad((n + 0.5) * paso, h1_ef, d, f, rho) / norma, 4) for n in range(puntos)]
        i_main = intensidad(h2, h1_ef, d, f, rho)
        i_div = intensidad(h_div, h1_ef, d, f, rho)
        theta = distancia_entre_minimos(d, f, h1_ef)

    db_main = nivel_db(i_main)
    db_div = nivel_db(i_div)
    return {
        "rho": rho,
        "h1_ef_m": round(max(h1_ef, 0.0), 3),
        "h1_m": h1,
        "theta_m": None if theta is None else round(theta, 3),
        "separacion_m": round(separacion, 3),
        "altura_torre_m": round(altura_torre, 3),
        "h_main_m": h2,
        "h_div_m": round(h_div, 3),
        "db_main": round(db_main, 2),
        "db_div": round(db_div, 2),
        "db_mejor": round(max(db_main, db_div), 2),
        "patron": patron,
    }


if __name__ == "__main__":
    # Ejemplo: 40 km, 6 GHz, h1 = 60 m, d1 = 15 km, k = 4/3 -> S ≈ 10.7 m
    r = calcular_separacion(40, 6, 60, 15, K_REFERENCIA)
    print(f"Altura efectiva: {r['altura_efectiva_m']} m | θ: {r['theta_m']} m | S = θ/2: {r['separacion_m']} m")
    e = ESCENARIO_DEFECTO
    s = simular_interferencia(K_REFERENCIA, 0.9, e["d"], e["f"], e["h1"], e["d1"], e["h2"])
    print(f"Señal en main: {s['db_main']} dB | Señal en diversidad: {s['db_div']} dB")
