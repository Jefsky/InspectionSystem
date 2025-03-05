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
        <div class="card-title">
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
        <div class="card-actions">
          <el-tooltip content="置顶/取消置顶">
            <el-button 
              :type="props.website.isPinned ? 'success' : 'info'" 
              size="small" 
              @click="handleTogglePin"
              circle
              :icon="Top"
            />
          </el-tooltip>
          <el-tooltip content="刷新">
            <el-button 
              type="primary" 
              size="small" 
              :loading="isRefreshing"
              @click="handleRefresh"
              circle
              :icon="Refresh"
            />
          </el-tooltip>
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

            <div v-if="props.website.responseTime" class="status-row">
              <span class="status-label">响应时间：</span>
              <span :class="getResponseTimeClass(props.website.responseTime)">
                {{ props.website.responseTime }}ms
              </span>
            </div>

            <div v-if="props.website.statusCode" class="status-row">
              <span class="status-label">状态码：</span>
              <el-tag 
                :type="getStatusCodeType(props.website.statusCode)" 
                size="small"
                class="status-tag"
              >
                {{ props.website.statusCode }}
              </el-tag>
            </div>
          </div>

          <div class="cert-section" :class="{'no-cert': !props.website.certificateInfo}">
            <div v-if="props.website.certificateInfo" class="cert-info">
              <div class="cert-header">
                <div class="cert-label">证书信息</div>
              </div>
              <div class="cert-header">
                <div class="cert-label">证书提供商：</div>
                <div class="issuer">{{ formatIssuer(props.website.certificateInfo.issuer) }}</div>
              </div>
              <div class="cert-header">
                <div class="cert-label">证书主体：</div>
                <div class="subject">{{ formatSubject(props.website.certificateInfo.subject) }}</div>
              </div>
              <div class="validity-section">
                <div class="validity-header">有效期：</div>
                <div class="date-row">
                  <div class="date-item">
                    <div class="date-label">从：</div>
                    <div class="date-value">{{ formatDate(props.website.certificateInfo.validFrom) }}</div>
                  </div>
                  <div class="date-item">
                    <div class="date-label">至：</div>
                    <div class="date-value">{{ formatDate(props.website.certificateInfo.validTo) }}</div>
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
          <span>{{ lastCheckTimeDisplay }}</span>
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
import { Delete, Edit, Refresh, Link, Top } from '@element-plus/icons-vue'

// 接收props
const props = defineProps({
  website: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['refresh', 'delete', 'update', 'togglePin'])

// 本地状态
const isRefreshing = ref(false)
const editDialogVisible = ref(false)
const isSubmitting = ref(false)
const editForm = ref({
  title: '',
  domain: '',
  protocol: 'https'
})
const lastCheckTimeDisplay = ref('')

// 计算属性
const isStatusSuccess = computed(() => {
  return props.website.isAccessible && props.website.sslStatus === 'valid';
});

const isStatusWarning = computed(() => {
  return props.website.isAccessible && 
         (props.website.sslStatus === 'invalid' || 
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
  
  try {
    console.log('原始日期字符串:', dateString);
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.error('无效的日期字符串:', dateString);
      return '未知';
    }
    
    console.log('解析后的日期对象:', date.toString());
    
    const now = new Date();
    console.log('当前时间:', now.toString());
    
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    console.log('时间差（秒）:', diffSec);
    
    if (diffSec < 60) {
      return '刚刚';
    }
    
    if (diffSec < 3600) {
      return `${Math.floor(diffSec / 60)}分钟前`;
    }
    
    if (diffSec < 86400) {
      return `${Math.floor(diffSec / 3600)}小时前`;
    }
    
    // 如果时间差小于3天，显示"X天前"
    if (diffSec < 259200) { 
      return `${Math.floor(diffSec / 86400)}天前`;
    }
    
    // 否则显示完整日期时间
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '未知';
  }
}

// 获取SSL状态文本
const getStatusText = (status) => {
  switch (status) {
    case 'valid':
      return '有效'
    case 'expired':
      return '已过期'
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

// 获取响应时间的CSS类
const getResponseTimeClass = (responseTime) => {
  if (responseTime <= 200) return 'response-time-fast'
  if (responseTime <= 500) return 'response-time-normal'
  return 'response-time-slow'
}

// 获取状态码的类型
const getStatusCodeType = (statusCode) => {
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'warning'
  if (statusCode >= 400 && statusCode < 500) return 'danger'
  if (statusCode >= 500) return 'danger'
  return 'info'
}

// 格式化证书提供商
const formatIssuer = (issuer) => {
  if (!issuer) return '未知';
  
  try {
    if (typeof issuer === 'object') {
      const hasInvalidChars = Object.values(issuer).some(value => 
        typeof value === 'string' && value.includes('?')
      );
      
      if (hasInvalidChars && issuer.CN) {
        return issuer.CN;
      }
      
      if (issuer.O && issuer.CN) {
        return `${issuer.O} (${issuer.CN})`;
      } else if (issuer.CN) {
        return issuer.CN;
      } else if (issuer.O) {
        return issuer.O;
      } else {
        return Object.entries(issuer)
          .filter(([key, value]) => !String(value).includes('?')) 
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }
    }
    
    if (typeof issuer === 'string' && (issuer.startsWith('{') || issuer.includes(':'))) {
      try {
        const parsed = JSON.parse(issuer.replace(/'/g, '"'));
        return formatIssuer(parsed); 
      } catch (e) {
        return issuer;
      }
    }
    
    return issuer;
  } catch (e) {
    console.error('格式化证书提供商出错:', e);
    return String(issuer);
  }
};

// 格式化证书主体
const formatSubject = (subject) => {
  if (!subject) return '未知';
  
  try {
    if (typeof subject === 'object') {
      const hasInvalidChars = Object.values(subject).some(value => 
        typeof value === 'string' && value.includes('?')
      );
      
      if (hasInvalidChars && subject.CN) {
        return subject.CN;
      }
      
      if (subject.O && subject.CN) {
        return `${subject.O} (${subject.CN})`;
      } else if (subject.CN) {
        return subject.CN;
      } else if (subject.O) {
        return subject.O;
      } else {
        return Object.entries(subject)
          .filter(([key, value]) => !String(value).includes('?')) 
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }
    }
    
    if (typeof subject === 'string' && (subject.startsWith('{') || subject.includes(':'))) {
      try {
        const parsed = JSON.parse(subject.replace(/'/g, '"'));
        return formatSubject(parsed); 
      } catch (e) {
        return subject;
      }
    }
    
    return subject;
  } catch (e) {
    console.error('格式化证书主体出错:', e);
    return String(subject);
  }
};

// 处理刷新
const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    const result = await emit('refresh', props.website)
    console.log('刷新结果:', result)
    
    // 手动更新组件内的时间显示
    if (result && result.lastCheck) {
      // 使用深拷贝更新props中的网站对象，确保响应式更新
      props.website.lastCheck = result.lastCheck
      props.website.isAccessible = result.isAccessible
      props.website.responseTime = result.responseTime
      props.website.statusCode = result.statusCode
      props.website.title = result.title || props.website.title
      
      // 强制更新计算属性
      lastCheckTimeDisplay.value = formatDateTime(result.lastCheck)
    }
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
  editForm.value = {
    title: props.website.title || '',
    domain: props.website.domain || '',
    protocol: props.website.protocol || 'https'
  }
  
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
    
    editDialogVisible.value = false
    
    emit('update', updatedWebsite)
    
    ElMessage.success('更新成功')
  } catch (error) {
    console.error('更新失败:', error)
    ElMessage.error('更新失败: ' + (error.message || '未知错误'))
  } finally {
    isSubmitting.value = false
  }
}

// 处理置顶/取消置顶
const handleTogglePin = async () => {
  try {
    await emit('togglePin', props.website)
  } catch (error) {
    console.error('切换置顶状态失败:', error)
  }
}

// 监听props变化
watch(() => props.website, (newVal) => {
  console.log('WebsiteCard组件接收到新的website数据:', newVal ? newVal.id : 'undefined')
  if (newVal && newVal.lastCheck) {
    lastCheckTimeDisplay.value = formatDateTime(newVal.lastCheck)
  }
}, { deep: true, immediate: true })

// 组件挂载
onMounted(() => {
  if (props.website && props.website.lastCheck) {
    lastCheckTimeDisplay.value = formatDateTime(props.website.lastCheck)
  }
  console.log('WebsiteCard组件挂载完成，website:', props.website ? props.website.id : 'undefined')
})
</script>

<style scoped>
.website-card {
  margin-bottom: 20px;
  border-radius: 8px;
  transition: all 0.5s ease;
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

.card-title {
  position: relative;
  flex: 1;
  min-width: 0;
  margin-right: 10px;
  display: flex;
  align-items: center;
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

.card-actions {
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

.cert-info {
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 10px;
  border-left: 3px solid #409EFF;
}

.cert-header {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

.cert-label {
  font-weight: bold;
  color: #606266;
  margin-bottom: 2px;
}

.issuer {
  font-weight: 500;
  color: #409EFF;
  word-break: break-all;
  padding-left: 8px;
}

.subject {
  font-weight: 500;
  color: #67C23A;
  word-break: break-all;
  padding-left: 8px;
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

.response-time-fast {
  color: #67c23a;
}

.response-time-normal {
  color: #909399;
}

.response-time-slow {
  color: #f56c6c;
}
</style>
