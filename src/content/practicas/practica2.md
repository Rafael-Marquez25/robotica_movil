---
title: "Práctica 2: seguimiento visual de una línea"
description: "Detección de una línea roja, velocidad adaptativa y recuperación del seguimiento."
date: 2026-10-16
draft: false
---

## Objetivo y fundamentos

Esta práctica consiste en conducir un vehículo simulado siguiendo la línea roja de un circuito mediante su **cámara**. El primer objetivo fue mantenerlo centrado; después, aumentar la velocidad sin perder estabilidad y recuperar el seguimiento cuando la línea dejara de verse.

La [guía de Follow Line de Robotics Academy](https://jderobot.github.io/RoboticsAcademy/exercises/AutonomousCars/follow_line/) plantea un control reactivo realimentado y presenta las alternativas P, PD y PID. La cámara permite observar la desviación, el controlador calcula una corrección y la siguiente imagen muestra el efecto de esa acción. Este ciclo constituye un control en lazo cerrado.

En términos generales, la acción proporcional responde al error presente; la integral acumula errores anteriores; y la derivativa responde a su variación. La solución evolucionó durante las pruebas hasta conservar únicamente las componentes proporcional y derivativa, tanto para el giro como para el comando de velocidad.

## De la imagen al error de seguimiento

### Segmentar la línea roja

Cada imagen de la cámara se transforma de BGR a HSV. Esta representación separa el tono del color de su saturación y luminosidad, lo que facilita construir una máscara para seleccionar la línea. La [documentación de OpenCV sobre espacios de color](https://docs.opencv.org/4.x/df/d9d/tutorial_py_colorspaces.html) describe este procedimiento de conversión y filtrado por intervalos.

En la representación de 8 bits utilizada, el rojo aparece cerca de ambos extremos de la escala de tono. Por ello se combinan dos intervalos:

| Componente  | Intervalos utilizados | Propósito                                   |
| ----------- | --------------------- | ------------------------------------------- |
| Tono        | 0–10 y 170–179        | Incluir los dos extremos asociados al rojo. |
| Saturación  | 100–255               | Descartar colores poco saturados.           |
| Luminosidad | 100–255               | Descartar píxeles demasiado oscuros.        |

### Región de interés y centroide

Durante el seguimiento se utiliza aproximadamente el **40 % inferior de la imagen**, desde el 60 % de su altura hasta el borde inferior. Esta región de interés concentra la medida en la zona próxima al vehículo.

El centro de los píxeles seleccionados se obtiene mediante momentos de imagen:

**cₓ = m₁₀ / m₀₀** y **cᵧ = m₀₁ / m₀₀ + y₀**.

Aquí, m₀₀ representa la suma de intensidades de la máscara, y₀ es el desplazamiento vertical de la región y cₓ, cᵧ sitúan el centroide en la imagen completa. Si m₀₀ es cero, no se considera visible la línea en esa región. Estas relaciones se apoyan en la [explicación de momentos y centroides de OpenCV](https://docs.opencv.org/4.x/dd/d49/tutorial_py_contour_features.html).

El error horizontal se define como la diferencia entre el centroide y el centro de la cámara:

**eₖ = cₓ − centro horizontal de la imagen**.

El error se expresa en píxeles: es positivo si la línea aparece a la derecha y negativo si aparece a la izquierda. La orden de giro utiliza el signo opuesto, de acuerdo con la convención del vehículo simulado.

La visualización de depuración muestra el centro de la cámara, el límite de la región de interés, el centroide y un segmento que representa el error. Más adelante se añadió el estado de navegación, con colores y un contorno para facilitar su lectura. Así se puede relacionar lo que detecta la cámara con lo que hace el coche.

## Primera iteración: seguir la línea con control proporcional

El punto de partida fue una velocidad lineal constante de **3,0**, una ganancia proporcional de giro de **0,005** y un límite de magnitud angular de **1,5**, en las unidades de comando del simulador.

La corrección era proporcional a la desviación: cuanto más lejos aparecía la línea del centro, más intenso era el giro. Esta primera versión permitía seguirla, pero durante los ajustes aparecieron oscilaciones y respuestas tardías en curvas.

Subir la ganancia hacía más enérgica la corrección, aunque también podía provocar que el coche cruzase repetidamente de un lado a otro de la línea. Bajarla suavizaba el movimiento, pero reducía la capacidad de corregir a tiempo. 

## Segunda iteración: añadir D

La componente derivativa se implementó como diferencia entre errores consecutivos:

**Δeₖ = eₖ − eₖ₋₁**.

El giro queda definido por:

**ωₖ = limitar(−(Kₚ · eₖ + K𝒹 · Δeₖ), −ωₘₐₓ, ωₘₐₓ)**.

La operación «limitar» recorta el resultado al intervalo permitido. En esta implementación discreta **no se divide por el tiempo entre imágenes**: las ganancias se ajustan para trabajar por iteraciones. Por tanto, cambiar la frecuencia efectiva del bucle puede modificar el comportamiento aunque se mantengan las mismas ganancias.

En la primera medida se anula la contribución derivativa. También se reinicia su historial al perder y recuperar la línea, para evitar comparar una detección nueva con un error antiguo.

Durante las pruebas se distinguieron dos problemas: oscilaciones amplias tras las curvas y pequeños temblores cerca del centro. La componente D ayuda a responder a los cambios del error, pero aumentarla sin límite puede amplificar ruido o producir correcciones bruscas. Una ganancia mayor no garantiza una conducción más estable.

## Tercera iteración: adaptar la velocidad al error visual

Mantener una velocidad fija limitaba las posibilidades de circular rápido en recta y conservar el control en curvas. Se incorporó un segundo regulador PD que reduce la velocidad comandada cuando aumenta la desviación.

Para ello se utiliza la magnitud del error, normalizada por la mitad del ancho de la imagen:

**qₖ = |eₖ| / (ancho / 2)**.

La velocidad se calcula mediante:

**vₖ = limitar(vₘₐₓ − Kₚᵥ · qₖ − K𝒹ᵥ · (qₖ − qₖ₋₁), vₘᵢₙ, vₘₐₓ)**.

Este segundo controlador regula el **comando de velocidad a partir del error visual**. No compara una velocidad deseada con una velocidad real medida mediante odometría.

Con un error pequeño y estable, el coche puede acercarse a la velocidad máxima. Si la desviación crece, disminuye el comando. La componente derivativa también influye: puede reforzar la reducción cuando el error aumenta rápidamente y permitir una aceleración cuando disminuye.

La principal limitación es la falta de anticipación. El centroide puede estar centrado justo antes de una curva cerrada; en ese instante, el controlador todavía no tiene un error grande que le haga reducir velocidad. Aumentar las ganancias no resuelve por sí solo la ausencia de una medida de la geometría que viene por delante.

## Ajuste de parámetros y aprendizajes

Las pruebas buscaron aumentar progresivamente la velocidad y observar qué sucedía en las curvas. Se pasó por límites máximos de velocidad de 8, 16 y finalmente 20. Aparecieron rebotes, sobreoscilación al salir de algunas curvas y correcciones angulares demasiado intensas.

| Etapa                                           | Configuración o decisión                          | Observación y alcance                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Inicio                                          | Giro proporcional y velocidad fija de 3,0.        | Permitió establecer el seguimiento básico.                                                                                  |
| Ajustes con máximo de velocidad 8               | Se variaron las ganancias de giro y de velocidad. | Se observaron oscilaciones en algunas curvas rápidas.                                                                       |
| Análisis de una grabación durante el desarrollo | Máximo de velocidad 16 y límite angular 10.       | Se describieron buena velocidad, giros bruscos y reducción insuficiente en determinadas curvas.                             |
| Última configuración                            | Máximo de velocidad 20 y dos PD independientes.   | Se conservaron las ganancias al añadir la recuperación.  |

También se propusieron configuraciones intermedias más conservadoras. Se consideran alternativas de ajuste, sin presentarlas como resultados medidos ni como una selección óptima demostrada.

Los parámetros de la versión final son:

| Magnitud                                                | Valor      |
| ------------------------------------------------------- | ---------- |
| Ganancia P de giro                                      | 0,0085     |
| Ganancia D de giro                                      | 0,0803     |
| Límite de magnitud angular                              | 10,0       |
| Ganancia P del comando de velocidad                     | 17,0       |
| Ganancia D del comando de velocidad                     | 10,0       |
| Velocidad mínima y máxima durante el seguimiento normal | 2,0 y 20,0 |
| Frecuencia                            | 100 Hz     |

Los límites son valores comandados al simulador, no mediciones de la velocidad efectiva del vehículo. 

El criterio de ajuste fue trabajar primero sobre el giro a velocidad baja y después sobre la velocidad adaptativa, variando una ganancia cada vez para interpretar mejor sus efectos. 

## Cuarta iteración: recuperar la línea

Al principio, perder la línea en la región inferior provocaba la parada y el reinicio de los controladores. La primera recuperación añadida avanzaba lentamente mientras giraba hacia el último lado conocido. Tras 80 iteraciones buscaba en el sentido contrario y, al superar 240, se detenía.

Esta estrategia tenía un problema en los arranques con el coche orientado aproximadamente **90° respecto de la línea**: avanzar durante la búsqueda podía alejarlo todavía más de ella.

La siguiente versión cambió dos decisiones: ordenar la búsqueda sin avance y mirar **toda la imagen** mientras la línea no apareciera en la región inferior. De ese modo puede detectar rojo antes de que entre en el área utilizada para el seguimiento normal.

### Organización de la recuperación final

| Situación                   | Acción                                                                                         | Transición                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Seguimiento                 | Aplicar los dos PD usando el centroide de la región inferior.                                  | Si desaparece la detección, reiniciar los historiales y comenzar la búsqueda.                                                  |
| Búsqueda inicial            | Ordenar velocidad lineal cero y giro hacia el último lado conocido.                            | Tras 180 iteraciones sin recuperar la línea, buscar en sentido contrario, salvo que proceda alinear con una detección visible. |
| Búsqueda contraria          | Ordenar el giro opuesto al sentido de referencia conservado.                                   | Recuperar el seguimiento, alinear con la línea visible o alcanzar el límite de búsqueda.                                       |
| Alineación                  | Girar hacia el centroide detectado en la imagen completa si su error supera el 12 % del ancho. | Volver al seguimiento cuando la línea entre en la región inferior.                                                             |
| Parada por búsqueda agotada | Ordenar velocidad y giro cero al superar 540 iteraciones sin recuperación.                     | Continuar observando; si vuelve a detectarse la línea en la región inferior, reanudar el seguimiento.                          |

**La recuperación se ha comprobado en las pruebas realizadas**, incluida la situación de arranque desalineado que motivó el cambio. El apartado de validación incluye una grabación específica de este comportamiento. Esta comprobación es cualitativa: no se ha medido una tasa de éxito ni se garantiza la recuperación para cualquier posición inicial.

La búsqueda con velocidad lineal cero responde al comportamiento probado en este simulador. Su traslado a otro vehículo requeriría revisar la cinemática: un coche con dirección Ackermann convencional no puede cambiar su orientación girando sobre el sitio.

## Validación y material multimedia

### Demostración del seguimiento

La siguiente grabación acompaña la práctica y permite observar el comportamiento del vehículo durante una ejecución. Se aporta como evidencia visual del seguimiento, sin asignarle un tiempo de vuelta ni afirmar que corresponda a una comparación controlada de ganancias.

<figure>
  <video controls preload="metadata" playsinline aria-label="Demostración del seguimiento de una línea roja en la práctica 2">
    <source src="/robotica_movil/media/practica2/videos/practica2.mp4" type="video/mp4" />
    Tu navegador no permite reproducir este vídeo. Puedes abrirlo mediante el enlace situado debajo.
  </video>
  <figcaption>Ejecución del seguidor visual de línea durante la navegación por el circuito.</figcaption>
</figure>

[Abrir el vídeo de seguimiento](/robotica_movil/media/practica2/videos/practica2.mp4).

### Demostración de la recuperación

Esta segunda grabación documenta la recuperación de la línea y complementa la demostración de seguimiento normal. Permite observar la maniobra de búsqueda y la vuelta al seguimiento en la situación ensayada.

<figure>
  <video controls preload="metadata" playsinline aria-label="Demostración de la recuperación de la línea en la práctica 2">
    <source src="/robotica_movil/media/practica2/videos/recovery_p2.mp4" type="video/mp4" />
    Tu navegador no permite reproducir este vídeo. Puedes abrirlo mediante el enlace situado debajo.
  </video>
  <figcaption>Prueba de recuperación de la línea y reanudación del seguimiento.</figcaption>
</figure>

[Abrir el vídeo de recuperación](/robotica_movil/media/practica2/videos/recovery_p2.mp4).

La grabación aporta evidencia visual de la recuperación en esta prueba. Para cuantificar su robustez haría falta repetirla con distintas posiciones y orientaciones iniciales y registrar los éxitos y fallos.

## Conclusiones y referencias

La práctica evolucionó desde seguir la línea a velocidad fija hasta combinar percepción por color, dos reguladores PD y una búsqueda activa cuando se pierde la referencia. El aprendizaje principal fue que aumentar la velocidad exige equilibrar la intensidad de las correcciones, la sensibilidad a los cambios del error y la capacidad de reducir velocidad a tiempo.

La recuperación resolvió en las pruebas el problema que motivó su desarrollo y queda documentada en su vídeo específico. Sigue pendiente cuantificar la robustez del conjunto. La anticipación de curvas sigue siendo una mejora relevante para avanzar más allá del ajuste manual de ganancias.

Como apoyo teórico se utilizó la [práctica Follow Line de Robotics Academy](https://jderobot.github.io/RoboticsAcademy/exercises/AutonomousCars/follow_line/). Un recurso de referencia que ayudó durante el desarrollo fue este [vídeo de OpenCV con Python](https://www.youtube.com/watch?v=oXlwWbU8l2o), útil como introducción al trabajo con imágenes. La documentación de OpenCV sobre [conversión de color](https://docs.opencv.org/4.x/df/d9d/tutorial_py_colorspaces.html) y [momentos de imagen](https://docs.opencv.org/4.x/dd/d49/tutorial_py_contour_features.html) complementa las decisiones de percepción descritas aquí.
