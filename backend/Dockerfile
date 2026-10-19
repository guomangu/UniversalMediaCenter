FROM docker.io/node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-pip python3-setuptools tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng mkvtoolnix \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages guessit pgsrip

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
