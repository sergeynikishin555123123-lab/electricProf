const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

let currentUser = null;
let userRole = 'client';
let selectedServices = [];
let currentOrderId = null;
let chatInterval = null;

const API_BASE = window.location.origin + '/api';

const SERVICES = [
    { name: 'Нет света', price: 'от 500 ₽', category: 'Аварийные' },
    { name: 'Короткое замыкание', price: 'от 800 ₽', category: 'Аварийные' },
    { name: 'Искрит розетка', price: 'от 600 ₽', category: 'Аварийные' },
    { name: 'Замена автомата', price: 'от 500 ₽', category: 'Щитовое оборудование' },
    { name: 'Замена УЗО', price: 'от 600 ₽', category: 'Щитовое оборудование' },
    { name: 'Замена дифавтомата', price: 'от 700 ₽', category: 'Щитовое оборудование' },
    { name: 'Замена счетчика', price: 'от 1500 ₽', category: 'Щитовое оборудование' },
    { name: 'Сборка щита', price: 'от 5000 ₽', category: 'Щитовое оборудование' },
    { name: 'Монтаж щита', price: 'от 3000 ₽', category: 'Щитовое оборудование' },
    { name: 'Замена розетки', price: 'от 400 ₽', category: 'Розетки и выключатели' },
    { name: 'Замена выключателя', price: 'от 400 ₽', category: 'Розетки и выключатели' },
    { name: 'Добавить розетку', price: 'от 800 ₽', category: 'Розетки и выключатели' },
    { name: 'Добавить выключатель', price: 'от 800 ₽', category: 'Розетки и выключатели' },
    { name: 'Перенос розетки', price: 'от 1000 ₽', category: 'Розетки и выключатели' },
    { name: 'Перенос выключателя', price: 'от 1000 ₽', category: 'Розетки и выключатели' },
    { name: 'Замена проводки', price: 'от 5000 ₽', category: 'Монтажные работы' },
    { name: 'Замена кабеля', price: 'от 2000 ₽', category: 'Монтажные работы' },
    { name: 'Электрика под ключ', price: 'от 30000 ₽', category: 'Монтажные работы' },
    { name: 'Подключение варочной панели', price: 'от 1500 ₽', category: 'Подключение техники' },
    { name: 'Подключение духового шкафа', price: 'от 1500 ₽', category: 'Подключение техники' },
    { name: 'Подключение кондиционера', price: 'от 3000 ₽', category: 'Подключение техники' },
    { name: 'Подключение люстры', price: 'от 800 ₽', category: 'Освещение' },
    { name: 'Монтаж светильников', price: 'от 600 ₽', category: 'Освещение' },
    { name: 'Диагностика', price: 'от 1000 ₽', category: 'Диагностика' },
    { name: 'Аварийный выезд', price: 'от 2000 ₽', category: 'Аварийные' },
    { name: 'Подключение дома', price: 'от 15000 ₽', category: 'Монтажные работы' },
    { name: 'Заземление', price: 'от 5000 ₽', category: 'Монтажные работы' },
    { name: 'Установка стабилизатора', price: 'от 2000 ₽', category: 'Монтажные работы' },
    { name: 'Штробление стен', price: 'от 300 ₽/м', category: 'Монтажные работы' },
    { name: 'Прокладка кабеля', price: 'от 150 ₽/м', category: 'Монтажные работы' }
];

// Инициализация
async function initApp() {
    try {
        const initData = tg.initDataUnsafe;
        
        if (initData && initData.user) {
            const userId = initData.user.id;
            
            try {
                const response = await fetch(API_BASE + '/user/' + userId);
                
                if (!response.ok) {
                    document.getElementById('app').innerHTML = `
                        <div class="loading-screen">
                            <div class="lightning-icon">⚡</div>
                            <p>Вы еще не зарегистрированы</p>
                            <p style="color: #999; font-size: 14px;">Вернитесь в бот и нажмите "Начать регистрацию"</p>
                        </div>
                    `;
                    return;
                }
                
                currentUser = await response.json();
                userRole = currentUser.role;
                
                document.getElementById('app').innerHTML = renderApp();
                
                if (window.location.search.includes('admin=true') && userRole === 'admin') {
                    showAdminPanel();
                } else if (userRole === 'electrician') {
                    showElectricianPanel();
                } else {
                    showClientPanel();
                }
            } catch (error) {
                showError('Ошибка загрузки данных');
            }
        } else {
            showError('Откройте приложение через Telegram');
        }
    } catch (error) {
        showError('Ошибка инициализации');
    }
}

function showError(message) {
    document.getElementById('app').innerHTML = `
        <div class="loading-screen">
            <div class="lightning-icon" style="font-size: 50px;">⚡</div>
            <p>${message}</p>
        </div>
    `;
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(API_BASE + endpoint, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function renderApp() {
    return `
        <div class="app-container">
            <div id="main-screen" class="screen active"></div>
            <div id="chat-screen" class="screen"></div>
            <div id="order-detail-screen" class="screen"></div>
        </div>
    `;
}

// Клиентский интерфейс
function showClientPanel() {
    const screen = document.getElementById('main-screen');
    screen.innerHTML = `
        <div id="profile-screen" class="screen active">
            ${renderClientProfile()}
        </div>
        <div id="create-order-screen" class="screen">
            ${renderCreateOrder()}
        </div>
        <div id="orders-screen" class="screen">
            ${renderOrdersList()}
        </div>
        
        <div class="bottom-nav">
            <button class="nav-item active" onclick="switchScreen('profile')">
                <span class="nav-item-icon">👤</span>
                Профиль
            </button>
            <button class="nav-item" onclick="switchScreen('create-order')">
                <span class="nav-item-icon">⚡</span>
                Создать
            </button>
            <button class="nav-item" onclick="switchScreen('orders')">
                <span class="nav-item-icon">📋</span>
                Заявки
            </button>
        </div>
    `;
}

function switchScreen(screenName) {
    document.querySelectorAll('#main-screen .screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenName + '-screen').classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const clickedBtn = event?.target?.closest('.nav-item');
    if (clickedBtn) clickedBtn.classList.add('active');
    
    if (screenName === 'orders') loadOrdersList();
    if (screenName === 'profile') refreshProfile();
}

function renderClientProfile() {
    return `
        <div class="profile-header">
            <div class="profile-avatar">${currentUser.firstName ? currentUser.firstName[0] : '?'}</div>
            <h2>${currentUser.firstName || ''} ${currentUser.lastName || ''}</h2>
            <span class="profile-role-badge">👤 Клиент</span>
        </div>
        
        <div class="profile-stats">
            <div class="stat-item">
                <div class="stat-value">${currentUser.rating || 0} ⭐</div>
                <div class="stat-label">Рейтинг</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${currentUser.ordersCount || 0}</div>
                <div class="stat-label">Заявок</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${currentUser.completedOrders || 0}</div>
                <div class="stat-label">Выполнено</div>
            </div>
        </div>
        
        <div class="profile-info">
            <div class="profile-info-item">
                <span class="profile-info-icon">📱</span>
                <span class="profile-info-text">${currentUser.phone || 'Не указан'}</span>
            </div>
            <div class="profile-info-item">
                <span class="profile-info-icon">📍</span>
                <span class="profile-info-text">${currentUser.region || 'Не указан'}</span>
            </div>
            <div class="profile-info-item">
                <span class="profile-info-icon">🏠</span>
                <span class="profile-info-text">${currentUser.address || 'Не указан'}</span>
                <span class="profile-info-edit" onclick="editAddress()">✏️</span>
            </div>
        </div>
        
        <button class="btn btn-primary btn-block" onclick="editProfile()">
            ✏️ Изменить данные
        </button>
    `;
}

function refreshProfile() {
    document.getElementById('profile-screen').innerHTML = renderClientProfile();
}

async function editAddress() {
    const newAddress = prompt('Введите новый адрес:', currentUser.address || '');
    if (newAddress !== null && newAddress !== currentUser.address) {
        try {
            await fetchAPI('/user/' + currentUser.id, {
                method: 'PUT',
                body: JSON.stringify({ address: newAddress })
            });
            currentUser.address = newAddress;
            refreshProfile();
            showToast('✅ Адрес обновлен');
        } catch (error) {
            showToast('❌ Ошибка обновления');
        }
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function renderCreateOrder() {
    return `
        <h2><span class="icon">⚡</span> Создать заявку</h2>
        
        <div class="form-group">
            <label class="form-label">Выберите услуги (можно несколько)</label>
            <input type="text" class="form-input" placeholder="🔍 Поиск услуги..." 
                   oninput="searchServices(this.value)">
            <div id="service-results" class="service-list" style="display:none;"></div>
        </div>
        
        <div class="selected-services-list" id="selected-services"></div>
        
        <div class="form-group">
            <label class="form-label">Адрес</label>
            <input type="text" id="order-address" class="form-input" 
                   placeholder="Улица, дом, квартира" value="${currentUser.address || ''}">
        </div>
        
        <div class="form-group">
            <label class="form-label">Описание проблемы</label>
            <textarea id="order-description" class="form-textarea" 
                      placeholder="Опишите проблему подробнее..."></textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">Желаемое время</label>
            <input type="text" id="order-time" class="form-input" 
                   placeholder="Например: завтра с 10:00 до 12:00">
        </div>
        
        <div class="form-group">
            <label class="form-label">Комментарий</label>
            <textarea id="order-comment" class="form-textarea" 
                      placeholder="Дополнительная информация..."></textarea>
        </div>
        
        <button class="btn btn-primary btn-block" onclick="publishOrder()">
            📤 Опубликовать заявку
        </button>
    `;
}

function searchServices(query) {
    const container = document.getElementById('service-results');
    
    if (!query || query.trim() === '') {
        container.style.display = 'none';
        return;
    }
    
    const results = SERVICES.filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase()) &&
        !selectedServices.find(ss => ss.name === s.name)
    );
    
    container.style.display = 'block';
    container.innerHTML = results.length === 0 
        ? '<div class="service-item">Ничего не найдено</div>'
        : results.map(s => `
            <div class="service-item" onclick="addService('${s.name}', '${s.price}')">
                <strong>${s.name}</strong>
                <span class="service-price">${s.price}</span>
            </div>
        `).join('');
}

function addService(name, price) {
    if (!selectedServices.find(s => s.name === name)) {
        selectedServices.push({ name, price });
        updateSelectedServices();
    }
    
    document.getElementById('service-results').style.display = 'none';
    const searchInput = document.querySelector('#create-order-screen .form-input');
    if (searchInput) searchInput.value = '';
}

function removeService(name) {
    selectedServices = selectedServices.filter(s => s.name !== name);
    updateSelectedServices();
}

function updateSelectedServices() {
    const container = document.getElementById('selected-services');
    container.innerHTML = selectedServices.map(s => `
        <div class="selected-service-badge">
            ${s.name} (${s.price})
            <span class="remove" onclick="removeService('${s.name}')">×</span>
        </div>
    `).join('');
}

function renderOrdersList() {
    return `
        <h2><span class="icon">📋</span> Мои заявки</h2>
        
        <div class="tabs">
            <button class="tab active" onclick="filterOrders('active', this)">Активные</button>
            <button class="tab" onclick="filterOrders('completed', this)">Завершенные</button>
        </div>
        
        <div id="orders-container">Загрузка...</div>
    `;
}

async function loadOrdersList(status = 'active') {
    const container = document.getElementById('orders-container');
    if (!container) return;
    
    try {
        const orders = await fetchAPI('/orders/client/' + currentUser.id);
        const filteredOrders = orders.filter(o => 
            status === 'active' ? o.status === 'active' : o.status === 'completed'
        );
        
        container.innerHTML = filteredOrders.length === 0 
            ? '<div class="empty-state"><div class="icon">📭</div><p>Нет заявок</p></div>'
            : filteredOrders.map(order => `
                <div class="order-card" onclick="viewOrder('${order.id}')">
                    <div class="order-header">
                        <h3>${order.service}</h3>
                        <span class="order-status status-${order.status}">
                            ${order.status === 'active' ? '⚡ Активна' : '✅ Завершена'}
                        </span>
                    </div>
                    <div class="order-price">${order.price}</div>
                    <div class="order-details">
                        <p>📍 ${order.address}</p>
                        <p>🕐 ${order.desiredTime || 'Не указано'}</p>
                        <p>📅 ${new Date(order.createdAt).toLocaleDateString()}</p>
                        ${order.electricianId ? '<p>👨‍🔧 Исполнитель назначен</p>' : '<p>🔍 Ищем исполнителя...</p>'}
                    </div>
                </div>
            `).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Ошибка загрузки</p></div>';
    }
}

function filterOrders(status, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    loadOrdersList(status);
}

async function publishOrder() {
    const address = document.getElementById('order-address').value.trim();
    const description = document.getElementById('order-description').value.trim();
    const time = document.getElementById('order-time').value.trim();
    const comment = document.getElementById('order-comment').value.trim();
    
    if (selectedServices.length === 0) {
        tg.showAlert('Выберите хотя бы одну услугу');
        return;
    }
    
    if (!address) {
        tg.showAlert('Укажите адрес');
        return;
    }
    
    // Отправляем заявку для каждой выбранной услуги
    try {
        for (const service of selectedServices) {
            await fetchAPI('/orders', {
                method: 'POST',
                body: JSON.stringify({
                    clientId: currentUser.id,
                    service: service.name,
                    price: service.price,
                    address: address,
                    description: description,
                    desiredTime: time,
                    comment: comment
                })
            });
        }
        
        tg.showAlert(`✅ Опубликовано заявок: ${selectedServices.length}`);
        currentUser.ordersCount = (currentUser.ordersCount || 0) + selectedServices.length;
        
        // Очистка формы
        selectedServices = [];
        document.getElementById('order-address').value = currentUser.address || '';
        document.getElementById('order-description').value = '';
        document.getElementById('order-time').value = '';
        document.getElementById('order-comment').value = '';
        updateSelectedServices();
        
        switchScreen('orders');
    } catch (error) {
        tg.showAlert('❌ Ошибка публикации');
    }
}

async function viewOrder(orderId) {
    try {
        const orders = await fetchAPI('/orders/client/' + currentUser.id);
        const order = orders.find(o => o.id === orderId);
        
        if (!order) {
            tg.showAlert('Заявка не найдена');
            return;
        }
        
        const detailScreen = document.getElementById('order-detail-screen');
        detailScreen.innerHTML = `
            <div style="padding: 16px;">
                <button class="back-btn" onclick="closeOrderDetail()">← Назад</button>
                <h2 style="margin: 16px 0;">${order.service}</h2>
                <div class="order-price">${order.price}</div>
                <div class="order-details" style="margin: 16px 0;">
                    <p>📍 ${order.address}</p>
                    <p>📝 ${order.description || 'Нет описания'}</p>
                    <p>🕐 ${order.desiredTime || 'Не указано'}</p>
                    <p>💬 ${order.comment || 'Нет комментария'}</p>
                </div>
                
                ${order.electricianId ? `
                    <button class="btn btn-primary btn-block" onclick="openChat('${order.id}')">
                        💬 Чат с исполнителем
                    </button>
                ` : ''}
                
                ${order.status === 'active' ? `
                    <button class="btn btn-danger btn-block" onclick="cancelOrder('${order.id}')">
                        ❌ Отменить заявку
                    </button>
                ` : ''}
            </div>
        `;
        
        detailScreen.classList.add('active');
        document.getElementById('main-screen').style.display = 'none';
    } catch (error) {
        tg.showAlert('Ошибка загрузки заявки');
    }
}

function closeOrderDetail() {
    document.getElementById('order-detail-screen').classList.remove('active');
    document.getElementById('main-screen').style.display = 'block';
    loadOrdersList();
}

async function cancelOrder(orderId) {
    try {
        await fetchAPI('/orders/' + orderId, {
            method: 'PUT',
            body: JSON.stringify({ status: 'cancelled' })
        });
        
        tg.showAlert('✅ Заявка отменена');
        closeOrderDetail();
    } catch (error) {
        tg.showAlert('❌ Ошибка отмены');
    }
}

// Электрик
function showElectricianPanel() {
    const screen = document.getElementById('main-screen');
    screen.innerHTML = `
        <div id="electrician-profile-screen" class="screen active">
            ${renderElectricianProfile()}
        </div>
        <div id="available-orders-screen" class="screen">
            ${renderAvailableOrders()}
        </div>
        <div id="my-jobs-screen" class="screen">
            ${renderMyJobs()}
        </div>
        
        <div class="bottom-nav">
            <button class="nav-item active" onclick="switchElectricianScreen('electrician-profile')">
                <span class="nav-item-icon">👤</span>
                Профиль
            </button>
            <button class="nav-item" onclick="switchElectricianScreen('available-orders')">
                <span class="nav-item-icon">📋</span>
                Заявки
            </button>
            <button class="nav-item" onclick="switchElectricianScreen('my-jobs')">
                <span class="nav-item-icon">🔧</span>
                Объекты
            </button>
        </div>
    `;
    
    loadAvailableOrders();
}

function switchElectricianScreen(screenName) {
    document.querySelectorAll('#main-screen .screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenName + '-screen').classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event?.target?.closest('.nav-item')?.classList.add('active');
    
    if (screenName === 'available-orders') loadAvailableOrders();
    if (screenName === 'my-jobs') loadMyJobs();
}

function renderElectricianProfile() {
    return `
        <div class="profile-header">
            <div class="profile-avatar">${currentUser.firstName ? currentUser.firstName[0] : '?'}</div>
            <h2>${currentUser.firstName || ''} ${currentUser.lastName || ''}</h2>
            <span class="profile-role-badge">👨‍🔧 Электрик</span>
        </div>
        
        <div class="profile-stats">
            <div class="stat-item">
                <div class="stat-value">${currentUser.rating || 0} ⭐</div>
                <div class="stat-label">Рейтинг</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${currentUser.completedOrders || 0}</div>
                <div class="stat-label">Выполнено</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${currentUser.reviewsCount || 0}</div>
                <div class="stat-label">Отзывов</div>
            </div>
        </div>
        
        <div class="profile-info">
            <div class="profile-info-item">
                <span class="profile-info-icon">📱</span>
                <span class="profile-info-text">${currentUser.phone || 'Не указан'}</span>
            </div>
            <div class="profile-info-item">
                <span class="profile-info-icon">📍</span>
                <span class="profile-info-text">${currentUser.region || 'Не указан'}</span>
            </div>
        </div>
    `;
}

function renderAvailableOrders() {
    return `
        <h2><span class="icon">📋</span> Доступные заявки</h2>
        <div id="available-orders-container">Загрузка...</div>
    `;
}

async function loadAvailableOrders() {
    const container = document.getElementById('available-orders-container');
    if (!container) return;
    
    try {
        const orders = await fetchAPI('/orders/available');
        
        container.innerHTML = orders.length === 0
            ? '<div class="empty-state"><div class="icon">📭</div><p>Нет доступных заявок</p></div>'
            : orders.map(order => `
                <div class="order-card">
                    <h3>${order.service}</h3>
                    <div class="order-price">${order.price}</div>
                    <div class="order-details">
                        <p>📍 ${order.address}</p>
                        <p>📝 ${order.description || 'Нет описания'}</p>
                        <p>🕐 ${order.desiredTime || 'Не указано'}</p>
                        <p>📅 ${new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button class="btn btn-primary btn-block" onclick="respondToOrder('${order.id}')">
                        ✅ Откликнуться
                    </button>
                </div>
            `).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Ошибка загрузки</p></div>';
    }
}

async function respondToOrder(orderId) {
    try {
        await fetchAPI('/orders/' + orderId, {
            method: 'PUT',
            body: JSON.stringify({
                electricianId: currentUser.id,
                electricianName: currentUser.firstName
            })
        });
        
        tg.showAlert('✅ Вы откликнулись на заявку!');
        loadAvailableOrders();
    } catch (error) {
        tg.showAlert('❌ Ошибка отклика');
    }
}

function renderMyJobs() {
    return `
        <h2><span class="icon">🔧</span> Мои объекты</h2>
        
        <div class="tabs">
            <button class="tab active" onclick="filterMyJobs('active', this)">Активные</button>
            <button class="tab" onclick="filterMyJobs('completed', this)">Завершенные</button>
        </div>
        
        <div id="my-jobs-container">Загрузка...</div>
    `;
}

async function loadMyJobs(status = 'active') {
    const container = document.getElementById('my-jobs-container');
    if (!container) return;
    
    try {
        const orders = await fetchAPI('/orders/electrician/' + currentUser.id);
        const filteredOrders = orders.filter(o => 
            status === 'active' ? o.status === 'active' : o.status === 'completed'
        );
        
        container.innerHTML = filteredOrders.length === 0
            ? '<div class="empty-state"><div class="icon">📭</div><p>Нет объектов</p></div>'
            : filteredOrders.map(order => `
                <div class="order-card">
                    <h3>${order.service}</h3>
                    <div class="order-price">${order.price}</div>
                    <div class="order-details">
                        <p>📍 ${order.address}</p>
                        <p>📝 ${order.description || 'Нет описания'}</p>
                    </div>
                    <button class="btn btn-primary btn-block" onclick="openChat('${order.id}')">
                        💬 Чат с клиентом
                    </button>
                    ${order.status === 'active' ? `
                        <button class="btn btn-success btn-block" onclick="completeJob('${order.id}')">
                            ✅ Завершить работу
                        </button>
                    ` : ''}
                </div>
            `).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Ошибка загрузки</p></div>';
    }
}

function filterMyJobs(status, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    loadMyJobs(status);
}

async function completeJob(orderId) {
    try {
        await fetchAPI('/orders/' + orderId, {
            method: 'PUT',
            body: JSON.stringify({ status: 'completed' })
        });
        
        currentUser.completedOrders = (currentUser.completedOrders || 0) + 1;
        tg.showAlert('✅ Работа завершена!');
        loadMyJobs();
    } catch (error) {
        tg.showAlert('❌ Ошибка');
    }
}

// Чат
async function openChat(orderId) {
    currentOrderId = orderId;
    const chatScreen = document.getElementById('chat-screen');
    chatScreen.innerHTML = `
        <div class="chat-container">
            <div class="chat-header">
                <button class="back-btn" onclick="closeChat()">← Назад</button>
                <span style="font-weight: 600;">Чат по заявке</span>
            </div>
            <div class="chat-messages" id="chat-messages">Загрузка...</div>
            <div class="chat-input">
                <input type="text" id="message-input" placeholder="Сообщение..." 
                       onkeypress="if(event.key==='Enter')sendMessage()">
                <button class="chat-send-btn" onclick="sendMessage()">➤</button>
            </div>
        </div>
    `;
    
    chatScreen.classList.add('active');
    document.getElementById('main-screen').style.display = 'none';
    
    await loadMessages();
    chatInterval = setInterval(loadMessages, 3000);
}

function closeChat() {
    if (chatInterval) clearInterval(chatInterval);
    document.getElementById('chat-screen').classList.remove('active');
    document.getElementById('main-screen').style.display = 'block';
}

async function loadMessages() {
    if (!currentOrderId) return;
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    try {
        const messages = await fetchAPI('/messages/' + currentOrderId);
        container.innerHTML = messages.length === 0 
            ? '<div class="empty-state"><p>Нет сообщений</p></div>'
            : messages.map(msg => `
                <div class="message ${msg.senderId === currentUser.id ? 'sent' : 'received'}">
                    <div>${msg.text}</div>
                    <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString()}</div>
                </div>
            `).join('');
        container.scrollTop = container.scrollHeight;
    } catch (error) {}
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    
    try {
        const orders = await fetchAPI('/orders/client/' + currentUser.id);
        const myOrders = await fetchAPI('/orders/electrician/' + currentUser.id);
        const allOrders = [...orders, ...myOrders];
        const order = allOrders.find(o => o.id === currentOrderId);
        
        if (!order) return;
        
        const receiverId = currentUser.id === order.clientId ? order.electricianId : order.clientId;
        
        await fetchAPI('/messages', {
            method: 'POST',
            body: JSON.stringify({
                orderId: currentOrderId,
                senderId: currentUser.id,
                receiverId: receiverId,
                text: text
            })
        });
        
        input.value = '';
        await loadMessages();
    } catch (error) {
        tg.showAlert('Ошибка отправки');
    }
}

// Админ
function showAdminPanel() {
    const screen = document.getElementById('main-screen');
    screen.innerHTML = `
        <div class="screen active" style="padding: 16px;">
            <h2><span class="icon">👑</span> Панель администратора</h2>
            
            <div style="display: grid; gap: 12px; margin: 20px 0;">
                <button class="btn btn-primary btn-block" onclick="loadAdminSection('users')">
                    👥 Пользователи
                </button>
                <button class="btn btn-primary btn-block" onclick="loadAdminSection('orders')">
                    📋 Заявки
                </button>
                <button class="btn btn-primary btn-block" onclick="loadAdminSection('stats')">
                    📊 Статистика
                </button>
            </div>
            
            <div id="admin-content"></div>
        </div>
    `;
}

async function loadAdminSection(section) {
    const content = document.getElementById('admin-content');
    if (!content) return;
    
    switch(section) {
        case 'users':
            try {
                const users = await fetchAPI('/admin/users');
                content.innerHTML = `
                    <div class="admin-section">
                        <h3>👥 Пользователи (${users.length})</h3>
                        ${users.map(u => `
                            <div class="admin-card">
                                <p><strong>${u.firstName} ${u.lastName || ''}</strong></p>
                                <p>📱 ${u.phone || 'Нет'}</p>
                                <p>📍 ${u.region || 'Нет'}</p>
                                <p>Роль: ${u.role === 'electrician' ? '👨‍🔧 Электрик' : u.role === 'admin' ? '👑 Админ' : '👤 Клиент'}</p>
                                <button class="btn btn-danger btn-block" onclick="deleteUserById('${u.id}')">Удалить</button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } catch (error) {
                content.innerHTML = '<p>Ошибка загрузки</p>';
            }
            break;
            
        case 'orders':
            try {
                const orders = await fetchAPI('/admin/orders');
                content.innerHTML = `
                    <div class="admin-section">
                        <h3>📋 Заявки (${orders.length})</h3>
                        ${orders.map(o => `
                            <div class="admin-card">
                                <h4>${o.service}</h4>
                                <p>💰 ${o.price}</p>
                                <p>Статус: ${o.status}</p>
                                <p>📍 ${o.address}</p>
                                <p>Исполнитель: ${o.electricianId || 'Не назначен'}</p>
                                <button class="btn btn-danger btn-block" onclick="deleteOrderById('${o.id}')">Удалить</button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } catch (error) {
                content.innerHTML = '<p>Ошибка загрузки</p>';
            }
            break;
            
        case 'stats':
            try {
                const [users, orders] = await Promise.all([
                    fetchAPI('/admin/users'),
                    fetchAPI('/admin/orders')
                ]);
                
                const clients = users.filter(u => u.role === 'client').length;
                const electricians = users.filter(u => u.role === 'electrician').length;
                const activeOrders = orders.filter(o => o.status === 'active').length;
                
                content.innerHTML = `
                    <div class="admin-section">
                        <h3>📊 Статистика</h3>
                        <div class="profile-stats">
                            <div class="stat-item">
                                <div class="stat-value">${clients}</div>
                                <div class="stat-label">Клиентов</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${electricians}</div>
                                <div class="stat-label">Электриков</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${orders.length}</div>
                                <div class="stat-label">Всего заявок</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value">${activeOrders}</div>
                                <div class="stat-label">Активных</div>
                            </div>
                        </div>
                    </div>
                `;
            } catch (error) {
                content.innerHTML = '<p>Ошибка загрузки</p>';
            }
            break;
    }
}

async function deleteUserById(id) {
    try {
        await fetchAPI('/user/' + id, { method: 'DELETE' });
        showToast('✅ Пользователь удален');
        loadAdminSection('users');
    } catch (error) {
        showToast('❌ Ошибка удаления');
    }
}

async function deleteOrderById(id) {
    try {
        await fetchAPI('/orders/' + id, { method: 'DELETE' });
        showToast('✅ Заявка удалена');
        loadAdminSection('orders');
    } catch (error) {
        showToast('❌ Ошибка удаления');
    }
}

function editProfile() {
    const newName = prompt('Введите новое имя:', currentUser.firstName);
    if (newName && newName !== currentUser.firstName) {
        fetchAPI('/user/' + currentUser.id, {
            method: 'PUT',
            body: JSON.stringify({ firstName: newName })
        }).then(() => {
            currentUser.firstName = newName;
            refreshProfile();
            showToast('✅ Имя обновлено');
        });
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', initApp);
