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

// NUEVO: Middleware para loguear TODAS las peticiones entrantes
app.use((req, res, next) => {
    console.log(`--> Petición Recibida: ${req.method} ${req.path}`);
    next(); // Pasa a los siguientes middlewares/rutas
});

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

// --- Middleware de Autenticación (AÑADIR LOG) ---
function authenticateToken(req, res, next) {
    console.log(`--> authenticateToken: Intentando verificar token para ruta: ${req.path}`); // NUEVO LOG
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        console.log('<-- authenticateToken: No hay token'); // NUEVO LOG
        return res.sendStatus(401);
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
             console.log('<-- authenticateToken: Token inválido o expirado', err.message); // NUEVO LOG
             return res.sendStatus(403);
        }
        console.log('<-- authenticateToken: Token verificado OK, usuario:', user.username); // NUEVO LOG
        req.user = user;
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
    console.log(`--> POST /api/login: Recibida petición con body:`, req.body); // NUEVO LOG
    try { // Añadir try-catch aquí también
        const { username, password } = req.body;
        if (!username || !password) {
             console.log('<-- POST /api/login: Falta username o password'); // NUEVO LOG
             return res.status(400).json({ message: 'Nombre de usuario y contraseña requeridos' });
        }
        const db = await readDB();
        console.log(`   POST /api/login: Base de datos leída`); // NUEVO LOG
        const user = db.users.find(u => u.username === username && u.password === password); // Aún en texto plano

        if (user) {
            console.log(`   POST /api/login: Usuario encontrado:`, user.username); // NUEVO LOG
            const accessToken = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
            console.log(`<-- POST /api/login: Login exitoso para:`, user.username); // NUEVO LOG
            res.json({ accessToken, role: user.role, username: user.username });
        } else {
            console.log(`<-- POST /api/login: Usuario no encontrado o contraseña incorrecta para:`, username); // NUEVO LOG
            res.status(400).json({ message: 'Nombre de usuario o contraseña incorrectos' });
        }
    } catch (error) {
         console.error(`<-- POST /api/login: Error interno:`, error); // NUEVO LOG
         res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// --- Rutas para Herramientas (Protegidas) ---

// GET todas las herramientas
app.get('/api/tools', authenticateToken, async (req, res) => {
    console.log(`--> GET /api/tools: Petición recibida por usuario: ${req.user.username}`); // NUEVO LOG
    try {
        const db = await readDB();
        console.log(`<-- GET /api/tools: Enviando ${db.tools.length} herramientas.`); // NUEVO LOG
        res.json(db.tools);
    } catch (error) {
        console.error(`<-- GET /api/tools: Error interno:`, error); // NUEVO LOG
        res.status(500).json({ message: 'Error interno al obtener herramientas' });
    }
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

// ANTES de app.get('*', ...)
app.get('/api/test', (req, res) => {
    console.log("--> GET /api/test: ¡La ruta de prueba funciona!");
    res.json({ message: 'Backend test route OK!' });
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