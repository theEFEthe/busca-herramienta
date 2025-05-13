document.addEventListener('DOMContentLoaded', () => {
    // --- Constantes --- 
    const API_BASE_URL = '/api'; // Se mantiene ruta relativa

    // --- Elementos del DOM (se eliminan los relacionados con login) --- 
    const mainContent = document.querySelector('main'); // Aún útil si quisiéramos ocultar/mostrar todo
    const footerContent = document.querySelector('footer');
    const addToolSection = document.getElementById('add-tool-section');
    const toolListContainer = document.getElementById('tool-list-container');
    const addToolForm = document.getElementById('add-tool-form');
    const searchNameInput = document.getElementById('search-name');
    const searchCategorySelect = document.getElementById('search-category');
    const searchLocationSelect = document.getElementById('search-location');
    const editToolModal = document.getElementById('edit-tool-modal');
    const editToolForm = document.getElementById('edit-tool-form');
    const editToolIdInput = document.getElementById('edit-tool-id');
    const editToolNameInput = document.getElementById('edit-tool-name');
    const editToolDescriptionInput = document.getElementById('edit-tool-description');
    const editToolCategoryInput = document.getElementById('edit-tool-category');
    const editToolAcquisitionDateInput = document.getElementById('edit-tool-acquisition-date');
    const editToolLocationInput = document.getElementById('edit-tool-location');
    const editToolImageInput = document.getElementById('edit-tool-image');

    // --- Estado de la Aplicación (simplificado) ---
    let tools = [];

    // --- Funciones Auxiliares de API (simplificada) --- 
    async function apiRequest(endpoint, method = 'GET', body = null) { // Eliminamos requiresAuth
        const headers = {
            'Content-Type': 'application/json'
        };

        const config = {
            method,
            headers
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Error ${response.status}: ${errorData.message || 'Error desconocido'}`);
            }

            if (response.status === 204) {
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error('Error en la petición API:', error);
            alert(`Error en la comunicación con el servidor: ${error.message}`);
            throw error;
        }
    }

    // --- Funciones CRUD para Herramientas (sin cambios, ya eran genéricas) --- 
    async function loadTools() {
        try {
            toolListContainer.innerHTML = '<p>Cargando herramientas...</p>';
            const fetchedTools = await apiRequest('/tools', 'GET');
            if (fetchedTools) {
                 tools = fetchedTools;
                 renderTools();
                 populateFilterDropdowns();
            } else {
                toolListContainer.innerHTML = '<p>No se pudieron cargar las herramientas.</p>';
            }
        } catch (error) {
            toolListContainer.innerHTML = `<p>Error al cargar herramientas: ${error.message}</p>`;
        }
    }

    async function addTool(toolData) {
         try {
            const newTool = await apiRequest('/tools', 'POST', toolData);
            if(newTool) {
                loadTools();
                addToolForm.reset();
            }
        } catch (error) { /* Manejado en apiRequest */ }
    }

    async function updateTool(toolId, toolData) {
        try {
            const updatedTool = await apiRequest(`/tools/${toolId}`, 'PUT', toolData);
            if(updatedTool) {
                loadTools();
                closeEditModal();
            }
        } catch (error) { /* Manejado en apiRequest */ }
    }

    async function deleteToolApi(toolId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta herramienta?')) {
            try {
                await apiRequest(`/tools/${toolId}`, 'DELETE');
                loadTools();
            } catch (error) { /* Manejado en apiRequest */ }
        }
    }

    // --- Renderizado y Filtros (ajustar para siempre mostrar botones de admin) --- 

    function renderTools(filteredTools = tools) {
        toolListContainer.innerHTML = '';

        const toolsToRender = filteredTools;

        if (toolsToRender.length === 0) {
            if (tools.length === 0) {
                toolListContainer.innerHTML = '<p>No hay herramientas en el catálogo. ¡Añade la primera!</p>';
            } else {
                toolListContainer.innerHTML = '<p>No hay herramientas que coincidan con los filtros.</p>';
            }
            return;
        }

        toolsToRender.forEach(tool => {
            const toolCard = document.createElement('div');
            toolCard.classList.add('tool-card');
            toolCard.dataset.id = tool.id;
            toolCard.innerHTML = `
                <h3>${tool.name}</h3>
                ${tool.image ? `<img src="${tool.image}" alt="${tool.name}">` : ''}
                <p><strong>Descripción:</strong> ${tool.description || 'N/A'}</p>
                <p><strong>Categoría:</strong> ${tool.category || 'N/A'}</p>
                <p><strong>Fecha Adquisición:</strong> ${tool.acquisitionDate || 'N/A'}</p>
                <p><strong>Ubicación:</strong> ${tool.location || 'N/A'}</p>
                <button class="edit-btn">Editar</button>
                <button class="delete-btn">Eliminar</button>
            `;
            toolCard.querySelector('.edit-btn').addEventListener('click', () => openEditModal(tool.id));
            toolCard.querySelector('.delete-btn').addEventListener('click', () => deleteToolApi(tool.id));
            toolListContainer.appendChild(toolCard);
        });
    }

    function populateFilterDropdowns() {
        const categories = new Set();
        const locations = new Set();
        tools.forEach(tool => {
            if (tool.category) categories.add(tool.category.trim());
            if (tool.location) locations.add(tool.location.trim());
        });
        const currentCategory = searchCategorySelect.value;
        const currentLocation = searchLocationSelect.value;
        searchCategorySelect.innerHTML = '<option value="">-- Todas las Categorías --</option>';
        searchLocationSelect.innerHTML = '<option value="">-- Todas las Ubicaciones --</option>';
        Array.from(categories).sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category; option.textContent = category;
            searchCategorySelect.appendChild(option);
        });
        Array.from(locations).sort().forEach(location => {
            const option = document.createElement('option');
            option.value = location; option.textContent = location;
            searchLocationSelect.appendChild(option);
        });
        searchCategorySelect.value = currentCategory;
        searchLocationSelect.value = currentLocation;
    }

    function filterTools() {
        const nameFilter = searchNameInput.value.toLowerCase();
        const categoryFilter = searchCategorySelect.value;
        const locationFilter = searchLocationSelect.value;

        const filtered = tools.filter(tool => {
            const toolName = (tool.name || '').toLowerCase();
            const categoryMatch = categoryFilter === "" || (tool.category && tool.category === categoryFilter);
            const locationMatch = locationFilter === "" || (tool.location && tool.location === locationFilter);
            return toolName.includes(nameFilter) && categoryMatch && locationMatch;
        });
        renderTools(filtered);
    }

    // --- Handlers de Eventos (se elimina el de loginForm y logoutButton) --- 
    addToolForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const toolData = {
            name: document.getElementById('tool-name').value,
            description: document.getElementById('tool-description').value,
            category: document.getElementById('tool-category').value,
            acquisitionDate: document.getElementById('tool-acquisition-date').value,
            location: document.getElementById('tool-location').value,
            image: document.getElementById('tool-image').value
        };
        addTool(toolData);
    });

    editToolForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const toolId = editToolIdInput.value;
        const toolData = {
            name: editToolNameInput.value,
            description: editToolDescriptionInput.value,
            category: editToolCategoryInput.value.trim(),
            acquisitionDate: editToolAcquisitionDateInput.value,
            location: editToolLocationInput.value.trim(),
            image: editToolImageInput.value
        };
        updateTool(toolId, toolData);
    });

    searchNameInput.addEventListener('input', filterTools);
    searchCategorySelect.addEventListener('change', filterTools);
    searchLocationSelect.addEventListener('change', filterTools);

    // Funciones del Modal de Edición (sin cambios, openEditModal ahora siempre es accesible)
    function openEditModal(toolId) {
        const toolToEdit = tools.find(tool => tool.id === toolId);
        if (!toolToEdit) return;
        editToolIdInput.value = toolToEdit.id;
        editToolNameInput.value = toolToEdit.name;
        editToolDescriptionInput.value = toolToEdit.description || '';
        editToolCategoryInput.value = toolToEdit.category || '';
        editToolAcquisitionDateInput.value = toolToEdit.acquisitionDate || '';
        editToolLocationInput.value = toolToEdit.location || '';
        editToolImageInput.value = toolToEdit.image || '';
        editToolModal.style.display = 'flex';
    }

    window.closeEditModal = function() {
        editToolModal.style.display = 'none';
    }

    // --- Inicialización (simplificada) --- 
    function initializeApp() {
        // Ya no hay login, simplemente cargamos las herramientas
        loadTools();
    }

    initializeApp();
}); 