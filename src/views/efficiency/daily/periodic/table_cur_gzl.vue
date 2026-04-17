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
          <h4 class="m-0">人员当日工作量统计</h4>
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
            <ElDropdown split-button type="primary" @click="handleExportCurrent" v-ripple>
              <ElIcon>
                <Download />
              </ElIcon>
              导出当前页
              <template #dropdown>
                <ElDropdownMenu>
                  <ElDropdownItem @click="handleExportCurrent">导出当前页</ElDropdownItem>
                  <ElDropdownItem @click="handleExportAll">导出全部</ElDropdownItem>
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
        <template #comName="{ row }">
          <span>{{ row.comName }}</span>
        </template>

        <!-- 人员列 -->
        <template #userName="{ row }">
          <span>{{ row.userName }}</span>
        </template>

        <!-- 用户编码列 -->
        <template #userCode="{ row }">
          <span>{{ row.userCode }}</span>
        </template>

        <!-- 小组列 -->
        <template #groups="{ row }">
          <span>{{ row.groups }}</span>
        </template>

        <!-- 小组编码列 -->
        <template #groupsCode="{ row }">
          <span>{{ row.groupsCode }}</span>
        </template>

        <!-- 查勘件数量列 -->
        <template #ckJsl="{ row }">
          <span>{{ row.ckJsl }}</span>
        </template>

        <!-- 查勘件未处理数量列 -->
        <template #ckJslWcl="{ row }">
          <span>{{ row.ckJslWcl }}</span>
        </template>

        <!-- 查勘未处理数量列 -->
        <template #ckWcl="{ row }">
          <span>{{ row.ckWcl }}</span>
        </template>

        <!-- 定损提交量列 -->
        <template #dsTjl="{ row }">
          <span>{{ row.dsTjl }}</span>
        </template>

        <!-- 定损未处理量列 -->
        <template #dsWcl="{ row }">
          <span>{{ row.dsWcl }}</span>
        </template>

        <!-- 定损支付量列 -->
        <template #dsZfl="{ row }">
          <span>{{ row.dsZfl }}</span>
        </template>

        <!-- 首跟数量列 -->
        <template #shouGen="{ row }">
          <span>{{ row.shouGen }}</span>
        </template>

        <!-- 后跟数量列 -->
        <template #houGen="{ row }">
          <span>{{ row.houGen }}</span>
        </template>

        <!-- 调解数量列 -->
        <template #tiaoJie="{ row }">
          <span>{{ row.tiaoJie }}</span>
        </template>

        <!-- 结案数量列 -->
        <template #ja="{ row }">
          <span>{{ row.ja }}</span>
        </template>

        <!-- 总量列 -->
        <template #zl="{ row }">
          <span>{{ row.zl }}</span>
        </template>

        <!-- 统计日期列 -->
        <template #tjDate="{ row }">
          <span>{{ row.tjDate }}</span>
        </template>

        <!-- ID列 -->
        <template #id="{ row }">
          <span>{{ row.id !== null && row.id !== undefined ? row.id : '' }}</span>
        </template>
      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
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

  defineOptions({ name: 'DailyWorkloadTable' })

  // 定义表格数据类型
  interface DailyWorkloadData {
    id: number | null | undefined
    comName: string      // 部门
    userName: string     // 人员
    userCode: string     // 用户编码
    groups: string       // 小组
    groupsCode: string   // 小组编码
    ckJsl: number        // 查勘件数量
    ckJslWcl: number     // 查勘件未处理数量
    ckWcl: number        // 查勘未处理数量
    dsTjl: number        // 定损提交量
    dsWcl: number        // 定损未处理量
    dsZfl: number        // 定损支付量
    shouGen: number      // 首跟数量
    houGen: number       // 后跟数量
    tiaoJie: number      // 调解数量
    ja: number           // 结案数量
    zl: number           // 总量
    tjDate: string | null // 统计日期
  }

  // 搜索表单 ref
  const searchBarRef = ref()

  // 校验规则
  const rules = {
    startDate: [{ required: false, message: '请选择开始日期', trigger: 'change' }],
    endDate: [{ required: false, message: '请选择结束日期', trigger: 'change' }]
  }

  // 获取当前日期的函数
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 表单搜索初始值
  const searchFormState = ref({
    startDate: getCurrentDate(),
    endDate: getCurrentDate(),
    comName: '',
    groups: '',
    userName: ''
  })

  // 搜索表单配置
  const searchItems = computed(() => [
    {
      key: 'startDate',
      label: '开始日期',
      type: 'date',
      props: {
        placeholder: '选择开始日期',
        valueFormat: 'YYYY-MM-DD'
      }
    },
    {
      key: 'endDate',
      label: '结束日期',
      type: 'date',
      props: {
        placeholder: '选择结束日期',
        valueFormat: 'YYYY-MM-DD'
      }
    },
    {
      key: 'comName',
      label: '部门',
      type: 'select',
      props: {
        placeholder: '请选择部门'
      }
    },
    {
        key:"groups",
        label:"小组",
        type:"select",
        props:{
            placeholder:"请选择小组"
        }
    },
    {
        key: 'userName',
        label: '人员',
        type: 'input',
        props: {
          placeholder: '请输入人员名称'
        }
    },
    
  ])

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
  } = useTable<DailyWorkloadData>({
    core: {
      apiFn: async ({ current, size, ...params }) => {
        // 构建查询参数
        const queryParams: Record<string, any> = {
          current,
          size,
          startDate: params.startDate || searchFormState.value.startDate || '',
          endDate: params.endDate || searchFormState.value.endDate || '',
          groups: params.groups || searchFormState.value.groups || '' || '',
          userName: params.userName || searchFormState.value.userName || '',
          comName: params.comName || searchFormState.value.comName || ''
        }

        // 发送请求到后端 - 根据后端期望的参数格式进行调整
        let apiUrl = 'http://localhost:8080/api/cur_gzl/list';
        
         // 添加调试日志
        console.log('发送API请求参数:', {
          startDate: queryParams.startDate,
          endDate: queryParams.endDate,
          groups: queryParams.groups,
          userName: queryParams.userName,
          comName: queryParams.comName
        });

        const response = await axios.get(apiUrl, {
          params: {
            startDate: queryParams.startDate, // 直接使用原始日期
            endDate: queryParams.endDate,
            groups: queryParams.groups,
            userName: queryParams.userName,
            comName: queryParams.comName
          }
        })


        // 添加响应调试日志
        console.log('API响应数据:', response);

        // 后端返回的是标准格式的数据，需要检查并提取data部分
        if (response.data && response.data.code === 200 && Array.isArray(response.data.data)) {
          // 假设后端返回的是完整数据而非分页数据，需要手动分页
          const allData = response.data.data;
          const start = (current - 1) * size;
          const end = start + size;
          const paginatedData = allData.slice(start, end);
          
          return {
            records: paginatedData,
            total: allData.length,
            current,
            size
          };
        } else {
          // 如果后端已处理过分页，直接使用返回的数据
          // 注意：如果后端返回分页格式，应包含records、total等字段
          console.error('API response error:', response.data);
          return {
            records: [],
            total: 0,
            current,
            size
          };
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
        //   prop: 'id',
        //   label: '序号',
        //   width: 80,
        //   align: 'center',
        //   fixed: 'left',
        //   sortable: false,
        //   draggable: false
        // },
        {
          prop: 'comName',
          label: '部门',
          minWidth: 200,
          align: 'center',
          fixed: 'left',
          sortable: true,

        },
        {
          prop: 'userName',
          label: '人员',
          width: 120,
          align: 'center',
          fixed: 'left',
        },
        {
          prop: 'userCode',
          label: '用户编码',
          width: 120,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'groups',
          label: '小组',
          width: 120,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'groupsCode',
          label: '小组编码',
          width: 120,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'ckJsl',
          label: '查勘件数量',
          width: 120,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'ckJslWcl',
          label: '查勘件未处理数量',
          width: 150,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'ckWcl',
          label: '查勘未处理数量',
          width: 150,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'dsTjl',
          label: '定损提交量',
          width: 120,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'dsWcl',
          label: '定损未处理量',
          width: 120,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'dsZfl',
          label: '定损支付量',
          width: 120,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'shouGen',
          label: '首跟数量',
          width: 100,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'houGen',
          label: '后跟数量',
          width: 100,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'tiaoJie',
          label: '调解数量',
          width: 100,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'ja',
          label: '结案数量',
          width: 100,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'zl',
          label: '总量',
          width: 100,
          align: 'center',
          sortable: true,
          draggable: true
        },
        {
          prop: 'tjDate',
          label: '统计日期',
          width: 120,
          align: 'center',
          sortable: true,
          draggable: true
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
  const selectedRows = ref<DailyWorkloadData[]>([])

  // 事件处理函数
  const handleSelectionChange = (rows: DailyWorkloadData[]) => {
    selectedRows.value = rows
  }

  const handleRowClick = (row: DailyWorkloadData) => {
    console.log('Row clicked:', row)
  }

  const handleHeaderClick = (column: any) => {
    console.log('Header clicked:', column)
  }

  const handleSortChange = (sortInfo: any) => {
    console.log('Sort changed:', sortInfo)
  }

  const handleRefresh = () => {
    refreshData(searchFormState.value)
  }

  const handleSearch = async () => {
    await searchBarRef.value.validate()
    console.log('搜索参数:', searchFormState.value)
    refreshData(searchFormState.value)
  }

  const handleReset = () => {
    // 重置搜索表单状态
    searchFormState.value = {
      startDate: '',
      endDate: '',
      comName: '',
      groups: '',
      userName: ''
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
      '部门': item.comName,
      '人员': item.userName,
      '用户编码': item.userCode,
      '小组': item.groups,
      '小组编码': item.groupsCode,
      '查勘件数量': item.ckJsl,
      '查勘件未处理数量': item.ckJslWcl,
      '查勘未处理数量': item.ckWcl,
      '定损提交量': item.dsTjl,
      '定损未处理量': item.dsWcl,
      '定损支付量': item.dsZfl,
      '首跟数量': item.shouGen,
      '后跟数量': item.houGen,
      '调解数量': item.tiaoJie,
      '结案数量': item.ja,
      '总量': item.zl,
      '统计日期': item.tjDate
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '四川省当日工作量统计')
    
    // 生成当前时间戳格式的文件名 YYYYMMDD_HHMMSS
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    
    const fileName = `四川省当日工作量统计_当前页_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`
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
      const response = await axios.get('http://localhost:8080/api/cur_gzl/list', {
        params: {
          startDate: searchFormState.value.startDate,
          endDate: searchFormState.value.endDate,
          groups: searchFormState.value.groups,
          userName: searchFormState.value.userName,
          comName: searchFormState.value.comName
        }
      })

      if (!response.data || !response.data.data) {
        ElNotification({
          title: '提示',
          message: '暂无数据可导出',
          type: 'warning'
        })
        return
      }

      const allData = response.data.data;
      const exportData = allData.map((item, index) => ({
        '序号': index + 1,
        '部门': item.comName,
        '人员': item.userName,
        '用户编码': item.userCode,
        '小组': item.groups,
        '小组编码': item.groupsCode,
        '查勘件数量': item.ckJsl,
        '查勘件未处理数量': item.ckJslWcl,
        '查勘未处理数量': item.ckWcl,
        '定损提交量': item.dsTjl,
        '定损未处理量': item.dsWcl,
        '定损支付量': item.dsZfl,
        '首跟数量': item.shouGen,
        '后跟数量': item.houGen,
        '调解数量': item.tiaoJie,
        '结案数量': item.ja,
        '总量': item.zl,
        '统计日期': item.tjDate
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '四川省当日工作量统计')
      
      // 生成当前时间戳格式的文件名 YYYYMMDD_HHMMSS
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      
      const fileName = `四川省当日工作量统计_全部_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`
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