FROM node:24-alpine

WORKDIR /app

# Копируем package.json
COPY package*.json ./

# Устанавливаем зависимости напрямую из npm
RUN npm install --production

# Копируем все файлы проекта
COPY . .

# Создаем папку для данных
RUN mkdir -p data

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["node", "server.js"]
