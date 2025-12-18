# Mi Saldo TransMi (Node.js + EJS Port)

Esta es una reescritura completa de la aplicación original Angular utilizando Node.js, Express, EJS, TailwindCSS y Vanilla JS.

## Pre-requisitos

- Node.js instalado.
- Una cuenta de Firebase (Firestore y Auth habilitados).

## Instalación

1.  Abre una terminal en esta carpeta.
2.  Ejecuta:
    ```bash
    npm install
    ```

## Configuración OBLIGATORIA

Debes configurar tus credenciales de Firebase para que la aplicación funcione.

1.  Abre el archivo `public/js/main.js`.
2.  Busca la constante `firebaseConfig` al inicio del archivo.
3.  Reemplaza los valores de `API_KEY_AQUI`, `PROJECT_ID`, etc., con los de tu proyecto de Firebase.

## Ejecución

Para iniciar el servidor:

```bash
npm start
```

La aplicación estará disponible en: [http://localhost:3000](http://localhost:3000)

## Estructura

- `app.js`: Servidor Express.
- `views/index.ejs`: Plantilla HTML con Tailwind.
- `public/js/main.js`: Lógica de la aplicación (Auth, Firestore, UI).
- `public/css/styles.css`: Estilos personalizados (animaciones, scrollbar).
