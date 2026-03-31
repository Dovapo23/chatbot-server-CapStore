# 1. Usamos una versión oficial de Node.js (la misma que tienes)
FROM node:22-slim

# 2. Obligamos al sistema a instalar TODAS las librerías gráficas para Chrome
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libgtk-3-0 libpango-1.0-0 libcairo2 \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# 3. Preparamos tu código
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 4. Exponemos el puerto de tu web y arrancamos el bot
EXPOSE 8080
CMD ["node", "index.js"]
