# DispatchLab — Monte Carlo Exploring Starts

Juego multijugador para estudiantes de Ingeniería Industrial. Los estudiantes optimizan despachos de vehículos sin conocer la distribución de llegadas ni la matriz de transición de congestión.

## Ejecutar

Desde esta carpeta:

```bash
npm start
```

Abrir http://localhost:3000. Cada estudiante introduce sala y alias. Hay partidas manuales con acción inicial forzada y entrenamiento automático con MC-ES.

## MC-ES

El servidor elige pares estado–acción iniciales válidos procurando cobertura. La primera decisión del episodio es obligatoria; las siguientes decisiones automáticas se toman con la política greedy aprendida. Se estiman retornos completos first-visit y se actualiza Q por promedio incremental. El modo manual permite experimentar y registra episodios, pero las decisiones posteriores pueden no seguir una política greedy.

## Publicación

Configurar un servicio de Railway con **Root Directory** `/dispatchlab-multijugador`, conectado al repositorio y rama main. Railway debe generar un dominio público. Los pushes siguientes dispararán nuevos despliegues si Autodeploy está habilitado.

El archivo `data/state.json` almacena salas y puntajes localmente. Para preservar datos entre despliegues, montar un volumen en Railway y definir `DATA_FILE=/data/state.json`. Sin volumen, los puntajes pueden reiniciarse tras un redeploy.

No publicar secretos. El código del simulador y sus probabilidades están en `server.js`; estudiantes que tengan acceso al repositorio público pueden leerlas, aunque no se envían al navegador. Para ocultarlas completamente, es necesario almacenar el backend en un repositorio privado.
