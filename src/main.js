import './assets/main.css'

import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'

// 添加全局样式
import './assets/global.css'

// 创建应用实例
const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 添加全局错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue全局错误:', err)
  console.error('错误组件:', vm)
  console.error('错误信息:', info)
}

// 使用Element Plus
app.use(ElementPlus)

// 挂载应用
app.mount('#app')

console.log('应用已初始化完成')
