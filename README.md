# MedicFy

Recordatorios de medicamentos por WhatsApp. Escaneas el QR una vez, configuras horarios y MedicFy envía los mensajes automáticamente a tu abuelita.

## Stack

- **[Astro](https://astro.build/)** — interfaz web y API (modo servidor)
- **whatsapp-web.js** — conexión con WhatsApp (QR + sesión)
- **IndexedDB** — configuración y horarios (en el navegador)
- **JSON (servidor)** — copia sincronizada para envíos automáticos
- **node-cron** — envío programado
- **nodemailer** — alertas por correo

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior
- Tu teléfono con WhatsApp (para escanear el QR)
- El PC debe estar encendido a la hora de los recordatorios

## Instalación

```bash
npm install
copy .env.example .env
```

Edita `.env` con tu zona horaria y correo para alertas.

## Configurar correo (alertas de fallo)

Cuando un mensaje no se puede enviar, MedicFy te manda un correo. Con Gmail:

1. Activa verificación en 2 pasos en tu cuenta Google
2. Crea una **contraseña de aplicación** en https://myaccount.google.com/apppasswords
3. Pon esa contraseña en `SMTP_PASS` del archivo `.env`

## Uso

Desarrollo:

```bash
npm run dev
```

Abre **http://localhost:4321**

Producción:

```bash
npm run build
npm start
```

1. Escanea el QR con WhatsApp (Dispositivos vinculados → Vincular dispositivo)
2. Guarda el número de tu abuelita (con código de país: `5215512345678`)
3. Agrega horarios y mensajes (ej: 08:00, 14:00, 20:00)
4. Prueba con "Enviar mensaje de prueba"

## Estructura

```
src/
  pages/
    index.astro          → Interfaz principal
    api/                 → Endpoints REST
  lib/server/
    whatsapp.js          → Conexión WhatsApp
    scheduler.js         → Envío automático
    email.js             → Alertas por correo
    store.js             → Copia en servidor (sync)
  lib/client/
    idb.ts               → IndexedDB (navegador)
  scripts/dashboard.ts   → Lógica del panel (cliente)
data/                    → Sesión WhatsApp y store.json (no subir a git)
```
