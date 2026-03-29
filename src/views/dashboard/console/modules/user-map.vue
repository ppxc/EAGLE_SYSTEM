<!-- 人员路线地图组件 -->
<template>
  <div class="user-map-container">
    <div class="map-content">
      <div id="map-container" class="map-container"></div>
      <div v-if="loading" class="loading">地图加载中...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
    <div class="user-list">
      <h3 class="user-list-title">人员列表</h3>
      <div v-if="loading" class="user-list-loading">加载中...</div>
      <div v-else-if="userList.length === 0" class="user-list-empty">暂无人员数据</div>
      <div
        v-for="user in userList"
        :key="user.usercode"
        class="user-card"
        :class="{ 'active': selectedUser === user.usercode }"
        @click="showUserHistory(user.usercode)"
      >
        <div class="user-card-header">
          <span class="user-code">{{ user.usercode }}</span>
          <span class="user-time">{{ formatTime(user.createTime) }}</span>
        </div>
        <div class="user-card-body">
          <div class="user-location">
            <span class="label">当前位置:</span>
            <span class="value">{{ user.latitude.toFixed(4) }}, {{ user.longitude.toFixed(4) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'

declare global {
  interface Window {
    qq: any
  }
}

const map = ref<any>(null)
const markers = ref<any[]>([])
const polylines = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const userList = ref<any[]>([])
const selectedUser = ref<string>('')

// 格式化时间
const formatTime = (timeString: string) => {
  const date = new Date(timeString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 初始化地图
const initMap = async () => {
  try {
    if (!window.qq || !window.qq.maps) {
      throw new Error("地图SDK加载失败")
    }

    // 成都中心
    const center = new window.qq.maps.LatLng(30.6799, 104.0571)
    
    map.value = new window.qq.maps.Map(document.getElementById("map-container"), {
      center: center,
      zoom: 12,
      draggable: true,
      scrollwheel: true
    })

    await fetchLatestLocations()
    loading.value = false
  } catch (err: unknown) {
    console.error('地图初始化失败', err)
    error.value = '地图加载失败'
    loading.value = false
  }
}

// 获取每个用户最新的位置
const fetchLatestLocations = async () => {
  try {
    const res = await fetch('http://localhost:8080/api/locations/latest')
    const data = await res.json()
    console.log('获取数据:', data)

    clearOverlays()
    if (!data || data.length === 0) {
      userList.value = []
      return
    }

    // 按usercode分组并获取最新记录
    const userGroups: any = {}
    data.forEach((item: any) => {
      if (!userGroups[item.usercode] || 
          new Date(item.createTime).getTime() > new Date(userGroups[item.usercode].createTime).getTime()) {
        userGroups[item.usercode] = item
      }
    })

    // 转换为数组
    userList.value = Object.values(userGroups)

    // 在地图上显示最新位置
    userList.value.forEach((user: any) => {
      const pos = new window.qq.maps.LatLng(user.latitude, user.longitude)
      const marker = new window.qq.maps.Marker({
        position: pos,
        map: map.value,
        title: user.usercode
      })
      markers.value.push(marker)

      // 点击标记显示信息窗口
      const info = new window.qq.maps.InfoWindow({
        content: `
          <div style="padding:8px;">
            <strong>用户：</strong>${user.usercode}<br>
            <strong>时间：</strong>${formatTime(user.createTime)}<br>
            <strong>经纬度：</strong>${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}
          </div>
        `
      })

      window.qq.maps.event.addListener(marker, 'click', () => {
        info.open(map.value, marker)
      })
    })

    // 自适应视野
    if (markers.value.length > 0) {
      const bounds = new window.qq.maps.LatLngBounds()
      markers.value.forEach(marker => {
        bounds.extend(marker.getPosition())
      })
      map.value.fitBounds(bounds)
    }
  } catch (e) {
    console.error('获取数据失败', e)
    error.value = '后端接口异常'
  }
}

// 显示用户历史轨迹
const showUserHistory = async (usercode: string) => {
  try {
    selectedUser.value = usercode
    clearOverlays()

    // 获取用户历史数据
    const res = await fetch(`http://localhost:8080/api/locations/user/${usercode}`)
    const data = await res.json()
    console.log(`获取${usercode}的历史数据:`, data)

    if (!data || data.length === 0) {
      error.value = '该用户暂无历史数据'
      return
    }

    // 按时间排序
    data.sort((a: any, b: any) => {
      return new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
    })

    // 绘制轨迹
    const path = data.map((item: any) => 
      new window.qq.maps.LatLng(item.latitude, item.longitude)
    )

    const line = new window.qq.maps.Polyline({
      map: map.value,
      path: path,
      strokeColor: '#409EFF',
      strokeWeight: 4,
      strokeOpacity: 0.8
    })
    polylines.value.push(line)

    // 绘制标记点
    data.forEach((item: any, index: number) => {
      const pos = new window.qq.maps.LatLng(item.latitude, item.longitude)
      const marker = new window.qq.maps.Marker({
        position: pos,
        map: map.value,
        title: `${usercode} - 点 ${index + 1}`
      })
      markers.value.push(marker)

      // 点击标记显示信息窗口
      const info = new window.qq.maps.InfoWindow({
        content: `
          <div style="padding:8px;">
            <strong>用户：</strong>${item.usercode}<br>
            <strong>时间：</strong>${formatTime(item.createTime)}<br>
            <strong>经纬度：</strong>${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}<br>
            <strong>点序号：</strong>${index + 1}/${data.length}
          </div>
        `
      })

      window.qq.maps.event.addListener(marker, 'click', () => {
        info.open(map.value, marker)
      })
    })

    // 聚焦到用户轨迹
    if (path.length > 0) {
      const bounds = new window.qq.maps.LatLngBounds()
      path.forEach((point: any) => {
        bounds.extend(point)
      })
      map.value.fitBounds(bounds)
    }

    error.value = ''
  } catch (e) {
    console.error('获取历史数据失败', e)
    error.value = '获取历史数据失败'
  }
}

// 清理覆盖物
const clearOverlays = () => {
  if (map.value) {
    markers.value.forEach(m => m.setMap(null))
    polylines.value.forEach(p => p.setMap(null))
  }
  markers.value = []
  polylines.value = []
}

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  clearOverlays()
  map.value = null
})
</script>

<style scoped>
.user-map-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
}

.map-content {
  flex: 1;
  position: relative;
}

.map-container {
  width: 100%;
  height: 500px;
}

.user-list {
  width: 300px;
  height: 500px;
  overflow-y: auto;
  background-color: #f9f9f9;
  border-left: 1px solid #eaeaea;
  padding: 16px;
}

.user-list-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #333;
}

.user-card {
  background-color: white;
  border: 1px solid #eaeaea;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.user-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #409EFF;
}

.user-card.active {
  border-color: #409EFF;
  background-color: #ecf5ff;
}

.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.user-code {
  font-weight: bold;
  color: #333;
}

.user-time {
  font-size: 12px;
  color: #999;
}

.user-card-body {
  font-size: 14px;
}

.user-location {
  display: flex;
  justify-content: space-between;
}

.user-location .label {
  color: #666;
}

.user-location .value {
  color: #333;
  font-family: monospace;
}

.loading, .error, .user-list-loading, .user-list-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.error {
  color: #f56c6c;
}

.user-list-loading, .user-list-empty {
  position: relative;
  top: auto;
  left: auto;
  transform: none;
  padding: 40px 0;
  color: #999;
}

@media (max-width: 768px) {
  .user-map-container {
    flex-direction: column;
  }
  
  .user-list {
    width: 100%;
    height: 200px;
    border-left: none;
    border-top: 1px solid #eaeaea;
  }
}
</style>
