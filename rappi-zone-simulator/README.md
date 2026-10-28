# DispatchLab — simulador de despacho con Monte Carlo Exploring Starts

Juego de clase para aprender Reinforcement Learning (MC-ES) mediante decisiones de despacho de vehículos. El servicio Railway existente usa el directorio raíz `/rappi-zone-simulator`. Hay una copia del servidor y la interfaz en `/dispatchlab-multijugador`.

## Cómo jugar

1. Entra con una sala y alias; cada estudiante aprende Q de manera independiente.
2. Inicia un episodio. El simulador asigna el estado inicial y la primera acción obligatoria (exploring start).
3. Elige acciones en los turnos siguientes y observa pedidos, disponibilidad del vehículo, congestión, entregas y costos.
4. En el entrenamiento automático, el agente sigue la política greedy después de la primera acción. Al terminar el episodio, actualiza Q con el promedio incremental de retornos first-visit.
5. Consulta el mapa de política por hora, congestión y pedidos.
6. Tras 20 episodios como mínimo, evalúa tu política para competir.

## Quién gana

**Gana la política con mayor utilidad neta promedio en 80 escenarios idénticos para todos los estudiantes.** Cada escenario tiene un estado inicial fijo y una secuencia pseudoaleatoria determinista. Se evalúa la política greedy congelada, sin exploración ni actualización de Q.

- Puntuación oficial = suma de recompensas de los 80 escenarios / 80.
- Recompensa por turno = 30 × entregados − 35 si hay despacho − 15 si se despacha con congestión alta − 6 × pendientes tras la acción − 20 × rechazados − 20 × sin entregar al cerrar el horizonte.
- Desempate = menos pedidos perdidos (rechazados + sin entregar al cierre), acumulados en los mismos 80 escenarios. Si también empatan allí, comparten la posición.
- Los episodios de entrenamiento no otorgan puntos directamente.
- Al entrenar después de evaluar, el ranking marca la puntuación como desactualizada hasta reevaluar.
- El benchmark es una comparación reproducible en un conjunto fijo, no una estimación perfecta del valor esperado.

## Modelo y pedagogía

Estado `[hora, pedidos pendientes, vehículo disponible, congestión]`: 4 horas, de 0 a 6 pedidos, vehículo libre/ocupado y congestión alta/baja. Acciones: ESPERAR y DESPACHAR (solo si hay vehículo y pedidos). Capacidad de despacho: 4 pedidos.

Las probabilidades están en el servidor y no viajan al navegador. **Advertencia:** el repositorio es público y los estudiantes pueden leer `server.js`. Si deben permanecer desconocidas incluso para quien inspeccione GitHub, se requiere un backend privado.

En el juego manual, las decisiones posteriores al inicio exploratorio pueden no seguir la política greedy. Es útil para explorar y aprender, mientras que el entrenamiento automático implementa directamente el control MC-ES.

## Ejecutar

Requiere Node.js 20 o superior, sin dependencias externas:

    npm start

Abrir `http://localhost:3000`.

## Desplegar en Railway

Conservar Root Directory `/rappi-zone-simulator`, rama `main`, Start Command `npm start`, Health Check `/health` y habilitar Autodeploy si se desean despliegues por push. No mover el root a la carpeta espejo.

El estado se guarda por defecto en `data/state.json`. Para persistirlo entre despliegues, montar un volumen y configurar `DATA_FILE=/data/state.json`. Sin volumen, salas y puntuaciones pueden perderse al redesplegar.

Endpoints: `/api/join`, `/api/state`, `/api/start`, `/api/act`, `/api/train`, `/api/evaluate`.

Este laboratorio es una herramienta educativa, no un servicio de autenticación seguro ni un sistema de exámenes protegido contra trampas.
