document.addEventListener('DOMContentLoaded', () => {
    // --- Constantes y Configuración --- 
    const API_BASE_URL = '/api'; // Ruta relativa para el backend

    // --- Elementos del DOM --- 
    // Login
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username'); // Asegúrate que existe en index.html
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const logoutButton = document.getElementById('logout-button');
    const loggedInUserInfo = document.getElementById('logged-in-user-info');

    // Contenido Principal
    const mainContent = document.querySelector('main');
    const addToolSection = document.getElementById('add-tool-section');
    const toolListContainer = document.getElementById('tool-list-container');
    const addToolForm = document.getElementById('add-tool-form');
    
    // Filtros
    const searchNameInput = document.getElementById('search-name');
    const searchCategorySelect = document.getElementById('search-category');
    const searchLocationSelect = document.getElementById('search-location');
    
    // Modal de Edición
    const editToolModal = document.getElementById('edit-tool-modal');
    const editToolForm = document.getElementById('edit-tool-form');
    const editToolIdInput = document.getElementById('edit-tool-id');
    const editToolNameInput = document.getElementById('edit-tool-name');
    const editToolDescriptionInput = document.getElementById('edit-tool-description');
    const editToolCategoryInput = document.getElementById('edit-tool-category');
    const editToolAcquisitionDateInput = document.getElementById('edit-tool-acquisition-date');
    const editToolLocationInput = document.getElementById('edit-tool-location');
    const editToolImageInput = document.getElementById('edit-tool-image');
    const editToolQuantityInput = document.getElementById('edit-tool-quantity');

    // --- Estado de la Aplicación ---
    let tools = [];
    let currentUser = null; // { username: '...', role: '...', token: '...' }

    // --- Funciones de Autenticación y UI --- 
    function updateUIForRole() {
        if (currentUser && currentUser.token) {
            loginModal.style.display = 'none';
            mainContent.style.display = 'block'; // O la sección principal que quieras mostrar
            if (logoutButton) logoutButton.style.display = 'block';
            if (loggedInUserInfo) loggedInUserInfo.textContent = `Usuario: ${currentUser.username} (Rol: ${currentUser.role})`;
            
            // Mostrar/ocultar elementos según el rol
            if (currentUser.role === 'admin') {
                if (addToolSection) addToolSection.style.display = 'block'; 
                // Los botones de editar/eliminar se controlan en renderTools o directamente por el backend
            } else { // Rol 'user' u otros
                if (addToolSection) addToolSection.style.display = 'none'; 
            }
            loadTools(); // Cargar herramientas después de un login exitoso
        } else {
            loginModal.style.display = 'flex';
            mainContent.style.display = 'none';
            if (logoutButton) logoutButton.style.display = 'none';
            if (loggedInUserInfo) loggedInUserInfo.textContent = '';
            toolListContainer.innerHTML = '<p>Por favor, inicia sesión para ver las herramientas.</p>';
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        if (loginError) loginError.textContent = '';
        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Error ${response.status}`);
            }
            
            currentUser = { username: data.username, role: data.role, token: data.token };
            localStorage.setItem('toolTrackerToken', data.token);
            localStorage.setItem('toolTrackerUserRole', data.role);
            localStorage.setItem('toolTrackerUsername', data.username);
            updateUIForRole();

        } catch (error) {
            console.error('Error de login:', error);
            if (loginError) loginError.textContent = error.message || 'Fallo al iniciar sesión. Verifica tus credenciales.';
            currentUser = null;
            localStorage.removeItem('toolTrackerToken');
            localStorage.removeItem('toolTrackerUserRole');
            localStorage.removeItem('toolTrackerUsername');
            updateUIForRole();
        }
    }

    function logout() {
        currentUser = null;
        localStorage.removeItem('toolTrackerToken');
        localStorage.removeItem('toolTrackerUserRole');
        localStorage.removeItem('toolTrackerUsername');
        if (loginForm) loginForm.reset();
        if (loginError) loginError.textContent = '';
        updateUIForRole();
        // Opcional: redirigir a una página de logout o simplemente mostrar el login modal
    }

    // --- Funciones Auxiliares de API ---
    async function apiRequest(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (currentUser && currentUser.token) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
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
                logout(); // Forzar logout
                throw new Error(response.status === 401 ? 'No autorizado. Inicia sesión de nuevo.' : 'Acceso prohibido.');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Error ${response.status}: ${errorData.message || 'Error desconocido del servidor'}`);
            }

            if (response.status === 204) { // No Content
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error('Error en la petición API:', error.message);
            // Evitar mostrar múltiples alerts si el logout ya maneja la UI
            if (! (error.message.includes('No autorizado') || error.message.includes('Acceso prohibido'))) {
                 alert(`Error en la comunicación con el servidor: ${error.message}`);
            }
            throw error; // Relanzar para que la función que llama pueda manejarlo si es necesario
        }
    }

    // --- Funciones CRUD para Herramientas ---
    async function loadTools() {
        if (!currentUser || !currentUser.token) {
            // No intentar cargar si no hay usuario logueado
            updateUIForRole();
            return;
        }
        try {
            toolListContainer.innerHTML = '<p>Cargando herramientas...</p>';
            const fetchedTools = await apiRequest('/tools', 'GET');
            if (fetchedTools) {
                 tools = fetchedTools;
                 renderTools();
                 populateFilterDropdowns();
            } else {
                // Esto podría ocurrir si la respuesta es 204 o un error ya manejado por apiRequest
                tools = [];
                renderTools(); // Renderizar lista vacía o mensaje
                populateFilterDropdowns(); 
            }
        } catch (error) {
            // El error ya es logueado y posiblemente alertado por apiRequest.
            // updateUIForRole podría ser llamado si el error es de autenticación.
            toolListContainer.innerHTML = `<p>Error al cargar herramientas. ${error.message.includes('No autorizado') || error.message.includes('Acceso prohibido') ? 'Por favor, inicia sesión.': 'Intenta de nuevo más tarde.'}</p>`;
        }
    }

    async function addTool(toolData) {
         try {
            const newTool = await apiRequest('/tools', 'POST', toolData);
            if(newTool) {
                loadTools(); // Recarga y renderiza
                if (addToolForm) addToolForm.reset();
            }
        } catch (error) { /* Ya manejado por apiRequest y loadTools si hay error de auth */ }
    }

    async function updateTool(toolId, toolData) {
        try {
            const updatedTool = await apiRequest(`/tools/${toolId}`, 'PUT', toolData);
            if(updatedTool) {
                loadTools(); // Recarga y renderiza
                closeEditModal();
            }
        } catch (error) { /* Ya manejado por apiRequest y loadTools si hay error de auth */ }
    }

    async function deleteToolApi(toolId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta herramienta?')) {
            try {
                await apiRequest(`/tools/${toolId}`, 'DELETE');
                loadTools(); // Recarga y renderiza
            } catch (error) { /* Ya manejado por apiRequest y loadTools si hay error de auth */ }
        }
    }

    // --- Renderizado y Filtros ---
    function renderTools(filteredTools = tools) {
        toolListContainer.innerHTML = '';
        const toolsToRender = filteredTools;

        if (!currentUser || !currentUser.token) {
            toolListContainer.innerHTML = '<p>Debes iniciar sesión para ver las herramientas.</p>';
            return;
        }

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
            
            let buttonsHTML = '';
            // Solo admin puede editar/eliminar según la lógica actual de UI
            // El backend ya protege las rutas, pero esto mejora la UX.
            if (currentUser.role === 'admin') {
                buttonsHTML = `
                    <button class="edit-btn">Editar</button>
                    <button class="delete-btn">Eliminar</button>
                `;
            }

            toolCard.innerHTML = `
                <h3>${tool.name}</h3>
                ${tool.image ? `<img src="${tool.image}" alt="${tool.name}" style="max-width: 100px; height: auto;">` : ''}
                <p><strong>Descripción:</strong> ${tool.description || 'N/A'}</p>
                <p><strong>Categoría:</strong> ${tool.category || 'N/A'}</p>
                <p><strong>Fecha Adquisición:</strong> ${tool.acquisitionDate || 'N/A'}</p>
                <p><strong>Ubicación:</strong> ${tool.location || 'N/A'}</p>
                <p><strong>Cantidad:</strong> ${tool.quantity || '1'}</p>
                <div class="tool-actions">
                    ${buttonsHTML}
                </div>
            `;
            
            if (currentUser.role === 'admin') {
                const editBtn = toolCard.querySelector('.edit-btn');
                const deleteBtn = toolCard.querySelector('.delete-btn');
                if(editBtn) editBtn.addEventListener('click', () => openEditModal(tool.id));
                if(deleteBtn) deleteBtn.addEventListener('click', () => deleteToolApi(tool.id));
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
        
        const currentCategoryValue = searchCategorySelect ? searchCategorySelect.value : '';
        const currentLocationValue = searchLocationSelect ? searchLocationSelect.value : '';

        if (searchCategorySelect) {
            searchCategorySelect.innerHTML = '<option value="">-- Todas las Categorías --</option>';
            Array.from(categories).sort().forEach(category => {
                const option = document.createElement('option');
                option.value = category; option.textContent = category;
                searchCategorySelect.appendChild(option);
            });
            searchCategorySelect.value = currentCategoryValue;
        }

        if (searchLocationSelect) {
            searchLocationSelect.innerHTML = '<option value="">-- Todas las Ubicaciones --</option>';
            Array.from(locations).sort().forEach(location => {
                const option = document.createElement('option');
                option.value = location; option.textContent = location;
                searchLocationSelect.appendChild(option);
            });
            searchLocationSelect.value = currentLocationValue;
        }
    }

    function filterTools() {
        if (!currentUser || !currentUser.token) return; // No filtrar si no está logueado

        const nameFilter = searchNameInput ? searchNameInput.value.toLowerCase() : '';
        const categoryFilter = searchCategorySelect ? searchCategorySelect.value : '';
        const locationFilter = searchLocationSelect ? searchLocationSelect.value : '';

        const filtered = tools.filter(tool => {
            const toolName = (tool.name || '').toLowerCase();
            const categoryMatch = categoryFilter === "" || (tool.category && tool.category === categoryFilter);
            const locationMatch = locationFilter === "" || (tool.location && tool.location === locationFilter);
            return toolName.includes(nameFilter) && categoryMatch && locationMatch;
        });
        renderTools(filtered);
    }

    // --- Handlers de Eventos ---
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    if (addToolForm) {
        addToolForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!currentUser || currentUser.role !== 'admin') {
                alert('Solo administradores pueden añadir herramientas.');
                return;
            }
            const toolData = {
                name: document.getElementById('tool-name').value,
                description: document.getElementById('tool-description').value,
                category: document.getElementById('tool-category').value.trim(),
                acquisitionDate: document.getElementById('tool-acquisition-date').value,
                location: document.getElementById('tool-location').value.trim(),
                quantity: parseInt(document.getElementById('tool-quantity').value) || 1,
                image: document.getElementById('tool-image').value.trim() // trim para evitar URLs con espacios
            };
            addTool(toolData);
        });
    }

    if (editToolForm) {
        editToolForm.addEventListener('submit', (event) => {
            event.preventDefault();
            // La protección de rol ya estaría en openEditModal y en el backend
            const toolId = editToolIdInput.value;
            const toolData = {
                name: editToolNameInput.value,
                description: editToolDescriptionInput.value,
                category: editToolCategoryInput.value.trim(),
                acquisitionDate: editToolAcquisitionDateInput.value,
                location: editToolLocationInput.value.trim(),
                quantity: parseInt(editToolQuantityInput.value) || 1,
                image: editToolImageInput.value.trim()
            };
            updateTool(toolId, toolData);
        });
    }
    
    if (searchNameInput) searchNameInput.addEventListener('input', filterTools);
    if (searchCategorySelect) searchCategorySelect.addEventListener('change', filterTools);
    if (searchLocationSelect) searchLocationSelect.addEventListener('change', filterTools);

    // Funciones del Modal de Edición
    function openEditModal(toolId) {
        if (currentUser && currentUser.role !== 'admin') {
            alert('Solo administradores pueden editar herramientas.');
            return;
        }
        const toolToEdit = tools.find(tool => tool.id === toolId);
        if (!toolToEdit) return;
        
        editToolIdInput.value = toolToEdit.id;
        editToolNameInput.value = toolToEdit.name;
        editToolDescriptionInput.value = toolToEdit.description || '';
        editToolCategoryInput.value = toolToEdit.category || '';
        editToolAcquisitionDateInput.value = toolToEdit.acquisitionDate || '';
        editToolLocationInput.value = toolToEdit.location || '';
        editToolQuantityInput.value = toolToEdit.quantity || 1;
        editToolImageInput.value = toolToEdit.image || '';
        if (editToolModal) editToolModal.style.display = 'flex';
    }

    window.closeEditModal = function() { // Hacerla global para el botón en HTML
        if (editToolModal) editToolModal.style.display = 'none';
    }

    // --- Inicialización --- 
    function initializeApp() {
        const token = localStorage.getItem('toolTrackerToken');
        const role = localStorage.getItem('toolTrackerUserRole');
        const username = localStorage.getItem('toolTrackerUsername');

        if (token && role && username) {
            currentUser = { token, role, username };
        } else {
            currentUser = null;
        }
        updateUIForRole(); // Esto decidirá si muestra login o carga herramientas
    }

    initializeApp();
}); 