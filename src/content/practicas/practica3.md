---
title: "Práctica 3: evitación de obstáculos con VFF"
description: "Navegación mediante fuerzas virtuales, repulsión ponderada y recuperación ante bloqueos."
date: 2026-10-30
draft: false
---

## Objetivo y fundamentos

En esta práctica el coche debe avanzar hacia una secuencia de objetivos evitando los obstáculos del circuito. Aquí la navegación utiliza la posición y orientación del vehículo y las distancias del láser.

La solución se basa en un **campo de fuerzas virtuales (VFF)**. El objetivo genera una fuerza atractiva y los obstáculos generan fuerzas repulsivas. Su suma indica hacia dónde dirigir el coche:

**F = Fₐ + Fᵣ**.

Son vectores de control, no fuerzas físicas aplicadas al vehículo. Es un método de navegación local: decide con la información actual, sin calcular una ruta completa alrededor de los obstáculos.

## Atracción hacia el objetivo y lectura del láser

Primero se expresa el objetivo en las coordenadas del coche: se resta la posición del vehículo y se gira el resultado según su orientación. Así, el eje longitudinal apunta hacia delante y el lateral hacia la izquierda. El vector hacia el objetivo se normaliza para que tenga módulo uno; de esta manera, un objetivo lejano no genera una atracción cada vez mayor.

Cuando la distancia al objetivo es inferior a **1 metro**, se marca como alcanzado y se pasa al siguiente. Si no hay un objetivo activo, el coche se detiene. Al cambiar de objetivo también se reinicia el filtrado para no arrastrar la dirección anterior.

El láser aporta hasta 180 lecturas del semicírculo frontal. Cada distancia se asocia a un ángulo respecto al frente del coche. Para calcular la repulsión se descartan las lecturas no finitas o no positivas, y solo intervienen los obstáculos a menos de **5 metros**.

## Repulsión: dar más importancia al frente

Cada lectura aporta un vector que apunta en sentido contrario al obstáculo. Su intensidad aumenta al disminuir la distancia. Además, se aplica un peso angular:

**peso(θ) = 0,2 + 0,8 · cos²(θ)**.

Un obstáculo justo delante tiene peso 1, mientras que una lectura lateral se aproxima a 0,2. Por tanto, a igual distancia, la lectura frontal puede pesar cinco veces más que una lateral.

Esta es la forma de hacer que **las paredes laterales influyan menos** y que un obstáculo en la dirección de avance tenga más importancia.

Las contribuciones se suman, se dividen por el número de lecturas que han intervenido y se aplica una ganancia de 3. Esto reduce la dependencia de la fuerza respecto al número de rayos activos. Finalmente, el módulo de la repulsión se limita a 2. Atracción y repulsión se combinan con el mismo peso global; la diferencia se introduce dentro del cálculo repulsivo.

## Convertir la fuerza en movimiento

La dirección de la fuerza resultante determina el giro mediante un control proporcional. La velocidad lineal es mayor cuando esa dirección coincide con el frente y disminuye cuando exige girar. Para evitar cambios bruscos se suavizan tanto la fuerza como la orden angular.

| Decisión | Ajuste utilizado |
| --- | --- |
| Suavizado de la fuerza | 15 % de la nueva medida y 85 % del valor anterior. |
| Giro | Ganancia proporcional de 0,6 y límite de magnitud de 3. |
| Suavizado del giro | 20 % de la nueva orden y 80 % de la anterior. |
| Velocidad según la dirección | Entre 0,4 y 6 antes de aplicar el frenado por obstáculos. |
| Vigilancia frontal | Distancia mínima dentro de un sector de ±20°. |
| Frenado | Reducción progresiva por debajo de 3 m y avance nulo a 0,8 m o menos. |

Los valores de velocidad son órdenes al simulador. El mínimo de 0,4 no obliga al coche a seguir avanzando: el frenado frontal puede reducirlo hasta cero. Si el módulo de la fuerza filtrada cae por debajo de 0,1, se detienen tanto el avance como el giro.

## Recuperación cuando las fuerzas se compensan

Un problema del VFF aparece cuando la atracción y la repulsión tienen magnitudes parecidas y sentidos opuestos. La resultante puede quedar casi anulada y el coche deja de progresar aunque todavía no haya llegado al objetivo.

Para salir de esta situación añadí una recuperación basada en el **desplazamiento real**: si el coche permanece durante más de 3 segundos sin alejarse más de 0,25 m de la posición de referencia, se considera bloqueado.

La maniobra tiene tres pasos:

1. **Buscar una salida.** Se comparan sectores de unos 30° dentro del campo frontal. Se valora la distancia al obstáculo más cercano de cada sector y se penalizan ligeramente los giros grandes. Si se repite un bloqueo antes de 10 segundos, se penaliza el lado del escape anterior para favorecer otra salida.
2. **Orientarse.** Se ordena girar sin avanzar hacia el sector elegido, hasta quedar a menos de 12° de esa dirección.
3. **Avanzar y volver al VFF.** Se avanza con una orden de velocidad de 1 durante un máximo de 2 segundos, corrigiendo la orientación. Si aparece un obstáculo frontal a 1 m o menos, se interrumpe antes. Después se reinician los filtros y la referencia de progreso.

Durante esta maniobra se deja de seguir temporalmente la suma de fuerzas. Eso permite romper el equilibrio que mantenía parado al coche, conservando la comprobación frontal durante el avance.

## Validación y vídeo

La grabación muestra el recorrido, las lecturas del láser y los vectores de atracción, repulsión y resultante. Permite relacionar la proximidad de los obstáculos con los cambios de dirección y observar la recuperación para continuar la navegación.

Un momento interesante está aproximadamente entre **2:05 y 2:15**: el coche queda frente a un obstáculo amarillo, cambia su orientación y consigue continuar. Esta secuencia permite ver la utilidad de la maniobra de escape cuando avanzar directamente hacia el objetivo deja de funcionar.

<figure>
  <video controls preload="metadata" playsinline aria-label="Navegación con VFF y recuperación ante obstáculos en la práctica 3">
    <source src="/robotica_movil/media/practica3/practica3.mp4" type="video/mp4" />
    Tu navegador no permite reproducir este vídeo. Puedes abrirlo mediante el enlace situado debajo.
  </video>
  <figcaption>Ejecución de la práctica: navegación entre objetivos, evitación de obstáculos y recuperación.</figcaption>
</figure>

[Abrir el vídeo de la práctica 3](/robotica_movil/media/practica3/practica3.mp4).


## Conclusiones

La parte más interesante ha sido combinar una regla sencilla, sumar atracción y repulsión, con ajustes que la hagan útil en el circuito. Ponderar por ángulo reduce la influencia de las paredes laterales, mientras que el frenado frontal y el suavizado ayudan a controlar el movimiento.

La recuperación complementa al VFF cuando deja de haber progreso, aunque no garantiza resolver cualquier disposición de obstáculos.
