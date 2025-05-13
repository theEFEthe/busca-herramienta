const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// Middleware para loguear TODAS las peticiones entrantes
app.use((req, res, next) => {
    console.log(`--> Petición Recibida: ${req.method} ${req.path}`);
    next();
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

// --- Rutas para Herramientas (Ahora Públicas) ---

// GET todas las herramientas
app.get('/api/tools', async (req, res) => {
    console.log(`--> GET /api/tools: Petición recibida`);
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
app.post('/api/tools', async (req, res) => {
    console.log(`--> POST /api/tools: Recibida petición con body:`, req.body);
    try {
        const db = await readDB();
        const newTool = {
            id: Date.now().toString(),
            ...req.body
        };
        db.tools.push(newTool);
        await writeDB(db);
        console.log(`<-- POST /api/tools: Herramienta creada:`, newTool.id);
        res.status(201).json(newTool);
    } catch (error) {
        console.error(`<-- POST /api/tools: Error interno:`, error);
        res.status(500).json({ message: 'Error interno al crear herramienta' });
    }
});

// PUT actualizar herramienta
app.put('/api/tools/:id', async (req, res) => {
    const toolId = req.params.id;
    console.log(`--> PUT /api/tools/${toolId}: Recibida petición con body:`, req.body);
    try {
        const updatedToolData = req.body;
        const db = await readDB();
        const toolIndex = db.tools.findIndex(t => t.id === toolId);

        if (toolIndex === -1) {
            console.log(`<-- PUT /api/tools/${toolId}: Herramienta no encontrada.`);
            return res.status(404).json({ message: 'Herramienta no encontrada' });
        }
        db.tools[toolIndex] = { ...db.tools[toolIndex], ...updatedToolData, id: toolId };
        await writeDB(db);
        console.log(`<-- PUT /api/tools/${toolId}: Herramienta actualizada.`);
        res.json(db.tools[toolIndex]);
    } catch (error) {
        console.error(`<-- PUT /api/tools/${toolId}: Error interno:`, error);
        res.status(500).json({ message: 'Error interno al actualizar herramienta' });
    }
});

// DELETE herramienta
app.delete('/api/tools/:id', async (req, res) => {
    const toolId = req.params.id;
    console.log(`--> DELETE /api/tools/${toolId}: Recibida petición.`);
    try {
        const db = await readDB();
        const initialLength = db.tools.length;
        db.tools = db.tools.filter(t => t.id !== toolId);

        if (db.tools.length === initialLength) {
            console.log(`<-- DELETE /api/tools/${toolId}: Herramienta no encontrada.`);
            return res.status(404).json({ message: 'Herramienta no encontrada' });
        }
        await writeDB(db);
        console.log(`<-- DELETE /api/tools/${toolId}: Herramienta eliminada.`);
        res.status(204).send();
    } catch (error) {
        console.error(`<-- DELETE /api/tools/${toolId}: Error interno:`, error);
        res.status(500).json({ message: 'Error interno al eliminar herramienta' });
    }
});

// Ruta de prueba (la mantenemos para verificar conectividad básica)
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
}); 