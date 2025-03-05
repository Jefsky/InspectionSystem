<template>
  <el-card class="statistics-card" :class="{ 'refreshing': isRefreshing }" shadow="hover">
    <template #header>
      <div class="card-header">
        <h3>网站监控统计</h3>
        <el-button 
          type="primary" 
          size="small" 
          @click="refreshStats"
          circle
          :icon="Refresh"
          class="refresh-button"
          :loading="isRefreshing"
        />
      </div>
    </template>
    
    <div class="stats-content">
      <div class="statistics-grid">
        <div class="stat-item total-websites">
          <div class="stat-title">总网站数量</div>
          <div class="stat-value">{{ stats.totalCount }}</div>
          <div class="stat-icon"><i class="el-icon-monitor"></i></div>
        </div>
        
        <div class="stat-item accessible-websites">
          <div class="stat-title">可访问网站</div>
          <div class="stat-value success">{{ stats.accessibleCount }}</div>
          <div class="stat-icon"><i class="el-icon-check"></i></div>
        </div>
        
        <div class="stat-item inaccessible-websites">
          <div class="stat-title">不可访问网站</div>
          <div class="stat-value danger">{{ stats.inaccessibleCount }}</div>
          <div class="stat-icon"><i class="el-icon-close"></i></div>
        </div>
        
        <div class="stat-item response-time">
          <div class="stat-title">平均响应时间</div>
          <div class="stat-value">
            <span :class="getResponseTimeClass(stats.avgResponseTime)">
              {{ stats.avgResponseTime }}ms
            </span>
          </div>
          <div class="response-time-indicator">
            <el-progress 
              :percentage="getResponseTimePercentage(stats.avgResponseTime)" 
              :color="getResponseTimeColor(stats.avgResponseTime)"
              :stroke-width="8"
              :show-text="false"
            ></el-progress>
            <div class="response-time-label">
              {{ getResponseTimeLabel(stats.avgResponseTime) }}
            </div>
          </div>
        </div>
        
        <div class="stat-item accessibility-rate">
          <div class="stat-title">可访问率</div>
          <div class="accessibility-rate">
            <div class="rate-value" :class="getAccessibilityRateClass(stats.accessibilityRate)">
              {{ stats.accessibilityRate }}%
            </div>
            <el-progress 
              type="circle" 
              :percentage="stats.accessibilityRate" 
              :color="getAccessibilityRateColor(stats.accessibilityRate)"
              :width="80"
            ></el-progress>
          </div>
        </div>
      </div>
      
      <el-divider />
      
      <div class="stat-title">SSL证书状态</div>
      <div class="ssl-stats">
        <div class="ssl-item">
          <el-tag type="success">有效</el-tag>
          <span class="ssl-count">{{ stats.sslValid }}</span>
        </div>
        <div class="ssl-item">
          <el-tag type="warning">即将过期</el-tag>
          <span class="ssl-count">{{ stats.sslExpiringSoon }}</span>
        </div>
        <div class="ssl-item">
          <el-tag type="danger">已过期</el-tag>
          <span class="ssl-count">{{ stats.sslExpired }}</span>
        </div>
        <div class="ssl-item">
          <el-tag type="danger">无效</el-tag>
          <span class="ssl-count">{{ stats.sslSelfSigned }}</span>
        </div>
        <div class="ssl-item">
          <el-tag>无SSL</el-tag>
          <span class="ssl-count">{{ stats.sslNone }}</span>
        </div>
      </div>
      
      <div class="ssl-chart-container">
        <div ref="sslChartRef" class="ssl-chart"></div>
      </div>
      
      <el-divider />
      
      <div class="stat-title">HTTP状态码分布</div>
      <div class="status-codes">
        <div v-for="(count, code) in stats.statusCodes" :key="code" class="status-code-item">
          <el-tag :type="getStatusCodeType(code)" size="small">{{ code }}</el-tag>
          <span class="status-code-count">{{ count }}</span>
        </div>
      </div>
      
      <div class="status-chart-container">
        <div ref="statusChartRef" class="status-chart"></div>
      </div>
      
      <!-- 最近更新的网站 -->
      <div v-if="stats.recentlyUpdated && stats.recentlyUpdated.length > 0">
        <el-divider />
        <div class="stat-title">最近更新的网站</div>
        <div class="recent-updates">
          <el-table :data="stats.recentlyUpdated" size="small" style="width: 100%" @row-click="handleRowClick">
            <el-table-column prop="title" label="网站" min-width="120">
              <template #default="scope">
                <el-tooltip :content="scope.row.domain" placement="top">
                  <span>{{ scope.row.title || scope.row.domain }}</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column prop="lastCheck" label="检查时间" width="100">
              <template #default="scope">
                {{ formatDateTime(scope.row.lastCheck) }}
              </template>
            </el-table-column>
            <el-table-column prop="responseTime" label="响应时间" width="100">
              <template #default="scope">
                <span v-if="scope.row.responseTime" :class="getResponseTimeClass(scope.row.responseTime)">
                  {{ scope.row.responseTime }}ms
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="statusCode" label="状态码" width="80">
              <template #default="scope">
                <el-tag v-if="scope.row.statusCode" :type="getStatusCodeType(scope.row.statusCode)" size="small">
                  {{ scope.row.statusCode }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="isAccessible" label="状态" width="80">
              <template #default="scope">
                <el-tag :type="scope.row.isAccessible ? 'success' : 'danger'" size="small">
                  {{ scope.row.isAccessible ? '正常' : '异常' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, onMounted, nextTick, onUnmounted, computed } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 注册必须的组件
echarts.use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  PieChart,
  BarChart,
  CanvasRenderer
])

// 状态变量
const isRefreshing = ref(false)
const sslChartRef = ref(null)
const statusChartRef = ref(null)
const sslChart = ref(null)
const statusChart = ref(null)

const stats = ref({
  totalCount: 0,
  accessibleCount: 0,
  inaccessibleCount: 0,
  sslValid: 0,
  sslExpiringSoon: 0,
  sslExpired: 0,
  sslSelfSigned: 0,
  sslNone: 0,
  avgResponseTime: 0,
  statusCodes: {},
  recentlyUpdated: [],
  lastCheck: null,
  accessibilityRate: 0
})

// 格式化日期时间
const formatDateTime = (dateString) => {
  if (!dateString) return '未知';
  
  try {
    // 打印原始日期字符串，用于调试
    console.log('原始日期字符串:', dateString);
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.error('无效的日期字符串:', dateString);
      return '未知';
    }
    
    // 打印解析后的日期对象，用于调试
    console.log('解析后的日期对象:', date.toString());
    
    // 获取当前日期
    const now = new Date();
    console.log('当前时间:', now.toString());
    
    // 计算时间差（毫秒）
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    console.log('时间差（秒）:', diffSec);
    
    // 如果时间差小于60秒，显示"刚刚"
    if (diffSec < 60) {
      return '刚刚';
    }
    
    // 如果时间差小于60分钟，显示"X分钟前"
    if (diffSec < 3600) {
      return `${Math.floor(diffSec / 60)}分钟前`;
    }
    
    // 如果时间差小于24小时，显示"X小时前"
    if (diffSec < 86400) {
      return `${Math.floor(diffSec / 3600)}小时前`;
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
};

// 获取状态码对应的标签类型
const getStatusCodeType = (code) => {
  const codeNum = parseInt(code);
  if (codeNum >= 200 && codeNum < 300) return 'success';
  if (codeNum >= 300 && codeNum < 400) return 'warning';
  if (codeNum >= 400 && codeNum < 500) return 'danger';
  if (codeNum >= 500) return 'error';
  return 'info';
};

// 处理表格行点击
const handleRowClick = (row) => {
  window.open(`http://${row.domain}`, '_blank');
};

// 获取统计数据
const fetchStats = async () => {
  console.log('开始获取统计数据');
  isRefreshing.value = true;
  
  try {
    console.log('发送请求到 http://localhost:3001/statistics');
    const response = await fetch('http://localhost:3001/statistics', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('服务器返回了非JSON数据:', contentType);
      const text = await response.text();
      console.error('响应内容:', text.substring(0, 500));
      throw new Error('服务器返回了非JSON数据: ' + contentType);
    }
    
    const data = await response.json();
    console.log('获取到统计数据:', data);
    console.log('后端返回的最后更新时间:', data.lastCheck);
    
    // 添加动画效果，先保存旧数据
    const oldStats = { ...stats.value };
    
    // 更新数据
    stats.value = {
      ...data
    };
    
    // 确保最后更新时间存在，如果后端没有提供，则使用当前时间
    if (!stats.value.lastCheck) {
      console.log('后端未提供lastCheck，使用当前时间');
      stats.value.lastCheck = new Date().toISOString();
    }
    
    console.log('更新后的统计数据:', stats.value);
    console.log('前端显示的最后更新时间:', stats.value.lastCheck);
    
    // 更新图表
    updateCharts();
    
    // 如果是首次加载或自动刷新，不显示提示
    if (!oldStats.lastCheck) {
      console.log('首次加载，不显示提示');
      return;
    }
    
    // 检查数据变化并提示
    if (oldStats.totalCount !== stats.value.totalCount) {
      console.log(`网站总数变化: ${oldStats.totalCount} -> ${stats.value.totalCount}`);
      ElMessage({
        message: `网站总数从 ${oldStats.totalCount} 变为 ${stats.value.totalCount}`,
        type: 'info'
      });
    }
    
    if (oldStats.accessibleCount !== stats.value.accessibleCount) {
      const type = oldStats.accessibleCount < stats.value.accessibleCount ? 'success' : 'warning';
      console.log(`可访问网站数变化: ${oldStats.accessibleCount} -> ${stats.value.accessibleCount}`);
      ElMessage({
        message: `可访问网站数从 ${oldStats.accessibleCount} 变为 ${stats.value.accessibleCount}`,
        type
      });
    }
    
  } catch (error) {
    console.error('获取统计数据失败:', error);
    ElMessage.error('获取统计数据失败: ' + error.message);
  } finally {
    isRefreshing.value = false;
    console.log('完成获取统计数据');
  }
};

// 刷新统计数据
const refreshStats = async () => {
  console.log('手动刷新统计数据');
  // 确保不在刷新中才执行刷新
  if (!isRefreshing.value) {
    try {
      await fetchStats();
      
      // 打印刷新后的时间
      console.log('刷新后的最后检查时间:', stats.value.lastCheck);
      console.log('格式化后的时间显示:', formatDateTime(stats.value.lastCheck));
      
      ElMessage({
        message: '统计数据已刷新',
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('刷新统计数据失败:', error);
      ElMessage.error('刷新统计数据失败: ' + error.message);
    }
  }
};

// 直接更新统计数据（用于从外部传入统计数据）
const updateStats = (newStats) => {
  console.log('直接更新统计数据:', newStats);
  
  // 添加动画效果，先保存旧数据
  const oldStats = { ...stats.value };
  
  // 更新数据
  stats.value = {
    ...newStats
  };
  
  // 确保最后更新时间存在
  if (!stats.value.lastCheck) {
    console.log('统计数据中没有lastCheck，使用当前时间');
    stats.value.lastCheck = new Date().toISOString();
  }
  
  console.log('更新后的统计数据:', stats.value);
  console.log('前端显示的最后更新时间:', stats.value.lastCheck);
  console.log('格式化后的时间显示:', formatDateTime(stats.value.lastCheck));
  
  // 更新图表
  updateCharts();
  
  // 如果是首次加载，不显示提示
  if (!oldStats.lastCheck) {
    console.log('首次加载，不显示提示');
    return;
  }
  
  // 显示提示
  ElMessage({
    message: '统计数据已更新',
    type: 'success',
    duration: 2000,
    showClose: false
  });
};

// 根据平均响应时间获取颜色标识
const getResponseTimeClass = (time) => {
  if (time < 200) return 'success';
  if (time < 500) return 'warning';
  return 'danger';
};

// 根据平均响应时间获取进度条颜色
const getResponseTimeColor = (time) => {
  if (time < 200) return '#67c23a';
  if (time < 500) return '#e6a23c';
  return '#f56c6c';
};

// 根据平均响应时间获取进度条百分比
const getResponseTimePercentage = (time) => {
  if (time < 200) return 100;
  if (time < 500) return 50;
  return 0;
};

// 根据平均响应时间获取标签文本
const getResponseTimeLabel = (time) => {
  if (time < 200) return '快速响应';
  if (time < 500) return '正常响应';
  return '慢速响应';
};

// 根据可访问率获取颜色标识
const getAccessibilityRateClass = (rate) => {
  if (rate >= 90) return 'success';
  if (rate >= 70) return 'warning';
  return 'danger';
};

// 根据可访问率获取进度条颜色
const getAccessibilityRateColor = (rate) => {
  if (rate >= 90) return '#67c23a';
  if (rate >= 70) return '#e6a23c';
  return '#f56c6c';
};

// 组件挂载时获取统计数据
onMounted(() => {
  fetchStats();
  
  // 监听窗口大小变化，重新渲染图表
  window.addEventListener('resize', () => {
    if (sslChart.value) {
      sslChart.value.resize();
    }
    if (statusChart.value) {
      statusChart.value.resize();
    }
  });
});

// 组件卸载时清理定时器
onUnmounted(() => {
  // 销毁图表实例
  if (sslChart.value) {
    sslChart.value.dispose();
    sslChart.value = null;
  }
  if (statusChart.value) {
    statusChart.value.dispose();
    statusChart.value = null;
  }
  
  // 移除事件监听
  window.removeEventListener('resize', () => {});
});

// 暴露方法给父组件
defineExpose({
  refreshStats,
  updateStats
});

// 更新图表
const updateCharts = () => {
  nextTick(() => {
    // SSL证书状态图表
    const sslChartOption = {
      title: {
        text: 'SSL证书状态分布',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'normal'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 10,
        top: 'center',
        data: ['有效', '即将过期', '已过期', '无效', '无SSL']
      },
      series: [
        {
          name: 'SSL证书状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: [
            { value: stats.value.sslValid, name: '有效', itemStyle: { color: '#67c23a' } },
            { value: stats.value.sslExpiringSoon, name: '即将过期', itemStyle: { color: '#e6a23c' } },
            { value: stats.value.sslExpired, name: '已过期', itemStyle: { color: '#f56c6c' } },
            { value: stats.value.sslSelfSigned, name: '无效', itemStyle: { color: '#909399' } },
            { value: stats.value.sslNone, name: '无SSL', itemStyle: { color: '#c0c4cc' } }
          ]
        }
      ]
    };
    
    if (sslChartRef.value) {
      if (sslChart.value) {
        sslChart.value.setOption(sslChartOption);
      } else {
        sslChart.value = echarts.init(sslChartRef.value);
        sslChart.value.setOption(sslChartOption);
      }
    }
    
    // HTTP状态码分布图表
    const statusData = Object.entries(stats.value.statusCodes).map(([code, count]) => {
      return { code, count };
    });
    
    statusData.sort((a, b) => b.count - a.count);
    
    const statusChartOption = {
      title: {
        text: 'HTTP状态码分布',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'normal'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: statusData.map(item => item.code),
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '网站数量',
          type: 'bar',
          barWidth: '60%',
          data: statusData.map(item => {
            let color = '#909399';
            if (item.code.startsWith('2')) color = '#67c23a';
            if (item.code.startsWith('3')) color = '#e6a23c';
            if (item.code.startsWith('4') || item.code.startsWith('5')) color = '#f56c6c';
            
            return {
              value: item.count,
              itemStyle: { color }
            };
          })
        }
      ]
    };
    
    if (statusChartRef.value) {
      if (statusChart.value) {
        statusChart.value.setOption(statusChartOption);
      } else {
        statusChart.value = echarts.init(statusChartRef.value);
        statusChart.value.setOption(statusChartOption);
      }
    }
  });
};
</script>

<style scoped>
.statistics-card {
  margin-bottom: 20px;
  transition: all 0.3s;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  background-color: #ffffff;
  overflow: hidden;
}

.statistics-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #f0f0f0;
  background-color: #f9f9f9;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.stats-content {
  padding: 20px;
}

.statistics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.stat-item {
  background-color: #fff;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
  border: 1px solid #f0f0f0;
}

.stat-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.08);
}

.stat-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
  background-color: #dcdfe6;
}

.total-websites::before {
  background-color: #409eff;
}

.accessible-websites::before {
  background-color: #67c23a;
}

.inaccessible-websites::before {
  background-color: #f56c6c;
}

.response-time::before {
  background-color: #e6a23c;
}

.accessibility-rate::before {
  background-color: #909399;
}

.stat-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 15px;
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 10px;
}

.stat-value .success {
  color: #67c23a;
}

.stat-value .warning {
  color: #e6a23c;
}

.stat-value .danger {
  color: #f56c6c;
}

.stat-icon {
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 24px;
  opacity: 0.2;
}

.accessibility-rate {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rate-value {
  font-size: 28px;
  font-weight: bold;
}

.rate-value.success {
  color: #67c23a;
}

.rate-value.warning {
  color: #e6a23c;
}

.rate-value.danger {
  color: #f56c6c;
}

.ssl-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin: 15px 0 25px;
}

.ssl-item {
  display: flex;
  align-items: center;
  padding: 8px 15px;
  background-color: #f5f7fa;
  border-radius: 8px;
  transition: all 0.2s;
}

.ssl-item:hover {
  background-color: #ecf5ff;
}

.ssl-count {
  margin-left: 10px;
  font-weight: bold;
  font-size: 16px;
}

.status-codes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 15px 0 25px;
}

.status-code-item {
  display: flex;
  align-items: center;
  padding: 8px 15px;
  background-color: #f5f7fa;
  border-radius: 8px;
  transition: all 0.2s;
}

.status-code-item:hover {
  background-color: #ecf5ff;
}

.status-code-count {
  margin-left: 10px;
  font-weight: bold;
  font-size: 16px;
}

.ssl-chart-container, .status-chart-container {
  margin: 25px 0;
}

.ssl-chart, .status-chart {
  width: 100%;
  height: 300px;
  background-color: #fff;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #f0f0f0;
}

.recent-updates {
  margin-top: 20px;
}

.response-time-indicator {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.response-time-label {
  font-size: 12px;
  margin-top: 5px;
  text-align: center;
  font-weight: bold;
  color: #606266;
}

/* 添加数据加载动画 */
@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}

.refreshing .stat-value,
.refreshing .rate-value {
  animation: pulse 1.5s infinite;
}

.el-divider {
  margin: 30px 0;
}
</style>
