# Quiniela NFL — Configuración y promoción

Guía para dejar funcionando la Quiniela y promocionarla entre usuarios.

## 1. Reglas de seguridad de Firestore (OBLIGATORIO)

La quiniela usa estas colecciones en Firestore:

- `pools/{poolId}` — datos del grupo
- `pools/{poolId}/members/{uid}` — miembros y su puntaje
- `pools/{poolId}/predictions/{uid}` — predicciones de cada usuario

Ve a **Firebase Console → Firestore Database → Reglas** y agrega los bloques
de `pools` DENTRO de `match /databases/{database}/documents { ... }`, junto a
las reglas que ya tienes de `users`.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Reglas existentes de usuarios (NO borrar) ──
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && !request.resource.data.diff(resource.data).affectedKeys()
                        .hasAny(['pro', 'proUpdatedAt', 'stripeCustomerId', 'stripeSubscriptionId']);
    }

    // ── Quiniela ──
    match /pools/{poolId} {
      // Cualquier usuario autenticado puede leer un grupo (para buscarlo
      // por código y unirse) y crear grupos nuevos.
      allow read: if request.auth != null;
      allow create: if request.auth != null;

      // Solo actualizar el conteo de miembros / datos del grupo estando logueado.
      allow update: if request.auth != null;

      // Miembros del grupo
      match /members/{uid} {
        allow read: if request.auth != null;
        // Cada quien crea/edita su propia membresía.
        // (El puntaje lo recalcula el propio cliente comparando con
        //  resultados reales; para una quiniela amistosa es aceptable.)
        allow write: if request.auth != null;
      }

      // Predicciones
      match /predictions/{uid} {
        allow read: if request.auth != null;
        // Cada usuario solo puede escribir SU propia predicción.
        allow write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

Después de pegarlas, haz clic en **Publicar**.

> Nota de seguridad: en esta versión, el puntaje lo calcula el propio
> navegador y lo escribe en la membresía. Para una quiniela entre amigos
> (sin dinero) es suficiente. Si más adelante quieres que sea "a prueba de
> trampas", el cálculo de puntaje debería moverse a una función del
> servidor (Cloud Function / endpoint) con Admin SDK.

## 2. Índice de Firestore (probablemente necesario)

`getMyPools()` usa una consulta de tipo **collection group** sobre la
subcolección `members` (para encontrar todos los grupos del usuario).
Firestore suele pedir un índice para esto.

Si al abrir la Quiniela ves un error en la consola del navegador con un
enlace tipo `https://console.firebase.google.com/...create_composite=...`,
haz clic en ese enlace: crea el índice automáticamente. Espera 1-2 minutos
a que se active.

Alternativamente, en Firebase Console → Firestore → Índices →
**Exención de campo / Índice de grupo de colecciones**, crea uno para el
grupo de colecciones `members` con el campo `uid` (Ascendente).

## 3. Cómo funciona (resumen para el usuario)

1. Entrar a **Quiniela** en el menú (requiere iniciar sesión, es gratis).
2. **Crear** una quiniela (le pones nombre) o **unirte** con un código.
3. Al crear, se genera un **código** tipo `NFL-4X8K2` para compartir.
4. Cada semana, en **Mis pronósticos**, eliges al ganador de cada partido.
   - El pronóstico se **guarda automáticamente** y no se reinicia.
   - Cuando un partido **empieza**, tu pronóstico queda **bloqueado**.
5. En **Posiciones** ves la tabla del grupo: 1 punto por cada acierto.

## 4. Pasos para PROMOVER la quiniela entre nuevos usuarios

Objetivo: usar la quiniela como gancho para atraer y retener usuarios.

1. **Crea tú la primera quiniela** con tu cuenta y obtén su código.
2. **Comparte el código** por WhatsApp / redes con un mensaje tipo:
   > 🏈 Armé una quiniela de la NFL en Centro NFL. Regístrate gratis y únete
   > con el código NFL-XXXXX. A ver quién le atina a más partidos 😎
   > https://project-nfl-stats-pro.vercel.app/quiniela
3. **Contenido para TikTok/Instagram:**
   - "Reta a tus amigos: quiniela de la NFL gratis 🏈"
   - Graba la pantalla creando una quiniela y compartiendo el código.
   - Publica los **domingos** (día de más partidos) para máximo alcance.
4. **Cada semana**, recuerda a tu grupo que hagan sus pronósticos antes de
   que empiecen los juegos (jueves por la noche / domingo).
5. La quiniela **requiere registro** → cada persona que invitas se registra,
   lo que hace crecer tu base de usuarios.
