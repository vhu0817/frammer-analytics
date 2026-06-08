FROM node:20-alpine

WORKDIR /app

# install deps first (cached unless package.json changes)
COPY package.json package-lock.json* ./
RUN npm install

# copy everything else
COPY . .

# vite dev server — 5173 is the default port
EXPOSE 5173
CMD ["npm", "run", "dev"]
