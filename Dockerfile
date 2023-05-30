FROM node:alpine3.16
RUN mkdir /app
WORKDIR /app
# COPY node_modules/ ./
COPY package.json tsconfig.json ./
RUN npm install
COPY ./src ./src

# dev with nodemon
# RUN npm install nodemon && npm install

# CMD npm run start
CMD npm run dev