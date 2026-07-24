require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Инициализация хранилища
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Инициализация JSON файлов
const files = ['users', 'orders', 'messages', 'reviews'];
files.forEach(file => {
  const filePath = path.join(dataDir, `${file}.json`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf8');
  }
});

// Вспомогательные функции для работы с данными
function readData(filename) {
  const filePath = path.join(dataDir, `${filename}.json`);
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function writeData(filename, data) {
  const filePath = path.join(dataDir, `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Генератор ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// API функции
function getUserById(id) {
  const users = readData('users');
  return users.find(u => u.id === id || u.id.toString() === id.toString());
}

function createUser(userData) {
  const users = readData('users');
  const existingUser = users.find(u => u.id === userData.id);
  if (existingUser) return existingUser;
  
  const newUser = {
    ...userData,
    role: userData.role || 'client',
    rating: 0,
    reviewsCount: 0,
    ordersCount: 0,
    completedOrders: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  users.push(newUser);
  writeData('users', users);
  return newUser;
}

function updateUser(id, updates) {
  const users = readData('users');
  const index = users.findIndex(u => u.id === id || u.id.toString() === id.toString());
  if (index === -1) throw new Error('Пользователь не найден');
  
  users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
  writeData('users', users);
  return users[index];
}

function deleteUser(id) {
  let users = readData('users');
  users = users.filter(u => u.id !== id && u.id.toString() !== id.toString());
  writeData('users', users);
  return true;
}

function createOrder(orderData) {
  const orders = readData('orders');
  const newOrder = {
    id: generateId(),
    clientId: orderData.clientId,
    electricianId: null,
    status: 'active',
    service: orderData.service,
    price: orderData.price || 'Договорная',
    address: orderData.address,
    description: orderData.description,
    desiredTime: orderData.desiredTime || 'В любое время',
    comment: orderData.comment || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null
  };
  
  orders.push(newOrder);
  writeData('orders', orders);
  return newOrder;
}

function updateOrder(id, updates) {
  const orders = readData('orders');
  const index = orders.findIndex(o => o.id === id);
  if (index === -1) throw new Error('Заказ не найден');
  
  orders[index] = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
  writeData('orders', orders);
  return orders[index];
}

function deleteOrder(id) {
  let orders = readData('orders');
  orders = orders.filter(o => o.id !== id);
  writeData('orders', orders);
  return true;
}

function addMessage(messageData) {
  const messages = readData('messages');
  const newMessage = {
    id: generateId(),
    ...messageData,
    read: false,
    createdAt: new Date().toISOString()
  };
  
  messages.push(newMessage);
  writeData('messages', messages);
  return newMessage;
}

function getMessagesByOrder(orderId) {
  const messages = readData('messages');
  return messages.filter(m => m.orderId === orderId).sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );
}

function addReview(reviewData) {
  const reviews = readData('reviews');
  const newReview = {
    id: generateId(),
    ...reviewData,
    createdAt: new Date().toISOString()
  };
  
  reviews.push(newReview);
  writeData('reviews', reviews);
  
  // Обновление рейтинга
  const userReviews = reviews.filter(r => r.targetId === reviewData.targetId);
  const avgRating = userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length;
  updateUser(reviewData.targetId, { rating: Math.round(avgRating * 10) / 10, reviewsCount: userReviews.length });
  
  return newReview;
}

// Создание Express приложения
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API маршруты
app.get('/api/user/:id', (req, res) => {
  try {
    const user = getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const user = createUser(req.body);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/user/:id', (req, res) => {
  try {
    const user = updateUser(req.params.id, req.body);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/user/:id', (req, res) => {
  try {
    deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/client/:clientId', (req, res) => {
  try {
    const orders = readData('orders').filter(o => o.clientId === req.params.clientId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/electrician/:electricianId', (req, res) => {
  try {
    const orders = readData('orders').filter(o => o.electricianId === req.params.electricianId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/available', (req, res) => {
  try {
    const orders = readData('orders').filter(o => o.status === 'active' && !o.electricianId);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const order = createOrder(req.body);
    
    // Уведомление всем электрикам
    const users = readData('users').filter(u => u.role === 'electrician');
    const bot = app.get('bot');
    if (bot) {
      users.forEach(electrician => {
        bot.sendMessage(electrician.id, `🔌 Новая заявка!\n📍 ${order.address}\n🔧 ${order.service}\n💰 ${order.price}₽`)
          .catch(() => {});
      });
    }
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/orders/:id', (req, res) => {
  try {
    const order = updateOrder(req.params.id, req.body);
    
    // Уведомление клиенту о завершении
    if (req.body.status === 'completed') {
      const bot = app.get('bot');
      if (bot) {
        bot.sendMessage(order.clientId, `✅ Ваша заявка "${order.service}" выполнена!\nОставьте отзыв о работе электрика.`)
          .catch(() => {});
      }
    }
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/orders/:id', (req, res) => {
  try {
    deleteOrder(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/:orderId', (req, res) => {
  try {
    const messages = getMessagesByOrder(req.params.orderId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', (req, res) => {
  try {
    const message = addMessage(req.body);
    
    // Уведомление второй стороне
    const order = readData('orders').find(o => o.id === message.orderId);
    if (order) {
      const bot = app.get('bot');
      if (bot) {
        const recipientId = message.senderId === order.clientId ? order.electricianId : order.clientId;
        if (recipientId) {
          bot.sendMessage(recipientId, `💬 Новое сообщение по заявке ${order.service}\n📝 ${message.text}`)
            .catch(() => {});
        }
      }
    }
    
    res.json(message);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/reviews/:userId', (req, res) => {
  try {
    const reviews = readData('reviews').filter(r => r.targetId === req.params.userId);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const review = addReview(req.body);
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/users', (req, res) => {
  try {
    const users = readData('users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/orders', (req, res) => {
  try {
    const orders = readData('orders');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Запуск бота
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;

if (token) {
  const bot = new TelegramBot(token, { polling: true });
  app.set('bot', bot);

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const existingUser = getUserById(userId);
    
    if (existingUser) {
      await bot.sendMessage(chatId, 
        `👋 С возвращением, ${existingUser.firstName}!\n\nРоль: ${existingUser.role === 'electrician' ? '👨‍🔧 Электрик' : existingUser.role === 'admin' ? '👑 Админ' : '👤 Клиент'}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '📱 Открыть приложение', web_app: { url: process.env.PUBLIC_URL || `https://${process.env.APP_DOMAIN}` } }
            ]]
          }
        }
      );
    } else {
      await bot.sendMessage(chatId, '👋 Добро пожаловать! Для начала работы нужна регистрация.', {
        reply_markup: {
          inline_keyboard: [[
            { text: '📝 Начать регистрацию', callback_data: 'start_registration' }
          ]]
        }
      });
    }
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    
    if (query.data === 'start_registration') {
      await bot.sendMessage(chatId, '📱 Поделитесь номером телефона:', {
        reply_markup: {
          keyboard: [[{ text: '📱 Отправить номер', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    }
    
    if (query.data && query.data.startsWith('region_')) {
      const region = query.data.replace('region_', '');
      const regionNames = {
        'zelenograd': 'Зеленоград',
        'andreevka': 'Андреевка',
        'goluboe': 'Голубое'
      };
      
      const userData = {
        id: userId,
        firstName: query.from.first_name,
        lastName: query.from.last_name || '',
        username: query.from.username || '',
        phone: global.pendingPhones?.[userId] || '',
        region: regionNames[region] || region,
        role: global.pendingRoles?.[userId] || 'client'
      };
      
      createUser(userData);
      
      await bot.sendMessage(chatId, '✅ Регистрация завершена!', {
        reply_markup: {
          inline_keyboard: [[
            { text: '📱 Открыть приложение', web_app: { url: process.env.PUBLIC_URL || `https://${process.env.APP_DOMAIN}` } }
          ]],
          remove_keyboard: true
        }
      });
      
      if (global.pendingPhones) delete global.pendingPhones[userId];
      if (global.pendingRoles) delete global.pendingRoles[userId];
    }
  });

  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (msg.contact) {
      if (!global.pendingPhones) global.pendingPhones = {};
      global.pendingPhones[userId] = msg.contact.phone_number;
      
      await bot.sendMessage(chatId, '📍 Выберите регион:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏙️ Зеленоград', callback_data: 'region_zelenograd' }],
            [{ text: '🏘️ Андреевка', callback_data: 'region_andreevka' }],
            [{ text: '🌊 Голубое', callback_data: 'region_goluboe' }]
          ]
        }
      });
    }
  });

  bot.onText(/\/prof/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const existingUser = getUserById(userId);
    if (existingUser && existingUser.role === 'electrician') {
      await bot.sendMessage(chatId, '❌ Вы уже зарегистрированы как исполнитель');
      return;
    }
    
    if (!global.pendingRoles) global.pendingRoles = {};
    global.pendingRoles[userId] = 'electrician';
    
    await bot.sendMessage(chatId, '👨‍🔧 Регистрация исполнителя\nПоделитесь номером:', {
      reply_markup: {
        keyboard: [[{ text: '📱 Отправить номер', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  });

  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const adminId = parseInt(process.env.ADMIN_ID);
    
    if (userId !== adminId) {
      await bot.sendMessage(chatId, '⛔ Доступ запрещен');
      return;
    }
    
    const url = process.env.PUBLIC_URL || `https://${process.env.APP_DOMAIN}`;
    await bot.sendMessage(chatId, '👑 Панель администратора', {
      reply_markup: {
        inline_keyboard: [[
          { text: '📊 Открыть панель', web_app: { url: `${url}?admin=true` } }
        ]]
      }
    });
  });

  console.log('✅ Telegram бот успешно запущен');
} else {
  console.warn('⚠️ TELEGRAM_BOT_TOKEN не указан. Бот не будет работать.');
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 WebApp доступен: http://localhost:${PORT}`);
});
