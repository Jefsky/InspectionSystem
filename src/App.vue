<template>
  <div class="container" :class="{ 'dark-mode': isDarkMode }">
    <div class="header">
      <h1>网站检查系统</h1>
      <div class="header-actions">
        <el-button 
          type="primary" 
          :loading="isRefreshingAll" 
          @click="refreshAll"
        >
          {{ isRefreshingAll ? '正在刷新所有...' : '刷新所有' }}
        </el-button>
        
        <!-- 深色模式切换按钮 -->
        <el-button
          circle
          :icon="isDarkMode ? Sunny : Moon"
          @click="toggleDarkMode"
          class="theme-toggle-btn"
          :title="isDarkMode ? '切换到浅色模式' : '切换到深色模式'"
        />
      </div>
    </div>

    <!-- 添加网站表单 -->
    <el-card class="add-website-form" shadow="hover">
      <template #header>
        <div class="form-header">
          <span>添加网站</span>
          <el-button 
            type="primary"
            :loading="isAddingWebsite"
            @click="addWebsite"
          >
            添加
          </el-button>
        </div>
      </template>
      
      <el-form :model="newWebsite" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="域名" prop="domain">
          <el-input 
            v-model="newWebsite.domain" 
            placeholder="例如: www.example.com、http://example.com 或 https://www.example.com"
            @keyup.enter="addWebsite"
          />
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input 
            v-model="newWebsite.title" 
            placeholder="网站标题"
            @keyup.enter="addWebsite"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计卡片 -->
    <statistics-card ref="statsCardRef" class="statistics-card" />

    <!-- 网站列表 -->
    <div class="website-list" v-if="!isLoadingWebsites">
      <div v-if="sortedWebsites && sortedWebsites.length > 0" class="websites-grid">
        <template v-for="website in sortedWebsites" :key="website.id">
          <div v-if="isRefreshingAll" class="skeleton-card">
            <el-skeleton animated>
              <template #template>
                <el-card shadow="hover" class="website-card-skeleton">
                  <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <el-skeleton-item variant="text" style="width: 60%" />
                      <div style="display: flex; gap: 8px;">
                        <el-skeleton-item variant="button" style="width: 32px; height: 32px; border-radius: 50%;" />
                        <el-skeleton-item variant="button" style="width: 32px; height: 32px; border-radius: 50%;" />
                      </div>
                    </div>
                  </template>
                  <el-skeleton-item variant="p" style="width: 100%" />
                  <el-skeleton-item variant="text" style="width: 60%; margin-top: 16px" />
                  <el-skeleton-item variant="text" style="width: 60%; margin-top: 16px" />
                  <div style="background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 4px;">
                    <el-skeleton-item variant="text" style="width: 80%" />
                    <el-skeleton-item variant="text" style="width: 60%; margin-top: 16px" />
                    <el-skeleton-item variant="text" style="width: 60%; margin-top: 16px" />
                  </div>
                  <el-skeleton-item variant="text" style="width: 40%; margin-top: auto" />
                </el-card>
              </template>
            </el-skeleton>
          </div>
          <website-card
            v-else
            :website="website"
            @refresh="refreshWebsite"
            @delete="deleteWebsite"
            @update="handleWebsiteUpdate"
            @toggle-pin="handleTogglePin"
          />
        </template>
      </div>
      <div v-else class="empty-container">
        <el-empty description="暂无网站数据" />
      </div>
    </div>
    
    <!-- 页脚 -->
    <div class="footer">
      <p> {{ new Date().getFullYear() }} <a href="https://www.jefsky.com" target="_blank">Jefsky</a>. </p>
    </div>
  </div>
  
  <!-- 回到顶部按钮 -->
  <el-backtop :right="20" :bottom="20">
    <div class="back-to-top">
      <el-icon><Top /></el-icon>
    </div>
  </el-backtop>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { ElMessage, ElLoading } from 'element-plus'
import WebsiteCard from './components/WebsiteCard.vue'
import StatisticsCard from './components/StatisticsCard.vue'
import { Refresh, Moon, Sunny, Top } from '@element-plus/icons-vue'

// 状态变量
const websites = ref([])
const isRefreshingAll = ref(false)
const isAddingWebsite = ref(false)
const isLoadingWebsites = ref(false)
const formRef = ref(null)
const statsCardRef = ref(null)
const showDebug = ref(true) // 调试模式
const isDarkMode = ref(false) // 深色模式

// 表单数据
const newWebsite = ref({
  domain: '',
  title: ''
})

// 验证规则
const rules = {
  domain: [
    { required: true, message: '请输入域名', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        // 验证域名格式
        const domainPattern = /^(https?:\/\/)?(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+([A-Za-z]{2,})(\:\d+)?(\/.*)?$/;
        if (!domainPattern.test(value)) {
          callback(new Error('请输入有效的域名'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
}

// 计算属性：根据置顶状态和最后检查时间排序网站
const sortedWebsites = computed(() => {
  if (!websites.value || websites.value.length === 0) {
    return [];
  }
  
  return [...websites.value].sort((a, b) => {
    // 首先按照置顶状态排序
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    
    // 然后按照最后检查时间排序（最新的在前面）
    const dateA = new Date(a.lastCheck || 0);
    const dateB = new Date(b.lastCheck || 0);
    return dateB - dateA;
  });
});

// 加载网站数据
const loadWebsites = async () => {
  console.log('加载网站数据...')
  isLoadingWebsites.value = true
  
  try {
    console.log('请求 /websites API')
    // 发送 GET 请求
    const response = await fetch('http://localhost:3001/websites', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json()
    console.log('网站数据:', JSON.stringify(data).substring(0, 100) + '...')
    console.log('数据类型:', typeof data, '数据长度:', data.length)
    
    if (Array.isArray(data)) {
      // 排序网站数据
      const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.lastCheck || 0)
        const dateB = new Date(b.lastCheck || 0)
        return dateB - dateA
      });
      
      // 更新网站数据
      websites.value = sortedData.map(site => ({...site}))
      console.log('更新网站数据成功')
      
      // 等待 DOM 更新
      await nextTick()
      console.log('DOM 更新完成')
      
      // 再次更新网站数据
      if (websites.value.length > 0) {
        const temp = [...websites.value]
        websites.value = []
        await nextTick()
        websites.value = temp
        console.log('再次更新网站数据成功')
      }
    } else {
      console.error('API 返回数据错误')
      websites.value = []
    }

  } catch (error) {
    console.error('加载网站数据失败:', error)
    ElMessage.error(`加载网站数据失败: ${error.message}`)
    websites.value = [] // 重置网站数据
  } finally {
    isLoadingWebsites.value = false
    console.log('加载网站数据完成')
  }
}

const refreshWebsite = async (website) => {
  try {
    console.log(`刷新网站: ${website.domain} (ID: ${website.id})`);
    const response = await fetch(`http://localhost:3001/refresh/${website.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const result = await response.json()
    console.log('刷新结果:', result);
    
    // 更新网站数据
    const index = websites.value.findIndex(w => w.id === website.id)
    if (index !== -1) {
      console.log('更新前的网站数据:', websites.value[index]);
      websites.value[index] = { ...websites.value[index], ...result }
      console.log('更新后的网站数据:', websites.value[index]);
      
      // 显示成功消息
      const websiteName = result.title || result.domain;
      ElMessage.success(`网站 ${websiteName} 刷新成功`);
    }
    
    // 刷新统计数据
    if (statsCardRef.value) {
      console.log('刷新统计卡片数据');
      statsCardRef.value.refreshStats();
    }
    
    return result
  } catch (error) {
    console.error('刷新网站数据失败:', error);
    throw new Error('刷新网站数据失败: ' + error.message);
  }
}

const refreshAll = async () => {
  isRefreshingAll.value = true
  try {
    const response = await fetch('http://localhost:3001/refresh-all', {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('刷新所有网站返回数据:', data)
    
    // 更新网站数据
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach(result => {
        const index = websites.value.findIndex(w => w.id === result.id)
        if (index !== -1) {
          websites.value[index] = { ...websites.value[index], ...result }
        }
      })
      
      ElMessage.success(`成功刷新了 ${data.results.length} 个网站数据`)
    } else if (Array.isArray(data)) {
      // 兼容旧版API
      data.forEach(result => {
        const index = websites.value.findIndex(w => w.id === result.id)
        if (index !== -1) {
          websites.value[index] = { ...websites.value[index], ...result }
        }
      })
      
      ElMessage.success(`成功刷新了 ${data.length} 个网站数据`)
    }
    
    // 如果返回了统计数据，直接更新统计卡片
    if (data.statistics && statsCardRef.value) {
      console.log('使用返回的统计数据更新统计卡片')
      statsCardRef.value.updateStats(data.statistics)
    } else if (statsCardRef.value) {
      // 否则刷新统计数据
      console.log('刷新统计卡片数据')
      statsCardRef.value.refreshStats()
    }
  } catch (error) {
    console.error('刷新所有网站数据失败:', error)
    ElMessage.error('刷新所有网站数据失败: ' + error.message)
  } finally {
    isRefreshingAll.value = false
  }
}

const addWebsite = async () => {
  formRef.value.validate(async (valid) => {
    if (!valid) return
    
    isAddingWebsite.value = true
    
    try {
      console.log('添加网站:', newWebsite.value)
      
      // 处理域名格式
      let domain = newWebsite.value.domain.trim()
      let protocol = 'https'
      
      // 如果域名包含协议前缀，提取出协议和域名
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        const url = new URL(domain)
        protocol = url.protocol.replace(':', '')
        domain = url.hostname
      }
      
      // 发送请求
      const response = await fetch('http://localhost:3001/website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain,
          protocol,
          title: newWebsite.value.title.trim()
        })
      })
      
      if (!response.ok) {
        throw new Error(`添加网站失败: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('添加网站成功:', result)
      
      // 添加到网站列表
      websites.value.push(result)
      
      // 刷新统计数据
      if (statsCardRef.value) {
        console.log('刷新统计卡片数据');
        statsCardRef.value.refreshStats();
      }
      
      // 重置表单
      formRef.value.resetFields()
      ElMessage.success('添加网站成功')
    } catch (error) {
      if (error.message) {
        ElMessage.error(error.message)
      }
    } finally {
      isAddingWebsite.value = false
    }
  })
}

const deleteWebsite = async (website) => {
  try {
    console.log('删除网站:', website.id)
    const response = await fetch(`http://localhost:3001/website/${website.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`删除网站失败: ${response.status}`)
    }
    
    const result = await response.json()
    console.log('删除网站成功:', result)
    
    websites.value = websites.value.filter(w => w.id !== website.id)
    
    // 刷新统计数据
    if (statsCardRef.value) {
      console.log('刷新统计卡片数据');
      statsCardRef.value.refreshStats();
    }
    
    ElMessage.success('删除网站成功')
  } catch (error) {
    console.error('删除网站失败:', error)
    ElMessage.error('删除网站失败: ' + (error.message || '未知错误'))
  }
}

const handleWebsiteUpdate = (updatedWebsite) => {
  console.log('更新网站数据:', updatedWebsite)
  
  try {
    // 更新网站数据
    const index = websites.value.findIndex(site => site.id === updatedWebsite.id)
    if (index !== -1) {
      console.log(`更新网站数据 ${index}:`, websites.value[index], '->', updatedWebsite)
      websites.value[index] = { ...websites.value[index], ...updatedWebsite }
      ElMessage.success('更新网站数据成功')
    } else {
      console.warn('未找到网站数据:', updatedWebsite)
      ElMessage.warning('未找到网站数据')
    }
  } catch (error) {
    console.error('更新网站数据失败:', error)
    ElMessage.error('更新网站数据失败: ' + (error.message || '未知错误'))
  }
}

const handleTogglePin = async (website) => {
  console.log('切换网站置顶状态:', website.domain);
  try {
    const response = await fetch(`http://localhost:3001/websites/${website.id}/toggle-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`切换置顶状态失败: ${response.status}`);
    }

    const updatedWebsite = await response.json();
    console.log('切换置顶状态成功:', updatedWebsite);

    // 更新本地网站数据
    const index = websites.value.findIndex(w => w.id === website.id);
    if (index !== -1) {
      websites.value[index] = { ...websites.value[index], ...updatedWebsite };
      
      // 显示成功消息
      const websiteName = updatedWebsite.title || updatedWebsite.domain;
      const statusText = updatedWebsite.isPinned ? '已置顶' : '已取消置顶';
      ElMessage.success(`网站 ${websiteName} ${statusText}`);
      
      // 刷新统计数据
      if (statsCardRef.value) {
        console.log('刷新统计卡片数据');
        statsCardRef.value.refreshStats();
      }
    }
  } catch (error) {
    console.error('切换置顶状态失败:', error);
    ElMessage.error('切换置顶状态失败: ' + error.message);
  }
}

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
  // 保存用户偏好到本地存储
  localStorage.setItem('darkMode', isDarkMode.value ? 'true' : 'false')
  // 更新文档根元素的类，以便全局CSS可以使用
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark-theme')
    // 添加过渡动画类
    document.documentElement.classList.add('theme-transition')
    // 延迟移除过渡类，防止其他操作也触发过渡
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 1000)
  } else {
    document.documentElement.classList.remove('dark-theme')
    // 添加过渡动画类
    document.documentElement.classList.add('theme-transition')
    // 延迟移除过渡类，防止其他操作也触发过渡
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 1000)
  }
}

// 加载网站数据
onMounted(() => {
  console.log('加载网站数据...')
  loadWebsites()
  
  // 从本地存储加载深色模式偏好
  const savedDarkMode = localStorage.getItem('darkMode')
  if (savedDarkMode === 'true') {
    isDarkMode.value = true
    document.documentElement.classList.add('dark-theme')
  }
})
</script>

<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.container.dark-mode {
  background-color: #121212;
  color: #e0e0e0;
  transition: background-color 0.5s ease, color 0.5s ease;
}

.container.dark-mode .website-grid {
  background-color: #121212;
}

.container.dark-mode .footer {
  color: #b0b3b8;
}

.container.dark-mode .footer a {
  color: #58a6ff;
}

.container.dark-mode .el-empty__description {
  color: #b0b3b8;
}

.container.dark-mode .add-website-form,
.container.dark-mode .statistics-card {
  background-color: #1e1e1e;
  color: #e0e0e0;
  border: 1px solid #333;
}

.container.dark-mode .form-header,
.container.dark-mode .card-header {
  border-bottom: 1px solid #333;
}

.container.dark-mode .el-button--primary {
  background-color: #409EFF;
  border-color: #409EFF;
}

.container.dark-mode .el-button--default {
  background-color: #2c2c2c;
  border-color: #444;
  color: #e0e0e0;
}

.container.dark-mode .el-input__inner {
  background-color: #2c2c2c;
  color: #e0e0e0;
  border-color: #444;
}

.container.dark-mode .el-form-item__label {
  color: #e0e0e0;
}

/* 添加过渡效果 */
.container, 
.header, 
.add-website-form, 
.statistics-card, 
.website-grid, 
.footer,
.el-button,
.el-input,
.el-form-item,
.el-card {
  transition: all 0.5s ease;
}

.theme-transition {
  transition: all 1s ease;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.add-website-form {
  margin-bottom: 20px;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.website-list {
  margin-top: 20px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.websites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.empty-container {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.skeleton-card {
  min-height: 200px;
}

.website-card-skeleton {
  height: 100%;
}

.footer {
  margin-top: 40px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.footer a {
  color: #409EFF;
  text-decoration: none;
}

.footer a:hover {
  text-decoration: underline;
}

.theme-toggle-btn {
  margin-left: 10px;
}

.back-to-top {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f8f9fa;
  cursor: pointer;
}

.back-to-top:hover {
  background-color: #e4e7ed;
}

.back-to-top .el-icon {
  font-size: 20px;
}
</style>
