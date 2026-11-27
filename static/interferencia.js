// Simulador de interferencia: pide el patrón a Python y lo dibuja en la torre.

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

// Geometría del dibujo (coordenadas del viewBox)
const SY = 210;          // nivel del agua
const XS = 90;           // x de la antena del sitio 1
const XT = 570;          // x de la torre del sitio 2
const TORRE_PX = 162;    // alto máximo de la torre en el dibujo
const IMAGEN_PX = 96;    // profundidad máxima de la antena imagen en el dibujo

const camposEscenario = ["d", "f", "h1", "d1", "h2"];
let escenarioDefecto = null;
let enVuelo = false;
let pendiente = false;
let animando = false;
let t = 0;
let ultimoTs = 0;
let temporizador = null;
const historial = { main: [], div: [], mejor: [] };
const MAX_HISTORIAL = 400;

function set(el, attrs) {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

function fmtDb(v) {
  if (v <= -40) return "< −40 dB";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} dB`;
}

// ---------- Dibujo del SVG ----------
function dibujar(r) {
  const sc = Math.min(TORRE_PX / r.altura_torre_m, IMAGEN_PX / r.h1_m);
  const torrePx = r.altura_torre_m * sc;
  const topY = SY - torrePx;

  set($("fondoTorre"), { y: topY, height: torrePx });
  set($("torre2"), { y1: topY - 4 });
  set($("sitio2"), { y: topY - 16 });

  // Franjas
  const g = $("franjas");
  const n = r.patron.length;
  while (g.childNodes.length < n) {
    const rect = document.createElementNS(NS, "rect");
    set(rect, { x: 548, width: 20, fill: "#EF9F27" });
    g.appendChild(rect);
  }
  while (g.childNodes.length > n) g.removeChild(g.lastChild);
  const alto = torrePx / n;
  r.patron.forEach((v, i) => {
    set(g.childNodes[i], { y: SY - (i + 1) * alto, height: alto + 0.6, opacity: v });
  });

  // Antena del sitio 1 y su imagen
  const hayReflexion = r.h1_ef_m > 0 && r.rho > 0;
  const ys = SY - Math.max(r.h1_ef_m, 0) * sc;
  const yi = SY + Math.max(r.h1_ef_m, 0) * sc;
  const ym = SY - r.h_main_m * sc;
  const yd = SY - r.h_div_m * sc;

  set($("fuente"), { cy: ys });
  set($("fuenteL"), { y: ys - 14 });
  set($("imagen"), { cy: yi, display: hayReflexion ? "inline" : "none" });
  set($("imagenL"), { y: yi + 24, display: hayReflexion ? "inline" : "none" });
  set($("cota"), { y1: ys + 3, y2: yi - 3, display: hayReflexion ? "inline" : "none" });

  set($("rDir"), { x1: XS + 7, y1: ys, x2: XT - 7, y2: ym });
  if (hayReflexion) {
    const rx = XS + ((XT - XS) * (yi - SY)) / (yi - ym);
    set($("rRef1"), { x1: XS + 5, y1: ys + 5, x2: rx, y2: SY, display: "inline" });
    set($("rRef2"), { x1: rx, y1: SY, x2: XT - 7, y2: ym + 4, display: "inline" });
    set($("rVirt"), { x1: XS + 5, y1: yi - 5, x2: rx, y2: SY, display: "inline" });
  } else {
    ["rRef1", "rRef2", "rVirt"].forEach((id) => set($(id), { display: "none" }));
  }

  // Antenas del sitio 2 y sus etiquetas
  set($("antMain"), { y: ym - 6 });
  set($("antDiv"), { y: yd - 6 });
  let yMainL = ym;
  let yDivL = yd;
  if (yd - ym < 15) {
    const medio = (ym + yd) / 2;
    yMainL = medio - 8;
    yDivL = medio + 8;
  }
  set($("mainL"), { y: yMainL });
  set($("divL"), { y: yDivL });

  // Tarjetas
  $("oTheta").textContent = r.theta_m === null ? "sin reflexión" : `${r.theta_m.toFixed(1)} m`;
  $("oMain").textContent = fmtDb(r.db_main);
  $("oDiv").textContent = fmtDb(r.db_div);
  $("oMejor").textContent = fmtDb(r.db_mejor);
  $("oS").textContent = `${r.separacion_m.toFixed(1)} m`;
}

// ---------- Historial ----------
function agregarHistorial(r) {
  historial.main.push(r.db_main);
  historial.div.push(r.db_div);
  historial.mejor.push(r.db_mejor);
  for (const s of Object.values(historial)) if (s.length > MAX_HISTORIAL) s.shift();
  dibujarHistorial();
}

function limpiarHistorial() {
  historial.main = [];
  historial.div = [];
  historial.mejor = [];
  dibujarHistorial();
}

function dibujarHistorial() {
  const canvas = $("historial");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const css = getComputedStyle(document.documentElement);
  const color = (v) => css.getPropertyValue(v).trim();
  const izq = 52, der = 10, arr = 10, aba = 22;
  const yMin = -40, yMax = 10;
  const Y = (v) => arr + ((yMax - Math.max(yMin, Math.min(yMax, v))) / (yMax - yMin)) * (h - arr - aba);
  const X = (i) => izq + (i / (MAX_HISTORIAL - 1)) * (w - izq - der);

  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = color("--text-3");
  ctx.strokeStyle = color("--border");
  ctx.lineWidth = 1;
  for (let v = yMax; v >= yMin; v -= 10) {
    ctx.beginPath();
    ctx.moveTo(izq, Y(v));
    ctx.lineTo(w - der, Y(v));
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${v} dB`, izq - 6, Y(v));
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("tiempo →", izq, h - 4);

  const serie = (datos, col, ancho, guiones) => {
    if (datos.length < 2) return;
    const desde = MAX_HISTORIAL - datos.length;
    ctx.beginPath();
    datos.forEach((v, i) => (i === 0 ? ctx.moveTo(X(desde + i), Y(v)) : ctx.lineTo(X(desde + i), Y(v))));
    ctx.strokeStyle = col;
    ctx.lineWidth = ancho;
    ctx.setLineDash(guiones);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  serie(historial.mejor, color("--text-3"), 3, [2, 3]);
  serie(historial.main, color("--main-stroke"), 1.8, []);
  serie(historial.div, color("--div-stroke"), 1.8, []);
}

// ---------- Comunicación con Python ----------
function parametros() {
  const p = new URLSearchParams();
  p.set("k", $("k").value);
  p.set("rho", $("rho").value);
  for (const c of camposEscenario) p.set(c, $(c).value);
  return p;
}

async function pedir() {
  if (enVuelo) {
    pendiente = true;
    return;
  }
  enVuelo = true;
  try {
    const resp = await fetch(`/api/patron?${parametros()}`);
    const r = await resp.json();
    if (!r.ok) {
      $("error").textContent = r.error;
    } else {
      $("error").textContent = "";
      dibujar(r);
      agregarHistorial(r);
    }
  } catch (e) {
    $("error").textContent = "No se pudo conectar con el programa en Python. ¿Sigue corriendo app.py?";
    detenerAnimacion();
  } finally {
    enVuelo = false;
    if (pendiente) {
      pendiente = false;
      pedir();
    }
  }
}

// ---------- Animación de k ----------
const K_MIN = 0.7, K_MAX = 3.5;
const lnA = Math.log(K_MIN), lnB = Math.log(K_MAX);

function bucle(ts) {
  if (!animando) return;
  if (ultimoTs) t += (ts - ultimoTs) / 1000;
  ultimoTs = ts;
  if (!enVuelo) {
    const k = Math.exp(lnA + (lnB - lnA) * (0.5 - 0.5 * Math.cos(t * 0.8)));
    $("k").value = k.toFixed(3);
    $("kv").textContent = k.toFixed(2);
    pedir();
  }
  requestAnimationFrame(bucle);
}

function iniciarAnimacion() {
  animando = true;
  $("animar").textContent = "Detener";
  const k0 = parseFloat($("k").value);
  const u = Math.min(Math.max((Math.log(k0) - lnA) / (lnB - lnA), 0), 1);
  t = Math.acos(1 - 2 * u) / 0.8;
  ultimoTs = 0;
  requestAnimationFrame(bucle);
}

function detenerAnimacion() {
  animando = false;
  $("animar").textContent = "Variar k automáticamente";
}

// ---------- Eventos ----------
$("k").addEventListener("input", () => {
  if (animando) detenerAnimacion();
  $("kv").textContent = parseFloat($("k").value).toFixed(2);
  pedir();
});
$("rho").addEventListener("input", () => {
  $("rhov").textContent = parseFloat($("rho").value).toFixed(2);
  pedir();
});
$("animar").addEventListener("click", () => (animando ? detenerAnimacion() : iniciarAnimacion()));
$("limpiar").addEventListener("click", limpiarHistorial);

camposEscenario.forEach((c) =>
  $(c).addEventListener("input", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      limpiarHistorial();
      pedir();
    }, 250);
  })
);

$("restaurar").addEventListener("click", () => {
  if (!escenarioDefecto) return;
  camposEscenario.forEach((c) => ($(c).value = escenarioDefecto[c]));
  limpiarHistorial();
  pedir();
});

window.addEventListener("resize", dibujarHistorial);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", dibujarHistorial);

// ---------- Inicio ----------
(async function iniciar() {
  try {
    const resp = await fetch("/api/escenario");
    escenarioDefecto = await resp.json();
    camposEscenario.forEach((c) => ($(c).value = escenarioDefecto[c]));
  } catch (e) {
    $("error").textContent = "No se pudo conectar con el programa en Python. ¿Sigue corriendo app.py?";
    return;
  }
  dibujarHistorial();
  pedir();
})();
