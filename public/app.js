// Инициализация Telegram Mini App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Глобальные переменные
let currentUser = null;
let userRole = 'client';
let currentScreen = 'profile';
let selectedService = null;
let currentOrderId = null;
let chatInterval = null;

// API URL
const API_BASE = window.location.origin + '/api';

// Сервисы электрика с ценами
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

// Инициализация приложения
async function initApp() {
    try {
        const initData = tg.initDataUnsafe;
        
        if (initData && initData.user) {
            const userId = initData.user.id;
            currentUser = await fetchAPI(`/user/${userId}`);
            
            if (!currentUser) {
                showError('Пользователь не найден. Зарегистрируйтесь через бота.');
                return;
            }
            
            userRole = currentUser.role;
            document.getElementById('app').innerHTML = renderApp();
            
            if (window.location.search.includes('admin=true') && userRole === 'admin') {
                showAdminPanel();
            } else if (userRole === 'electrician') {
                showElectricianPanel();
            } else {
                showClientPanel();
            }
        } else {
            showError('Ошибка инициализации. Откройте приложение через Telegram.');
        }
    } catch (error) {
        showError('Ошибка загрузки: ' + error.message);
    }
}

function showError(message) {
    document.getElementById('app').innerHTML = `
        <div class="loading-screen">
            <p style="color: red; text-align: center; padding: 20px;">${message}</p>
        </div>
    `;
}

// API запросы
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(API_BASE + endpoint, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Рендер основного приложения
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
                <span class="nav-item-icon">➕</span>
                Создать
            </button>
            <button class="nav-item" onclick="switchScreen('orders')">
                <span class="nav-item-icon">📋</span>
                Заявки
            </button>
        </div>
    `;
    
    switchScreen('profile');
    loadProfileData();
}

function switchScreen(screenName) {
    document.querySelectorAll('#main-screen .screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenName + '-screen').classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event?.target?.closest('.nav-item')?.classList.add('active');
    
    if (screenName === 'orders') loadOrdersList();
}

function renderClientProfile() {
    return `
        <div class="profile-header">
            <div class="profile-avatar">${currentUser.firstName[0]}</div>
            <h2>${currentUser.firstName} ${currentUser.lastName || ''}</h2>
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
            <p>📱 ${currentUser.phone}</p>
            <p>📍 ${currentUser.region}</p>
            <p>🏠 ${currentUser.address || 'Не указан'}</p>
        </div>
        
        <button class="btn btn-primary btn-block" onclick="editProfile()">
            ✏️ Изменить данные
        </button>
    `;
}

function renderCreateOrder() {
    const categories = [...new Set(SERVICES.map(s => s.category))];
    const serviceOptions = SERVICES.map(s => 
        `<option value="${s.name}">${s.name} (${s.price})</option>`
    ).join('');
    
    return `
        <h2>📝 Создать заявку</h2>
        
        <div class="form-group">
            <label class="form-label">Услуга</label>
            <select id="service-select" class="form-select" onchange="updateServicePrice()">
                <option value="">Выберите услугу</option>
                ${SERVICES.map(s => 
                    `<option value="${s.name}" data-price="${s.price}">${s.name} (${s.price})</option>`
                ).join('')}
            </select>
        </div>
        
        <div id="service-search" class="form-group" style="display:none;">
            <label class="form-label">Поиск услуги</label>
            <input type="text" class="form-input" placeholder="Начните вводить..." 
                   oninput="searchServices(this.value)">
            <div id="service-results" class="service-list"></div>
        </div>
        
        <div class="form-group">
            <label class="form-label">Адрес</label>
            <input type="text" id="order-address" class="form-input" placeholder="Улица, дом, квартира">
        </div>
        
        <div class="form-group">
            <label class="form-label">Описание проблемы</label>
            <textarea id="order-description" class="form-textarea" placeholder="Опишите проблему подробнее"></textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">Желаемое время</label>
            <input type="text" id="order-time" class="form-input" placeholder="Например: завтра с 10 до 12">
        </div>
        
        <div class="form-group">
            <label class="form-label">Комментарий</label>
            <textarea id="order-comment" class="form-textarea" placeholder="Дополнительная информация"></textarea>
        </div>
        
        <button class="btn btn-primary btn-block" onclick="publishOrder()">
            📤 Опубликовать заявку
        </button>
    `;
}

function updateServicePrice() {
    const select = document.getElementById('service-select');
    const selectedOption = select.options[select.selectedIndex];
    selectedService = {
        name: select.value,
        price: selectedOption.dataset.price
    };
}

function searchServices(query) {
    const results = SERVICES.filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase())
    );
    
    const container = document.getElementById('service-results');
    container.innerHTML = results.map(s => `
        <div class="service-item ${selectedService?.name === s.name ? 'selected' : ''}" 
             onclick="selectService('${s.name}', '${s.price}')">
            <strong>${s.name}</strong>
            <span style="float: right; color: var(--tg-theme-hint-color)">${s.price}</span>
        </div>
    `).join('');
}

function selectService(name, price) {
    selectedService = { name, price };
    document.getElementById('service-select').value = name;
    document.querySelectorAll('.service-item').forEach(item => {
        item.classList.remove('selected');
        if (item.querySelector('strong').textContent === name) {
            item.classList.add('selected');
        }
    });
}

function renderOrdersList() {
    return `
        <h2>📋 Мои заявки</h2>
        
        <div class="tabs">
            <button class="tab active" onclick="filterOrders('active', this)">Активные</button>
            <button class="tab" onclick="filterOrders('completed', this)">Завершенные</button>
        </div>
        
        <div id="orders-container">Загрузка...</div>
    `;
}

async function loadOrdersList(status = 'active') {
    try {
        const orders = await fetchAPI(`/orders/client/${currentUser.id}`);
        const filteredOrders = orders.filter(o => 
            status === 'active' ? o.status === 'active' : o.status === 'completed'
        );
        
        document.getElementById('orders-container').innerHTML = filteredOrders.length === 0 
            ? '<p style="text-align: center; color: var(--tg-theme-hint-color)">Нет заявок</p>'
            : filteredOrders.map(order => `
                <div class="order-card" onclick="viewOrder('${order.id}')">
                    <div class="order-header">
                        <h3>${order.service}</h3>
                        <span class="order-status ${order.status === 'active' ? 'status-active' : 'status-completed'}">
                            ${order.status === 'active' ? 'Активна' : 'Завершена'}
                        </span>
                    </div>
                    <div class="order-price">${order.price}</div>
                    <div class="order-details">
                        <p>📍 ${order.address}</p>
                        <p>🕐 ${order.desiredTime}</p>
                        <p>📅 ${new Date(order.createdAt).toLocaleDateString()}</p>
                        ${order.electricianId ? '<p>👨‍🔧 Исполнитель назначен</p>' : '<p>🔍 Ищем исполнителя</p>'}
                    </div>
                </div>
            `).join('');
    } catch (error) {
        document.getElementById('orders-container').innerHTML = 'Ошибка загрузки';
    }
}

function filterOrders(status, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    loadOrdersList(status);
}

async function publishOrder() {
    const service = document.getElementById('service-select').value;
    const address = document.getElementById('order-address').value;
    const description = document.getElementById('order-description').value;
    const time = document.getElementById('order-time').value;
    const comment = document.getElementById('order-comment').value;
    
    if (!service) {
        tg.showAlert('Выберите услугу');
        return;
    }
    
    if (!address) {
        tg.showAlert('Укажите адрес');
        return;
    }
    
    try {
        const order = await fetchAPI('/orders', {
            method: 'POST',
            body: JSON.stringify({
                clientId: currentUser.id,
                service: service,
                price: selectedService?.price || 'Договорная',
                address: address,
                description: description,
                desiredTime: time,
                comment: comment
            })
        });
        
        tg.showAlert('✅ Заявка опубликована!');
        switchScreen('orders');
        loadOrdersList();
        
        // Обновление счетчика
        currentUser.ordersCount = (currentUser.ordersCount || 0) + 1;
    } catch (error) {
        tg.showAlert('❌ Ошибка публикации');
    }
}

async function viewOrder(orderId) {
    try {
        const orders = await fetchAPI(`/orders/client/${currentUser.id}`);
        const order = orders.find(o => o.id === orderId);
        
        if (!order) return;
        
        const detailScreen = document.getElementById('order-detail-screen');
        detailScreen.innerHTML = `
            <div style="padding: 16px;">
                <button class="btn" onclick="closeOrderDetail()">← Назад</button>
                <h2 style="margin: 16px 0;">${order.service}</h2>
                <div class="order-price">${order.price}</div>
                <p>📍 ${order.address}</p>
                <p>📝 ${order.description}</p>
                <p>🕐 ${order.desiredTime}</p>
                <p>💬 ${order.comment || 'Нет комментария'}</p>
                
                ${order.electricianId ? `
                    <button class="btn btn-primary btn-block" onclick="openChat('${order.id}')">
                        💬 Чат с исполнителем
                    </button>
                ` : `
                    <p style="color: var(--tg-theme-hint-color)">Ожидание исполнителя...</p>
                `}
                
                ${order.status === 'active' ? `
                    <div style="margin-top: 12px;">
                        <button class="btn btn-danger btn-block" onclick="cancelOrder('${order.id}')">
                            ❌ Отменить заявку
                        </button>
                    </div>
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
        await fetchAPI(`/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'cancelled' })
        });
        
        tg.showAlert('✅ Заявка отменена');
        closeOrderDetail();
    } catch (error) {
        tg.showAlert('❌ Ошибка отмены');
    }
}

// Интерфейс электрика
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
    
    if (screenName === 'available-orders') loadAvailableOrders();
    if (screenName === 'my-jobs') loadMyJobs();
}

function renderElectricianProfile() {
    return `
        <div class="profile-header">
            <div class="profile-avatar">${currentUser.firstName[0]}</div>
            <h2>${currentUser.firstName} ${currentUser.lastName || ''}</h2>
            <p>👨‍🔧 Электрик</p>
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
            <p>📱 ${currentUser.phone}</p>
            <p>📍 ${currentUser.region}</p>
        </div>
    `;
}

function renderAvailableOrders() {
    return `
        <h2>📋 Доступные заявки</h2>
        <div id="available-orders-container">Загрузка...</div>
    `;
}

async function loadAvailableOrders() {
    try {
        const orders = await fetchAPI('/orders/available');
        
        document.getElementById('available-orders-container').innerHTML = orders.length === 0
            ? '<p style="text-align: center; color: var(--tg-theme-hint-color)">Нет доступных заявок</p>'
            : orders.map(order => `
                <div class="order-card">
                    <h3>${order.service}</h3>
                    <div class="order-price">${order.price}</div>
                    <div class="order-details">
                        <p>📍 ${order.address}</p>
                        <p>📝 ${order.description}</p>
                        <p>🕐 ${order.desiredTime}</p>
                        <p>📅 ${new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button class="btn btn-primary btn-block" onclick="respondToOrder('${order.id}')">
                        ✅ Откликнуться
                    </button>
                </div>
            `).join('');
    } catch (error) {
        document.getElementById('available-orders-container').innerHTML = 'Ошибка загрузки';
    }
}

async function respondToOrder(orderId) {
    try {
        await fetchAPI(`/orders/${orderId}`, {
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
        <h2>🔧 Мои объекты</h2>
        
        <div class="tabs">
            <button class="tab active" onclick="filterMyJobs('active', this)">Активные</button>
            <button class="tab" onclick="filterMyJobs('completed', this)">Завершенные</button>
        </div>
        
        <div id="my-jobs-container">Загрузка...</div>
    `;
}

async function loadMyJobs(status = 'active') {
    try {
        const orders = await fetchAPI(`/orders/electrician/${currentUser.id}`);
        const filteredOrders = orders.filter(o => 
            status === 'active' ? o.status === 'active' : o.status === 'completed'
        );
        
        document.getElementById('my-jobs-container').innerHTML = filteredOrders.length === 0
            ? '<p style="text-align: center; color: var(--tg-theme-hint-color)">Нет объектов</p>'
            : filteredOrders.map(order => `
                <div class="order-card">
                    <h3>${order.service}</h3>
                    <div class="order-price">${order.price}</div>
                    <p>📍 ${order.address}</p>
                    <p>📝 ${order.description}</p>
                    <button class="btn btn-primary btn-block" onclick="openChat('${order.id}')">
                        💬 Чат с клиентом
                    </button>
                    ${order.status === 'active' ? `
                        <button class="btn btn-danger btn-block" onclick="completeJob('${order.id}')" style="margin-top: 8px;">
                            ✅ Завершить работу
                        </button>
                    ` : ''}
                </div>
            `).join('');
    } catch (error) {
        document.getElementById('my-jobs-container').innerHTML = 'Ошибка загрузки';
    }
}

function filterMyJobs(status, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    loadMyJobs(status);
}

async function completeJob(orderId) {
    try {
        await fetchAPI(`/orders/${orderId}`, {
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
    try {
        currentOrderId = orderId;
        const chatScreen = document.getElementById('chat-screen');
        chatScreen.innerHTML = `
            <div class="chat-container">
                <div style="padding: 8px; border-bottom: 1px solid var(--tg-theme-secondary-bg-color);">
                    <button class="btn" onclick="closeChat()">← Назад</button>
                    <span style="margin-left: 8px;">Чат по заявке</span>
                </div>
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input">
                    <input type="text" id="message-input" placeholder="Сообщение...">
                    <button class="chat-send-btn" onclick="sendMessage()">➤</button>
                </div>
            </div>
        `;
        
        chatScreen.classList.add('active');
        document.getElementById('main-screen').style.display = 'none';
        
        await loadMessages();
        chatInterval = setInterval(loadMessages, 3000);
    } catch (error) {
        tg.showAlert('Ошибка открытия чата');
    }
}

function closeChat() {
    clearInterval(chatInterval);
    document.getElementById('chat-screen').classList.remove('active');
    document.getElementById('main-screen').style.display = 'block';
}

async function loadMessages() {
    if (!currentOrderId) return;
    
    try {
        const messages = await fetchAPI(`/messages/${currentOrderId}`);
        
        document.getElementById('chat-messages').innerHTML = messages.map(msg => `
            <div class="message ${msg.senderId === currentUser.id ? 'sent' : 'received'}">
                <div>${msg.text}</div>
                <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString()}</div>
            </div>
        `).join('');
        
        document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
    } catch (error) {
        console.error('Ошибка загрузки сообщений');
    }
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    try {
        const orders = await fetchAPI(`/orders/client/${currentUser.id}`);
        const myOrders = await fetchAPI(`/orders/electrician/${currentUser.id}`);
        const allOrders = [...orders, ...myOrders];
        const order = allOrders.find(o => o.id === currentOrderId);
        
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

// Админ панель
function showAdminPanel() {
    const screen = document.getElementById('main-screen');
    screen.innerHTML = `
        <div class="screen active">
            <h2>👑 Панель администратора</h2>
            
            <div style="display: grid; gap: 12px; margin: 16px 0;">
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
    
    switch(section) {
        case 'users':
            try {
                const users = await fetchAPI('/admin/users');
                content.innerHTML = `
                    <h3>👥 Пользователи (${users.length})</h3>
                    ${users.map(u => `
                        <div class="order-card">
                            <p><strong>${u.firstName} ${u.lastName || ''}</strong></p>
                            <p>📱 ${u.phone}</p>
                            <p>📍 ${u.region}</p>
                            <p>Роль: ${u.role}</p>
                            <button class="btn btn-danger" onclick="deleteUserById('${u.id}')">Удалить</button>
                        </div>
                    `).join('')}
                `;
            } catch (error) {
                content.innerHTML = 'Ошибка загрузки';
            }
            break;
            
        case 'orders':
            try {
                const orders = await fetchAPI('/admin/orders');
                content.innerHTML = `
                    <h3>📋 Заявки (${orders.length})</h3>
                    ${orders.map(o => `
                        <div class="order-card">
                            <h4>${o.service}</h4>
                            <p>Статус: ${o.status}</p>
                            <p>Клиент: ${o.clientId}</p>
                            <p>Исполнитель: ${o.electricianId || 'Не назначен'}</p>
                            <button class="btn btn-danger" onclick="deleteOrderById('${o.id}')">Удалить</button>
                        </div>
                    `).join('')}
                `;
            } catch (error) {
                content.innerHTML = 'Ошибка загрузки';
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
                            <div class="stat-label">Заявок</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${activeOrders}</div>
                            <div class="stat-label">Активных</div>
                        </div>
                    </div>
                `;
            } catch (error) {
                content.innerHTML = 'Ошибка загрузки';
            }
            break;
    }
}

async function deleteUserById(id) {
    try {
        await fetchAPI(`/user/${id}`, { method: 'DELETE' });
        tg.showAlert('✅ Пользователь удален');
        loadAdminSection('users');
    } catch (error) {
        tg.showAlert('❌ Ошибка удаления');
    }
}

async function deleteOrderById(id) {
    try {
        await fetchAPI(`/orders/${id}`, { method: 'DELETE' });
        tg.showAlert('✅ Заявка удалена');
        loadAdminSection('orders');
    } catch (error) {
        tg.showAlert('❌ Ошибка удаления');
    }
}

function editProfile() {
    const newName = prompt('Введите имя:', currentUser.firstName);
    if (newName) {
        fetchAPI(`/user/${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify({ firstName: newName })
        }).then(() => {
            currentUser.firstName = newName;
            tg.showAlert('✅ Данные обновлены');
            switchScreen('profile');
        });
    }
}

// Запуск приложения
initApp();
