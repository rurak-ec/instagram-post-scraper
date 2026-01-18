# 📘 Instagram Scraper API - Guía del Desarrollador

> **Estado del Proyecto**: Activo & Estable 🚀
> **Tech Stack**: NestJS, Playwright, Docker, TypeScript

[🇺🇸 Read in English](./README.md)

API REST robusta para scraping de Instagram, diseñada específicamente para desarrolladores que necesitan alta disponibilidad y evasión de bloqueos mediante un sistema inteligente de rotación de cuentas.

---

## ⚡ Quick Start (Para Desarrolladores)

Si eres desarrollador y quieres levantar el proyecto YA, sigue esto:

### 1. Requisitos Críticos ⚠️

Para que este scraper funcione de manera confiable y evite bloqueos ("soft bans" o "rate limits"), necesitas cuentas de Instagram dedicadas.

| Requisito           | Cantidad       | Nota                                                                      |
| ------------------- | -------------- | ------------------------------------------------------------------------- |
| **Mínimo Absoluto** | 2 Cuentas      | Funciona, pero si una cae (challenge/lock), el sistema se degrada al 50%. |
| **Recomendado**     | **5+ Cuentas** | **Estabilidad Óptima**. Permite rotación amplia y "descanso" de cuentas.  |
| **Infinito**        | N Cuentas      | El sistema soporta tantas cuentas como agregues al `.env`.                |

> [!WARNING]
> **⚠️ Riesgos de Detección de Comportamiento Automatizado**
>
> Instagram detecta y restringe activamente la actividad automatizada. Puedes recibir avisos como "Detectamos actividad inusual" o "Intento de inicio de sesión sospechoso". Aquí están las mejores prácticas para minimizar riesgos:

#### 🛡️ Recomendaciones para Cuentas

| Recomendación                        | Por Qué Es Importante                                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Usa cuentas con antigüedad**       | Las cuentas creadas recientemente (< 6 meses) tienen más probabilidad de disparar la detección. Usa cuentas que ya llevan tiempo activas. |
| **Empieza gradualmente**             | No comiences con scraping intensivo. Inicia con 2-3 peticiones por cuenta por hora e incrementa progresivamente durante días/semanas.     |
| **Deja que las cuentas "descansen"** | Rota frecuentemente para que cada cuenta tenga períodos de enfriamiento. El sistema lo hace automáticamente.                              |
| **Más cuentas = más seguro**         | Tener 5-10+ cuentas distribuye la carga y reduce el riesgo individual de cada cuenta.                                                     |
| **No uses tu cuenta principal**      | Siempre usa cuentas secundarias/dedicadas. Si una se restringe, no pierdes tu perfil personal.                                            |

#### 📈 Estrategia de Uso Progresivo

```
Semana 1:  🐢 Uso ligero (2-3 scrapes/cuenta/hora)
Semana 2:  🚶 Uso moderado (5-8 scrapes/cuenta/hora)
Semana 3+: 🏃 Uso normal (10-15 scrapes/cuenta/hora)
```

> [!TIP]
> **Si una cuenta es marcada**: No entres en pánico. El sistema rota automáticamente a cuentas saludables. Inicia sesión manualmente en la cuenta afectada, completa cualquier verificación de desafío, y se recuperará. Tener más cuentas significa que una cuenta marcada no detiene tu operación.

### 2. Configuración de Entorno

```bash
# Copia el template
cp .env.example .env

# EDITA EL .env (Vital)
# Agrega tus cuentas en formato: USER:PASS
IG_ACCOUNT_1=mi_bot_1:password123
IG_ACCOUNT_2=mi_bot_2:password123
IG_ACCOUNT_3=mi_bot_3:password123
IG_ACCOUNT_4=mi_bot_4:password123
IG_ACCOUNT_5=mi_bot_5:password123
```

### 3. Configuración de Proxy

> [!IMPORTANT]
> **¿Cuándo necesitas un proxy?**
>
> - **Local Development (sin proxy)**: ❌ Setea `ENABLE_PROXY=false`.
> - **Testing (con proxy)**: ✅ Setea `ENABLE_PROXY=true` y configura `GLOBAL_PROXY_URL`.
> - **Producción (Cloud/VPS)**: ✅ **REQUERIDO**. (`ENABLE_PROXY=true`).

Instagram bloquea agresivamente las IPs de datacenters (AWS, Google Cloud, DigitalOcean, etc).

#### Opción A: Testing Local del Proxy (yarn dev)

**Paso 1:** Edita tu `.env` local:

```bash
# 1. Habilita el uso de proxy
ENABLE_PROXY=true

# 2. Configura tus credenciales reales
GLOBAL_PROXY_URL=http://usuario:pass@geo.proveedor.com:12321
```

**Paso 2:** Ejecuta el servidor:

```bash
yarn dev
```

**Paso 3:** Verifica en los logs:

```
🌐 Using Proxy: http://***@geo.proveedor.com:12321
```

Esto te permite **probar que el proxy funciona** antes de hacer deploy a producción.

#### Opción B: Producción (Recomendado)

**NO pongas el proxy en `.env`**. Usa los **Secrets** o **Environment Variables** de tu proveedor de Cloud.

```bash
# Variable para habilitar
ENABLE_PROXY=true

# Variable con la URL (Setear como Secret)
GLOBAL_PROXY_URL="http://usuario:password@geo.proveedor.com:12321"
```

El código leerá automáticamente `process.env.GLOBAL_PROXY_URL` si `ENABLE_PROXY` es true.

> [!TIP]
> **Consumo de Datos con Optimización**: Este proyecto bloquea imágenes/videos/fuentes automáticamente. Con esto, cada scrape consume ~300-500KB "utilizando tu proveedor de proxies residenciales favorito".

---

## 🛠️ Flujos de Trabajo (Workflows)

Diferenciamos claramente entre **Desarrollo** (donde quieres VER qué pasa) y **Producción** (donde quieres rendimiento y silencio).

### 🐛 Modo Desarrollo (Debugging Visual)

En este modo, el navegador se abre visualmente (`headless: false`). Ves exactamente cómo el bot entra a Instagram, hace login y navega.

**Configuración en `.env`:**

```properties
NODE_ENV=development
HEADLESS=false       <-- CLAVE: Esto abre el navegador
VERBOSE_LOGS=true    <-- CLAVE: Logs detallados en consola
```

**Comando:**

```bash
yarn dev
```

> El servidor iniciará en `http://localhost:3000`. Verás Chromium abrirse automáticamente.

---

### 🚀 Modo Producción (Docker / Server)

Este es el modo "Fire & Forget". Todo corre en contenedores Docker, sin interfaz gráfica, optimizado para servidores Linux/Cloud. Las sesiones PERSISTEN aunque reinicies el contenedor.

**Configuración (Automática en Docker):**
No necesitas tocar el `.env` para esto. El `docker compose.yml` fuerza:

- `HEADLESS=true`
- `NODE_ENV=production`

**Comandos de Despliegue:**

```bash
# 1. Levantar servicios (Build automático)
docker compose up -d

# 2. Ver logs en tiempo real (Vital para monitorear scraping)
docker compose logs -f

# 3. Administración Básica
docker compose down         # Detener todo
docker compose restart      # Reiniciar servicios (rápido)
```

### 🛠️ Comandos de Mantenimiento

**1. Recompilar (Si cambias código):**

```bash
docker compose up -d --build
```

**2. Ver Logs (Vital para debugging):**

```bash
docker compose logs -f --tail 100
```

**3. Reiniciar solo el Scraper:**

```bash
docker compose restart instagram-post-scraper
```

**4. Ver estado de contenedores:**

```bash
docker compose ps
```

**5. Reconstruir TODO desde cero (Reset Completo):**

```bash
# Detiene y elimina contenedores, redes y volúmenes
docker compose down -v

# Elimina la imagen
docker rmi instagram-post-scraper:latest

# Limpia el caché de build de Docker
docker builder prune -af

# Reconstruye sin caché y levanta
docker compose build --no-cache && docker compose up -d
```

> ⚠️ **Advertencia**: Esto eliminará todas las sesiones guardadas. Tendrás que volver a iniciar sesión en todas las cuentas de Instagram.

> **Persistencia**: Los volúmenes de Docker aseguran que **NO** tengas que loguearte cada vez.
>
> - `sessions/`: Guarda cookies/localStorage de cada bot.
> - `data/`: Guarda estadísticas de rotación.

---

### 🌐 Docker Networking (Importante)

Este proyecto usa **`network_mode: host`** en lugar de redes virtuales de Docker. Esto es **necesario** porque:

1. **Chromium requiere acceso real a internet** para conectarse a Instagram
2. Las redes bridge de Docker pueden bloquear la conectividad externa del navegador
3. Simplifica la comunicación desde otros contenedores

**Cómo conectarse desde otros contenedores Docker:**

| Desde                            | URL de conexión                                    |
| -------------------------------- | -------------------------------------------------- |
| Host (tu máquina)                | `http://localhost:3000`                            |
| Otro contenedor (Linux)          | `http://172.17.0.1:3000` o `http://<IP-HOST>:3000` |
| Otro contenedor (Docker Desktop) | `http://host.docker.internal:3000`                 |

**Ejemplo: Consumir desde otro docker-compose.yml:**

```yaml
services:
  my-service:
    image: my-app:latest
    environment:
      # En Linux, usa la IP del gateway de Docker
      - SCRAPER_API_URL=http://172.17.0.1:3000
      # En Docker Desktop (Mac/Windows)
      # - SCRAPER_API_URL=http://host.docker.internal:3000
```

> **Nota**: Para obtener la IP correcta del host en Linux, ejecuta: `docker network inspect bridge | grep Gateway`

---

## 📡 Ejemplos de Consumo

### 1. Simple cURL (Test rápido)

Scrapear posts de `@natgeo` usando una cuenta aleatoria disponible:

```bash
curl -X POST http://localhost:3000/instagram-post-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "username": "natgeo"
  }'
```

### 2. Typescript / Node.js (Integración)

```typescript
// Tu cliente API
async function getInstagramPosts(targetUsername: string) {
  try {
    const response = await fetch(
      "http://localhost:3000/instagram-post-scraper",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: targetUsername,
        }),
      },
    );

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Batch processed: ${data.totalProfiles} profiles`);
      data.results.forEach((result) => {
        if (result.success) {
          console.log(`\n📌 Profile: ${result.username}`);
          console.log(`🤖 Scraped with: ${result.scrapedWith}`);
          console.log(`📦 Posts: ${result.postsCount}`);
        } else {
          console.error(
            `❌ Profile ${result.username} failed: ${result.error}`,
          );
        }
      });
      return data.results;
    } else {
      console.error("❌ Error in scraper:", data);
    }
  } catch (error) {
    console.error("❌ Error de red:", error);
  }
}
```

### 3. Modo Batch (Multi-Scrape Paralelo)

**⚡ Nuevo: Procesamiento Simultáneo**

El modo batch ahora ejecuta todos los scrapes **en paralelo** usando múltiples pestañas en el mismo navegador. Esto significa:

- Todos los perfiles se scrapean **simultáneamente** (no secuencialmente)
- Usa la **misma cuenta de Instagram** para todo el batch
- **Emulated Focus** habilitado en cada pestaña para evitar problemas de tabs inactivas
- Máximo **5 perfiles** por batch

```bash
curl -X POST http://localhost:3000/instagram-post-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "usernames": ["natgeo", "nasa", "tesla"]
  }'
```

> **Nota**: El batch completo tarda aproximadamente lo que tarda el perfil más lento, no la suma de todos.

### 4. Filtrar por Fecha (`createdAt`)

Puedes especificar una fecha para obtener solo los posts publicados DESPUÉS de ese timestamp UNIX.

```bash
curl -X POST http://localhost:3000/instagram-post-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "username": "natgeo",
    "createdAt": 1765158474
  }'
```

### 4.1 Filtro por Fecha Individual (Modo Batch)

En modo batch, usa `createdAtMap` para especificar un `createdAt` diferente para cada perfil:

```bash
curl -X POST http://localhost:3000/instagram-post-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "usernames": ["natgeo", "nasa", "tesla"],
    "createdAtMap": {
      "natgeo": 1765158474,
      "nasa": 1765000000,
      "tesla": 1764900000
    }
  }'
```

> **Nota**: `createdAtMap` tiene precedencia sobre `createdAt` global. Si un perfil no está en el mapa, usa el `createdAt` global.

### 5. Ver Estado de Cuentas (`GET /accounts/status`)

Consulta el estado actual de todas las cuentas configuradas: si están activas, último éxito/fallo, y motivo del fallo.

```bash
curl http://localhost:3000/accounts/status
```

**Respuesta:**

```json
{
  "totalAccounts": 3,
  "activeAccounts": 2,
  "inactiveAccounts": 1,
  "accounts": [
    {
      "username": "bot_1",
      "isActive": true,
      "lastSuccess": "2025-12-07T04:45:00.000Z",
      "lastFailure": null,
      "failureReason": null,
      "consecutiveFailures": 0
    },
    {
      "username": "bot_2",
      "isActive": false,
      "lastSuccess": "2025-12-06T12:00:00.000Z",
      "lastFailure": "2025-12-07T02:30:00.000Z",
      "failureReason": "Session invalid (login required)",
      "consecutiveFailures": 3
    }
  ]
}
```

> **Nota**: Una cuenta se marca como `inactiva` después de 3 fallos consecutivos. El sistema de reparación automática intentará restaurarla en segundo plano.

---

## 🏗️ Arquitectura del Proyecto

```
instagram-post-scraper/
├── src/
│   ├── modules/
│   │   ├── accounts/   # 🧠 BRAIN: Gestiona la rotación y salud de cuentas
│   │   └── scraper/    # 🤖 BODY: Controla Playwright y la extracción de datos
├── sessions/           # 💾 MEMORY: Cookies y sesiones persistentes (GitIgnored)
└── data/               # 📊 STATS: Historial de uso de cuentas
```

### Cómo funciona la Rotación ("The Secret Sauce")

1. **Request Entrante**: Usuario pide scrapear `@leomessi`.
2. **Account Manager**:
   - Mira tu pool de cuentas (ej. 5 bots).
   - Filtra las que están "Healthy" (no bloqueadas recientemente).
   - Selecciona la **Menos Usada** (Lowest Usage Score) o Round-Robin.
3. **Session Check**:
   - ¿Ya tiene cookies validas en disco? -> **Reutiliza** (Carga instantánea ⚡).
   - ¿No tiene? -> **Login** (Solo la primera vez).
4. **Scraping**: Navega, extrae JSON, cierra contexto.
5. **Cool-down**: Libera el bot para la siguiente tarea.

---

## 📦 Estructura de Datos (JSON Response)

Lo que obtienes al final:

```json
{
  "success": true,
  "totalProfiles": 1,
  "successfulProfiles": 1,
  "failedProfiles": 0,
  "results": [
    {
      "success": true,
      "username": "natgeo",
      "postsCount": 1,
      "scrapedWith": "mi_bot_3",
      "scrapedAt": 1765159000,
      "posts": [
        {
          "id": "3123456789",
          "shortcode": "CzJ8...",
          "type": "feed",
          "text": "Caption del post...",
          "likes": 15400,
          "comments": 230,
          "createdAt": 1765158474,
          "media": [
            {
              "type": "image",
              "url": "https://instagram.fna... (URL Temporal de CDN)",
              "width": 1080,
              "height": 1080
            }
          ],
          "permalink": "https://instagram.com/p/CzJ8..."
        }
      ]
    }
  ]
}
```

---

## 🚨 Troubleshooting Común

**Q: Error `listen EADDRINUSE: address already in use :::3000`**  
A: Otro proceso (probablemente una instancia zombie de node) está usando el puerto.
Solución: `kill -9 $(lsof -t -i:3000)`

**Q: Mis cuentas se bloquean (Challenge Required)**  
A: Estás scrapeando demasiado rápido con muy pocas cuentas.
Solución:

1. Agrega más cuentas al `.env`.
2. Aumenta el delay entre requests.
3. Docker reinicia automáticamente las sesiones malas, pero necesitas "calma" en los requests.

**Q: No veo el navegador en `yarn dev`**  
A: Revisa que `HEADLESS=false` esté seteado en tu `.env`.

**Q: Error `net::ERR_INTERNET_DISCONNECTED` en Docker**  
A: Chromium dentro del contenedor no puede acceder a internet.  
Solución: Asegúrate de usar `network_mode: host` en tu `docker-compose.yml`. Las redes bridge de Docker pueden bloquear la conectividad del navegador.

**Q: La API devuelve 0 posts con `graphqlCaptured: false`**  
A: Esta advertencia significa que la API GraphQL de Instagram no respondió al scraper. Esto típicamente indica:

| Posible Causa             | Solución                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Restricción de cuenta** | Inicia sesión manualmente en la cuenta desde un navegador, completa cualquier verificación. Revisa el endpoint `/accounts/status`. |
| **Demasiadas peticiones** | La cuenta tiene rate-limit. Espera 15-30 minutos antes de reintentar. Agrega más cuentas para distribuir la carga.                 |
| **Sesión expirada**       | Reinicia el scraper con `docker compose restart instagram-post-scraper`. Las sesiones se revalidarán.                              |
| **Instagram bloqueando**  | Usa cuentas con antigüedad (6+ meses). Sigue la estrategia de uso progresivo descrita arriba.                                      |

> [!NOTE]
> Si `graphqlCaptured: true` pero `posts: []`, el perfil genuinamente no tiene posts (o todos fueron filtrados por `createdAt`). Este es comportamiento normal.

---

**Happy Scraping!** 🕷️
