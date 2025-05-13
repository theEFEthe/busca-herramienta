document.addEventListener('DOMContentLoaded', () => {
    // --- Constantes --- 
    const API_BASE_URL = 'http://localhost:3000/api'; // URL de nuestro backend
    const TOKEN_STORAGE_KEY = 'tooltracker_token';
    const ROLE_STORAGE_KEY = 'tooltracker_role';

    // --- Elementos del DOM --- 
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const usernameInput = document.getElementById('username'); // Asumiendo que añadimos un input de username
    const passwordInput = document.getElementById('password');
    const mainContent = document.querySelector('main');
    const footerContent = document.querySelector('footer');
    const logoutButton = document.getElementById('logout-button');
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

    // --- Estado de la Aplicación ---
    let tools = []; // Almacenará las herramientas cargadas desde la API
    let currentToken = localStorage.getItem(TOKEN_STORAGE_KEY) || null;
    let currentUserRole = localStorage.getItem(ROLE_STORAGE_KEY) || null;

    // --- Funciones Auxiliares de API --- 
    async function apiRequest(endpoint, method = 'GET', body = null, requiresAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (requiresAuth && currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }

        const config = {
            method,
            headers
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

            if (response.status === 401 || response.status === 403) {
                // Token inválido o expirado, o no autorizado
                console.warn('Token inválido/expirado o no autorizado. Cerrando sesión.');
                logout();
                return null; // O lanzar un error específico
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Error ${response.status}: ${errorData.message || 'Error desconocido'}`);
            }

            // Si es un DELETE exitoso (204 No Content), no hay cuerpo JSON
            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Error en la petición API:', error);
            alert(`Error en la comunicación con el servidor: ${error.message}`);
            throw error; // Re-lanzar para que el llamador pueda manejarlo si es necesario
        }
    }

    // --- Funciones de Autenticación y UI --- 
    async function login(username, password) {
        loginError.style.display = 'none';
        try {
            const data = await apiRequest('/login', 'POST', { username, password }, false);
            if (data && data.accessToken) {
                currentToken = data.accessToken;
                currentUserRole = data.role;
                localStorage.setItem(TOKEN_STORAGE_KEY, currentToken);
                localStorage.setItem(ROLE_STORAGE_KEY, currentUserRole);
                updateUIForRole(currentUserRole);
                passwordInput.value = '';
                if(usernameInput) usernameInput.value = '';
                loadTools(); // Cargar herramientas después del login
            } else {
                // El error ya se manejó en apiRequest o la respuesta fue inesperada
                 loginError.textContent = data?.message || 'Error inesperado durante el login.';
                 loginError.style.display = 'block';
            }
        } catch (error) {
             loginError.textContent = error.message;
             loginError.style.display = 'block';
        }
    }

    function logout() {
        currentToken = null;
        currentUserRole = null;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(ROLE_STORAGE_KEY);
        tools = []; // Limpiar herramientas en memoria
        updateUIForRole(null);
    }

    function updateUIForRole(role) {
        if (role) {
            loginModal.style.display = 'none';
            mainContent.style.display = 'block';
            footerContent.style.display = 'block';
            logoutButton.style.display = 'block';

            if (role === 'admin') {
                addToolSection.style.display = 'block';
            } else {
                addToolSection.style.display = 'none';
            }
             // renderTools y populate se llaman después de cargar los datos
        } else {
            loginModal.style.display = 'flex';
            mainContent.style.display = 'none';
            footerContent.style.display = 'none';
            logoutButton.style.display = 'none';
            addToolSection.style.display = 'none';
            toolListContainer.innerHTML = '<p>Por favor, inicia sesión.</p>'; // Mensaje en login
        }
    }

    // --- Funciones CRUD para Herramientas --- 
    async function loadTools() {
        if (!currentToken) return; // No cargar si no hay token
        try {
            toolListContainer.innerHTML = '<p>Cargando herramientas...</p>';
            const fetchedTools = await apiRequest('/tools', 'GET');
            if (fetchedTools) {
                 tools = fetchedTools;
                 renderTools();
                 populateFilterDropdowns();
            } else {
                // Manejar el caso donde la petición falló pero no lanzó error (ej: 401/403)
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
                // Opcional: podríamos añadir newTool a `tools` localmente y re-renderizar,
                // o simplemente recargar todo para asegurar consistencia.
                loadTools(); // Recargar para mostrar la nueva herramienta
                addToolForm.reset();
            }
        } catch (error) {
            // El error ya se mostró en apiRequest
        }
    }

    async function updateTool(toolId, toolData) {
        try {
            const updatedTool = await apiRequest(`/tools/${toolId}`, 'PUT', toolData);
            if(updatedTool) {
                loadTools(); // Recargar para mostrar los cambios
                closeEditModal();
            }
        } catch (error) {
             // El error ya se mostró en apiRequest
        }
    }

    async function deleteToolApi(toolId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta herramienta?')) {
            try {
                await apiRequest(`/tools/${toolId}`, 'DELETE');
                loadTools(); // Recargar la lista después de eliminar
            } catch (error) {
                // El error ya se mostró en apiRequest
            }
        }
    }

    // --- Renderizado y Filtros --- 

    function renderTools(filteredTools = tools) {
        toolListContainer.innerHTML = '';
        const isAdmin = currentUserRole === 'admin';

        const toolsToRender = filteredTools; // Usamos el array filtrado que se pasa

        if (toolsToRender.length === 0) {
            if (!currentToken) {
                 toolListContainer.innerHTML = '<p>Por favor, inicia sesión.</p>';
            } else if (tools.length === 0) {
                toolListContainer.innerHTML = '<p>No hay herramientas en el catálogo. ¡Añade la primera!</p>';
            } else {
                toolListContainer.innerHTML = '<p>No hay herramientas que coincidan con los filtros.</p>';
            }
            return;
        }

        toolsToRender.forEach(tool => {
            const toolCard = document.createElement('div');
            toolCard.classList.add('tool-card');
            // Añadir data-id para fácil acceso si es necesario
            toolCard.dataset.id = tool.id;
            toolCard.innerHTML = `
                <h3>${tool.name}</h3>
                ${tool.image ? `<img src="${tool.image}" alt="${tool.name}">` : ''}
                <p><strong>Descripción:</strong> ${tool.description || 'N/A'}</p>
                <p><strong>Categoría:</strong> ${tool.category || 'N/A'}</p>
                <p><strong>Fecha Adquisición:</strong> ${tool.acquisitionDate || 'N/A'}</p>
                <p><strong>Ubicación:</strong> ${tool.location || 'N/A'}</p>
                ${isAdmin ? `<button class="edit-btn">Editar</button>` : ''}
                ${isAdmin ? `<button class="delete-btn">Eliminar</button>` : ''}
            `;
            // Añadir event listeners directamente aquí es más eficiente que onclick global
            if (isAdmin) {
                toolCard.querySelector('.edit-btn').addEventListener('click', () => openEditModal(tool.id));
                toolCard.querySelector('.delete-btn').addEventListener('click', () => deleteToolApi(tool.id));
            }
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

        // Guardar selección actual si existe
        const currentCategory = searchCategorySelect.value;
        const currentLocation = searchLocationSelect.value;

        searchCategorySelect.innerHTML = '<option value="">-- Todas las Categorías --</option>';
        searchLocationSelect.innerHTML = '<option value="">-- Todas las Ubicaciones --</option>';

        Array.from(categories).sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            searchCategorySelect.appendChild(option);
        });

        Array.from(locations).sort().forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            searchLocationSelect.appendChild(option);
        });

        // Restaurar selección
        searchCategorySelect.value = currentCategory;
        searchLocationSelect.value = currentLocation;
    }

    function filterTools() {
        if (!currentToken) return;

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

    // --- Handlers de Eventos --- 

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        // Necesitamos un input para username en el HTML
        const username = usernameInput ? usernameInput.value : 'admin'; // Temporal si no existe input
        const password = passwordInput.value;
        if (!username || !password) {
             loginError.textContent = 'Usuario y contraseña son requeridos.';
             loginError.style.display = 'block';
             return;
        }
        login(username, password);
    });

    logoutButton.addEventListener('click', logout);

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

    // Listeners para filtros
    searchNameInput.addEventListener('input', filterTools);
    searchCategorySelect.addEventListener('change', filterTools);
    searchLocationSelect.addEventListener('change', filterTools);

    // Funciones del Modal de Edición (globales o llamadas desde listeners)
    function openEditModal(toolId) {
        // No necesitamos verificar rol aquí, el botón solo existe si es admin
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

    window.closeEditModal = function() { // Dejarla global si se llama desde HTML
        editToolModal.style.display = 'none';
    }

    // --- Inicialización --- 
    function initializeApp() {
        if (currentToken) {
            // Si hay token, intentamos cargar las herramientas
            // La función apiRequest maneja el caso de token inválido/expirado
            updateUIForRole(currentUserRole);
            loadTools();
        } else {
            // Si no hay token, mostramos el login
            updateUIForRole(null);
        }
    }

    initializeApp();

}); 