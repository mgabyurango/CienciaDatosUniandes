# Rappi Zone Simulator

Laboratorio educativo con dos juegos interactivos:

- **Presión operativa por zona:** muestra cómo la demanda, la capacidad y las decisiones de operaciones afectan el ETA.
- **Segmentación de clientes:** permite clasificar clientes nuevos, elegir intervenciones y analizar si una decisión fue buena o solo tuvo suerte.

## Ejecutarlo localmente

Necesitas Node.js 20 o superior.

```bash
npm start
```

Abre `http://localhost:3000`. La contraseña inicial del modo proyector es `uniandes2026`.

Para usar otra contraseña:

```bash
PRESENTER_PASSWORD="tu-clave" npm start
```

## Publicarlo en Railway

1. Sube esta carpeta a un repositorio de GitHub.
2. En Railway, crea un proyecto nuevo y elige **Deploy from GitHub repo**.
3. Selecciona el repositorio. Railway detectará Node y ejecutará `npm start`.
4. En **Variables**, crea `PRESENTER_PASSWORD` con una clave propia.
5. En **Settings → Networking**, pulsa **Generate Domain**.
6. Comparte ese dominio con los estudiantes.

No necesitas configurar una base de datos. El estado compartido vive en memoria y se reinicia cuando el servicio se vuelve a desplegar o reinicia, lo cual es adecuado para sesiones de clase.

## Estructura

- `upload/home.html`: selector de juegos.
- `upload/rappi-zone-simulator.html`: simulador de zonas.
- `upload/segmentation-game.html`: juego de segmentación y post mortem.
- `server.js`: servidor web y sincronización compartida.
- `railway.json`: configuración de despliegue y health check.
