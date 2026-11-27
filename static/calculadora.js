// Calculadora de separación SD: lee los datos, pide el cálculo a Python y muestra el resultado.

const campos = ["d", "f", "h1", "d1", "k"];
const $ = (id) => document.getElementById(id);
const fmt = (x) => (x === null || x === undefined ? "—" : `${x.toFixed(1)} m`);

let temporizador = null;
let ultimaPeticion = 0;

function limpiarResultados() {
  ["o-corr", "o-hef", "o-theta", "o-s", "o-opt"].forEach((id) => ($(id).textContent = "–"));
  $("svg-s").textContent = "–";
  $("tabla-k").innerHTML = "";
}

function mostrar(r) {
  $("o-corr").textContent = fmt(r.correccion_m);
  $("o-hef").textContent = fmt(r.altura_efectiva_m);
  $("o-theta").textContent = fmt(r.theta_m);
  $("o-s").textContent = fmt(r.separacion_m);
  $("svg-s").textContent = fmt(r.separacion_m);
  $("o-opt").textContent = r.separaciones_optimas_m.map((s) => `${s.toFixed(1)} m`).join(", ") + " y así sucesivamente";

  const kActual = $("k").value;
  const mapa = { "2/3": "2/3", "1": "1", "4/3": "4/3 (normal)", inf: "∞" };
  $("tabla-k").innerHTML = r.tabla_k
    .map((fila) => {
      const clase = fila.k === mapa[kActual] ? ' class="actual"' : "";
      return `<tr${clase}><td>${fila.k}</td><td>${fmt(fila.altura_efectiva_m)}</td><td>${fmt(fila.theta_m)}</td><td>${fmt(fila.separacion_m)}</td></tr>`;
    })
    .join("");
}

async function calcular() {
  const params = new URLSearchParams();
  for (const c of campos) params.set(c, $(c).value);
  const id = ++ultimaPeticion;
  try {
    const resp = await fetch(`/api/separacion?${params}`);
    const datos = await resp.json();
    if (id !== ultimaPeticion) return; // llegó una respuesta vieja
    if (!datos.ok) {
      $("error").textContent = datos.error;
      limpiarResultados();
      return;
    }
    $("error").textContent = "";
    mostrar(datos);
  } catch (e) {
    $("error").textContent = "No se pudo conectar con el programa en Python. ¿Sigue corriendo app.py?";
  }
}

function programarCalculo() {
  clearTimeout(temporizador);
  temporizador = setTimeout(calcular, 150);
}

campos.forEach((c) => $(c).addEventListener("input", programarCalculo));
calcular();
