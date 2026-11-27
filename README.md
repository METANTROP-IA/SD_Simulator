# Instalación

Requisito: un entorno de Miniforge con Python 3.10.

## 1. Instalar Flask (solo la primera vez)

```bash
conda activate tu_entorno
conda install flask
```

Cambia `tu_entorno` por el nombre de tu entorno.

## 2. Ejecutar

```bash
conda activate tu_entorno
cd sd_simulador
python app.py
```

Se abre el navegador en **http://127.0.0.1:5001**. Arriba hay dos pestañas: **Calculadora de separación** y **Simulador de interferencia**.

Para detener el programa, presiona **Ctrl + C** en la terminal.

## Opciones

```bash
python app.py --port 8080    # si el puerto 5001 está ocupado
python app.py --no-browser   # no abrir el navegador automáticamente
```
