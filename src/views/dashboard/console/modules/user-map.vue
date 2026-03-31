<!-- 人员轨迹地图组件
  功能：展示人员实时定位 + 历史轨迹播放 + 人员列表筛选
  技术：QQ地图 + Vue3 + Element Plus
-->
<template>
  <div class="user-map-container">
    <!-- 左侧地图展示区域 -->
    <div class="map-content">
      <!-- 地图DOM容器 -->
      <div id="map-container" class="map-container"></div>
      <!-- 地图加载中提示 -->
      <div v-if="loading" class="loading">地图加载中...</div>
      <!-- 异常错误提示 -->
      <div v-if="error" class="error">{{ error }}</div>
    </div>

    <!-- 右侧人员列表面板 -->
    <div class="user-list">
      <!-- 面板顶部固定区域：标题 + 搜索筛选 -->
      <div class="user-list-fixed">
        <!-- 标题栏 + 返回主页按钮 -->
        <div class="title-row">
          <h3 class="user-list-title">人员列表</h3>
          <img
            src="@/assets/images/icon/Home.png"
            class="home-img-btn"
            @click="goToHomePage"
            title="返回主页"
          >
        </div>

        <!-- 日期选择 + 关键词搜索 行 -->
        <div class="search-date-row">
          <!-- 日期选择器：筛选某一天的轨迹 -->
          <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            class="date-picker"
          />
          <!-- 搜索框：按姓名/工号模糊搜索 -->
          <el-input
            v-model="searchKeyword"
            placeholder="搜索姓名/工号"
            class="search-input"
            @input="filterUsers"
            clearable
          />
        </div>

        <!-- 筛选确认按钮 -->
        <el-button
          type="primary"
          @click="filterUsers"
          style="width: 100%; margin-top: 10px"
        >
          筛选
        </el-button>
      </div>

      <!-- 人员列表滚动区域 -->
      <div class="user-list-scroll">
        <!-- 加载状态 -->
        <div v-if="loading" class="user-list-loading">加载中...</div>
        <!-- 无数据状态 -->
        <div v-else-if="filteredUserList.length === 0" class="user-list-empty">暂无人员数据</div>

        <!-- 人员卡片列表 -->
        <div
          v-for="user in filteredUserList"
          :key="user.usercode"
          class="user-card"
          :class="{ active: selectedUser === user.usercode }"
          @click="showUserHistory(user.usercode)"
        >
          <!-- 卡片头部：姓名/工号 + 时间 -->
          <div class="user-card-header">
            <span class="user-code">
              {{ user.username || user.usercode }}
              <span v-if="user.username && user.usercode" class="user-code-sub">
                ({{ user.usercode }})
              </span>
            </span>
            <span class="user-time">{{ formatTime(user.createTime) }}</span>
          </div>

          <!-- 卡片内容：经纬度 + 查勘定损量 -->
          <div class="user-card-body">
            <div class="user-location">
              <span class="label">经纬度</span>
              <span class="value">{{ `${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}` }}</span>
            </div>
            <div class="user-info" v-if="user.ckl || user.dsl">
              查勘量: {{ user.ckl || '-' }} &nbsp;&nbsp;|&nbsp;&nbsp; 定损量: {{ user.dsl || '-' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

// 给全局 window.qq.maps 做类型声明，避免TS报错
declare global {
  interface Window {
    qq: any
  }
}

// ==================== 地图实例与覆盖物 ====================
// 地图实例对象
const map = ref<any>(null)
// 存储所有点标记（人员位置、起点、终点）
const markers = ref<any[]>([])
// 存储轨迹线
const polylines = ref<any[]>([])

// ==================== 状态控制 ====================
// 全局加载状态
const loading = ref(true)
// 错误提示信息
const error = ref('')
// 原始人员列表数据
const userList = ref<any[]>([])
// 当前选中的人员 usercode
const selectedUser = ref<string>('')

// ==================== 搜索与筛选 ====================
// 搜索关键词
const searchKeyword = ref('')

// 计算属性：根据关键词对人员列表进行模糊过滤
const filteredUserList = computed(() => {
  if (!searchKeyword.value) return userList.value
  const kw = searchKeyword.value.toLowerCase()
  return userList.value.filter(u => {
    const name = (u.username || '').toLowerCase()
    const code = (u.usercode || '').toLowerCase()
    return name.includes(kw) || code.includes(kw)
  })
})

// ==================== 轨迹动画相关 ====================
// 轨迹播放小车图标
const playMarker = ref<any>(null)
// 动画定时器
const playTimer = ref<any>(null)
// 动画速度（越小越快）
const playSpeed = ref(16)

// ==================== 日期与时间格式化 ====================
// 获取今天日期并格式化为 YYYY-MM-DD
const today = new Date()
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
// 默认选中今天
const selectedDate = ref<string | null>(formatDate(today))

// 时间格式化：转为本地标准时间字符串
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

// ==================== 轨迹平滑与方向计算 ====================
// 记录上一次车头方向，用于平滑旋转
let lastHeading = 0

// 轨迹插值：把稀疏点加密成密集点，让小车移动更丝滑
const interpolatePath = (path: any[], segmentCount = 120) => {
  let smoothPath: any[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]
    const end = path[i + 1]
    // 两点之间插入 segmentCount 个点
    for (let j = 0; j <= segmentCount; j++) {
      const t = j / segmentCount
      const lat = start.lat + (end.lat - start.lat) * t
      const lng = start.lng + (end.lng - start.lng) * t
      smoothPath.push(new window.qq.maps.LatLng(lat, lng))
    }
  }
  return smoothPath
}

// 计算车头方向并做平滑处理，防止突然360°旋转
const computeSmoothHeading = (from: any, to: any) => {
  const dy = to.lng - from.lng
  const dx = to.lat - from.lat
  let heading = Math.atan2(dy, dx) * 180 / Math.PI
  // 解决角度跨180度时旋转异常
  const diff = heading - lastHeading
  if (Math.abs(diff) > 180) {
    heading -= Math.sign(diff) * 360
  }
  lastHeading = heading
  return heading
}

// ==================== 地图初始化 ====================
const initMap = async () => {
  try {
    // 判断地图SDK是否加载成功
    if (!window.qq || !window.qq.maps) {
      throw new Error('地图SDK加载失败')
    }

    // 设置地图中心点（成都）
    const center = new window.qq.maps.LatLng(30.6799, 104.0571)
    // 创建地图实例
    map.value = new window.qq.maps.Map(document.getElementById('map-container'), {
      center,
      zoom: 12,
      draggable: true,
      scrollwheel: true
    })

    // 初始化后立即获取最新人员位置
    await fetchLatestLocations()
    loading.value = false
  } catch (err: unknown) {
    console.error('地图初始化失败', err)
    error.value = '地图加载失败'
    loading.value = false
  }
}

// ==================== 获取人员最新位置列表 ====================
const fetchLatestLocations = async (date?: string) => {
  try {
    let url = 'http://localhost:8080/api/locations/latest'
    if (date) url += `?date=${date}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP错误: ${res.status}`)
    const data = await res.json()

    // 清除旧的地图覆盖物
    clearOverlays()

    if (!data || data.length === 0) {
      userList.value = []
      return
    }

    // 更新人员列表
    userList.value = data

    // 循环为每个人员创建地图标记点
    userList.value.forEach((user) => {
      const pos = new window.qq.maps.LatLng(user.latitude, user.longitude)
      const marker = new window.qq.maps.Marker({
        position: pos,
        map: map.value,
        title: `${user.username || ''} (${user.usercode})`,
        icon: 'src/assets/images/icon/Location.png'
      })
      markers.value.push(marker)

      // 创建点击弹窗信息
      const info = new window.qq.maps.InfoWindow({
        content: `
          <div style="padding:8px;">
            <strong>用户：</strong>${user.username || user.usercode}<br>
            <strong>时间：</strong>${formatTime(user.createTime)}<br>
            <strong>经纬度：</strong>${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}<br>
            <strong>CKL：</strong>${user.ckl || '-'} | <strong>DSL：</strong>${user.dsl || '-'}`
      })

      // 绑定点击事件：打开信息弹窗
      window.qq.maps.event.addListener(marker, 'click', () => {
        info.open(map.value, marker)
      })
    })

    // 自动调整地图视野，显示所有标记
    if (markers.value.length) {
      const bounds = new window.qq.maps.LatLngBounds()
      markers.value.forEach((m) => bounds.extend(m.getPosition()))
      map.value.fitBounds(bounds)
    }
  } catch (e) {
    console.error('获取人员数据失败', e)
    error.value = '后端接口异常'
  }
}

// ==================== 筛选按钮事件 ====================
const filterUsers = async () => {
  // 根据选中日期重新拉取数据
  await fetchLatestLocations(selectedDate.value || undefined)
}

// ==================== 返回主页视图 ====================
const goToHomePage = async () => {
  // 清空选中与搜索状态
  selectedUser.value = ''
  searchKeyword.value = ''
  // 清除轨迹重新加载最新位置
  clearOverlays()
  await fetchLatestLocations(selectedDate.value || undefined)
}

// ==================== 查看单人历史轨迹 ====================
const showUserHistory = async (usercode: string) => {
  try {
    // 标记当前选中人员
    selectedUser.value = usercode
    // 清除旧轨迹
    clearOverlays()
    lastHeading = 0

    // 请求该人员某天的轨迹数据
    let url = `http://localhost:8080/api/locations/user/${usercode}`
    if (selectedDate.value) url += `?date=${selectedDate.value}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP错误: ${res.status}`)
    const data = await res.json()

    if (!data || data.length === 0) {
      error.value = '该用户当日无轨迹数据'
      return
    }

    // 按时间升序排序轨迹点
    const sortedPath = data.sort((a: any, b: any) =>
      new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
    )

    // 构造地图经纬度路径
    const path = sortedPath.map((item: any) =>
      new window.qq.maps.LatLng(item.latitude, item.longitude)
    )

    // 绘制轨迹路线
    const line = new window.qq.maps.Polyline({
      map: map.value,
      path: path,
      strokeColor: '#FF5722',
      strokeWeight: 4,
      strokeOpacity: 0.4
    })
    polylines.value.push(line)

    // 起点标记
    const startPoint = path[0]
    const startMarker = new window.qq.maps.Marker({
      position: startPoint,
      map: map.value,
      icon: new window.qq.maps.MarkerImage(
        'src/assets/images/icon/FirstPoint.png',
        new window.qq.maps.Size(24, 24),
        null,
        new window.qq.maps.Point(12, 24),
        new window.qq.maps.Size(24, 24)
      ),
      zIndex: 100
    })
    markers.value.push(startMarker)

    // 终点标记
    const endPoint = path[path.length - 1]
    const endMarker = new window.qq.maps.Marker({
      position: endPoint,
      map: map.value,
      icon: new window.qq.maps.MarkerImage(
        'src/assets/images/icon/EndPoint.png',
        new window.qq.maps.Size(24, 24),
        null,
        new window.qq.maps.Point(12, 24),
        new window.qq.maps.Size(24, 24)
      ),
      zIndex: 100
    })
    markers.value.push(endMarker)

    // 创建轨迹动画小车图标
    playMarker.value = new window.qq.maps.Marker({
      position: path[0],
      map: map.value,
      icon: new window.qq.maps.MarkerImage(
        'src/assets/images/icon/car.png',
        new window.qq.maps.Size(36, 36),
        null,
        null,
        new window.qq.maps.Size(36, 36)
      ),
      zIndex: 999,
      anchor: new window.qq.maps.Point(18, 18)
    })

    // 开始小车轨迹动画
    startPlay(path)

    // 自动缩放视野以展示整条轨迹
    const bounds = new window.qq.maps.LatLngBounds()
    path.forEach((p: any) => bounds.extend(p))
    map.value.fitBounds(bounds)

    error.value = ''
  } catch (e) {
    console.error('获取轨迹失败详情:', e)
    error.value = `获取轨迹失败: ${(e as Error).message}`
  }
}

// ==================== 轨迹动画播放 ====================
const startPlay = (path: any[]) => {
  // 清除已有动画
  if (playTimer.value) clearInterval(playTimer.value)
  // 对轨迹进行插值加密
  const smoothPath = interpolatePath(path, 200)
  let index = 0
  const len = smoothPath.length

  // 动画帧函数
  const run = () => {
    if (index >= len) {
      index = 0 // 循环播放
    }

    const curr = smoothPath[index]
    const next = smoothPath[Math.min(index + 1, len - 1)]
    // 计算车头方向
    const heading = computeSmoothHeading(curr, next)

    // 更新小车位置与角度
    playMarker.value.setPosition(curr)
    playMarker.value.setRotation(heading)

    index++
  }

  // 启动定时器
  playTimer.value = setInterval(run, playSpeed.value)
}

// ==================== 清除地图所有覆盖物 ====================
const clearOverlays = () => {
  // 清除动画
  if (playTimer.value) clearInterval(playTimer.value)
  if (playMarker.value) {
    playMarker.value.setMap(null)
    playMarker.value = null
  }

  // 清除所有标记和折线
  if (map.value) {
    markers.value.forEach(m => m.setMap(null))
    polylines.value.forEach(p => p.setMap(null))
  }

  // 清空数组
  markers.value = []
  polylines.value = []
}

// ==================== 生命周期 ====================
// 页面挂载后初始化地图
onMounted(() => {
  initMap()
})

// 页面卸载前清理地图资源
onBeforeUnmount(() => {
  clearOverlays()
  map.value = null
})
</script>

<style scoped>
/* 输入框文字颜色强化，避免被全局样式覆盖变浅 */
:deep(.el-input__inner) {
  color: #1d2129 !important;
  --el-input-text-color: #1d2129 !important;
}
:deep(.el-input__inner::placeholder) {
  color: #999 !important;
}

/* 强制覆盖日期选择器默认宽度，使 flex 布局能正常分配比例 */
:deep(.el-date-editor.el-input--mini),
:deep(.el-date-editor.el-input),
:deep(.el-date-editor) {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

/* 日期 + 搜索框横向布局 */
.search-date-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.search-date-row .date-picker {
  flex: 1;
  min-width: 150px;
  max-width: 225px;
}
.search-date-row .search-input {
  flex: 1;
  min-width: 125px;
}

/* 整体布局：地图 + 人员面板 */
.user-map-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  background: #f5f7fa;
}

/* 地图区域样式 */
.map-content {
  flex: 1;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
.map-container {
  width: 100%;
  height: 500px;
}

/* 右侧人员列表面板 */
.user-list {
  width: 320px;
  height: 500px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 顶部搜索栏固定，不跟随滚动 */
.user-list-fixed {
  flex-shrink: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f2f5;
  margin-bottom: 8px;
}

/* 标题栏样式 */
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.user-list-title {
  font-size: 18px;
  font-weight: 600;
  color: #1d2129;
  margin: 0;
  letter-spacing: 0.5px;
}
/* 返回主页图标 */
.home-img-btn {
  width: 26px;
  height: 26px;
  cursor: pointer;
  transition: all 0.25s ease;
  opacity: 0.85;
}
.home-img-btn:hover {
  opacity: 1;
  transform: scale(1.08);
}

/* 滚动列表区域：超细滚动条美化 */
.user-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding-top: 12px;
  padding-bottom: 4px;
  padding-right: 0px !important;
  margin-right: -8px;
}
.user-list-scroll::-webkit-scrollbar {
  width: 2px !important;
  height: 2px !important;
}
.user-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.3) !important;
  border-radius: 10px !important;
  opacity: 0.4 !important;
}
.user-list-scroll::-webkit-scrollbar-track {
  background: transparent !important;
}

/* 人员卡片样式 */
.user-card {
  background: #ffffff;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.28s ease;
  border: 1px solid #f0f2f5;
}
/* 卡片悬浮效果 */
.user-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: #409EFF;
}
/* 卡片选中样式 */
.user-card.active {
  border-color: #409EFF;
  background: linear-gradient(135deg, #edf7ff 0%, #e8f3ff 100%);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

/* 卡片内部结构 */
.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.user-code {
  font-weight: 600;
  font-size: 15px;
  color: #222;
}
.user-code-sub {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
  font-weight: normal;
}
.user-time {
  font-size: 12px;
  color: #86909c;
  white-space: nowrap;
}

.user-card-body {
  font-size: 14px;
  line-height: 1.5;
}
.user-location {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.user-location .label {
  color: #4e5969;
  font-weight: 500;
  font-size: 13px;
}
.user-location .value {
  color: #1d2129;
  font-family: monospace;
  font-size: 13px;
}
.user-info {
  font-size: 12px;
  color: #666;
  padding-top: 6px;
  border-top: 1px dashed #f0f2f5;
  margin-top: 6px;
}

/* 加载与错误提示样式 */
.loading, .error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  font-size: 14px;
}
.error {
  color: #f56c6c;
}
.user-list-loading, .user-list-empty {
  padding: 50px 0;
  color: #999;
  text-align: center;
  font-size: 14px;
}

/* 移动端响应式适配 */
@media (max-width: 768px) {
  .user-map-container {
    flex-direction: column;
    gap: 16px;
  }
  .user-list {
    width: 100%;
    height: auto;
    max-height: 280px;
  }
}
</style>