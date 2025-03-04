<template>
  <el-card 
    class="website-card" 
    :class="{ 
      'is-loading': isRefreshing,
      'status-success': isStatusSuccess,
      'status-warning': isStatusWarning,
      'status-danger': isStatusDanger,
      'status-info': isStatusInfo
    }"
    shadow="hover"
  >
    <template #header>
      <div class="card-header">
        <div class="title-container">
          <h3 class="title" :title="props.website.title || props.website.domain">
            <span 
              class="status-indicator" 
              :class="{
                'success': isStatusSuccess,
                'warning': isStatusWarning,
                'danger': isStatusDanger,
                'info': isStatusInfo
              }"
            ></span>
            {{ props.website.title || props.website.domain }}
          </h3>
        </div>
        <div class="actions">
          <el-button 
            type="primary" 
            size="small" 
            :loading="isRefreshing"
            @click="handleRefresh"
            circle
            :icon="Refresh"
          />
          <el-button 
            type="warning" 
            size="small" 
            @click="handleEdit"
            circle
            :icon="Edit"
          />
          <el-button 
            type="danger" 
            size="small" 
            @click="handleDelete"
            circle
            :icon="Delete"
          />
        </div>
      </div>
    </template>
    
    <template #default>
      <div v-if="!isRefreshing" class="card-content">
        <div class="card-body">
          <div class="info-row">
            <div class="domain">
              <el-link 
                :href="`${props.website.protocol || 'https'}://${props.website.domain}`" 
                target="_blank" 
                :underline="false"
                class="domain-link"
              >
                {{ props.website.domain }}
                <el-icon class="external-link-icon"><Link /></el-icon>
              </el-link>
            </div>
          </div>

          <div class="status-section">
            <div class="status-row">
              <span class="status-label">访问状态：</span>
              <el-tag 
                :type="props.website.isAccessible ? 'success' : 'danger'" 
                size="small"
                class="status-tag"
              >
                {{ props.website.isAccessible ? '可访问' : '无法访问' }}
              </el-tag>
            </div>
            
            <div class="status-row">
              <span class="status-label">SSL状态：</span>
              <el-tag 
                :type="getSslStatusType(props.website)" 
                size="small"
                class="status-tag"
              >
                {{ getSslStatusText(props.website) }}
              </el-tag>
            </div>
          </div>

          <div class="cert-section" :class="{'no-cert': !props.website.certificateInfo}">
            <div v-if="props.website.certificateInfo" class="cert-info">
              <div class="cert-header">
                <span class="cert-label">证书提供商：</span>
                <span class="issuer">{{ props.website.certificateInfo.issuer }}</span>
              </div>
              
              <div class="validity-section">
                <div class="validity-header">有效期：</div>
                <div class="date-row">
                  <div class="date-item">
                    <span class="date-label">从：</span>
                    <span class="date-value">{{ formatDate(props.website.certificateInfo.validFrom) }}</span>
                  </div>
                  <div class="date-item">
                    <span class="date-label">至：</span>
                    <span class="date-value">{{ formatDate(props.website.certificateInfo.validTo) }}</span>
                  </div>
                </div>
              </div>
              
              <div v-if="props.website.certificateInfo.daysRemaining" class="days-section">
                <div class="days-header">
                  <span>证书有效期剩余：</span>
                  <span :class="getDaysRemainingClass(props.website.certificateInfo.daysRemaining)">
                    {{ props.website.certificateInfo.daysRemaining }} 天
                  </span>
                </div>
                <el-progress 
                  :percentage="getDaysRemainingPercentage(props.website.certificateInfo.daysRemaining)" 
                  :status="getDaysRemainingStatus(props.website.certificateInfo.daysRemaining)"
                  :stroke-width="8"
                  :show-text="false"
                />
              </div>
            </div>
            
            <div v-else-if="props.website.error && props.website.sslStatus === 'none'" class="no-cert-message">
              <el-alert
                type="info"
                :closable="false"
                show-icon
              >
                网站未使用HTTPS协议
              </el-alert>
            </div>
            
            <div v-else-if="!props.website.isAccessible" class="no-cert-message">
              <el-alert
                type="error"
                :closable="false"
                show-icon
              >
                无法获取证书信息
              </el-alert>
            </div>
          </div>

          <div v-if="props.website.error" class="error-message">
            <el-alert
              type="error"
              :closable="false"
              show-icon
            >
              {{ props.website.error }}
            </el-alert>
          </div>
        </div>

        <div class="last-check">
          <span>最后检查：</span>
          <span>{{ formatDateTime(props.website.lastCheck) }}</span>
        </div>
      </div>
      
      <el-skeleton v-else :rows="6" animated />
    </template>
  </el-card>

  <!-- 编辑对话框 -->
  <el-dialog
    v-model="editDialogVisible"
    title="编辑网站信息"
    width="500px"
  >
    <el-form :model="editForm" label-width="80px" ref="editFormRef">
      <el-form-item label="标题">
        <el-input v-model="editForm.title" placeholder="网站标题（可选）" />
      </el-form-item>
      <el-form-item label="域名">
        <el-input v-model="editForm.domain" placeholder="网站域名" />
      </el-form-item>
      <el-form-item label="协议">
        <el-radio-group v-model="editForm.protocol">
          <el-radio label="http">HTTP</el-radio>
          <el-radio label="https">HTTPS</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit" :loading="isSubmitting">确定</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Refresh, Link } from '@element-plus/icons-vue'

// 接收props
const props = defineProps({
  website: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['refresh', 'delete', 'update'])

// 本地状态
const isRefreshing = ref(false)
const editDialogVisible = ref(false)
const isSubmitting = ref(false)
const editForm = ref({
  title: '',
  domain: '',
  protocol: 'https'
})

// 计算属性
const isStatusSuccess = computed(() => {
  return props.website.isAccessible && props.website.sslStatus === 'valid';
});

const isStatusWarning = computed(() => {
  return props.website.isAccessible && 
         (props.website.sslStatus === 'self-signed' || 
          (props.website.certificateInfo && props.website.certificateInfo.daysRemaining <= 30));
});

const isStatusDanger = computed(() => {
  return !props.website.isAccessible || 
         props.website.sslStatus === 'expired' || 
         props.website.sslStatus === 'invalid';
});

const isStatusInfo = computed(() => {
  return props.website.isAccessible && 
         (props.website.sslStatus === 'none' || !props.website.sslStatus);
});

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '未知'
  
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

// 格式化日期时间
const formatDateTime = (dateString) => {
  if (!dateString) return '未知'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  // 超过3天显示具体日期时间
  if (diffDay > 3) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }
  
  // 3天内显示相对时间
  if (diffDay > 0) return `${diffDay}天前`
  if (diffHour > 0) return `${diffHour}小时前`
  if (diffMin > 0) return `${diffMin}分钟前`
  return `${diffSec}秒前`
}

// 获取SSL状态文本
const getStatusText = (status) => {
  switch (status) {
    case 'valid':
      return '有效'
    case 'expired':
      return '已过期'
    case 'self-signed':
      return '自签名'
    case 'invalid':
      return '无效'
    case 'none':
      return '无SSL'
    default:
      return '未知'
  }
}

// 获取SSL状态类型
const getStatusType = (status) => {
  switch (status) {
    case 'valid':
      return 'success'
    case 'expired':
      return 'danger'
    case 'self-signed':
      return 'warning'
    case 'invalid':
      return 'danger'
    case 'none':
      return 'info'
    default:
      return 'info'
  }
}

// 获取SSL状态文本（针对整个网站对象）
const getSslStatusText = (website) => {
  if (!website.isAccessible) {
    return '无效'
  }
  
  return getStatusText(website.sslStatus)
}

// 获取SSL状态类型（针对整个网站对象）
const getSslStatusType = (website) => {
  if (!website.isAccessible) {
    return 'danger'
  }
  
  return getStatusType(website.sslStatus)
}

// 获取剩余天数的百分比
const getDaysRemainingPercentage = (days) => {
  if (!days && days !== 0) return 0
  
  // 假设90天为100%
  const percentage = (days / 90) * 100
  return Math.min(percentage, 100)
}

// 获取剩余天数的状态
const getDaysRemainingStatus = (days) => {
  if (!days && days !== 0) return 'exception'
  
  if (days <= 7) return 'exception'
  if (days <= 30) return 'warning'
  return 'success'
}

// 获取剩余天数的CSS类
const getDaysRemainingClass = (days) => {
  if (!days && days !== 0) return 'days-danger'
  
  if (days <= 7) return 'days-danger'
  if (days <= 30) return 'days-warning'
  return 'days-success'
}

// 处理刷新
const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    await emit('refresh', props.website.id)
  } catch (error) {
    console.error('刷新网站失败:', error)
  } finally {
    isRefreshing.value = false
  }
}

// 处理删除
const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除网站 "${props.website.title || props.website.domain}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    console.log('用户确认删除网站:', props.website)
    emit('delete', props.website)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除网站失败:', error)
    }
  }
}

// 处理编辑
const handleEdit = () => {
  // 设置编辑表单的初始值
  editForm.value = {
    title: props.website.title || '',
    domain: props.website.domain || '',
    protocol: props.website.protocol || 'https'
  }
  
  // 显示编辑对话框
  editDialogVisible.value = true
  console.log('打开编辑对话框:', editForm.value)
}

// 提交编辑
const submitEdit = async () => {
  isSubmitting.value = true
  try {
    console.log('提交编辑:', editForm.value)
    
    const response = await fetch(`http://localhost:3001/website/${props.website.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editForm.value)
    })
    
    if (!response.ok) {
      throw new Error(`更新失败: ${response.status}`)
    }
    
    const updatedWebsite = await response.json()
    console.log('更新结果:', updatedWebsite)
    
    // 关闭对话框
    editDialogVisible.value = false
    
    // 通知父组件更新
    emit('update', updatedWebsite)
    
    ElMessage.success('更新成功')
  } catch (error) {
    console.error('更新失败:', error)
    ElMessage.error('更新失败: ' + (error.message || '未知错误'))
  } finally {
    isSubmitting.value = false
  }
}

// 监听props变化
watch(() => props.website, (newVal) => {
  console.log('WebsiteCard组件接收到新的website数据:', newVal ? newVal.id : 'undefined')
}, { deep: true, immediate: true })

// 组件挂载
onMounted(() => {
  console.log('WebsiteCard组件挂载完成，website:', props.website ? props.website.id : 'undefined')
})
</script>

<style scoped>
.website-card {
  margin-bottom: 20px;
  transition: all 0.3s;
  border-width: 1px;
  border-style: solid;
  border-color: #ebeef5;
  overflow: hidden;
}

.website-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
}

.website-card.is-loading {
  opacity: 0.7;
}

.status-success {
  border-width: 2px;
  border-color: #67c23a;
}

.status-warning {
  border-width: 2px;
  border-color: #e6a23c;
}

.status-danger {
  border-width: 2px;
  border-color: #f56c6c;
}

.status-info {
  border-width: 2px;
  border-color: #909399;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;
}

.title-container {
  flex: 1;
  min-width: 0;
  margin-right: 10px;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}

.card-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
  padding: 15px;
}

.card-body {
  flex: 1;
}

.info-row {
  margin-bottom: 15px;
}

.domain {
  font-size: 14px;
  color: #606266;
  word-break: break-all;
}

.domain-link {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #409eff;
  font-weight: 500;
}

.external-link-icon {
  margin-left: 4px;
  font-size: 12px;
}

.status-section {
  margin-bottom: 15px;
}

.status-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.status-label {
  margin-right: 8px;
  color: #606266;
  font-weight: 500;
  width: 80px;
}

.status-tag {
  min-width: 60px;
  text-align: center;
  font-weight: 500;
}

.cert-section {
  margin-bottom: 15px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.no-cert {
  padding: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cert-header {
  display: flex;
  margin-bottom: 10px;
}

.cert-label {
  color: #606266;
  margin-right: 4px;
  font-weight: 500;
  width: 100px;
}

.issuer {
  font-weight: 500;
  color: #303133;
  word-break: break-all;
}

.validity-section {
  margin-bottom: 15px;
}

.validity-header {
  margin-bottom: 8px;
  color: #606266;
  font-weight: 500;
}

.date-row {
  display: flex;
  flex-direction: column;
  margin-left: 15px;
  gap: 8px;
}

.date-item {
  display: flex;
}

.date-label {
  color: #909399;
  margin-right: 8px;
  min-width: 40px;
}

.date-value {
  color: #303133;
}

.days-section {
  margin-top: 15px;
}

.days-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #606266;
  font-weight: 500;
}

.days-warning {
  color: #e6a23c;
  font-weight: 600;
}

.days-danger {
  color: #f56c6c;
  font-weight: 600;
}

.days-success {
  color: #67c23a;
  font-weight: 600;
}

.no-cert-message {
  padding: 15px 0;
  text-align: center;
}

.error-message {
  margin-bottom: 15px;
}

.last-check {
  margin-top: auto;
  padding-top: 15px;
  border-top: 1px solid #ebeef5;
  color: #909399;
  font-size: 12px;
  text-align: right;
  flex-shrink: 0;
}

/* 状态指示器 */
.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
}

.status-indicator.success {
  background-color: #67c23a;
}

.status-indicator.warning {
  background-color: #e6a23c;
}

.status-indicator.danger {
  background-color: #f56c6c;
}

.status-indicator.info {
  background-color: #909399;
}
</style>
