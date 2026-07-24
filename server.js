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

// Хранилище временных данных регистрации
const pendingPhones = {};
const pendingRoles = {};
const userStates = {};

// Вспомогательные функции
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
    address: userData.address || '',
    photoUrl: userData.photoUrl || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  users.push(newUser);
  writeData('users', users);
  console.log(`✅ Новый пользователь: ${newUser.firstName} (${newUser.role})`);
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
  
  // Уведомление электрикам
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
  
  // Уведомление клиенту о завершении
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
  
  // Уведомление
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
  
  // Обновление рейтинга
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
      `🔌 Новая заявка!\n\n` +
      `📍 ${order.address}\n` +
      `🔧 ${order.service}\n` +
      `💰 ${order.price}\n\n` +
      `Откройте приложение, чтобы откликнуться!`
    ).catch(() => {});
  });
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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    botActive: !!global.bot
  });
});

// Запуск бота с защитой от падений
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;

if (token) {
  // Создаем бота с настройками для стабильной работы
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
  
  // Обработка ошибок polling
  bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error.message);
    
    // Перезапуск polling при фатальной ошибке
    if (error.message.includes('EFATAL')) {
      console.log('Перезапуск polling через 5 секунд...');
      setTimeout(() => {
        bot.stopPolling()
          .then(() => bot.startPolling())
          .catch(err => console.error('Ошибка перезапуска:', err));
      }, 5000);
    }
  });
  
  bot.on('error', (error) => {
    console.error('Ошибка бота:', error.message);
  });

  // Команда /start
  bot.onText(/\/start/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      console.log(`Пользователь ${userId} запустил бота`);
      
      const existingUser = getUserById(userId);
      
      if (existingUser) {
        // Пользователь уже зарегистрирован
        const webAppUrl = process.env.PUBLIC_URL || `https://${process.env.APP_DOMAIN || 'localhost:3000'}`;
        
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
        // Новая регистрация
        userStates[userId] = { step: 'start' };
        
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

  // Обработка callback_query (кнопки регионов и т.д.)
  bot.on('callback_query', async (query) => {
    try {
      const chatId = query.message.chat.id;
      const userId = query.from.id;
      const data = query.data;
      
      console.log(`Callback от ${userId}: ${data}`);
      
      // Подтверждаем получение callback
      await bot.answerCallbackQuery(query.id);
      
      if (data === 'start_registration') {
        // Запрашиваем телефон
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
        
        userStates[userId] = { step: 'waiting_phone' };
      }
      
      // Обработка выбора региона
      if (data && data.startsWith('region_')) {
        const region = data.replace('region_', '');
        const regionNames = {
          'zelenograd': 'Зеленоград',
          'andreevka': 'Андреевка',
          'goluboe': 'Голубое'
        };
        
        const phone = pendingPhones[userId];
        
        if (!phone) {
          await bot.sendMessage(chatId, '❌ Ошибка: номер телефона не найден. Начните регистрацию заново: /start');
          return;
        }
        
        const userData = {
          id: userId,
          firstName: query.from.first_name,
          lastName: query.from.last_name || '',
          username: query.from.username || '',
          phone: phone,
          region: regionNames[region] || region,
          role: pendingRoles[userId] || 'client'
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
        delete userStates[userId];
        
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
        userStates[userId] = { step: 'waiting_region' };
        
        console.log(`Получен телефон от ${userId}: ${msg.contact.phone_number}`);
        
        // Показываем выбор региона
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

  // Обработка текстовых сообщений
  bot.on('message', async (msg) => {
    try {
      // Пропускаем команды и контакты
      if (msg.text && msg.text.startsWith('/')) return;
      if (msg.contact) return;
      
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;
      
      // Проверяем состояние пользователя
      const state = userStates[userId];
      
      // Если пользователь в процессе регистрации и отправил текст
      if (state && state.step === 'waiting_phone' && text) {
        // Проверяем что это похоже на телефон
        const phoneRegex = /^[\+]?[0-9]{10,12}$/;
        const cleanPhone = text.replace(/[\s\(\)\-]/g, '');
        
        if (phoneRegex.test(cleanPhone)) {
          pendingPhones[userId] = cleanPhone;
          userStates[userId] = { step: 'waiting_region' };
          
          console.log(`Получен телефон (текстом) от ${userId}: ${cleanPhone}`);
          
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
        } else {
          await bot.sendMessage(chatId, 
            '❌ Неверный формат телефона.\n' +
            'Пожалуйста, отправьте номер в формате: +79001234567\n' +
            'Или нажмите кнопку "Отправить номер телефона"'
          );
        }
      }
    } catch (error) {
      console.error('Ошибка в message:', error);
    }
  });

  // Команда /prof
  bot.onText(/\/prof/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      const existingUser = getUserById(userId);
      if (existingUser && existingUser.role === 'electrician') {
        await bot.sendMessage(chatId, '❌ Вы уже зарегистрированы как исполнитель');
        return;
      }
      
      pendingRoles[userId] = 'electrician';
      userStates[userId] = { step: 'waiting_phone' };
      
      await bot.sendMessage(chatId, 
        '👨‍🔧 Регистрация исполнителя\n\nПоделитесь номером телефона:',
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

  // Команда /admin
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

  console.log('✅ Telegram бот успешно запущен');
} else {
  console.warn('⚠️ TELEGRAM_BOT_TOKEN не указан. Бот не будет работать.');
}

// Запуск сервера
const PORT = process.env.PORT || 3000;

// Добавляем обработку неотловленных ошибок
process.on('uncaughtException', (error) => {
  console.error('Неотловленная ошибка:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Необработанный Promise rejection:', error);
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 WebApp доступен: http://localhost:${PORT}`);
  console.log(`💡 Используйте /start в боте для начала работы`);
});
