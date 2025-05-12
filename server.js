const express = require('express');
const fs = require('fs').promises; // Usamos la versión de promesas de fs
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');
// Usar variable de entorno para JWT_SECRET. Si no está definida, usar un valor por defecto (NO para producción real sin variable de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'tu_super_secreto_jwt_desarrollo'; 

// --- Middlewares ---
app.use(cors()); // Permite peticiones de diferentes orígenes (nuestro frontend)
app.use(express.json()); // Para parsear bodies de peticiones JSON

// Servir archivos estáticos del frontend desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Funciones Auxiliares para la BD ---
async function readDB() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error leyendo la base de datos:', error);
        // Si el archivo no existe o hay error, devolver una estructura por defecto
        return { users: [], tools: [] }; 
    }
}

async function writeDB(data) {
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error escribiendo en la base de datos:', error);
    }
}

// --- Middleware de Autenticación ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401); // No hay token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token no válido
        req.user = user; // Añadimos el payload del token al request
        next();
    });
}

// Middleware para verificar rol de Admin
function isAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }
}

// --- Rutas de Autenticación ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await readDB();
    const user = db.users.find(u => u.username === username && u.password === password);

    if (user) {
        // ¡No incluir la contraseña en el token!
        const accessToken = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ accessToken, role: user.role, username: user.username });
    } else {
        res.status(400).json({ message: 'Nombre de usuario o contraseña incorrectos' });
    }
});

// --- Rutas para Herramientas (Protegidas) ---

// GET todas las herramientas
app.get('/api/tools', authenticateToken, async (req, res) => {
    const db = await readDB();
    res.json(db.tools);
});

// POST crear nueva herramienta (solo Admin)
app.post('/api/tools', authenticateToken, isAdmin, async (req, res) => {
    const db = await readDB();
    const newTool = {
        id: Date.now().toString(), // ID simple
        ...req.body
    };
    db.tools.push(newTool);
    await writeDB(db);
    res.status(201).json(newTool);
});

// PUT actualizar herramienta (solo Admin)
app.put('/api/tools/:id', authenticateToken, isAdmin, async (req, res) => {
    const toolId = req.params.id;
    const updatedToolData = req.body;
    const db = await readDB();
    
    const toolIndex = db.tools.findIndex(t => t.id === toolId);

    if (toolIndex === -1) {
        return res.status(404).json({ message: 'Herramienta no encontrada' });
    }

    // Actualizar la herramienta (evitar sobreescribir el ID del body si se envía)
    db.tools[toolIndex] = { ...db.tools[toolIndex], ...updatedToolData, id: toolId }; 
    await writeDB(db);
    res.json(db.tools[toolIndex]);
});

// DELETE herramienta (solo Admin)
app.delete('/api/tools/:id', authenticateToken, isAdmin, async (req, res) => {
    const toolId = req.params.id;
    const db = await readDB();

    const initialLength = db.tools.length;
    db.tools = db.tools.filter(t => t.id !== toolId);

    if (db.tools.length === initialLength) {
        return res.status(404).json({ message: 'Herramienta no encontrada' });
    }

    await writeDB(db);
    res.status(204).send(); // No content
});

// Ruta Catch-all para servir index.html del frontend (DEBE IR DESPUÉS DE LAS RUTAS API)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    if (JWT_SECRET === 'tu_super_secreto_jwt_desarrollo') {
        console.warn('ADVERTENCIA: Estás usando un JWT_SECRET por defecto. ¡Cámbialo en producción mediante una variable de entorno!');
    }
}); 