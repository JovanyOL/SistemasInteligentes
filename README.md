# 🦁 León vs Impala — Simulador con Q-Learning

Este proyecto es un simulador donde un león aprende a cazar un impala utilizando una forma básica de **Q-Learning**.  
El objetivo es reproducir el comportamiento descrito en el escenario del proyecto académico:  
- El impala puede ver en varias direcciones, beber o huir.  
- El león puede avanzar, esconderse, atacar o situarse en 8 posiciones iniciales.  
- El sistema determina si el impala huye, si la cacería falla o si el león captura a su presa.  

Incluye dos modos de operación:
1. **Entrenamiento automático** (miles de incursiones).  
2. **Cacería paso a paso** visualizada en un canvas.

---

## 📁 Estructura del proyecto

/ (raíz del proyecto)
├── index.html
├── css/
│ └── styles.css
├── js/
│ ├── env.js
│ ├── impala.js
│ ├── leon.js
│ ├── qlearning.js
│ ├── knowledge.js
│ ├── ui.js
│ └── main.js
└── data/
└── qtable.json


---

## 📦 Archivos principales

### ✓ `index.html`
Interfaz principal del simulador.  
Carga el canvas, controles y scripts.

### ✓ `css/styles.css`
Diseño visual del tablero, botones y paneles.

### ✓ `js/env.js`
Define:
- tablero  
- posiciones válidas  
- reglas del mundo  

### ✓ `js/impala.js`
Lógica del comportamiento del impala.

### ✓ `js/leon.js`
Acciones del león:
- avanzar  
- esconderse  
- atacar  
- elegir acción según Q-learning  

### ✓ `js/qlearning.js`
Contiene:
- estructura de la Q-table  
- algoritmo de actualización  
- cálculo de recompensas  
- elección epsilon-greedy  

### ✓ `js/knowledge.js`
Permite:
- guardar el conocimiento  
- cargar qtable.json  
- mostrar la base de conocimiento en pantalla  

### ✓ `js/ui.js`
Maneja la interfaz gráfica:
- logs  
- secuencia programada  
- botones  
- visualización del estado  

### ✓ `js/main.js`
Controlador principal:
- sincroniza impala y león  
- avanza el tiempo T  
- ejecuta entrenamiento automático  
- reinicia la simulación  

---

## 📂 Carpeta `/data`

### ✓ `qtable.json`
Archivo donde se guarda y carga la Q-table del sistema.

Inicialmente está vacío:

```json
{
    "states": [],
    "qvalues": {}
}
