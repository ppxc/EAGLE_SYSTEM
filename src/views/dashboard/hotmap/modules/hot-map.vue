<template>
  <div class="heat-map-page">
    <div class="map-container-box">
      <div id="heat-map-container" class="map-container"></div>
      <div v-if="loading" class="loading">地图加载中...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue'

  declare global {
    interface Window {
      TMap: any
    }
  }

  // 实例
  let map: any = null
  let heat: any = null

  // 状态
  const loading = ref(true)
  const error = ref('')

  // ==================== 初始化地图 ====================
  const initMap = async () => {
    try {
      let attempts = 0
      while (!window.TMap && attempts < 100) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }
      if (!window.TMap) throw new Error('腾讯地图加载失败')

      const container = document.getElementById('heat-map-container')
      if (!container) return

      // 创建地图
      map = new window.TMap.Map(container, {
        center: new window.TMap.LatLng(30.6799, 104.0571), // 成都
        zoom: 12,
        pitch: 45,
        mapStyleId: 'style1',
        baseMap: {
          type: 'vector',
          features: ['base', 'building3d']
        }
      })

      // 设置地图控件位置到左上角
      let zoomControl = map.getControl(window.TMap.constants.DEFAULT_CONTROL_ID.ZOOM)
      let rotationControl = map.getControl(window.TMap.constants.DEFAULT_CONTROL_ID.ROTATION)
      if (zoomControl) {
        zoomControl.setPosition(window.TMap.constants.CONTROL_POSITION.TOP_LEFT)
      }
      if (rotationControl) {
        rotationControl.setPosition(window.TMap.constants.CONTROL_POSITION.TOP_LEFT)
      }

      // 初始化热力图
      initHeatMap()

      loading.value = false
    } catch (err: any) {
      error.value = '地图加载失败：' + err.message
      loading.value = false
    }
  }

  // ==================== 初始化热力图 ====================
  const initHeatMap = () => {
    heat = new window.TMap.visualization.Heat({
      max: 180,
      min: 0,
      height: 40,
      radius: 30,
      transitAnimation: { duration: 1500 }
    }).addTo(map)

    // —————— 这里放你的最终案件数据 ——————
    const yourCaseData = [
      { lat: 30.6799, lng: 104.0571, count: 10 },
      { lat: 30.6799, lng: 104.0571, count: 20 },
      { lat: 30.6799, lng: 104.39, count: 5 }
    ]

    // 执行从0涨到最终值动画
    startHeatGrowAnimation(yourCaseData)
  }

  // ==================== 热力从0增长动画（你要的核心功能） ====================
  const startHeatGrowAnimation = (finalData: any[]) => {
    let progress = 0
    const totalSteps = 50
    const interval = 30

    const timer = setInterval(() => {
      progress++
      if (progress >= totalSteps) {
        clearInterval(timer)
        heat.setData(finalData)
        return
      }

      const currentData = finalData.map((item) => ({
        lat: item.lat,
        lng: item.lng,
        count: item.count * (progress / totalSteps)
      }))

      heat.setData(currentData)
    }, interval)
  }

  // ==================== 生命周期 ====================
  onMounted(() => {
    initMap()
  })

  onBeforeUnmount(() => {
    if (map) {
      map.destroy()
      map = null
      heat = null
    }
  })
</script>

<style scoped>
  .heat-map-page {
    width: 100%;
    height: 100vh;
    background: #111827;
  }
  .map-container-box {
    width: 100%;
    height: 100%;
    position: relative;
  }
  .map-container {
    width: 100%;
    height: 100%;
  }
  .loading,
  .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
  }
</style>
