<template>
  <div class="container">
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
            placeholder="网站标题（可选）"
            @keyup.enter="addWebsite"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 网站列表 -->
    <div class="website-list">
      <div v-if="isLoadingWebsites" class="loading-container">
        <el-skeleton :rows="3" animated style="width: 100%" />
        <el-skeleton :rows="3" animated style="width: 100%" />
        <el-skeleton :rows="3" animated style="width: 100%" />
      </div>
      <template v-else>
        <div v-if="websites && websites.length > 0" class="websites-grid">
          <template v-for="website in websites" :key="website.id">
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
            />
          </template>
        </div>
        <div v-else class="empty-container">
          <el-empty description="暂无网站，请添加" />
        </div>
      </template>
    </div>
    
    <!-- 页脚 -->
    <div class="footer">
      <p> {{ new Date().getFullYear() }} <a href="https://www.jefsky.com" target="_blank">Jefsky</a>. </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage, ElLoading } from 'element-plus'
import WebsiteCard from './components/WebsiteCard.vue'

// 状态变量
const websites = ref([])
const isRefreshingAll = ref(false)
const isAddingWebsite = ref(false)
const isLoadingWebsites = ref(false)
const formRef = ref(null)
const showDebug = ref(true) // 调试模式

// 表单数据
const newWebsite = ref({
  domain: '',
  title: ''
})

// 表单验证规则
const rules = {
  domain: [
    { required: true, message: '请输入域名', trigger: 'blur' },
    { 
      validator: (rule, value, callback) => {
        // 允许带协议前缀或不带
        const domainPattern = /^(https?:\/\/)?(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+([A-Za-z]{2,})(\:\d+)?(\/.*)?$/;
        if (!domainPattern.test(value)) {
          callback(new Error('请输入有效的域名'));
        } else {
          callback();
        }
      }, 
      trigger: 'blur' 
    }
  ],
  title: [
    { required: false }
  ]
}

// 加载网站列表
const loadWebsites = async () => {
  console.log('开始加载网站列表...')
  isLoadingWebsites.value = true
  
  try {
    console.log('发送请求到 /websites API')
    // 添加缓存控制头部，防止浏览器缓存
    const response = await fetch('http://localhost:3001/websites', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('加载到的网站数据:', JSON.stringify(data).substring(0, 100) + '...')
    console.log('数据类型:', typeof data, '是数组:', Array.isArray(data), '长度:', data.length)
    
    if (Array.isArray(data)) {
      // 按最后检查时间排序，最新的在前面
      const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.lastCheck || 0)
        const dateB = new Date(b.lastCheck || 0)
        return dateB - dateA
      })
      
      // 直接赋值一个新数组，避免引用问题
      websites.value = sortedData.map(site => ({...site}))
      console.log('网站数据已赋值给websites变量，长度:', websites.value.length)
      
      // 使用nextTick确保DOM更新
      await nextTick()
      console.log('DOM已更新，websites长度:', websites.value.length)
      
      // 手动触发一次DOM更新
      if (websites.value.length > 0) {
        const temp = [...websites.value]
        websites.value = []
        await nextTick()
        websites.value = temp
        console.log('手动触发DOM更新后，websites长度:', websites.value.length)
      }
    } else {
      console.error('API返回的数据不是数组:', data)
      websites.value = []
    }

  } catch (error) {
    console.error('加载网站列表失败:', error)
    ElMessage.error(`加载网站列表失败: ${error.message}`)
    websites.value = [] // 确保在错误情况下清空列表
  } finally {
    isLoadingWebsites.value = false
    console.log('网站列表加载完成，当前数据长度:', websites.value.length)
  }
}

const refreshWebsite = async (website) => {
  try {
    const response = await fetch('http://localhost:3001/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain: website.domain,
        title: website.title
      })
    })
    const result = await response.json()
    
    // 更新单个网站的状态
    const index = websites.value.findIndex(w => w.id === website.id)
    if (index !== -1) {
      websites.value[index] = { ...websites.value[index], ...result }
    }
  } catch (error) {
    throw new Error('刷新失败')
  }
}

const refreshAll = async () => {
  if (isRefreshingAll.value) return
  
  isRefreshingAll.value = true
  try {
    const response = await fetch('http://localhost:3001/check-all', {
      method: 'POST'
    })
    const results = await response.json()
    
    // 更新每个网站的状态，保持顺序不变
    results.forEach(result => {
      const index = websites.value.findIndex(w => w.id === result.id)
      if (index !== -1) {
        websites.value[index] = { ...websites.value[index], ...result }
      }
    })
    
    ElMessage.success('所有网站刷新完成')
  } catch (error) {
    ElMessage.error('批量刷新失败')
  } finally {
    isRefreshingAll.value = false
  }
}

const addWebsite = async () => {
  if (isAddingWebsite.value) return
  
  try {
    await formRef.value.validate()
    
    isAddingWebsite.value = true
    
    // 处理域名格式，移除协议前缀
    let domain = newWebsite.value.domain;
    let protocol = 'https';
    
    if (domain.startsWith('http://')) {
      domain = domain.substring(7);
      protocol = 'http';
    } else if (domain.startsWith('https://')) {
      domain = domain.substring(8);
    }
    
    const response = await fetch('http://localhost:3001/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain: domain,
        title: newWebsite.value.title || domain,
        protocol: protocol
      })
    })
    
    const result = await response.json()
    websites.value.unshift({ 
      ...newWebsite.value, 
      ...result,
      domain: domain,
      protocol: protocol
    })
    
    // 重置表单
    formRef.value.resetFields()
    ElMessage.success('添加成功')
  } catch (error) {
    if (error.message) {
      ElMessage.error(error.message)
    }
  } finally {
    isAddingWebsite.value = false
  }
}

const deleteWebsite = async (website) => {
  try {
    console.log('删除网站:', website.id)
    const response = await fetch(`http://localhost:3001/website/${website.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(website)
    })
    
    if (!response.ok) {
      throw new Error(`删除失败: ${response.status}`)
    }
    
    const result = await response.json()
    console.log('删除结果:', result)
    
    websites.value = websites.value.filter(w => w.id !== website.id)
    ElMessage.success('删除成功')
  } catch (error) {
    console.error('删除失败:', error)
    ElMessage.error('删除失败: ' + (error.message || '未知错误'))
  }
}

const handleWebsiteUpdate = async (updatedWebsite) => {
  console.log('处理网站更新:', updatedWebsite)
  
  try {
    // 查找并更新网站
    const index = websites.value.findIndex(site => site.id === updatedWebsite.id)
    if (index !== -1) {
      console.log(`更新网站索引 ${index}:`, websites.value[index], '->', updatedWebsite)
      websites.value[index] = { ...websites.value[index], ...updatedWebsite }
      ElMessage.success('网站信息已更新')
    } else {
      console.warn('未找到要更新的网站:', updatedWebsite)
      ElMessage.warning('未找到要更新的网站')
    }
  } catch (error) {
    console.error('更新网站失败:', error)
    ElMessage.error('更新网站失败: ' + (error.message || '未知错误'))
  }
}

// 组件挂载时加载网站列表
onMounted(() => {
  console.log('App组件已挂载，准备加载网站列表')
  loadWebsites()
})
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Noto Sans SC', 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  height: 60px;
}

.header h1 {
  font-size: 28px;
  font-weight: 500;
  color: #303133;
  margin: 0;
}

.add-website-form {
  margin-bottom: 30px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
  height: 40px;
}

.website-list {
  margin-top: 30px;
}

.websites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 30px;
  margin-bottom: 30px;
}

.loading-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 30px;
  min-height: 300px;
}

.skeleton-card {
  min-height: 300px;
}

.website-card-skeleton {
  height: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.debug-info {
  margin-bottom: 30px;
  background-color: #f8f8f8;
  overflow: auto;
  max-height: 300px;
  font-family: 'Courier New', Courier, monospace;
}

.debug-info h3 {
  font-size: 16px;
  font-weight: 500;
  margin: 10px 0;
  color: #606266;
}

.debug-info pre {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 14px;
  padding: 10px;
  margin: 0;
}

.footer {
  text-align: center;
  margin-top: 30px;
  padding: 10px;
  border-top: 1px solid #dcdfe6;
}

.footer p {
  margin: 0;
  color: #606266;
}

.footer a {
  text-decoration: none;
  color: #409eff;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .websites-grid {
    grid-template-columns: 1fr;
  }
  
  .loading-container {
    grid-template-columns: 1fr;
  }
}
</style>
