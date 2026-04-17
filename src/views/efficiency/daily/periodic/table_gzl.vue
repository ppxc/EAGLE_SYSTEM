<template>
  <div class="flex flex-col gap-4 pb-5">
    <!-- 搜索区域 -->
    <ArtSearchBar
      ref="searchBarRef"
      v-model="searchFormState"
      :items="searchItems"
      :rules="rules"
      :is-expand="false"
      :show-expand="true"
      :show-reset-button="true"
      :show-search-button="true"
      :disabled-search-button="false"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 表格区域 -->
    <ElCard class="flex-1 art-table-card" style="margin-top: 0">
      <template #header>
        <div class="flex-cb">
          <h4 class="m-0">四川省工作量通报(gzl_ss)</h4>
          <div class="flex gap-2">
            <ElTag v-if="error" type="danger">{{ error.message }}</ElTag>
            <ElTag v-else-if="loading" type="warning">加载中...</ElTag>
            <ElTag v-else type="success">{{ data.length }} 条数据</ElTag>
          </div>
        </div>
      </template>

      <!-- 表格工具栏 -->
      <ArtTableHeader
        v-model:columns="columnChecks"
        :loading="loading"
        @refresh="handleRefresh"
        layout="refresh,size,fullscreen,columns,settings"
        fullClass="art-table-card"
      >
        <template #left>
          <ElSpace wrap>
            <ElDropdown split-button type="primary" @click="handleExportAll" v-ripple>
              <ElIcon>
                <Download />
              </ElIcon>
              导出全部
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem @click="handleExportCurrent">导出当前页</ElDropdownItem>
                  <!-- <ElDropdownItem @click="handleExportAll">导出全部</ElDropdownItem> -->
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <ArtTable
        ref="tableRef"
        :loading="loading"
        :pagination="pagination"
        :data="data"
        :columns="columns"
        :height="computedTableHeight"
        empty-height="360px"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        @header-click="handleHeaderClick"
        @sort-change="handleSortChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
        <!-- 序号列 -->
        <template #index="{ $index }">
          <span>{{ ($index + 1) + (pagination.current - 1) * pagination.size }}</span>
        </template>

        <!-- 部门列 -->
        <template #deptName="{ row }">
          <span>{{ row.deptName }}</span>
        </template>

        <!-- 小组列 -->
        <template #groupName="{ row }">
          <span>{{ row.groupName }}</span>
        </template>

        <!-- 人员列 -->
        <template #staffName="{ row }">
          <span>{{ row.staffName }}</span>
        </template>

        <!-- 排班列 -->
        <template #shiftType="{ row }">
          <span>{{ row.shiftType }}</span>
        </template>

        <!-- 标准工作量列 -->
        <template #standardWorkload="{ row }">
          <span>{{ row.standardWorkload }}</span>
        </template>

        <!-- 当日查勘量列 -->
        <template #surveyCount="{ row }">
          <span>{{ row.surveyCount }}</span>
        </template>

        <!-- 当日查勘未完成列 -->
        <template #surveyUnfinished="{ row }">
          <span>{{ row.surveyUnfinished }}</span>
        </template>

        <!-- 当日定损提交列 -->
        <template #damageSubmit="{ row }">
          <span>{{ row.damageSubmit }}</span>
        </template>

        <!-- 当日定损完成列 -->
        <template #damageFinish="{ row }">
          <span>{{ row.damageFinish }}</span>
        </template>

        <!-- 当日定损支付量列 -->
        <template #damagePay="{ row }">
          <span>{{ row.damagePay }}</span>
        </template>

        <!-- 当日首跟列 -->
        <template #firstFollow="{ row }">
          <span>{{ row.firstFollow }}</span>
        </template>

        <!-- 当日调解列 -->
        <template #mediation="{ row }">
          <span>{{ row.mediation }}</span>
        </template>

        <!-- 当日结案列 -->
        <template #caseClose="{ row }">
          <span>{{ row.caseClose }}</span>
        </template>

        <!-- 合计工作量列 -->
        <template #totalWorkload="{ row }">
          <span>{{ row.totalWorkload }}</span>
        </template>
      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue'
  import {
    Download,
    Refresh
  } from '@element-plus/icons-vue'
  import { ElMessageBox, ElNotification } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import { useTableStore } from '@/store/modules/table'
  import { ColumnOption } from '@/types'
  import * as XLSX from 'xlsx'
  import axios from 'axios'

  defineOptions({ name: 'WorkloadReportTable' })

  // 辅助函数：获取指定日期所在月份的第一天
  const getFirstDayOfMonth = (date: Date): string => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  };

  // 定义表格数据类型
  interface WorkloadReportData {
    id: number
    deptName: string
    groupName: string
    staffName: string
    shiftType: string
    standardWorkload: number
    surveyCount: number
    surveyUnfinished: number
    damageSubmit: number
    damageFinish: number
    damagePay: number
    firstFollow: number
    mediation: number
    caseClose: number
    totalWorkload: number
  }

  // 搜索表单 ref
  const searchBarRef = ref()

  // 校验规则
  const rules = {
    queryDate: [{ required: false, message: '请选择查询日期', trigger: 'change' }]
  }

  // 表单搜索初始值 - 修改为该月第一天
  const searchFormState = ref({
    queryDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    deptName: ''
  })

  // 搜索表单配置
  const searchItems = computed(() => [
    {
      key: 'queryDate',
      label: '查询日期',
      type: 'date',
      props: {
        placeholder: '选择查询日期',
        valueFormat: 'YYYY-MM-DD'
      }
    },
    {
      key: 'deptName',
      label: '部门',
      type: 'input',
      props: {
        placeholder: '请输入部门名称'
      }
    }
  ])

  // 监听查询日期的变化，自动调整为该月的第一天
  // watch(() => searchFormState.value.queryDate, (newVal) => {
  //   if (newVal) {
  //     const selectedDate = new Date(newVal);
  //     const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  //     const formattedFirstDay = firstDayOfMonth.toISOString().split('T')[0];
      
  //     // 如果当前日期不是该月的第一天，则更新为该月的第一天
  //     if (newVal !== formattedFirstDay) {
  //       searchFormState.value.queryDate = formattedFirstDay;
  //     }
  //   }
  // });

  // 表格实例引用
  const tableRef = ref()

  // 表格配置
  const tableConfig = ref({
    height: '100%',
    fixedHeight: false
  })

  // 计算实际的表格高度
  const computedTableHeight = computed(() => {
    return tableConfig.value.fixedHeight ? '500px' : ''
  })

  // 使用 useTable hook 获取表格数据和方法
  const {
    data,
    loading,
    error,
    pagination,
    refreshData,
    handleSizeChange,
    handleCurrentChange,
    columns,
    columnChecks
  } = useTable<WorkloadReportData>({
    core: {
      apiFn: async ({ current, size, ...params }) => {
        // 构建查询参数
        const queryParams: Record<string, any> = {
          current,
          size,
          queryDate: params.queryDate || new Date().toISOString().split('T')[0],
          deptName: params.deptName || ''
        }

        // 发送请求到后端 - 与table_gzl.vue保持一致
        const response = await axios.get('http://localhost:8080/api/gzlSs/list', {
          // params: { queryTime: queryParams.queryDate },
          // timeout: 10000
        })

        console.log('【后端返回】完整数据：', response.data)
        
        // 适配后端返回的数据格式：{ msg: "查询成功", code: 200, data: [...] }
        let allData = []
        if (response.data && response.data.code === 200) {
          allData = response.data.data || []
        } else {
          console.error('后端返回错误：', response.data?.msg || '未知错误')
          allData = []
        }
        
        const start = (current - 1) * size
        const end = start + size
        const paginatedData = allData.slice(start, end)
        
        return {
          records: paginatedData,
          total: allData.length,
          current,
          size
        }
      },
      apiParams: {
        current: 1,
        size: 20,
        ...searchFormState.value
      },
      immediate: true,
      columnsFactory: () => [
        // {
        //   type: 'selection',
        //   width: 50,
        //   align: 'center',
        //   draggable: true
        // },
        {
          prop: 'id',
          label: '序号',
          minWidth: 50,
          align: 'center',
          fixed: 'left',
          sortable: false,
          
        },
        {
          prop: 'deptName',
          label: '部门',
          minWidth: 200,
          align: 'center',
          fixed: 'left',
          sortable: true,
          
        },
        {
          prop: 'groupName',
          label: '小组',
          width: 140,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'staffName',
          label: '人员',
          minWidth: 140,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'shiftType',
          label: '排班',
          minWidth: 140,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'standardWorkload',
          label: '标准工作量',
          minWidth: 140,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'surveyCount',
          label: '当日查勘量',
          minWidth: 140,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'surveyUnfinished',
          label: '当日查勘未完成',
          minWidth: 170,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'damageSubmit',
          label: '当日定损提交',
          minWidth: 160,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'damageFinish',
          label: '当日定损完成',
          minWidth: 160,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'damagePay',
          label: '当日定损支付量',
          minWidth: 160,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'firstFollow',
          label: '当日首跟',
          minWidth: 120,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'mediation',
          label: '当日调解',
          minWidth: 120,  
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'caseClose',
          label: '当日结案',
          minWidth: 120,
          align: 'center',
          sortable: true,
          
        },
        {
          prop: 'totalWorkload',
          label: '合计工作量',
          minWidth: 140,
          align: 'center',
          sortable: true,
          
        }
      ]
    },
    performance: {
      enableCache: true,
      cacheTime: 5 * 60 * 1000, // 缓存5分钟
      debounceTime: 300,
      maxCacheSize: 100
    }
  })

  // 选中的行
  const selectedRows = ref<WorkloadReportData[]>([])

  // 事件处理函数
  const handleSelectionChange = (rows: WorkloadReportData[]) => {
    selectedRows.value = rows
  }

  const handleRowClick = (row: WorkloadReportData) => {
    console.log('Row clicked:', row)
  }

  const handleHeaderClick = (column: any) => {
    console.log('Header clicked:', column)
  }

  const handleSortChange = (sortInfo: any) => {
    console.log('Sort changed:', sortInfo)
  }

  const handleRefresh = () => {
    refreshData()
  }

  const handleSearch = async () => {
    await searchBarRef.value.validate()
    console.log('搜索参数:', searchFormState.value)
    refreshData()
  }

  const handleReset = () => {
    // 重置搜索表单状态
    searchFormState.value = {
      queryDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      deptName: ''
    }
    refreshData()
  }

  // 导出当前页数据
  const handleExportCurrent = async () => {
    if (!data.value || data.value.length === 0) {
      ElNotification({
        title: '提示',
        message: '暂无数据可导出',
        type: 'warning'
      })
      return
    }

    const exportData = data.value.map((item, index) => ({
      '序号': index + 1,
      '部门': item.deptName,
      '小组': item.groupName,
      '人员': item.staffName,
      '排班': item.shiftType,
      '标准工作量': item.standardWorkload,
      '当日查勘量': item.surveyCount,
      '当日查勘未完成': item.surveyUnfinished,
      '当日定损提交': item.damageSubmit,
      '当日定损完成': item.damageFinish,
      '当日定损支付量': item.damagePay,
      '当日首跟': item.firstFollow,
      '当日调解': item.mediation,
      '当日结案': item.caseClose,
      '合计工作量': item.totalWorkload
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '四川省工作量通报')
    
    // 生成当前时间戳格式的文件名 YYYYMMDD_HHMMSS
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    
    const fileName = `四川省工作量通报_当前页_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`
    XLSX.writeFile(wb, fileName)
    
    ElNotification({
      title: '成功',
      message: '当前页数据导出成功',
      type: 'success'
    })
  }

  // 导出全部数据
  const handleExportAll = async () => {
    try {
      // 获取全部数据，需要调用API获取所有记录
      const response = await axios.get('http://localhost:8080/api/gzlSs/list', {
        params: { queryTime: searchFormState.value.queryDate }
      })

      if (!response.data || !response.data.data) {
        ElNotification({
          title: '提示',
          message: '暂无数据可导出',
          type: 'warning'
        })
        return
      }

      const allData = response.data.data || response.data;
      const exportData = allData.map((item, index) => ({
        '序号': index + 1,
        '部门': item.deptName,
        '小组': item.groupName,
        '人员': item.staffName,
        '排班': item.shiftType,
        '标准工作量': item.standardWorkload,
        '当日查勘量': item.surveyCount,
        '当日查勘未完成': item.surveyUnfinished,
        '当日定损提交': item.damageSubmit,
        '当日定损完成': item.damageFinish,
        '当日定损支付量': item.damagePay,
        '当日首跟': item.firstFollow,
        '当日调解': item.mediation,
        '当日结案': item.caseClose,
        '合计工作量': item.totalWorkload
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '四川省工作量通报')
      
      // 生成当前时间戳格式的文件名 YYYYMMDD_HHMMSS
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      
      const fileName = `四川省工作量通报_全部_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      ElNotification({
        title: '成功',
        message: `${allData.length} 条数据导出成功`,
        type: 'success'
      })
    } catch (error) {
      console.error('导出全部数据失败:', error)
      ElNotification({
        title: '错误',
        message: '导出全部数据失败，请重试',
        type: 'error'
      })
    }
  }
</script>

<style scoped>
  .custom-header:hover {
    color: var(--el-color-primary-light-3);
  }

  .demo-group .config-toggles .el-switch {
    --el-switch-on-color: var(--el-color-primary);
  }

  .demo-group .performance-info .el-alert {
    --el-alert-padding: 12px;
  }
</style>