FROM node:14.18.3

WORKDIR /home/src/app

COPY . .

RUN npm install

RUN npm run build

CMD ["node", "build/app.js"]