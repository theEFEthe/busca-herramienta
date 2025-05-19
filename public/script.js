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
    
    // Pestañas
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const addTabButton = document.getElementById('add-tab-button');
    const maintenanceTabButton = document.getElementById('maintenance-tab-button'); // Asegurar que esta línea exista
    
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
    const editToolQuantityStockInput = document.getElementById('edit-tool-quantity-stock');
    const editToolQuantityBorrowedInput = document.getElementById('edit-tool-quantity-borrowed');
    const editToolImageInput = document.getElementById('edit-tool-image');

    // Botón para borrar historial de préstamos (admin)
    const clearLoanHistoryButton = document.getElementById('clear-loan-history-btn');

    // --- Estado de la Aplicación ---
    let tools = []; // Mantener
    let currentUser = null; // Mantener
    let loanHistory = {}; // Mantener

    // Hacer que las variables sean accesibles globalmente
    window.appCurrentUser = null; // Mantener

    // --- Funciones auxiliares ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    
    // Hacer que generateId sea accesible globalmente
    window.generateId = function() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    };
    
    // Función para generar un número de serie basado en ID y número de unidad
    function generateSerial(toolId, unitNumber) {
        // Si la herramienta tiene un serial personalizado, usarlo
        const tool = tools.find(t => t.id === toolId);
        if (tool && tool.customSerial) {
            return tool.customSerial;
        }
        
        // Si no, generar uno automáticamente
        const idPart = toolId.substring(0, 6);
        const unitPart = unitNumber.toString().padStart(3, '0');
        return `${idPart}-${unitPart}`;
    }

    // Función para cargar el historial de préstamos desde localStorage
    function loadLoanHistory() {
        const storedHistory = localStorage.getItem('toolTrackerLoanHistory');
        if (storedHistory) {
            loanHistory = JSON.parse(storedHistory);
        } else {
            loanHistory = {};
            localStorage.setItem('toolTrackerLoanHistory', JSON.stringify(loanHistory));
        }
    }

    // Función para guardar el historial de préstamos en localStorage
    function saveLoanHistory() {
        localStorage.setItem('toolTrackerLoanHistory', JSON.stringify(loanHistory));
    }

    // Función para registrar un préstamo o devolución en el historial
    function registerLoanEvent(toolId, unitNumber, action, person) {
        const key = `${toolId}_${unitNumber}`;
        if (!loanHistory[key]) {
            loanHistory[key] = [];
        }
        
        loanHistory[key].push({
            date: new Date().toISOString(),
            action: action, // 'loan' o 'return'
            person: person || 'Desconocido'
        });
        
        saveLoanHistory();
    }
    
    // Hacer que la función sea accesible globalmente
    window.registerLoanEvent = function(toolId, unitNumber, action, person) {
        const key = `${toolId}_${unitNumber}`;
        
        // Asegurar que loanHistory esté inicializado
        if (!window.loanHistory) {
            window.loanHistory = {};
        }
        
        if (!window.loanHistory[key]) {
            window.loanHistory[key] = [];
        }
        
        window.loanHistory[key].push({
            date: new Date().toISOString(),
            action: action, // 'loan' o 'return'
            person: person || 'Desconocido'
        });
        
        // Guardar en localStorage
        localStorage.setItem('toolTrackerLoanHistory', JSON.stringify(window.loanHistory));
    };
    
    // Funciones globales para los modals
    // window.closeAddPersonModal = function() { ... }; // COMENTAR/ELIMINAR
    // window.closeAssignToolModal = function() { ... }; // COMENTAR/ELIMINAR

    // --- Funciones para manejar las pestañas ---
    function activateTab(tabId) {
        tabButtons.forEach(button => button.classList.remove('active'));
        
        document.getElementById('tool-catalog-section').style.display = 'none';
        document.getElementById('add-tool-section').style.display = 'none';
        // document.getElementById('assigned-people-section').style.display = 'none'; // ELIMINADO
        document.getElementById('maintenance-section').style.display = 'none'; 
        
        const selectedButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (selectedButton) selectedButton.classList.add('active');
        
        if (tabId === 'catalog') {
            document.getElementById('tool-catalog-section').style.display = 'block';
        } else if (tabId === 'add' && currentUser && currentUser.role === 'admin') {
            document.getElementById('add-tool-section').style.display = 'block';
        } /* else if (tabId === 'assigned' && currentUser && currentUser.role === 'admin') { // COMENTAR/ELIMINAR ESTE BLOQUE
            document.getElementById('assigned-people-section').style.display = 'block';
            // loadPeople(); 
            // renderAssignedPeople();
        } */ else if (tabId === 'maintenance' && currentUser && currentUser.role === 'admin') {
            // ... (código de mantenimiento se mantiene)
        } else {
            // ... (default se mantiene)
        }
    }

    // --- Funciones de Autenticación y UI --- 
    function updateUIForRole() {
        if (currentUser && currentUser.token) {
            if (loginModal) loginModal.style.display = 'none';
            if (mainContent) mainContent.style.display = 'block'; // O la sección principal que quieras mostrar
            if (logoutButton) logoutButton.style.display = 'block';
            if (loggedInUserInfo) loggedInUserInfo.textContent = `Usuario: ${currentUser.username} (Rol: ${currentUser.role})`;
            
            // Actualizar la referencia global
            window.appCurrentUser = currentUser;
            
            // Mostrar/ocultar botones de pestaña según el rol
            // const assignedTabButton = document.querySelector(`.tab-button[data-tab="assigned"]`); // COMENTAR/ELIMINAR
            
            if (currentUser.role === 'admin') {
                if (addTabButton) addTabButton.style.display = 'block';
                // if (assignedTabButton) assignedTabButton.style.display = 'block'; // COMENTAR/ELIMINAR
                if (maintenanceTabButton) maintenanceTabButton.style.display = 'block';
            } else { // Rol 'user' u otros
                if (addTabButton) addTabButton.style.display = 'none';
                // if (assignedTabButton) assignedTabButton.style.display = 'none'; // COMENTAR/ELIMINAR
                if (maintenanceTabButton) maintenanceTabButton.style.display = 'none';
            }
            
            // Activar la pestaña del catálogo por defecto
            activateTab('catalog');
            
            loadTools(); // Cargar herramientas después de un login exitoso
        } else {
            // Asegurar que el modal de login esté visible y sus campos sean interactivos
            if (loginModal) {
                loginModal.style.display = 'flex';
                setTimeout(() => {
                    if (usernameInput) {
                        usernameInput.focus();
                        usernameInput.readOnly = false;
                    }
                    if (passwordInput) {
                        passwordInput.readOnly = false;
                    }
                }, 100);
            }
            
            if (mainContent) mainContent.style.display = 'none';
            if (logoutButton) logoutButton.style.display = 'none';
            if (loggedInUserInfo) loggedInUserInfo.textContent = '';
            if (toolListContainer) toolListContainer.innerHTML = '<p>Por favor, inicia sesión para ver las herramientas.</p>';
            
            // Limpiar la referencia global
            window.appCurrentUser = null;
        }
    }

    async function handleLogin(event) {
        if (event) event.preventDefault();
        
        if (loginError) loginError.textContent = '';
        
        // Asegurar que los inputs no sean nulos y sean accesibles
        if (!usernameInput || !passwordInput) {
            console.error("Campos de login no encontrados");
            return;
        }
        
        const username = usernameInput.value;
        const password = passwordInput.value;
        
        if (!username || !password) {
            if (loginError) loginError.textContent = 'Por favor, complete ambos campos';
            return;
        }

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
        window.appCurrentUser = null; // Limpiar la referencia global
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
    
    // Hacer que apiRequest sea accesible globalmente
    window.apiRequest = async function(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Usar la referencia global a currentUser
        if (window.appCurrentUser && window.appCurrentUser.token) {
            headers['Authorization'] = `Bearer ${window.appCurrentUser.token}`;
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
                console.warn('Token inválido/expirado o no autorizado.');
                // No llamamos a logout aquí para evitar problemas con el ámbito
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
            console.error('Error en la petición API global:', error.message);
            // No mostramos alert aquí para evitar múltiples alertas
            throw error;
        }
    };

    // --- Funciones CRUD para Herramientas ---
    async function loadTools() {
        if (!currentUser || !currentUser.token) {
            // No intentar cargar si no hay usuario logueado
            updateUIForRole();
            return;
        }
        try {
            toolListContainer.innerHTML = '<p>Cargando herramientas...</p>';
             
            // Intentar cargar desde localStorage primero
            const storedTools = localStorage.getItem('toolTrackerTools');
            
            if (storedTools) {
                tools = JSON.parse(storedTools);
                renderTools();
                populateFilterDropdowns();
            }
            
            // Luego intentar cargar desde el API
            const fetchedTools = await apiRequest('/tools', 'GET');
            if (fetchedTools) {
                // Si no había herramientas guardadas localmente, usar las del API
                if (!storedTools) {
                    tools = fetchedTools;
                }
                // Si ya habían herramientas locales, comparar y decidir
                else {
                    // Eliminar el diálogo de confirmación y usar una estrategia de fusión inteligente
                    mergeFetchedWithLocalTools(fetchedTools);
                }
                localStorage.setItem('toolTrackerTools', JSON.stringify(tools));
                renderTools();
                populateFilterDropdowns();
            } else {
                // Esto podría ocurrir si la respuesta es 204 o un error ya manejado por apiRequest
                if (!storedTools) {
                    tools = [];
                    renderTools(); // Renderizar lista vacía o mensaje
                    populateFilterDropdowns(); 
                }
            }
        } catch (error) {
            // El error ya es logueado y posiblemente alertado por apiRequest.
            // updateUIForRole podría ser llamado si el error es de autenticación.
            if (!localStorage.getItem('toolTrackerTools')) {
                toolListContainer.innerHTML = `<p>Error al cargar herramientas. ${error.message.includes('No autorizado') || error.message.includes('Acceso prohibido') ? 'Por favor, inicia sesión.': 'Intenta de nuevo más tarde.'}</p>`;
            }
        }
    }
    
    // Función para fusionar los datos del servidor con los datos locales
    function mergeFetchedWithLocalTools(fetchedTools) {
        // Crear un mapa de herramientas locales para búsqueda rápida
        const localToolsMap = new Map();
        tools.forEach(tool => {
            localToolsMap.set(tool.id, tool);
        });
        
        // Recorrer las herramientas del servidor
        fetchedTools.forEach(serverTool => {
            const localTool = localToolsMap.get(serverTool.id);
            
            // Si la herramienta no existe localmente, añadirla
            if (!localTool) {
                tools.push(serverTool);
                return;
            }
            
            // Si la herramienta existe localmente, preservar datos de préstamo
            if (localTool.assignedTo && localTool.quantityBorrowed > 0) {
                // Preservar información de préstamo del local
                serverTool.assignedTo = localTool.assignedTo;
                serverTool.quantityBorrowed = localTool.quantityBorrowed;
                serverTool.note = localTool.note || '';
                
                // Ajustar la cantidad en almacén para que sea consistente
                const totalQuantity = parseInt(serverTool.quantityStock) + parseInt(serverTool.quantityBorrowed) || 0;
                serverTool.quantityStock = totalQuantity - localTool.quantityBorrowed;
                
                // Si la cantidad en almacén es negativa, ajustar
                if (serverTool.quantityStock < 0) {
                    serverTool.quantityStock = 0;
                }
            }
            
            // Actualizar la herramienta local con la del servidor (preservando datos de préstamo)
            const index = tools.findIndex(t => t.id === serverTool.id);
            if (index !== -1) {
                tools[index] = serverTool;
            }
        });
        
        // Mantener herramientas que solo existen localmente (puede ser por préstamos no sincronizados)
        const serverToolIds = new Set(fetchedTools.map(tool => tool.id));
        const localOnlyTools = tools.filter(tool => !serverToolIds.has(tool.id));
        
        // Si hay herramientas solo locales con préstamos, mantenerlas
        const localOnlyWithBorrows = localOnlyTools.filter(tool => 
            tool.assignedTo && 
            tool.quantityBorrowed > 0);
        
        // Reconstruir el array de herramientas
        tools = [...fetchedTools, ...localOnlyWithBorrows];
    }

    async function addTool(toolData) {
        try {
            const newTool = await apiRequest('/tools', 'POST', toolData);
            if(newTool) {
                // Añadir la nueva herramienta al array local
                tools.push(newTool);
                localStorage.setItem('toolTrackerTools', JSON.stringify(tools));
                
                // Recargar la vista
                renderTools();
                populateFilterDropdowns();
                
                if (addToolForm) addToolForm.reset();
            }
        } catch (error) {
            // Si hay un error de conexión, guardar localmente de todos modos
            const newTool = {
                ...toolData,
                id: generateId() // Generar un ID temporal
            };
            tools.push(newTool);
            localStorage.setItem('toolTrackerTools', JSON.stringify(tools));
            
            // Recargar la vista
            renderTools();
            populateFilterDropdowns();
            
            if (addToolForm) addToolForm.reset();
            
            alert('Se guardó localmente pero no se pudo sincronizar con el servidor. Los cambios se enviarán cuando se restablezca la conexión.');
        }
    }

    async function updateTool(toolId, toolData) {
        try {
            const updatedTool = await apiRequest(`/tools/${toolId}`, 'PUT', toolData);
            if(updatedTool) {
                // Actualizar la herramienta en el array local
                const index = tools.findIndex(tool => tool.id === toolId);
                if (index !== -1) {
                    tools[index] = updatedTool;
                }
                localStorage.setItem('toolTrackerTools', JSON.stringify(tools));
                
                // Recargar la vista
                renderTools();
                populateFilterDropdowns();
                
                closeEditModal();
            }
        } catch (error) {
            // Si hay un error de conexión, actualizar localmente
            const index = tools.findIndex(tool => tool.id === toolId);
            if (index !== -1) {
                tools[index] = { ...tools[index], ...toolData, id: toolId };
            }
            localStorage.setItem('toolTrackerTools', JSON.stringify(tools));
            
            // Recargar la vista
            renderTools();
            populateFilterDropdowns();
            
            closeEditModal();
            
            alert('Se actualizó localmente pero no se pudo sincronizar con el servidor. Los cambios se enviarán cuando se restablezca la conexión.');
        }
    }

    async function deleteToolApi(toolId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta herramienta?')) {
            try {
                await apiRequest(`/tools/${toolId}`, 'DELETE');
                
                // Eliminar la herramienta del array local
                const index = tools.findIndex(tool => tool.id === toolId);
                if (index !== -1) {
                    tools.splice(index, 1);
                }
                localStorage.setItem('toolTrackerTools', JSON.stringify(tools));
                
                // Recargar la vista
                renderTools();
                populateFilterDropdowns();
                
            } catch (error) {
                // Si hay un error de conexión, eliminar localmente
                const index = tools.findIndex(tool => tool.id === toolId);
                if (index !== -1) {
                    tools.splice(index, 1);
                }
                localStorage.setItem('toolTrackerTools', JSON.stringify(tools));
                
                // Recargar la vista
                renderTools();
                populateFilterDropdowns();
                
                alert('Se eliminó localmente pero no se pudo sincronizar con el servidor. Los cambios se enviarán cuando se restablezca la conexión.');
            }
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

        // Agrupar herramientas por nombre para agrupar préstamos
        const toolGroups = new Map();
        
        toolsToRender.forEach(tool => {
            const toolName = tool.name;
            if (!toolGroups.has(toolName)) {
                // Guardar una copia de la primera herramienta encontrada como base para el grupo.
                // Sus cantidades se recalcularán después.
                toolGroups.set(toolName, {
                    representativeTool: { ...tool }, // Usaremos este como base para datos comunes (desc, img, etc.)
                    allInstances: [],       // Para almacenar todas las instancias reales de este tipo de herramienta
                    borrowers: []           // Para la lista de prestatarios
                });
            }
            const group = toolGroups.get(toolName);
            group.allInstances.push(tool); // Añadir la instancia actual al grupo

            // Si la herramienta (instancia actual) está prestada, añadir a la lista de borrowers del grupo
            if (tool.assignedTo && tool.quantityBorrowed > 0) {
                const existingBorrower = group.borrowers.find(b => b.name === tool.assignedTo);
                if (existingBorrower) {
                    existingBorrower.quantity += parseInt(tool.quantityBorrowed) || 0;
                } else {
                    group.borrowers.push({
                        name: tool.assignedTo,
                        quantity: parseInt(tool.quantityBorrowed) || 0
                    });
                }
            }
        });
        
        // Procesar cada grupo de herramientas
        toolGroups.forEach(group => {
            // Recalcular el stock total y el total prestado para la herramienta representativa del grupo
            let totalStockForGroup = 0;
            let totalBorrowedForGroup = 0;
            group.allInstances.forEach(instance => {
                totalStockForGroup += parseInt(instance.quantityStock) || 0;
                totalBorrowedForGroup += parseInt(instance.quantityBorrowed) || 0;
            });

            // Usar la 'representativeTool' para los datos base y actualizar sus cantidades con los totales recalculados
            const toolCardData = { ...group.representativeTool };
            toolCardData.quantityStock = totalStockForGroup;
            toolCardData.quantityBorrowed = totalBorrowedForGroup;
            // El ID de la tarjeta y para edición/borrado debe ser el de la representativeTool (o el primero del grupo)
            // para consistencia, aunque las acciones de préstamo/devolución de unidades usarán este ID.
            const baseToolIdForCard = group.representativeTool.id;


            const toolCard = document.createElement('div');
            toolCard.classList.add('tool-card');
            toolCard.dataset.id = baseToolIdForCard; // Usar el ID de la herramienta base del grupo
            
            let buttonsHTML = '';
            // Solo admin puede editar/eliminar según la lógica actual de UI
            if (currentUser.role === 'admin') {
                buttonsHTML = `
                    <button class="edit-btn">Editar</button>
                    <button class="delete-btn">Eliminar</button>
                `;
            }

            // Usar las cantidades recalculadas para la visualización
            const displayTotalQuantity = totalStockForGroup + totalBorrowedForGroup;
            
            // Crear el desplegable de unidades y sus asignaciones con botón de detalles
            let inventoryDropdownHTML = '';
            if (displayTotalQuantity > 0) {
                inventoryDropdownHTML = `
                    <div class="inventory-dropdown-container">
                        <p><strong>Detalle de unidades:</strong></p>
                        <div class="dropdown-with-button">
                            <select class="inventory-dropdown" id="dropdown-${baseToolIdForCard}" data-tool-id="${baseToolIdForCard}" data-tool-name="${toolCardData.name}">
                                <option value="">-- Seleccione una unidad --</option>
                `;
                
                // Generar opciones para cada unidad
                for (let i = 1; i <= displayTotalQuantity; i++) {
                    // NUEVA LÓGICA para determinar el estado de la unidad i
                    let assignedPerson = "Almacén"; // Default
                    // Usar baseToolIdForCard para construir la clave del historial, ya que este es el ID "representativo"
                    const unitKey = `${baseToolIdForCard}_${i}`; 
                    
                    const historyForUnit = (window.loanHistory && window.loanHistory[unitKey]) ? window.loanHistory[unitKey] : [];

                    if (historyForUnit.length > 0) {
                        const sortedHistory = [...historyForUnit].sort((a, b) => new Date(b.date) - new Date(a.date));
                        const lastEvent = sortedHistory[0];

                        if (lastEvent.action === 'loan') {
                            const isCurrentActiveBorrower = group.borrowers.some(b => b.name === lastEvent.person && b.quantity > 0);
                            if (isCurrentActiveBorrower) {
                                assignedPerson = lastEvent.person;
                            } else {
                                console.warn(`Historial de préstamo para ${unitKey} (a ${lastEvent.person}) es obsoleto o inconsistente con los prestatarios activos. Se muestra como Almacén.`);
                                assignedPerson = "Almacén"; 
                            }
                        }
                    }
                    
                    inventoryDropdownHTML += `<option value="${i}" data-status="${assignedPerson}">${i}: ${assignedPerson}</option>`;
                }
                
                inventoryDropdownHTML += `
                            </select>
                            <button type="button" class="details-btn" data-tool-id="${baseToolIdForCard}" data-tool-name="${toolCardData.name}">Detalles</button>
                        </div>
                    </div>
                `;
            }
            
            toolCard.innerHTML = `
                <h3>${toolCardData.name}</h3>
                ${toolCardData.image ? `<img src="${toolCardData.image}" alt="${toolCardData.name}" style="max-width: 100px; height: auto;">` : ''}
                <p><strong>Descripción:</strong> ${toolCardData.description || 'N/A'}</p>
                <p><strong>Categoría:</strong> ${toolCardData.category || 'N/A'}</p>
                <p><strong>Cantidad en Almacén:</strong> ${toolCardData.quantityStock}</p>
                <p><strong>Cantidad Prestada:</strong> ${toolCardData.quantityBorrowed}</p>
                <p><strong>Cantidad Total:</strong> ${displayTotalQuantity}</p>
                ${inventoryDropdownHTML}
                <div class="tool-actions">
                    ${buttonsHTML}
                </div>
            `;
            
            if (currentUser.role === 'admin') {
                const editBtn = toolCard.querySelector('.edit-btn');
                const deleteBtn = toolCard.querySelector('.delete-btn');
                // Las acciones de editar/eliminar deberían operar sobre la herramienta 'representativa' o principal.
                if(editBtn) editBtn.addEventListener('click', () => openEditModal(baseToolIdForCard));
                if(deleteBtn) deleteBtn.addEventListener('click', () => deleteToolApi(baseToolIdForCard));
            }
            
            // Añadir evento al botón de detalles
            const detailsBtn = toolCard.querySelector('.details-btn');
            if (detailsBtn) {
                detailsBtn.addEventListener('click', function() {
                    try {
                        console.log("Click en botón detalles para herramienta:", baseToolIdForCard);
                        
                        const dropdown = document.getElementById(`dropdown-${baseToolIdForCard}`);
                        if (!dropdown) {
                            console.error("Dropdown no encontrado para herramienta:", baseToolIdForCard);
                            alert('Error: No se pudo encontrar el selector de unidades');
                            return;
                        }
                        
                        if (dropdown.value === '') {
                            alert('Por favor, seleccione una unidad primero');
                            return;
                        }
                        
                        const toolIdForModal = this.dataset.toolId; // Este es baseToolIdForCard
                        const toolNameForModal = this.dataset.toolName; // Este es toolCardData.name
                        const unitNumber = parseInt(dropdown.value);
                        
                        if (isNaN(unitNumber) || unitNumber <= 0) {
                            console.error("Número de unidad inválido:", dropdown.value);
                            alert('Error: Número de unidad inválido');
                            return;
                        }
                        
                        const selectedIndex = dropdown.selectedIndex;
                        if (selectedIndex < 0) {
                            console.error("Índice seleccionado inválido:", selectedIndex);
                            alert('Error: Selección inválida');
                            return;
                        }
                        
                        const selectedOption = dropdown.options[selectedIndex];
                        if (!selectedOption) {
                            console.error("Opción seleccionada no encontrada");
                            alert('Error: Opción seleccionada no encontrada');
                            return;
                        }
                        
                        const status = selectedOption.dataset.status || 'Almacén';
                        
                        console.log("Valores para el modal:", {
                            toolId: toolIdForModal,
                            toolName: toolNameForModal,
                            unitNumber,
                            status,
                            selectedIndex,
                            options: dropdown.options.length
                        });
                        
                        if (!toolIdForModal) {
                            console.error("ID de herramienta no encontrado para modal");
                            alert("Error: ID de herramienta no encontrado para modal");
                            return;
                        }
                        
                        if (!toolNameForModal) {
                            console.error("Nombre de herramienta no encontrado para modal");
                            alert("Error: Nombre de herramienta no encontrado para modal");
                            return;
                        }
                        
                        openUnitDetailsModal(toolIdForModal, toolNameForModal, unitNumber, status);
                    } catch (error) {
                        console.error("Error al procesar clic en botón detalles:", error);
                        alert("Hubo un problema al preparar los detalles. Por favor, intente de nuevo.");
                    }
                });
            }
            
            // Eliminar cualquier evento change del desplegable para evitar abrir el modal automáticamente
            const dropdown = toolCard.querySelector('.inventory-dropdown');
            if (dropdown) {
                // No añadimos ningún evento change al dropdown para evitar que abra el modal automáticamente
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

    // --- Renderizado de Personas ---
    
    // --- Funciones para gestión de personas ---
    
    
    
    
    // Hacer que la función sea accesible globalmente
    
    
    
    
    
    
    
    
    // --- Funciones para asignación de herramientas ---
    
    
    
    
    
    
    
    
    

    // --- Funciones de Eventos ---
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

            const totalUnits = parseInt(document.getElementById('tool-total-units').value) || 1;
            const toolData = {
                name: document.getElementById('tool-name').value,
                description: document.getElementById('tool-description').value,
                category: document.getElementById('tool-category').value.trim(),
                acquisitionDate: document.getElementById('tool-acquisition-date').value,
                location: document.getElementById('tool-location').value.trim(),
                quantityStock: totalUnits,
                quantityBorrowed: 0,
                image: document.getElementById('tool-image').value.trim(),
                defaultMaintenanceInterval: {
                    value: parseInt(document.getElementById('tool-default-maintenance-interval-value').value) || 0,
                    unit: document.getElementById('tool-default-maintenance-interval-unit').value
                },
                defaultCalibrationInterval: {
                    value: parseInt(document.getElementById('tool-default-calibration-interval-value').value) || 0,
                    unit: document.getElementById('tool-default-calibration-interval-unit').value
                }
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
                quantityStock: parseInt(editToolQuantityStockInput.value) || 0,
                quantityBorrowed: parseInt(editToolQuantityBorrowedInput.value) || 0,
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
        
        // Verificar que todos los elementos existan antes de usarlos
        const elements = {
            editToolIdInput: document.getElementById('edit-tool-id'),
            editToolNameInput: document.getElementById('edit-tool-name'),
            editToolDescriptionInput: document.getElementById('edit-tool-description'),
            editToolCategoryInput: document.getElementById('edit-tool-category'),
            editToolAcquisitionDateInput: document.getElementById('edit-tool-acquisition-date'),
            editToolLocationInput: document.getElementById('edit-tool-location'),
            editToolImageInput: document.getElementById('edit-tool-image'),
            editToolQuantityStockInput: document.getElementById('edit-tool-quantity-stock'),
            editToolQuantityBorrowedInput: document.getElementById('edit-tool-quantity-borrowed'),
            editToolModal: document.getElementById('edit-tool-modal')
        };

        // Verificar que todos los elementos existan
        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`Elemento no encontrado: ${key}`);
                return;
            }
        }

        // Si todos los elementos existen, proceder con la edición
        elements.editToolIdInput.value = toolToEdit.id;
        elements.editToolNameInput.value = toolToEdit.name;
        elements.editToolDescriptionInput.value = toolToEdit.description || '';
        elements.editToolCategoryInput.value = toolToEdit.category || '';
        elements.editToolAcquisitionDateInput.value = toolToEdit.acquisitionDate || '';
        elements.editToolLocationInput.value = toolToEdit.location || '';
        elements.editToolQuantityStockInput.value = toolToEdit.quantityStock || 0;
        elements.editToolQuantityBorrowedInput.value = toolToEdit.quantityBorrowed || 0;
        elements.editToolImageInput.value = toolToEdit.image || '';
        elements.editToolModal.style.display = 'flex';
    }

    window.closeEditModal = function() { // Hacerla global para el botón en HTML
        if (editToolModal) editToolModal.style.display = 'none';
    }

    // --- Inicialización de la aplicación ---
    function initializeApp() {
        // Cargar datos guardados
        loadLoanHistory(); 
        
        // Asegurar que los campos de entrada sean interactivos
        if (usernameInput) usernameInput.readOnly = false;
        if (passwordInput) passwordInput.readOnly = false;
        
        // Eventos para inicio de sesión
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
            // Asegurar que el formulario esté limpio
            loginForm.reset();
        }
        
        // Eventos para cierre de sesión
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
        }
        
        // Eventos para personas
        // if (addPersonBtn) {
        //     addPersonBtn.addEventListener('click', () => { ... });
        // }
        // if (addPersonForm) {
        //     addPersonForm.addEventListener('submit', (e) => { ... });
        // }
        // if (assignToolForm) {
        //     assignToolForm.addEventListener('submit', (e) => { ... });
        // }
        // if (searchPersonInput) {
        //     searchPersonInput.addEventListener('input', (e) => { ... });
        // }
        // ... (resto de initializeApp se mantiene) ...
        
        // Eventos para las pestañas
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                activateTab(tabId);
            });
        });
        
        // Comprobar si hay token guardado para auto-login
        const savedToken = localStorage.getItem('toolTrackerToken');
        const savedRole = localStorage.getItem('toolTrackerUserRole');
        const savedUsername = localStorage.getItem('toolTrackerUsername');
        if (savedToken && savedRole && savedUsername) {
            currentUser = {
                username: savedUsername,
                role: savedRole,
                token: savedToken
            };
            updateUIForRole();
        } else {
            currentUser = null;
            updateUIForRole();
        }
    }

    // Iniciar la aplicación
    initializeApp();
    
    // Hacer que los datos sean accesibles globalmente
    window.toolsData = tools;
    window.loanHistory = loanHistory;
    window.tools = tools; 
    window.API_BASE_URL = API_BASE_URL;
    
    // Hacer que generateSerial sea accesible globalmente
    window.generateSerial = generateSerial;
    
    // No añadimos delegación de eventos para los selectores de unidades
    // porque eso causa que el modal se abra automáticamente al seleccionar una opción

    if (clearLoanHistoryButton && currentUser && currentUser.role === 'admin') {
        clearLoanHistoryButton.addEventListener('click', () => {
            const confirmDelete = confirm("¿Estás SEGURO de que quieres borrar TODO el historial de préstamos de unidades? Esta acción no se puede deshacer y afectará el seguimiento detallado.");
            if (confirmDelete) {
                try {
                    localStorage.removeItem('toolTrackerLoanHistory');
                    window.loanHistory = {}; // Resetear la variable en memoria

                    // Adicionalmente, resetear el estado de préstamo en todas las herramientas
                    if (window.tools && Array.isArray(window.tools)) {
                        window.tools.forEach(tool => {
                            if (tool.quantityBorrowed && tool.quantityBorrowed > 0) {
                                tool.quantityStock = (parseInt(tool.quantityStock) || 0) + (parseInt(tool.quantityBorrowed) || 0);
                                tool.quantityBorrowed = 0;
                                tool.assignedTo = '';
                                tool.note = ''; // También limpiar notas asociadas al préstamo general
                                tool._modified = true; // Marcar para posible sincronización
                            }
                        });
                        // Guardar los cambios en el array tools en localStorage
                        localStorage.setItem('toolTrackerTools', JSON.stringify(window.tools));
                        
                        // Intentar sincronizar estos cambios con el servidor
                        if (typeof syncTools === 'function') {
                            syncTools().catch(err => console.warn("Error durante syncTools después de borrar historial:", err));
                        }
                    }

                    alert('Todo el historial de préstamos de unidades ha sido borrado, y las herramientas han sido actualizadas a \'En Almacén\'.');
                    
                    // Volver a renderizar las herramientas para que los desplegables reflejen el cambio
                    if (typeof renderTools === 'function') {
                        renderTools();
                    }
                } catch (error) {
                    console.error("Error al borrar el historial de préstamos:", error);
                    alert("Ocurrió un error al intentar borrar el historial de préstamos.");
                }
            }
        });
    } else if (clearLoanHistoryButton) {
        // Si el botón existe pero el usuario no es admin, ocultarlo o deshabilitarlo.
        // (Aunque la sección contenedora ya debería estar oculta para no admins)
        clearLoanHistoryButton.style.display = 'none'; 
    }
});

// Función global para cerrar el modal de edición
function closeEditModal() {
    document.getElementById('edit-tool-modal').style.display = 'none';
}

// Función para sincronizar datos locales con el servidor
async function syncTools() {
    try {
        // Por cada herramienta modificada, enviar actualización al servidor
        for (const tool of window.tools) {
            if (tool._modified) {
                try {
                    // Verificar que el ID de la herramienta sea válido
                    if (!tool.id || typeof tool.id !== 'string') {
                        console.warn('ID de herramienta inválido:', tool);
                        continue;
                    }

                    // Verificar que el token esté disponible
                    if (!window.appCurrentUser || !window.appCurrentUser.token) {
                        console.error('No hay token disponible para sincronización');
                        continue;
                    }

                    console.log('Sincronizando herramienta:', tool.id);
                    await window.apiRequest(`/tools/${tool.id}`, 'PUT', tool);
                    tool._modified = false;
                } catch (error) {
                    console.warn(`No se pudo sincronizar la herramienta ${tool.id}:`, error);
                    // Continuamos con las otras herramientas
                }
            }
        }
    } catch (error) {
        console.warn('Error general en syncTools:', error);
    }
}

// Función para abrir el modal de detalles de unidad (colocar dentro del addEventListener de DOMContentLoaded)
function openUnitDetailsModal(toolId, toolName, unitNumber, currentStatus) {
    try {
        console.log('Abriendo modal para:', { toolId, toolName, unitNumber, currentStatus });
        
        // Verificar que los parámetros sean válidos
        if (!toolId) {
            throw new Error('ID de herramienta no proporcionado');
        }
        
        if (!toolName) {
            throw new Error('Nombre de herramienta no proporcionado');
        }
        
        if (!unitNumber || isNaN(unitNumber) || unitNumber <= 0) {
            throw new Error('Número de unidad inválido');
        }
        
        // Buscar la herramienta directamente en el array global
        const toolsArray = window.toolsData || [];
        let tool = toolsArray.find(t => t.id === toolId);
        
        if (!tool) {
            // Si no se encuentra en el array global, usar un objeto con valores por defecto
            console.warn(`Herramienta con ID ${toolId} no encontrada en el array global, usando datos proporcionados`);
            tool = {
                id: toolId,
                name: toolName,
                description: 'No disponible',
                acquisitionDate: 'No disponible'
            };
        }
        
        // Cerrar cualquier modal existente primero
        const existingModal = document.getElementById('unit-details-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Generar serial basado en ID y número de unidad
        const serial = window.generateSerial ? window.generateSerial(toolId, unitNumber) : `${toolId.substring(0, 6)}-${unitNumber.toString().padStart(3, '0')}`;
        
        // Crear un objeto para historial si no existe
        if (!window.loanHistory) {
            window.loanHistory = {};
        }
        
        // Obtener historial de préstamos para esta unidad
        const historyKey = `${toolId}_${unitNumber}`;
        const unitHistory = window.loanHistory[historyKey] || [];
        
        // Crear HTML para el historial
        let historyHTML = '';
        if (unitHistory && unitHistory.length > 0) {
            historyHTML = '<h4>Historial de préstamos:</h4><ul class="loan-history-list">';
            unitHistory.forEach(entry => {
                const date = new Date(entry.date).toLocaleDateString();
                const action = entry.action === 'loan' ? 'Préstamo a' : 'Devolución por';
                historyHTML += `<li><span class="history-date">${date}</span> - <span class="history-action">${action}</span> <span class="history-person">${entry.person}</span></li>`;
            });
            historyHTML += '</ul>';
        } else {
            historyHTML = '<p>No hay historial de préstamos para esta unidad.</p>';
        }
        
        // Determinar si está prestada y mostrar información pertinente
        let loanInfoHTML = '';
        if (currentStatus && currentStatus !== 'Almacén') {
            // Buscar la fecha del último préstamo
            const lastLoan = unitHistory && unitHistory.length > 0 ? 
                [...unitHistory].reverse().find(entry => entry.action === 'loan') : null;
            const loanDate = lastLoan ? new Date(lastLoan.date).toLocaleDateString() : 'Desconocida';
            
            loanInfoHTML = `
                <div class="loan-info">
                    <p><strong>Actualmente prestada a:</strong> ${currentStatus}</p>
                    <p><strong>Fecha de préstamo:</strong> ${loanDate}</p>
                    <button id="return-unit-btn" data-tool-id="${toolId}" data-unit="${unitNumber}" data-person="${currentStatus}">Devolver al almacén</button>
                </div>
            `;
        } else {
            loanInfoHTML = `
                <div class="loan-info">
                    <p><strong>Estado actual:</strong> En almacén</p>
                    <button id="loan-unit-btn" data-tool-id="${toolId}" data-unit="${unitNumber}">Prestar unidad</button>
                </div>
            `;
        }
        
        // Determinar si el usuario es administrador para mostrar opciones de edición
        // Usar la variable global appCurrentUser en lugar de window.currentUser
        const isAdmin = window.appCurrentUser && window.appCurrentUser.role === 'admin';
        
        console.log('Estado de administrador:', isAdmin, 'Usuario actual:', window.appCurrentUser);
        
        // Crear el modal HTML
        const modalHTML = `
            <div id="unit-details-modal" class="modal">
                <div class="modal-content unit-details-content">
                    <span class="close-button" onclick="closeUnitDetailsModal()">&times;</span>
                    <h2>Detalles de ${toolName} - Unidad ${unitNumber}</h2>
                    
                    <div class="unit-details">
                        <div class="unit-info">
                            ${isAdmin ? `
                                <div class="editable-detail" data-field="model">
                                    <strong>Modelo:</strong> <span id="model-value">${tool.description || 'No especificado'}</span>
                                    <button class="edit-field-btn" data-field="model">Editar</button>
                                </div>
                                <div class="editable-detail" data-field="serial">
                                    <strong>Serial:</strong> <span id="serial-value">${serial}</span>
                                    <button class="edit-field-btn" data-field="serial">Editar</button>
                                </div>
                                <div class="editable-detail" data-field="acquisition-date">
                                    <strong>Fecha de adquisición:</strong> <span id="acquisition-date-value">${tool.acquisitionDate || 'No especificada'}</span>
                                    <button class="edit-field-btn" data-field="acquisition-date">Editar</button>
                                </div>
                            ` : `
                                <p><strong>Modelo:</strong> ${tool.description || 'No especificado'}</p>
                                <p><strong>Serial:</strong> ${serial}</p>
                                <p><strong>Fecha de adquisición:</strong> ${tool.acquisitionDate || 'No especificada'}</p>
                            `}
                            
                            <div id="barcode-container"></div>
                        </div>
                        
                        ${loanInfoHTML}
                        
                        <div class="history-container">
                            ${historyHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Insertar el modal en el DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Mostrar el modal
        const modal = document.getElementById('unit-details-modal');
        if (!modal) {
            throw new Error('No se pudo insertar el modal en el DOM');
        }
        modal.style.display = 'flex';
        
        // Si es administrador, añadir eventos a los botones de edición
        if (isAdmin) {
            const editButtons = modal.querySelectorAll('.edit-field-btn');
            console.log('Botones de edición encontrados:', editButtons.length);
            editButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const field = this.getAttribute('data-field');
                    showFieldEditForm(toolId, unitNumber, field);
                });
            });
        }
        
        // Generar el código de barras, con verificación de que la biblioteca exista
        setTimeout(() => {
            try {
                const barcodeContainer = document.getElementById('barcode-container');
                if (!barcodeContainer) {
                    console.error('No se pudo encontrar el contenedor del código de barras');
                    return;
                }
                
                if (typeof JsBarcode !== 'undefined') {
                    const canvas = document.createElement('canvas');
                    barcodeContainer.appendChild(canvas);
                    JsBarcode(canvas, serial, {
                        format: "CODE128",
                        lineColor: "#000",
                        width: 2,
                        height: 50,
                        displayValue: true
                    });
                } else {
                    console.warn('JsBarcode no está disponible');
                    // Si JsBarcode no está disponible, mostrar el serial como texto
                    barcodeContainer.innerHTML = `<p class="serial-text">${serial}</p>`;
                }
            } catch (e) {
                console.error('Error al generar código de barras:', e);
                const barcodeContainer = document.getElementById('barcode-container');
                if (barcodeContainer) {
                    barcodeContainer.innerHTML = `<p class="serial-text">${serial}</p>`;
                }
            }
        }, 100);
        
        // Añadir manejadores de eventos para los botones
        setTimeout(() => {
            try {
                const returnBtn = document.getElementById('return-unit-btn');
                if (returnBtn) {
                    returnBtn.addEventListener('click', function() {
                        const toolId = this.dataset.toolId;
                        const unitNumber = parseInt(this.dataset.unit);
                        const person = this.dataset.person;
                        
                        returnUnitToStock(toolId, unitNumber, person);
                        closeUnitDetailsModal();
                    });
                }
                
                const loanBtn = document.getElementById('loan-unit-btn');
                if (loanBtn) {
                    loanBtn.addEventListener('click', function() {
                        const toolId = this.dataset.toolId;
                        const unitNumber = parseInt(this.dataset.unit);
                        
                        showAssignPersonModal(toolId, unitNumber);
                        closeUnitDetailsModal();
                    });
                }
            } catch (e) {
                console.error('Error al configurar eventos de botones:', e);
            }
        }, 100);
        
    } catch (error) {
        console.error("Error al abrir modal de detalles:", error);
        alert(`Error: ${error.message || "Hubo un problema al mostrar los detalles. Por favor, intente de nuevo."}`);
    }
}

// Cerrar el modal de detalles (asegurar que sea global)
window.closeUnitDetailsModal = function() {
    try {
        const modal = document.getElementById('unit-details-modal');
        if (modal) {
            modal.remove();
        }
    } catch (error) {
        console.error("Error al cerrar modal:", error);
    }
};

// Función para mostrar el formulario de edición de un campo específico
function showFieldEditForm(toolId, unitNumber, field) {
    // Buscar la herramienta
    const tool = tools.find(t => t.id === toolId);
    if (!tool) {
        alert('No se pudo encontrar la herramienta');
        return;
    }
    
    let fieldValue = '';
    let fieldTitle = '';
    let inputType = 'text';
    
    // Determinar título y valor actual según el campo
    switch(field) {
        case 'model':
            fieldTitle = 'Modelo';
            fieldValue = tool.description || '';
            break;
        case 'serial':
            fieldTitle = 'Serial';
            fieldValue = tool.customSerial || '';
            break;
        case 'acquisition-date':
            fieldTitle = 'Fecha de Adquisición';
            fieldValue = tool.acquisitionDate || '';
            inputType = 'date';
            break;
        default:
            console.error('Campo no reconocido:', field);
            return;
    }
    
    // Crear HTML para el formulario de edición
    const formHTML = `
        <div id="field-edit-modal" class="modal">
            <div class="modal-content">
                <span class="close-button" onclick="closeFieldEditModal()">&times;</span>
                <h3>Editar ${fieldTitle}</h3>
                <form id="field-edit-form">
                    <input type="hidden" id="edit-field-tool-id" value="${toolId}">
                    <input type="hidden" id="edit-field-unit" value="${unitNumber}">
                    <input type="hidden" id="edit-field-name" value="${field}">
                    
                    <div>
                        <label for="edit-field-value">${fieldTitle}:</label>
                        <input type="${inputType}" id="edit-field-value" value="${fieldValue}" ${field === 'serial' ? 'placeholder="Serial personalizado (dejar en blanco para usar el predeterminado)"' : ''}>
                    </div>
                    
                    <button type="submit">Guardar Cambios</button>
                </form>
            </div>
        </div>
    `;
    
    // Insertar el formulario en el DOM
    document.body.insertAdjacentHTML('beforeend', formHTML);
    
    // Mostrar el modal
    const modal = document.getElementById('field-edit-modal');
    modal.style.display = 'flex';
    
    // Manejar el envío del formulario
    const form = document.getElementById('field-edit-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const toolId = document.getElementById('edit-field-tool-id').value;
            const unitNumber = parseInt(document.getElementById('edit-field-unit').value);
            const fieldName = document.getElementById('edit-field-name').value;
            const fieldValue = document.getElementById('edit-field-value').value;
            
            // Guardar el cambio
            saveFieldEdit(toolId, unitNumber, fieldName, fieldValue);
            
            // Cerrar el modal de edición
            closeFieldEditModal();
            
            // Actualizar la vista de detalles
            refreshUnitDetails(toolId, unitNumber);
        });
    }
}

// Función para guardar la edición de un campo
function saveFieldEdit(toolId, unitNumber, fieldName, fieldValue) {
    // Buscar la herramienta
    const tool = window.tools.find(t => t.id === toolId);
    if (!tool) return false;
    
    // Actualizar el campo correspondiente
    switch(fieldName) {
        case 'model':
            tool.description = fieldValue;
            break;
        case 'serial':
            tool.customSerial = fieldValue;
            break;
        case 'acquisition-date':
            tool.acquisitionDate = fieldValue;
            break;
        default:
            console.error('Campo no reconocido:', fieldName);
            return false;
    }
    
    tool._modified = true;
    
    // Guardar cambios
    localStorage.setItem('toolTrackerTools', JSON.stringify(window.tools));
    
    // Intentar sincronizar con el servidor
    try {
        syncTools();
    } catch (error) {
        console.warn('No se pudo sincronizar con el servidor, pero los cambios se guardaron localmente:', error);
    }
    
    return true;
}

// Función para cerrar el modal de edición de campo
window.closeFieldEditModal = function() {
    const modal = document.getElementById('field-edit-modal');
    if (modal) {
        modal.remove();
    }
};

// Función para actualizar la vista de detalles después de una edición
function refreshUnitDetails(toolId, unitNumber) {
    // Buscar la herramienta
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;
    
    // Actualizar los valores mostrados en la vista de detalles
    const modelValueElement = document.getElementById('model-value');
    const serialValueElement = document.getElementById('serial-value');
    const acquisitionDateValueElement = document.getElementById('acquisition-date-value');
    
    if (modelValueElement) {
        modelValueElement.textContent = tool.description || 'No especificado';
    }
    
    if (serialValueElement) {
        const serial = window.generateSerial ? window.generateSerial(toolId, unitNumber) : `${toolId.substring(0, 6)}-${unitNumber.toString().padStart(3, '0')}`;
        serialValueElement.textContent = serial;
        
        // Actualizar también el código de barras
        const barcodeContainer = document.getElementById('barcode-container');
        if (barcodeContainer && typeof JsBarcode !== 'undefined') {
            barcodeContainer.innerHTML = '';
            const canvas = document.createElement('canvas');
            barcodeContainer.appendChild(canvas);
            
            try {
                JsBarcode(canvas, serial, {
                    format: "CODE128",
                    lineColor: "#000",
                    width: 2,
                    height: 50,
                    displayValue: true
                });
            } catch (e) {
                console.error('Error al actualizar código de barras:', e);
                barcodeContainer.innerHTML = `<p class="serial-text">${serial}</p>`;
            }
        }
    }
    
    if (acquisitionDateValueElement) {
        acquisitionDateValueElement.textContent = tool.acquisitionDate || 'No especificada';
    }
}

// Función para mostrar modal de asignación de persona
function showAssignPersonModal(toolId, unitNumber) {
    console.log('Mostrando modal para asignar herramienta:', { toolId, unitNumber });
    
    // Buscar la herramienta para verificar disponibilidad
    const tool = window.tools.find(t => t.id === toolId);
    if (!tool) {
        alert('No se pudo encontrar la herramienta');
        return;
    }
    
    // Verificar stock disponible
    const stockAvailable = parseInt(tool.quantityStock) || 0;
    if (stockAvailable <= 0) {
        alert('No hay unidades disponibles en almacén');
        return;
    }
    
    // Cargar opciones de personas para el desplegable - ELIMINADO
    // let personOptionsHTML = ''; // ELIMINADO
    // try { // ELIMINADO
        // Cargar personas desde localStorage // ELIMINADO
        // const people = window.appPeople || window.loadPeopleFromStorage() || []; // ELIMINADO
        // if (people && people.length > 0) { // ELIMINADO
            // Ordenar alfabéticamente // ELIMINADO
            // const sortedPeople = [...people].sort((a, b) => a.name.localeCompare(b.name)); // ELIMINADO
            // Generar opciones HTML // ELIMINADO
            // personOptionsHTML = sortedPeople.map(person =>  // ELIMINADO
            //     `<option value="${person.name}">${person.name}</option>` // ELIMINADO
            // ).join(''); // ELIMINADO
        // } // ELIMINADO
    // } catch (error) { // ELIMINADO
    //     console.error('Error al cargar las personas:', error); // ELIMINADO
    // } // ELIMINADO
    
    // Crear HTML para el modal
    const modalHTML = `
        <div id="assign-person-modal" class="modal">
            <div class="modal-content">
                <span class="close-button" onclick="closeAssignPersonModal()">&times;</span>
                <h2>Asignar Unidad ${unitNumber} a Persona</h2>
                <form id="assign-person-form">
                    <input type="hidden" id="assign-unit-tool-id" value="${toolId}">
                    <input type="hidden" id="assign-unit-number" value="${unitNumber}">
                    
                    <div>
                        <label for="assign-person-name">Ingresar nombre de la persona:</label>
                        <input type="text" id="assign-person-name" placeholder="Nombre de la persona" required>
                    </div>
                    
                    <div>
                        <label for="assign-note">Nota o Comentario:</label>
                        <textarea id="assign-unit-note" placeholder="Opcional"></textarea>
                    </div>
                    
                    <button type="submit">Asignar Unidad ${unitNumber}</button>
                </form>
            </div>
        </div>
    `;
    
    // Insertar el modal en el DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Mostrar el modal
    const modal = document.getElementById('assign-person-modal');
    modal.style.display = 'flex';
    
    // Manejar el envío del formulario
    const form = document.getElementById('assign-person-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const toolId = document.getElementById('assign-unit-tool-id').value;
            const unitNumber = parseInt(document.getElementById('assign-unit-number').value);
            let personName = '';
            
            // Obtener el nombre de la persona (del input)
            const personInput = document.getElementById('assign-person-name');
            
            if (personInput.value.trim()) {
                personName = personInput.value.trim();
                // addPersonIfNew(personName); // LLAMADA ELIMINADA
            } else {
                alert('Por favor, ingrese el nombre de una persona');
                return;
            }
            
            const note = document.getElementById('assign-unit-note').value;
            
            // Asignar la unidad específica a la persona
            try {
                const result = assignSpecificUnitToPerson(toolId, unitNumber, personName, note);
                if (result) {
                    closeAssignPersonModal();
                }
            } catch (error) {
                console.error('Error al asignar unidad:', error);
                alert('Ha ocurrido un error al asignar la unidad. Por favor, intente nuevamente.');
            }
        });
    }
}

// Añadir una nueva persona si no existe // FUNCIÓN ELIMINADA
/* function addPersonIfNew(personName) { // ELIMINAR BLOQUE ENTERO
    const people = window.appPeople || window.loadPeopleFromStorage() || [];
    
    if (!people.some(p => p.name.toLowerCase() === personName.toLowerCase())) {
        const newPerson = {
            id: window.generateId(), // Usar la versión global
            name: personName,
            position: '',
            department: ''
        };
        people.push(newPerson);
        window.appPeople = people;
        localStorage.setItem('toolTrackerPeople', JSON.stringify(people));
    }
} */

// Cerrar el modal de asignación de persona
window.closeAssignPersonModal = function() {
    const modal = document.getElementById('assign-person-modal');
    if (modal) {
        modal.remove();
    }
};

// Función para devolver una unidad al stock
function returnUnitToStock(toolId, unitNumber, person) {
    // Buscar la herramienta asignada a la persona
    const tool = tools.find(t => t.id === toolId && t.assignedTo === person);
    if (!tool) return false;
    
    // Actualizar cantidades
    tool.quantityBorrowed = Math.max(0, (parseInt(tool.quantityBorrowed) || 0) - 1);
    tool.quantityStock = (parseInt(tool.quantityStock) || 0) + 1;
    
    // Si no quedan herramientas prestadas, limpiar la asignación
    if (tool.quantityBorrowed <= 0) {
        tool.assignedTo = '';
        tool.note = '';
    }
    
    tool._modified = true;
    
    // Registrar el evento en el historial
    registerLoanEvent(toolId, unitNumber, 'return', person);
    
    // Guardar cambios
    updateToolsAfterAssignment();
    
    return true;
}

// Función para actualizar las herramientas después de una asignación
function updateToolsAfterAssignment() {
    // Guardar herramientas actualizadas en localStorage
    localStorage.setItem('toolTrackerTools', JSON.stringify(window.tools));
    
    // Intentar sincronizar con el servidor
    try {
        syncTools(); // Esto es async, pero no estamos esperando aquí. Considerar hacerlo.
    } catch (error) {
        console.warn('No se pudo sincronizar con el servidor durante la asignación/devolución:', error);
        // Aún si syncTools falla, los cambios locales están hechos y la UI se actualizará con ellos.
    }
    
    // Actualizar la vista directamente en lugar de recargar la página
    // if (typeof renderTools === 'function') renderTools();
    // if (typeof populateFilterDropdowns === 'function') populateFilterDropdowns();
    // if (typeof renderAssignedPeople === 'function') renderAssignedPeople();
    
    // Comentado para evitar recarga que puede causar desincronización si sync falla.
    alert('Operación completada. La página se recargará para mostrar todos los cambios.');
    location.reload(); 
}

// Función para asignar una unidad específica a una persona
function assignSpecificUnitToPerson(toolId, unitNumber, personName, note) {
    console.log('Asignando unidad específica:', { toolId, unitNumber, personName });
    
    // Buscar la herramienta
    const tool = window.tools.find(t => t.id === toolId);
    if (!tool) {
        alert('Herramienta no encontrada');
        return false;
    }
    
    // Obtener cantidades actuales
    const stockAvailable = parseInt(tool.quantityStock) || 0;
    const totalQuantityBorrowed = parseInt(tool.quantityBorrowed) || 0;
    const totalUnits = stockAvailable + totalQuantityBorrowed;
    
    console.log('Cantidades antes de la operación:', {
        unidad: unitNumber,
        enAlmacen: stockAvailable,
        prestadas: totalQuantityBorrowed,
        total: totalUnits
    });
    
    // Verificar que la unidad esté actualmente en almacén y no prestada
    // La unidad está en stock si su número es <= stockAvailable
    // if (unitNumber > stockAvailable) { // ANTIGUA LÓGICA PROBLEMÁTICA
    //     alert(`La unidad ${unitNumber} ya está prestada o no está disponible en almacén.`);
    //     return false;
    // }

    // NUEVA LÓGICA para verificar disponibilidad de la unidad específica
    const historyKey = `${toolId}_${unitNumber}`;
    const unitSpecificHistory = (window.loanHistory && window.loanHistory[historyKey]) ? window.loanHistory[historyKey] : [];
    let isUnitCurrentlyLoaned = false;

    if (unitSpecificHistory.length > 0) {
        // Ordenar por fecha descendente para obtener el último evento
        const sortedUnitSpecificHistory = [...unitSpecificHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastEventForUnit = sortedUnitSpecificHistory[0];
        if (lastEventForUnit.action === 'loan') {
            isUnitCurrentlyLoaned = true;
        }
    }

    if (isUnitCurrentlyLoaned) {
        alert(`La unidad ${unitNumber} de "${tool.name}" ya se encuentra prestada a ${unitSpecificHistory[unitSpecificHistory.length -1].person}.`);
        return false;
    }
    // FIN NUEVA LÓGICA
    
    // Verificar que haya unidades disponibles en el stock general de la herramienta.
    // Esto es importante porque loanHistory podría estar desactualizado si hubo manipulación directa
    // o si es la primera vez que se presta esta unidad (no tendrá historial).
    if (stockAvailable <= 0) {
        alert('No hay unidades de "' + tool.name + '" disponibles en almacén.');
        return false;
    }
    
    // IMPORTANTE: Siempre decrementamos el stock en 1
    tool.quantityStock = stockAvailable - 1;
    
    // Registrar el evento de préstamo específico para esta unidad
    try {
        window.registerLoanEvent(toolId, unitNumber, 'loan', personName);
    } catch (error) {
        console.error('Error al registrar evento de préstamo:', error);
    }
    
    // Buscar si ya hay una asignación a esta persona
    const existingAssignment = window.tools.find(t => 
        t.name === tool.name && 
        t.assignedTo === personName &&
        t.id !== tool.id
    );
    
    if (existingAssignment) {
        // Actualizar la asignación existente
        existingAssignment.quantityBorrowed = (parseInt(existingAssignment.quantityBorrowed) || 0) + 1;
        existingAssignment._modified = true;
        
        console.log('Actualizando asignación existente:', {
            personName,
            nuevaCantidadPrestada: existingAssignment.quantityBorrowed
        });
    } else if (tool.assignedTo && tool.assignedTo !== personName) {
        // Si la herramienta está asignada a otra persona, crear nueva entrada
        const newAssignment = {
            id: window.generateId(),
            name: tool.name,
            description: tool.description,
            category: tool.category, 
            location: tool.location,
            acquisitionDate: tool.acquisitionDate,
            image: tool.image,
            customSerial: tool.customSerial,
            assignedTo: personName,
            quantityBorrowed: 1,
            quantityStock: 0,
            note: note || '',
            _modified: true
        };
        
        // Añadir la nueva asignación
        window.tools.push(newAssignment);
        
        // IMPORTANTE: Incrementar la cantidad prestada en la herramienta original
        tool.quantityBorrowed = totalQuantityBorrowed + 1;
        tool._modified = true;
        
        console.log('Creando nueva asignación:', {
            personName, 
            cantidadPrestada: 1,
            totalPrestadas: tool.quantityBorrowed
        });
    } else {
        // Si la herramienta no tenía asignaciones previas
        tool.assignedTo = personName;
        tool.quantityBorrowed = totalQuantityBorrowed + 1;
        tool.note = note || '';
        tool._modified = true;
        
        console.log('Primera asignación para la herramienta:', {
            personName,
            nuevaCantidadPrestada: tool.quantityBorrowed
        });
    }
    
    // Guardar cambios
    localStorage.setItem('toolTrackerTools', JSON.stringify(window.tools));
    
    // Verificación final - recalcular totales de todas las herramientas con este nombre
    const relatedTools = window.tools.filter(t => t.name === tool.name);
    let totalEnAlmacen = 0;
    let totalPrestadas = 0;
    
    relatedTools.forEach(t => {
        totalEnAlmacen += parseInt(t.quantityStock) || 0;
        totalPrestadas += parseInt(t.quantityBorrowed) || 0;
    });
    
    const nuevoTotal = totalEnAlmacen + totalPrestadas;
    
    console.log('Cantidades después de la operación:', {
        enAlmacen: totalEnAlmacen,
        prestadas: totalPrestadas,
        nuevoTotal,
        totalAnterior: totalUnits
    });
    
    if (nuevoTotal !== totalUnits) {
        console.warn(`¡ADVERTENCIA! El total de unidades ha cambiado: Antes=${totalUnits}, Ahora=${nuevoTotal}`);
    }
    
    // Intentar sincronizar con el servidor
    try {
        syncTools();
    } catch (error) {
        console.warn('No se pudo sincronizar con el servidor:', error);
    }
    
    // Mostrar mensaje de éxito y recargar para ver los cambios
    alert(`La unidad ${unitNumber} ha sido asignada correctamente a ${personName}. La página se recargará para mostrar los cambios.`);
    location.reload();
    
    return true;
}