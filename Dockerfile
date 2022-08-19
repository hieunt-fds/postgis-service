FROM node:alpine3.16
RUN mkdir /app
WORKDIR /app
# COPY node_modules/ ./
COPY package.json ./
COPY tsconfig.json ./
COPY ./src ./src
RUN npm install

# dev with nodemon
# RUN npm install nodemon && npm install

# CMD npm run start
CMD npm run dev