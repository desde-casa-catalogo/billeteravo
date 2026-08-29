# Libro — Ingresos y Gastos

App web simple para registrar ingresos y gastos, con login por email y sincronización entre todos tus dispositivos (compu, celu). Sin frameworks, sin build: solo HTML/CSS/JS que corre directo en el navegador.

## 1. Crear el proyecto de Firebase (gratis)

1. Andá a https://console.firebase.google.com y creá un proyecto nuevo (ej: `libro-finanzas`).
2. En el menú lateral: **Build > Authentication > Get started**. Activá el proveedor **Email/Password**.
3. En el menú lateral: **Build > Firestore Database > Create database**. Elegí modo **producción** y la región más cercana.
4. En **Firestore > Reglas**, reemplazá el contenido por esto y publicá:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/transactions/{txId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   Esto asegura que cada usuario solo puede leer/escribir sus propios movimientos.

5. En **⚙️ Configuración del proyecto > Tus apps**, hacé clic en el ícono `</>` para agregar una app web. Ponele un nombre y copiá el objeto `firebaseConfig` que te muestra.
6. Pegá esos valores en el archivo `firebase-config.js` de este proyecto.

## 2. Subir el código a GitHub

```bash
cd finanzas
git init
git add .
git commit -m "Primera versión de Libro"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/libro-finanzas.git
git push -u origin main
```

## 3. Desplegar en Vercel

1. Entrá a https://vercel.com/new e importá el repo `libro-finanzas`.
2. Como es un sitio estático (sin framework), dejá el **Framework Preset en "Other"** — no hace falta build command.
3. Deploy. En 1-2 minutos tenés una URL tipo `libro-finanzas.vercel.app` que abrís desde cualquier compu o el celu.

## 4. Crear tu usuario

Abrí la app desplegada, tocá "Crear cuenta", poné tu email y una contraseña. Listo — desde ese momento tus movimientos quedan guardados en la nube y accesibles desde cualquier dispositivo con el mismo login.

## Notas

- Categorías de gasto e ingreso están predefinidas en `app.js` (`CATEGORIES`). Si querés agregar o cambiar categorías, es ese array.
- No hay límite de usuarios: si en el futuro querés compartir la app con alguien más del negocio, cada quien crea su propia cuenta y ve solo sus propios movimientos (no se mezclan).
- El plan gratis de Firebase (Spark) alcanza sobradamente para uso personal/de un negocio chico.
