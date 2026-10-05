---
title: "Práctica 1: navegación de un robot aspirador"
description: "Cobertura reactiva de una vivienda mediante espirales crecientes, detección de obstáculos y maniobras aleatorias."
date: 2026-10-05
draft: false
---

## Objetivo y fundamentos

El objetivo de esta práctica es diseñar el comportamiento de un robot aspirador para que recorra la mayor superficie posible de una vivienda. Se trata de un problema de cobertura: interesa extender el recorrido por el espacio accesible, además de evitar obstáculos.

La [guía de Robotics Academy para el robot aspirador](https://jderobot.github.io/RoboticsAcademy/exercises/MobileRobots/vacuum_cleaner) distingue entre cobertura con conocimiento previo del entorno y cobertura en línea, basada en medidas obtenidas durante la navegación. También presenta la exploración aleatoria y movimientos como la espiral y el barrido en franjas. Para la espiral, la relación entre velocidad lineal, velocidad angular y radio es **v = r · ω**.

La solución de esta práctica combina una espiral creciente con maniobras de retroceso, giro aleatorio y avance recto. Es una estrategia reactiva: toma decisiones a partir de la proximidad de obstáculos y del tiempo transcurrido, sin construir un mapa ni recordar las zonas visitadas. El barrido sistemático en franjas no forma parte de esta solución.

## Percepción del entorno

### Lectura y representación del láser

El robot utiliza un barrido de 180 medidas de distancia. Cada lectura se asocia a un ángulo respecto a la dirección de avance: la medida central corresponde al frente, los ángulos negativos quedan a la derecha y los positivos a la izquierda.

La información se representa mediante pares de distancia y ángulo. También se calculan coordenadas cartesianas a partir de cada medida:

**x = d · cos(θ)** y **y = d · sen(θ)**.

En este sistema, el eje x apunta hacia delante y el eje y hacia la izquierda. Aunque se obtienen ambas representaciones, la decisión de evitar un obstáculo utiliza las distancias y los ángulos; las coordenadas cartesianas no intervienen en el control actual.

### Sector frontal y umbral de proximidad

La detección se limita al sector comprendido entre **−45° y +45°**, incluidos sus extremos. Dentro de esa zona se selecciona la menor distancia. Si es inferior o igual a **0,30 m**, se activa la maniobra de evasión.

El criterio utiliza el obstáculo más próximo del sector, no una media de las lecturas ni únicamente el rayo central. La dirección concreta de ese obstáculo no determina hacia dónde girará después el robot: el sentido de giro se elige aleatoriamente.

Si no llegan medidas, no se declara un obstáculo. Esto describe el comportamiento actual, pero no constituye una parada de seguridad ante fallos del sensor.

## Organización del comportamiento

El control se organiza en cuatro estados. El robot empieza trazando una espiral y continúa ejecutando ciclos de percepción y movimiento de forma indefinida.

| Estado | Movimiento | Condición de salida | Estado siguiente |
| --- | --- | --- | --- |
| Espiral | Avanzar y girar con un radio creciente | Obstáculo frontal a 0,30 m o menos | Retroceso |
| Retroceso | Alejarse en línea recta | Termina la duración elegida | Giro |
| Giro | Rotar sobre el sitio | Termina la duración elegida | Avance recto |
| Avance recto | Desplazarse sin rotación | Se detecta un obstáculo | Retroceso |
| Avance recto | Desplazarse sin rotación | Termina el tiempo y no hay obstáculo | Espiral, con el radio inicial |

Si en el avance recto coinciden el fin del tiempo y la detección de un obstáculo, tiene prioridad el retroceso. El cambio de estado se decide en un ciclo y el movimiento del nuevo estado se ordena en el siguiente; por tanto, la reacción también depende del ritmo del controlador.

### Espiral creciente

El radio inicial es de **0,20 m** y la velocidad angular se mantiene en **0,50 rad/s**. La velocidad lineal se calcula mediante la relación entre radio y velocidad angular, por lo que empieza en **0,10 m/s**.

En cada ciclo de espiral, el radio aumenta **0,0001 m**. Al mantener el giro y aumentar progresivamente la velocidad de avance, la trayectoria se va abriendo. El radio expresa la curvatura instantánea deseada; su crecimiento permite abandonar las vueltas más cerradas.

El incremento se aplica por iteración, no por segundo. Por ello, una frecuencia real de ejecución diferente modifica la rapidez con la que se abre la espiral. No hay un límite superior explícito de radio o velocidad en este comportamiento, y tampoco un tiempo máximo de permanencia: la salida se produce al detectar un obstáculo.

### Retroceso

Ante un obstáculo frontal, el robot retrocede a **0,20 m/s**, con velocidad angular nula, durante un tiempo elegido uniformemente entre **0,40 y 0,80 s**.

El propósito es ganar separación antes de cambiar la orientación. Si se supone un movimiento ideal a velocidad constante, la distancia recorrida hacia atrás estaría entre **0,08 y 0,16 m**. Es una estimación cinemática, no una medida obtenida en el simulador. Durante esta maniobra no se comprueba la presencia de obstáculos detrás del robot.

### Giro aleatorio

Después del retroceso, el robot se detiene en traslación y gira sobre el sitio a **0,80 rad/s** en valor absoluto. Se elige al azar uno de los dos sentidos y una duración uniforme entre **2,00 y 3,90 s**.

El producto de velocidad angular y duración da un giro nominal de **1,60 a 3,12 rad**, aproximadamente **92° a 179°**. La orientación final no se verifica mediante realimentación: la maniobra termina por tiempo, de modo que el ángulo real puede diferir de esa estimación.

La variación del sentido y la duración busca diversificar el recorrido. No garantiza que la nueva dirección esté despejada ni evita por sí sola volver a una zona ya visitada.

### Avance recto y retorno a la espiral

Tras el giro, el robot avanza a **0,30 m/s**, con velocidad angular nula. La duración prevista se elige uniformemente entre **2 y 7 s**, y durante el avance se vuelve a comprobar el sector frontal del láser.

Si aparece un obstáculo, se interrumpe el avance y comienza otro retroceso. Si se agota el tiempo sin detectar obstáculos, el radio se restablece a **0,20 m** y comienza una nueva espiral. Esta es la transición que reinicia el radio; el retroceso y el giro no lo reinician por sí mismos.

Sin interrupciones y bajo movimiento ideal, el tramo recto mediría entre **0,60 y 2,10 m**. Su función es desplazar al robot antes de iniciar otra exploración en espiral.

## Temporización y parámetros

Un regulador de frecuencia marca el ritmo del bucle de control. Las maniobras temporizadas se gestionan mediante un reloj monotónico, que permite medir intervalos sin depender de ajustes de la hora del sistema. Al preparar cada maniobra se calcula su instante de finalización; en los ciclos siguientes se comprueba si ese instante ya ha llegado.

No se bloquea el controlador con una espera que abarque toda la maniobra. Sin embargo, continuar ejecutando el bucle no implica comprobar obstáculos en todos los estados: la detección frontal se utiliza durante la espiral y el avance recto.

| Parámetro | Valor | Papel en el comportamiento |
| --- | --- | --- |
| Sector de detección | ±45° respecto al frente | Selecciona las lecturas utilizadas para evitar obstáculos |
| Distancia de reacción | ≤ 0,30 m | Activa el retroceso |
| Radio inicial | 0,20 m | Inicia cada nueva fase de espiral |
| Crecimiento del radio | 0,0001 m por ciclo de espiral | Abre progresivamente la trayectoria |
| Velocidad angular en espiral | 0,50 rad/s | Define el giro mientras crece la velocidad lineal |
| Retroceso | 0,20 m/s durante 0,40–0,80 s | Separa el robot del obstáculo |
| Giro | ±0,80 rad/s durante 2,00–3,90 s | Cambia la orientación |
| Avance recto | 0,30 m/s durante 2–7 s como máximo | Traslada el robot antes de otra espiral |

## Limitaciones y posibles mejoras

La estrategia permite alternar movimientos con pocos estados y sin una representación global del entorno. Su principal limitación es que **recorrer espacio no equivale a garantizar una cobertura completa**. Al no guardar las zonas visitadas, puede repetir trayectorias, insistir en un rincón o dejar partes de la vivienda sin recorrer. Tampoco existe una condición de finalización basada en la superficie cubierta.

La evasión depende de un sector frontal y de un umbral fijo. No se supervisa la parte trasera durante el retroceso, ni se comprueba el entorno durante el giro. Además, la espiral puede aumentar la velocidad sin ajustar la distancia de reacción, lo que reduce el tiempo disponible para responder a un obstáculo.

El tratamiento del sensor presupone que un barrido no vacío contiene las 180 medidas esperadas y no incorpora un filtrado explícito de lecturas inválidas. Sería conveniente comprobar su integridad y disponer de una respuesta segura cuando falten datos.

Como mejoras futuras se pueden estudiar el crecimiento del radio en función del tiempo transcurrido, límites de velocidad, distancias de reacción adaptadas a la velocidad y una elección del giro basada en el espacio libre. Una memoria de las zonas visitadas permitiría valorar estrategias de cobertura más sistemáticas. Estas mejoras no forman parte del comportamiento documentado.

## Validación y material multimedia

La validación se apoya en dos capturas de resultados obtenidos en ejecuciones distintas y una grabación del inicio de otra ejecución. Las imágenes permiten comparar la cobertura conseguida; el vídeo muestra la puesta en marcha y el movimiento del robot en el simulador.

### Primera ejecución: 23,30 % tras una ejecución prolongada

En una primera ejecución conseguí una **cobertura del 23,30 %**, indicada por el evaluador en la esquina superior derecha de la captura. Fue el mejor resultado disponible inicialmente y se obtuvo después de bastante tiempo de ejecución. No se dispone de una duración exacta para calcular la rapidez con la que se alcanzó esa cobertura.

<figure>
  <a href="/robotica_movil/media/practica1/imagenes/max.png" aria-label="Abrir la captura de la primera ejecución a tamaño completo">
    <img src="/robotica_movil/media/practica1/imagenes/max.png" alt="Simulador de Robotics Academy con las zonas recorridas marcadas en blanco y una cobertura del 23,30 % en el evaluador." width="2560" height="1330" loading="lazy" decoding="async" />
  </a>
  <figcaption>Primera ejecución documentada: 23,30 % de cobertura tras una ejecución prolongada. Pulsa la imagen para verla a tamaño completo.</figcaption>
</figure>

El mapa muestra que el recorrido se concentra en una parte de la vivienda y que quedan zonas amplias sin cubrir. El resultado pone de manifiesto una limitación de la estrategia: mantener al robot en movimiento durante mucho tiempo no asegura que explore nuevas áreas. La ausencia de memoria de las zonas visitadas permite repetir recorridos sin aumentar necesariamente la cobertura.

### Segunda ejecución: nuevo máximo del 24,20 % en menos tiempo

En otra ejecución conseguí una **cobertura del 24,20 %**, superando el resultado anterior en **0,90 puntos porcentuales**. Además, esta ejecución duró considerablemente menos que la primera, por lo que se alcanzó una mayor cobertura en menos tiempo.

<figure>
  <a href="/robotica_movil/media/practica1/imagenes/max2.png" aria-label="Abrir la captura del nuevo máximo de cobertura a tamaño completo">
    <img src="/robotica_movil/media/practica1/imagenes/max2.png" alt="Mapa del recorrido del robot, con trazas en la zona inferior izquierda de la vivienda y una cobertura del 24,20 % en el evaluador." width="2560" height="1330" loading="lazy" decoding="async" />
  </a>
  <figcaption>Segunda ejecución documentada: nuevo máximo del 24,20 % de cobertura, alcanzado en un tiempo considerablemente menor que el de la primera. Pulsa la imagen para verla a tamaño completo.</figcaption>
</figure>

Durante esta prueba observé que **al robot le costó salir de la esquina inferior izquierda de la casa**. A pesar del tiempo empleado en abandonar esa zona, el resultado global superó al anterior. La captura muestra las zonas recorridas; la dificultad para salir de la esquina y la menor duración corresponden a lo observado durante la ejecución.

La comparación ilustra la variabilidad de la estrategia: una ejecución más larga no tiene por qué cubrir más superficie. Los giros y las duraciones aleatorias pueden dar lugar a recorridos distintos, y la ausencia de memoria permite insistir en zonas ya visitadas. La dificultad observada en la esquina también apunta al interés de detectar situaciones de poco progreso y adaptar la maniobra de salida.

El **24,20 % es el mejor resultado observado hasta ahora**, no un límite teórico ni una cobertura garantizada. Como no se dispone de tiempos exactos para ambas pruebas, la mejora temporal se describe de forma cualitativa; no se calcula un factor de aceleración ni una tasa de cobertura. Para atribuir la diferencia a una mejora sistemática harían falta pruebas repetidas en condiciones comparables.

### Vídeo del inicio de una ejecución

La siguiente grabación recoge el inicio de otra ejecución y permite comprobar visualmente que el robot se pone en movimiento en el entorno simulado. Su finalidad es mostrar el funcionamiento inicial de la solución; no documenta las ejecuciones de las capturas ni la evolución hasta el máximo de cobertura.

<figure>
  <video controls preload="metadata" playsinline aria-label="Inicio de una ejecución del robot aspirador">
    <source src="/robotica_movil/media/practica1/videos/practica1.mp4" type="video/mp4" />
    Tu navegador no admite vídeo HTML5.
  </video>
  <figcaption>Inicio de una ejecución: demostración del movimiento del robot en el simulador.</figcaption>
</figure>

[Abrir o descargar el vídeo del inicio de la ejecución](/robotica_movil/media/practica1/videos/practica1.mp4).

### Alcance de la validación

| Evidencia | Qué permite comprobar | Límite de la observación |
| --- | --- | --- |
| Primera captura | Cobertura del 23,30 % y distribución de las zonas recorridas | Ejecución prolongada, sin un tiempo exacto disponible |
| Segunda captura y observaciones de la prueba | Nuevo máximo del 24,20 % en considerablemente menos tiempo, pese a la dificultad para salir de la esquina inferior izquierda | La duración relativa y la dificultad de salida se observaron durante la ejecución; no se deducen de la imagen por sí sola |
| Vídeo del inicio | Puesta en marcha y movimiento del robot en una ejecución | No muestra la evolución completa ni los resultados de las capturas |

Estas evidencias permiten documentar el funcionamiento y comparar dos resultados concretos. Para valorar la eficiencia y la repetibilidad harían falta varias ejecuciones con la misma duración y condiciones iniciales, registrando la cobertura a lo largo del tiempo. Tampoco se dispone de un recuento sistemático de colisiones que permita afirmar su ausencia.

## Conclusiones

La práctica combina percepción láser, control de velocidades, temporización y una máquina de estados para construir una estrategia de cobertura reactiva. La espiral amplía el recorrido local, mientras que el retroceso, el giro aleatorio y el avance recto permiten cambiar la trayectoria ante obstáculos.

El vídeo aporta una demostración del funcionamiento inicial y las capturas documentan una mejora del mejor resultado observado, del **23,30 % al 24,20 % de cobertura**. La segunda ejecución consiguió ese resultado en considerablemente menos tiempo, incluso después de que al robot le costara salir de la esquina inferior izquierda. Esto muestra que el tiempo total de ejecución no basta para anticipar la superficie cubierta y que el recorrido concreto influye en el resultado.

La cobertura sigue siendo parcial y la dificultad para abandonar una esquina señala una posible línea de mejora en las maniobras de salida. Una evaluación con tiempos fijados y ejecuciones repetidas permitiría medir mejor la eficiencia y orientar las mejoras hacia la exploración de zonas todavía no visitadas.
