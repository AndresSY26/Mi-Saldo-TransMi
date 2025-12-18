const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de EJS
app.set('view engine', 'ejs');
// Aseguramos que la ruta de vistas sea absoluta basándonos en la ubicación de este archivo
app.set('views', path.join(__dirname, 'views'));

// Servir archivos estáticos con ruta absoluta
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'Mi Saldo TransMi'
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
