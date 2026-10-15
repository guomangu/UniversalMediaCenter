FROM docker.io/node:20-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg python3 py3-pip \
    && pip install --break-system-packages guessit

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
