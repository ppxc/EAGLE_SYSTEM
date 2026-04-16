<template>
  <div class="page-wrapper">
    <!-- 顶部操作栏 -->
    <div class="toolbar" style="padding: 12px 20px; display: flex; align-items: center; gap: 8px;">
      <el-date-picker
        v-model="queryTime"
        type="date"
        placeholder="选择查询日期"
        value-format="yyyy-MM-dd"
        style="width: 170px;"
        size="small"
      />

      <el-button type="primary" size="small" @click="fetchData">
        查询
      </el-button>

      <el-button type="primary" size="small" @click="exportExcel">
        导出Excel
      </el-button>

      <el-input
        v-model="searchKey"
        placeholder="搜索表格内容"
        style="width: 170px;"
        size="small"
        clearable
      />

      <!-- 筛选列表 -->
      <el-dropdown 
        trigger="click" 
        :hide-on-click="false"
        ref="dropdownRef"
      >
        <el-button type="primary" size="small">
          筛选列表 <i class="el-icon-arrow-down el-icon--right"></i>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item divided>
              <el-checkbox v-model="checkAll" @change="handleCheckAll">全选</el-checkbox>
            </el-dropdown-item>

            <el-dropdown-item>
              <el-checkbox v-model="tempColShow.cityCompany">市公司</el-checkbox>
            </el-dropdown-item>
            <el-dropdown-item>
              <el-checkbox v-model="tempColShow.surveyCycle">查勘周期</el-checkbox>
            </el-dropdown-item>
            <el-dropdown-item>
              <el-checkbox v-model="tempColShow.urgeDetermineCycle">催定周期</el-checkbox>
            </el-dropdown-item>
            <el-dropdown-item>
              <el-checkbox v-model="tempColShow.determineCycle">定损周期</el-checkbox>
            </el-dropdown-item>
            <el-dropdown-item>
              <el-checkbox v-model="tempColShow.determineToPay">定损-支付</el-checkbox>
            </el-dropdown-item>
            <el-dropdown-item>
              <el-checkbox v-model="tempColShow.totalCloseCycle">整体结案周期</el-checkbox>
            </el-dropdown-item>
            <el-dropdown-item>
              <el-checkbox v-model="tempColShow.under10kCloseCycle">万元内结案</el-checkbox>
            </el-dropdown-item>
            <el-dropdown-item>
              <el-checkbox v-model="tempColShow.over10kCloseCycle">万元以上结案</el-checkbox>
            </el-dropdown-item>

            <el-dropdown-item divided style="text-align: center;">
              <el-button type="primary" size="small" @click="confirmColSelect">
                确认
              </el-button>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 左上角小标题（在查询栏下方，小字体，蓝色） -->
    <div style="padding: 0 20px 8px; font-size: 14px; color: #409eff; font-weight: 500;">
      四川省周期报表
    </div>

    <!-- 表格 -->
    <div style="width: 100%; overflow: auto;">
      <div style="width: 100%; overflow-x: auto; padding-bottom: 10px;">
        <el-table
          :data="sortedTableData"
          border
          stripe
          v-loading="loading"
          style="width: 100%; min-width: 1700px"
          max-height="calc(100vh - 160px)"
          @sort-change="handleSortChange"
        >
          <el-table-column label="序号" type="index" width="70" fixed />
          <el-table-column label="市公司" prop="cityCompany" width="220" fixed v-if="colShow.cityCompany" sortable="custom" />
          <el-table-column label="查勘周期(天)" prop="surveyCycle" width="140" v-if="colShow.surveyCycle" sortable />
          <el-table-column label="催定周期(天)" prop="urgeDetermineCycle" width="140" v-if="colShow.urgeDetermineCycle" sortable />
          <el-table-column label="定损周期(天)" prop="determineCycle" width="140" v-if="colShow.determineCycle" sortable />
          <el-table-column label="定损完成-支付(天)" prop="determineToPay" width="170" v-if="colShow.determineToPay" sortable />
          <el-table-column label="整体结案周期(天)" prop="totalCloseCycle" width="160" v-if="colShow.totalCloseCycle" sortable />
          <el-table-column label="万元内案件结案周期(天)" prop="under10kCloseCycle" width="200" v-if="colShow.under10kCloseCycle" sortable />
          <el-table-column label="万元以上案件结案周期(天)" prop="over10kCloseCycle" width="200" v-if="colShow.over10kCloseCycle" sortable />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import * as XLSX from 'xlsx'

const queryTime = ref('')
const tableData = ref([])
const loading = ref(false)
const searchKey = ref('')
const dropdownRef = ref(null)

const sortConfig = ref({ prop: 'cityCompany', order: 'ascending' })

// 真实显示列
const colShow = ref({
  cityCompany: true,
  surveyCycle: true,
  urgeDetermineCycle: true,
  determineCycle: true,
  determineToPay: true,
  totalCloseCycle: true,
  under10kCloseCycle: true,
  over10kCloseCycle: true,
})

// 临时勾选列
const tempColShow = ref(JSON.parse(JSON.stringify(colShow.value)))
const checkAll = ref(true)

// 全选
const handleCheckAll = (val: boolean) => {
  Object.keys(tempColShow.value).forEach(k => {
    tempColShow.value[k] = val
  })
}

// 确认选择 → 关闭下拉框
const confirmColSelect = () => {
  colShow.value = JSON.parse(JSON.stringify(tempColShow.value))
  dropdownRef.value.handleClose()
}

// 监听面板勾选，更新全选状态
watch(tempColShow, () => {
  checkAll.value = Object.values(tempColShow.value).every(Boolean)
}, { deep: true })

// 搜索
const filteredTableData = computed(() => {
  if (!searchKey.value) return tableData.value
  const k = searchKey.value.toLowerCase()
  return tableData.value.filter(item => 
    Object.values(item).some(v => String(v).toLowerCase().includes(k))
  )
})

// 排序
const sortedTableData = computed(() => {
  const d = [...filteredTableData.value]
  const { prop, order } = sortConfig.value
  if (!prop) return d

  d.sort((a, b) => {
    if (prop === 'cityCompany') {
      const r = a.cityCompany.localeCompare(b.cityCompany, 'zh-CN')
      return order === 'ascending' ? r : -r
    }
    const va = Number(a[prop]) || 0
    const vb = Number(b[prop]) || 0
    return order === 'ascending' ? va - vb : vb - va
  })
  return d
})

const handleSortChange = ({ prop, order }) => {
  sortConfig.value = { prop, order }
}

// 查询
const fetchData = async () => {
  loading.value = true
  try {
    const res = await axios.get('http://localhost:8080/api/aaa/list', {
      params: { queryTime: queryTime.value }
    })
    tableData.value = res.data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 导出
const exportExcel = () => {
  if (!sortedTableData.value.length) return alert('暂无数据')
  const data = sortedTableData.value.map((it, idx) => ({
    '序号': idx + 1,
    '市公司': it.cityCompany,
    '查勘周期(天)': it.surveyCycle,
    '催定周期(天)': it.urgeDetermineCycle,
    '定损周期(天)': it.determineCycle,
    '定损完成-支付(天)': it.determineToPay,
    '整体结案周期(天)': it.totalCloseCycle,
    '万元内案件结案周期(天)': it.under10kCloseCycle,
    '万元以上案件结案周期(天)': it.over10kCloseCycle
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '周期报表')
  XLSX.writeFile(wb, '四川省周期报表.xlsx')
}

onMounted(() => {
  tempColShow.value = JSON.parse(JSON.stringify(colShow.value))
  fetchData()
})
</script>

<style scoped>
:deep(.el-input__inner) { font-size:13px;height:32px;line-height:32px;border-radius:6px; }
:deep(.el-date-editor .el-input__inner) { font-size:13px;height:32px;line-height:32px;border-radius:6px; }
:deep(.el-button) { font-size:13px;padding:6px 14px;height:32px;line-height:32px;border-radius:6px;font-weight:500; }
:deep(.el-dropdown-menu__item) { padding:6px 12px;font-size:13px; }
</style>