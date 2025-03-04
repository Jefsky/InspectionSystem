FROM node:16-alpine

WORKDIR /app

# 复制项目文件
COPY . .

# 安装依赖
RUN npm install

# 构建前端
RUN npm run build

# 暴露端口
EXPOSE 3001 5173

# 启动命令
CMD ["npm", "run", "server"]
