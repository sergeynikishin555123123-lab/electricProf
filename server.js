require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Инициализация хранилища
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const files = ['users', 'orders', 'messages', 'reviews'];
files.forEach(file => {
  const filePath = path.join(dataDir, `${file}.json`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf8');
  }
});

const pendingPhones = {};
const pendingRoles = {};
const userStates = {};

function readData(filename) {
  try {
    const filePath = path.join(dataDir, `${filename}.json`);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Ошибка чтения ${filename}:`, error);
    return [];
  }
}

function writeData(filename, data) {
  try {
    const filePath = path.join(dataDir, `${filename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Ошибка записи ${filename}:`, error);
    return false;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getUserById(id) {
  const users = readData('users');
  return users.find(u => u.id === id || u.id.toString() === id.toString());
}

function createUser(userData) {
  const users = readData('users');
  
  // Проверяем существующего пользователя
  const existingUser = users.find(u => u.id === userData.id);
  
  if (existingUser) {
    // Если роль изменилась - обновляем
    if (userData.role && existingUser.role !== userData.role) {
      console.log(`🔄 Обновление роли пользователя ${existingUser.firstName}: ${existingUser.role} → ${userData.role}`);
      existingUser.role = userData.role;
      existingUser.updatedAt = new Date().toISOString();
      writeData('users', users);
    }
    return existingUser;
  }

  // Проверяем, не была ли уже назначена роль через /prof
  const pendingRole = pendingRoles[userData.id];
  
  const newUser = {
    ...userData,
    role: pendingRole || userData.role || 'client',
    rating: 0,
    reviewsCount: 0,
    ordersCount: 0,
    completedOrders: 0,
    address: userData.address || '',
    photoUrl: userData.photoUrl || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.push(newUser);
  writeData('users', users);
  
  // Очищаем pendingRole
  if (pendingRoles[userData.id]) {
    delete pendingRoles[userData.id];
  }
  
  console.log(`✅ Новый пользователь: ${newUser.firstName} (роль: ${newUser.role})`);
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
    electricianName: null,
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
  notifyElectricians(newOrder);
  return newOrder;
}

function updateOrder(id, updates) {
  const orders = readData('orders');
  const index = orders.findIndex(o => o.id === id);
  if (index === -1) throw new Error('Заказ не найден');
  
  if (updates.status === 'completed') {
    updates.completedAt = new Date().toISOString();
  }
  
  orders[index] = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
  writeData('orders', orders);
  
  if (updates.status === 'completed' && global.bot) {
    const order = orders[index];
    global.bot.sendMessage(order.clientId, 
      `✅ Ваша заявка "${order.service}" выполнена!\n📍 ${order.address}\n💰 ${order.price}\n\nОставьте отзыв о работе электрика.`
    ).catch(err => console.error('Ошибка уведомления:', err.message));
  }
  
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
  
  if (global.bot && messageData.receiverId) {
    global.bot.sendMessage(messageData.receiverId, 
      `💬 Новое сообщение по заявке\n📝 ${messageData.text.substring(0, 100)}`
    ).catch(() => {});
  }
  
  return newMessage;
}

function getMessagesByOrder(orderId) {
  const messages = readData('messages');
  return messages
    .filter(m => m.orderId === orderId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
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
  
  const userReviews = reviews.filter(r => r.targetId === reviewData.targetId);
  const avgRating = userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length;
  updateUser(reviewData.targetId, { 
    rating: Math.round(avgRating * 10) / 10, 
    reviewsCount: userReviews.length 
  });
  
  return newReview;
}

function notifyElectricians(order) {
  if (!global.bot) return;
  
  const users = readData('users');
  const electricians = users.filter(u => u.role === 'electrician');
  
  electricians.forEach(electrician => {
    global.bot.sendMessage(electrician.id, 
      `🔌 Новая заявка!\n\n📍 ${order.address}\n🔧 ${order.service}\n💰 ${order.price}\n\nОткройте приложение, чтобы откликнуться!`
    ).catch(() => {});
  });
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API маршруты
app.get('/api/user/:id', (req, res) => {
  try {
    const user = getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    
    // Возвращаем пользователя с актуальной ролью
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
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/orders/:id', (req, res) => {
  try {
    const order = updateOrder(req.params.id, req.body);
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

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    botActive: !!global.bot,
    users: readData('users').length
  });
});

// Запуск бота
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;

if (token) {
  const bot = new TelegramBot(token, { 
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10
      }
    }
  });
  
  global.bot = bot;
  
  bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
    if (error.message.includes('EFATAL')) {
      console.log('Restarting polling...');
      setTimeout(() => {
        bot.stopPolling().then(() => bot.startPolling()).catch(() => {});
      }, 5000);
    }
  });

  // /start - РЕГИСТРАЦИЯ КЛИЕНТА
  bot.onText(/\/start/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      console.log(`/start от пользователя ${userId}`);
      
      // Очищаем pending роль - /start всегда регистрирует как клиента
      delete pendingRoles[userId];
      
      const existingUser = getUserById(userId);
      
      if (existingUser) {
        // Пользователь уже существует - показываем его актуальную роль
        const webAppUrl = process.env.PUBLIC_URL || `https://${process.env.APP_DOMAIN || 'localhost:3000'}`;
        
        // Если был электриком, но нажал /start - предупреждаем
        if (existingUser.role === 'electrician') {
          await bot.sendMessage(chatId, 
            `⚠️ Вы зарегистрированы как электрик!\n\n` +
            `Для клиентского интерфейса используйте другого пользователя или удалите текущую регистрацию.`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '📱 Открыть приложение', web_app: { url: webAppUrl } }
                ]]
              }
            }
          );
          return;
        }
        
        await bot.sendMessage(chatId, 
          `👋 С возвращением, ${existingUser.firstName}!\n\n` +
          `📱 Телефон: ${existingUser.phone}\n` +
          `📍 Регион: ${existingUser.region}\n` +
          `👤 Роль: ${existingUser.role === 'electrician' ? '👨‍🔧 Электрик' : existingUser.role === 'admin' ? '👑 Админ' : '👤 Клиент'}`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📱 Открыть приложение', web_app: { url: webAppUrl } }
              ]]
            }
          }
        );
      } else {
        // Новая регистрация как клиент
        await bot.sendMessage(chatId, 
          '👋 Добро пожаловать в сервис поиска электриков!\n\n' +
          'Для начала работы необходимо зарегистрироваться.\n' +
          'Нажмите кнопку ниже чтобы начать.',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📝 Начать регистрацию', callback_data: 'start_registration' }
              ]]
            }
          }
        );
      }
    } catch (error) {
      console.error('Ошибка в /start:', error);
    }
  });

  // /prof - РЕГИСТРАЦИЯ ЭЛЕКТРИКА
  bot.onText(/\/prof/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      console.log(`/prof от пользователя ${userId}`);
      
      const existingUser = getUserById(userId);
      
      // Если уже зарегистрирован как электрик
      if (existingUser && existingUser.role === 'electrician') {
        const webAppUrl = process.env.PUBLIC_URL || `https://${process.env.APP_DOMAIN || 'localhost:3000'}`;
        await bot.sendMessage(chatId, 
          `👨‍🔧 Вы уже зарегистрированы как исполнитель!\n\n` +
          `Имя: ${existingUser.firstName}\n` +
          `Телефон: ${existingUser.phone}\n` +
          `Регион: ${existingUser.region}`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📱 Открыть приложение', web_app: { url: webAppUrl } }
              ]]
            }
          }
        );
        return;
      }
      
      // Если был клиентом - обновим роль
      if (existingUser && existingUser.role === 'client') {
        await bot.sendMessage(chatId, 
          '🔄 Вы уже зарегистрированы как клиент.\n' +
          'Сейчас обновим вашу роль на электрика.\n\n' +
          'Поделитесь номером телефона для подтверждения:',
          {
            reply_markup: {
              keyboard: [[
                { text: '📱 Отправить номер телефона', request_contact: true }
              ]],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          }
        );
        
        pendingRoles[userId] = 'electrician';
        return;
      }
      
      // Новая регистрация как электрик
      pendingRoles[userId] = 'electrician';
      
      await bot.sendMessage(chatId, 
        '👨‍🔧 Регистрация исполнителя\n\n' +
        'Поделитесь номером телефона:',
        {
          reply_markup: {
            keyboard: [[
              { text: '📱 Отправить номер телефона', request_contact: true }
            ]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    } catch (error) {
      console.error('Ошибка в /prof:', error);
    }
  });

  // /admin
  bot.onText(/\/admin/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const adminId = parseInt(process.env.ADMIN_ID);
      
      if (userId !== adminId) {
        await bot.sendMessage(chatId, '⛔ Доступ запрещен. Только для администратора.');
        return;
      }
      
      const webAppUrl = process.env.PUBLIC_URL || `https://${process.env.APP_DOMAIN || 'localhost:3000'}`;
      
      await bot.sendMessage(chatId, '👑 Панель администратора', {
        reply_markup: {
          inline_keyboard: [[
            { text: '📊 Открыть панель', web_app: { url: `${webAppUrl}?admin=true` } }
          ]]
        }
      });
    } catch (error) {
      console.error('Ошибка в /admin:', error);
    }
  });

  // Обработка callback_query
  bot.on('callback_query', async (query) => {
    try {
      const chatId = query.message.chat.id;
      const userId = query.from.id;
      const data = query.data;
      
      await bot.answerCallbackQuery(query.id);
      
      if (data === 'start_registration') {
        await bot.sendMessage(chatId, 
          '📱 Пожалуйста, поделитесь номером телефона.\n\n' +
          'Нажмите кнопку "Отправить номер" ниже.\n' +
          'Если кнопка не работает, просто напишите номер в чат.',
          {
            reply_markup: {
              keyboard: [[
                { text: '📱 Отправить номер телефона', request_contact: true }
              ]],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          }
        );
      }
      
      if (data && data.startsWith('region_')) {
        const region = data.replace('region_', '');
        const regionNames = {
          'zelenograd': 'Зеленоград',
          'andreevka': 'Андреевка',
          'goluboe': 'Голубое'
        };
        
        const phone = pendingPhones[userId];
        
        if (!phone) {
          await bot.sendMessage(chatId, '❌ Ошибка: номер телефона не найден. Начните заново: /start или /prof');
          return;
        }
        
        // Получаем роль из pending или используем client по умолчанию
        const role = pendingRoles[userId] || 'client';
        
        const userData = {
          id: userId,
          firstName: query.from.first_name,
          lastName: query.from.last_name || '',
          username: query.from.username || '',
          phone: phone,
          region: regionNames[region] || region,
          role: role
        };
        
        const user = createUser(userData);
        
        const webAppUrl = process.env.PUBLIC_URL || `https://${process.env.APP_DOMAIN || 'localhost:3000'}`;
        
        await bot.sendMessage(chatId, 
          '✅ Регистрация успешно завершена!\n\n' +
          `👤 Имя: ${user.firstName} ${user.lastName}\n` +
          `📱 Телефон: ${user.phone}\n` +
          `📍 Регион: ${user.region}\n` +
          `👤 Роль: ${user.role === 'electrician' ? '👨‍🔧 Электрик' : '👤 Клиент'}\n\n` +
          `Теперь вы можете пользоваться приложением:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📱 Открыть приложение', web_app: { url: webAppUrl } }
              ]],
              remove_keyboard: true
            }
          }
        );
        
        // Очищаем временные данные
        delete pendingPhones[userId];
        delete pendingRoles[userId];
        
        console.log(`✅ Пользователь ${userId} зарегистрирован как ${user.role}`);
      }
    } catch (error) {
      console.error('Ошибка в callback_query:', error);
    }
  });

  // Получение контакта
  bot.on('contact', async (msg) => {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      if (msg.contact && msg.contact.phone_number) {
        pendingPhones[userId] = msg.contact.phone_number;
        
        console.log(`📱 Получен телефон от ${userId}: ${msg.contact.phone_number}, роль: ${pendingRoles[userId] || 'client'}`);
        
        await bot.sendMessage(chatId, '📍 Выберите ваш регион:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏙️ Зеленоград', callback_data: 'region_zelenograd' }],
              [{ text: '🏘️ Андреевка', callback_data: 'region_andreevka' }],
              [{ text: '🌊 Голубое', callback_data: 'region_goluboe' }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('Ошибка в contact:', error);
    }
  });

  // Обработка текстовых сообщений (ручной ввод телефона)
  bot.on('message', async (msg) => {
    try {
      if (msg.text && msg.text.startsWith('/')) return;
      if (msg.contact) return;
      
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;
      
      if (text && /^[\+]?[0-9]{10,12}$/.test(text.replace(/[\s\(\)\-]/g, ''))) {
        pendingPhones[userId] = text.replace(/[\s\(\)\-]/g, '');
        
        console.log(`📱 Получен телефон (текст) от ${userId}, роль: ${pendingRoles[userId] || 'client'}`);
        
        await bot.sendMessage(chatId, '📍 Выберите ваш регион:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏙️ Зеленоград', callback_data: 'region_zelenograd' }],
              [{ text: '🏘️ Андреевка', callback_data: 'region_andreevka' }],
              [{ text: '🌊 Голубое', callback_data: 'region_goluboe' }]
            ],
            remove_keyboard: true
          }
        });
      }
    } catch (error) {
      console.error('Ошибка в message:', error);
    }
  });

  console.log('✅ Telegram бот успешно запущен');
} else {
  console.warn('⚠️ TELEGRAM_BOT_TOKEN не указан');
}

process.on('uncaughtException', (error) => {
  console.error('Неотловленная ошибка:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Необработанный Promise:', error);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 WebApp: http://localhost:${PORT}`);
});
