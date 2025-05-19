const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'tu_super_secreto_local'; // Usa una variable de entorno en producción

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// Middleware para loguear TODAS las peticiones entrantes
app.use((req, res, next) => {
    console.log(`--> Petición Recibida: ${req.method} ${req.path}`);
    if (Object.keys(req.body).length > 0) {
        console.log(`    Body: ${JSON.stringify(req.body)}`);
    }
    if (req.headers.authorization) {
        console.log(`    Authorization Header: Presente`);
    }
    next();
});

// Configuración de seguridad y caché
app.use((req, res, next) => {
    // Configurar CSP con versiones específicas para caché
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https: https://raw.githubusercontent.com; " +
        "frame-ancestors 'none';"
    );

    // Configurar caché con versiones
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 año para recursos estáticos

    // Eliminar headers innecesarios
    res.removeHeader('X-Frame-Options');
    res.removeHeader('X-XSS-Protection');
    res.removeHeader('Expires');

    next();
});

// Configuración específica para archivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        // Añadir versión al nombre del archivo para cache busting
        if (path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// Configuración específica para rutas API
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Servir favicon con el tipo MIME correcto y caché
app.get('/favicon.ico', (req, res) => {
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// --- Funciones Auxiliares para la BD ---
async function readDB() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error leyendo la base de datos:', error);
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
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    if (token == null) {
        console.log('<-- authenticateToken: Token no proporcionado.');
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('<-- authenticateToken: Token inválido.', err.message);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user; // Añade la info del usuario (payload del token) a la request
        console.log(`<-- authenticateToken: Token válido para usuario: ${user.username}, Rol: ${user.role}`);
        next();
    });
}

// Middleware para verificar rol de admin (opcional, si quieres rutas solo para admin)
// function isAdmin(req, res, next) {
//     if (req.user.role !== 'admin') {
//         console.log(`<-- isAdmin: Usuario ${req.user.username} no es admin.`);
//         return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
//     }
//     console.log(`<-- isAdmin: Usuario ${req.user.username} es admin.`);
//     next();
// }

// --- Rutas de Autenticación ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`--> POST /api/login: Intento de login para usuario: ${username}`);

    if (!username || !password) {
        console.log('<-- POST /api/login: Usuario o contraseña no proporcionados.');
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    try {
        const db = await readDB();
        const user = db.users.find(u => u.username === username);

        if (!user) {
            console.log(`<-- POST /api/login: Usuario no encontrado: ${username}`);
            return res.status(401).json({ message: 'Credenciales incorrectas' });
        }

        // DEBUG: Imprimir contraseña recibida y hash almacenado (Este lo podemos dejar o quitar)
        // console.log(`DEBUG: Contraseña recibida para comparación: "${password}"`);
        // console.log(`DEBUG: Hash almacenado para ${user.username}: "${user.password}"`);

        // Comparar la contraseña proporcionada con la hasheada en la BD
        const isMatch = bcrypt.compareSync(password, user.password);

        if (!isMatch) {
            console.log(`<-- POST /api/login: Contraseña incorrecta para usuario: ${username}`);
            return res.status(401).json({ message: 'Credenciales incorrectas' });
        }

        // Si las credenciales son correctas, generar un token JWT
        const tokenPayload = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' }); // Token expira en 1 hora

        console.log(`<-- POST /api/login: Login exitoso para ${username}. Token y rol enviados.`);
        res.json({ token, role: user.role, username: user.username });

    } catch (error) {
        console.error('<-- POST /api/login: Error interno:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// --- Rutas para Herramientas (Protegidas) ---

// GET todas las herramientas
app.get('/api/tools', authenticateToken, async (req, res) => {
    console.log(`--> GET /api/tools: Petición recibida por usuario ${req.user.username}`);
    try {
        const db = await readDB();
        console.log(`<-- GET /api/tools: Enviando ${db.tools.length} herramientas.`);
        res.json(db.tools);
    } catch (error) {
        console.error(`<-- GET /api/tools: Error interno:`, error);
        res.status(500).json({ message: 'Error interno al obtener herramientas' });
    }
});

// POST crear nueva herramienta
app.post('/api/tools', authenticateToken, async (req, res) => {
    console.log(`--> POST /api/tools: Recibida petición de ${req.user.username} con body:`, req.body);
    try {
        const db = await readDB();
        const newTool = {
            id: Date.now().toString(),
            ...req.body
            // Considerar añadir createdBy: req.user.username si quieres rastrear quién creó la herramienta
        };
        db.tools.push(newTool);
        await writeDB(db);
        console.log(`<-- POST /api/tools: Herramienta creada por ${req.user.username}:`, newTool.id);
        res.status(201).json(newTool);
    } catch (error) {
        console.error(`<-- POST /api/tools: Error interno:`, error);
        res.status(500).json({ message: 'Error interno al crear herramienta' });
    }
});

// PUT actualizar herramienta
app.put('/api/tools/:id', authenticateToken, async (req, res) => {
    const toolId = req.params.id;
    console.log(`--> PUT /api/tools/${toolId}: Recibida petición de ${req.user.username} con body:`, req.body);
    try {
        const updatedToolData = req.body;
        const db = await readDB();
        const toolIndex = db.tools.findIndex(t => t.id === toolId);

        if (toolIndex === -1) {
            console.log(`<-- PUT /api/tools/${toolId}: Herramienta no encontrada.`);
            return res.status(404).json({ message: 'Herramienta no encontrada' });
        }
        // Opcional: verificar si el usuario tiene permiso para editar (p.ej. si es admin o el creador)
        db.tools[toolIndex] = { ...db.tools[toolIndex], ...updatedToolData, id: toolId };
        await writeDB(db);
        console.log(`<-- PUT /api/tools/${toolId}: Herramienta actualizada por ${req.user.username}.`);
        res.json(db.tools[toolIndex]);
    } catch (error) {
        console.error(`<-- PUT /api/tools/${toolId}: Error interno:`, error);
        res.status(500).json({ message: 'Error interno al actualizar herramienta' });
    }
});

// DELETE herramienta
// Para DELETE, podríamos añadir el middleware isAdmin si solo los admins pueden borrar
// app.delete('/api/tools/:id', authenticateToken, isAdmin, async (req, res) => {
app.delete('/api/tools/:id', authenticateToken, async (req, res) => {
    const toolId = req.params.id;
    console.log(`--> DELETE /api/tools/${toolId}: Recibida petición de ${req.user.username}.`);
    // Si no se usa isAdmin, cualquier usuario autenticado podría borrar.
    // Considera si necesitas una lógica de permisos más granular aquí.
    // Por ejemplo, solo el admin o el creador de la herramienta pueden borrarla.
    // if (req.user.role !== 'admin' && db.tools.find(t => t.id === toolId)?.createdBy !== req.user.username) {
    //     return res.status(403).json({ message: 'No tienes permiso para eliminar esta herramienta.' });
    // }
    try {
        const db = await readDB();
        const initialLength = db.tools.length;
        db.tools = db.tools.filter(t => t.id !== toolId);

        if (db.tools.length === initialLength) {
            console.log(`<-- DELETE /api/tools/${toolId}: Herramienta no encontrada.`);
            return res.status(404).json({ message: 'Herramienta no encontrada' });
        }
        await writeDB(db);
        console.log(`<-- DELETE /api/tools/${toolId}: Herramienta eliminada por ${req.user.username}.`);
        res.status(204).send();
    } catch (error) {
        console.error(`<-- DELETE /api/tools/${toolId}: Error interno:`, error);
        res.status(500).json({ message: 'Error interno al eliminar herramienta' });
    }
});

// Ruta para borrar el historial de préstamos de una herramienta
app.post('/api/tools/:id/clear-loan-history', authenticateToken, async (req, res) => {
    const toolId = req.params.id;
    console.log(`--> POST /api/tools/${toolId}/clear-loan-history: Recibida petición de ${req.user.username}`);

    try {
        const db = await readDB();
        const toolIndex = db.tools.findIndex(t => t.id === toolId);

        if (toolIndex === -1) {
            console.log(`<-- POST /api/tools/${toolId}/clear-loan-history: Herramienta no encontrada.`);
            return res.status(404).json({ message: 'Herramienta no encontrada' });
        }

        // Borrar el historial de préstamos
        db.tools[toolIndex].loanHistory = [];
        
        // Actualizar el estado de las unidades
        if (db.tools[toolIndex].units) {
            db.tools[toolIndex].units.forEach(unit => {
                unit.assignedTo = '';
                unit.loanDate = '';
                unit.returnDate = '';
            });
        }

        await writeDB(db);
        console.log(`<-- POST /api/tools/${toolId}/clear-loan-history: Historial borrado por ${req.user.username}.`);
        res.status(200).json({ message: 'Historial de préstamos borrado exitosamente' });
    } catch (error) {
        console.error(`<-- POST /api/tools/${toolId}/clear-loan-history: Error interno:`, error);
        res.status(500).json({ message: 'Error interno al borrar el historial' });
    }
});

// Ruta de prueba (la mantenemos para verificar conectividad básica, no necesita autenticación)
app.get('/api/test', (req, res) => {
    console.log("--> GET /api/test: ¡La ruta de prueba funciona!");
    res.json({ message: 'Backend test route OK!' });
});

// Ruta Catch-all para servir index.html del frontend
// Importante: Debe ir DESPUÉS de todas las rutas API.
app.get('*', (req, res) => {
    // Evitar que esta ruta capture peticiones a /api/* si no se encontraron antes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'Ruta API no encontrada.'});
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT} o en la URL de Render.`);
    console.log(`JWT_SECRET está ${process.env.JWT_SECRET ? 'CONFIGURADO (usando variable de entorno)' : 'NO CONFIGURADO (usando valor por defecto - ¡NO PARA PRODUCCIÓN!)'}`);
}); 