<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import * as XLSX from 'xlsx'

// --- 1. ข้อมูลพื้นฐาน ---
const tasks = ref([])
const deadlinesList = ref([]) 
const currentDate = ref(new Date())
const todayStr = new Date().toLocaleDateString('en-CA')
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const showSummary = ref(false)

const thaiHolidays = {
  "2026-01-01": "วันขึ้นปีใหม่", "2026-01-02": "วันหยุดชดเชยวันสิ้นปี", "2026-03-03": "วันมาฆบูชา",
  "2026-04-06": "วันจักรี", "2026-04-13": "วันสงกรานต์", "2026-04-14": "วันสงกรานต์", "2026-04-15": "วันสงกรานต์",
  "2026-05-01": "วันแรงงาน", "2026-05-04": "วันฉัตรมงคล", "2026-05-31": "วันวิสาขบูชา",
  "2026-06-03": "วันเฉลิมฯ พระราชินี", "2026-07-28": "วันเฉลิมฯ ร.10", "2026-07-29": "วันอาสาฬหบูชา",
  "2026-08-12": "วันแม่แห่งชาติ", "2026-10-13": "วัน ร.9", "2026-10-23": "วันปิยมหาราช",
  "2026-12-05": "วันพ่อแห่งชาติ", "2026-12-31": "วันสิ้นปี"
}

const statusTypes = {
  work: { label: 'Work', color: 'bg-blue-600', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  leave: { label: 'Leave', color: 'bg-yellow-400', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' }
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const years = Array.from({ length: 11 }, (_, i) => 2024 + i)

// --- 2. State & Logic ---
const showModal = ref(false)
const isEditing = ref(false)
const currentHolidayName = ref('')
const taskInput = ref({ id: null, title: '', description: '', date: '', status: 'work' })

onMounted(() => {
  const saved = localStorage.getItem('report-work-excel-ver')
  if (saved) tasks.value = JSON.parse(saved)
})

watch(tasks, (newVal) => {
  localStorage.setItem('report-work-excel-ver', JSON.stringify(newVal))
}, { deep: true })

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let i = 0; i < firstDay; i++) days.push({ day: null })
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({ 
      day: i, date: dateStr, 
      holidayName: thaiHolidays[dateStr] || null,
      isHoliday: !!thaiHolidays[dateStr] || [0,6].includes(new Date(dateStr).getDay()),
      isToday: dateStr === todayStr
    })
  }
  return days
})

const summaryStats = computed(() => {
  const m = currentDate.value.getMonth()
  const y = currentDate.value.getFullYear()
  
  // กรองงานเฉพาะเดือนและปีที่เลือก
  const filtered = tasks.value.filter(t => {
    const d = new Date(t.date)
    return d.getMonth() === m && d.getFullYear() === y
  })

  // Group งานตามวันที่
  const grouped = filtered.reduce((acc, task) => {
    const date = task.date
    if (!acc[date]) {
      acc[date] = { date: date, tasks: [] }
    }
    acc[date].tasks.push(task)
    return acc
  }, {})

  const sortedGrouped = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date))

  // คำนวณจำนวนวัน (นับจากกลุ่มวันที่)
  const workingDaysCount = sortedGrouped.filter(group => 
    group.tasks.some(t => t.status === 'work')
  ).length

  const leaveDaysCount = sortedGrouped.filter(group => 
    group.tasks.some(t => t.status === 'leave')
  ).length

  const holidaysCount = Object.keys(thaiHolidays).filter(d => {
    const dt = new Date(d)
    return dt.getMonth() === m && dt.getFullYear() === y
  }).length

  return { 
    groupedTasks: sortedGrouped,
    workingDays: workingDaysCount,
    leaveDays: leaveDaysCount,
    holidaysInMonth: holidaysCount
  }
})

const copyGroupedTasks = (group) => {
  const text = group.tasks.map((t, index) => {
    const description = t.description ? `\n   - ${t.description}` : ''
    return `${index + 1}. ${t.title}${description}`
  }).join('\n\n')
  
  navigator.clipboard.writeText(text)
  const [y, m, d] = group.date.split('-')
  alert(`คัดลอกรายการงานของวันที่ ${d}/${m}/${y} เรียบร้อยแล้ว`)
}

// --- 3. ฟังก์ชันการทำงาน ---
const addExternalTask = (data) => {
  const finalDate = data.date || todayStr
  tasks.value.push({
    id: Date.now(),
    title: data.title,
    description: data.description || '',
    date: finalDate,
    status: 'work'
  })
}

const updateDeadlines = (newList) => {
  deadlinesList.value = newList
}

const getDeadlinesForDate = (dateStr) => {
  return deadlinesList.value.filter(item => item.deadline === dateStr)
}

defineExpose({ addExternalTask, updateDeadlines })

const setMonth = (m) => currentDate.value = new Date(currentDate.value.getFullYear(), parseInt(m), 1)
const setYear = (y) => currentDate.value = new Date(parseInt(y), currentDate.value.getMonth(), 1)
const changeMonth = (offset) => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + offset, 1)
}

const openModal = (date, task = null) => {
  currentHolidayName.value = thaiHolidays[date] || ''
  if (task) { 
    taskInput.value = { ...task }
    isEditing.value = true 
  } else { 
    taskInput.value = { id: null, title: '', description: '', date, status: 'work' }
    isEditing.value = false 
  }
  showModal.value = true
}

const saveTask = () => {
  if (!taskInput.value.title) return
  if (isEditing.value) {
    const idx = tasks.value.findIndex(t => t.id === taskInput.value.id)
    if (idx !== -1) tasks.value[idx] = { ...taskInput.value }
  } else { 
    tasks.value.push({ ...taskInput.value, id: Date.now() }) 
  }
  showModal.value = false
}

const deleteTask = (id) => {
  if(confirm('Delete this task?')) {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }
}

const exportToExcel = () => {
  const data = tasks.value.map(t => ({ Date: t.date, Status: t.status, Subject: t.title, Description: t.description }))
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Timesheet")
  XLSX.writeFile(workbook, `timesheet_${todayStr}.xlsx`)
}
</script>

<template>
  <div class="p-4 md:p-10 bg-slate-50/50 min-h-screen">
    
    <div class="flex flex-col lg:flex-row items-center justify-between gap-4 mb-8 bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100">
      <div class="flex items-center gap-3">
        <button @click="changeMonth(-1)" class="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-2xl transition font-black">◀</button>
        <div class="flex gap-2 bg-slate-50 px-5 py-2 rounded-2xl border border-slate-100 font-black text-sm uppercase">
          <select :value="currentDate.getMonth()" @change="setMonth($event.target.value)" class="bg-transparent outline-none cursor-pointer">
            <option v-for="(m, i) in months" :key="m" :value="i">{{ m }}</option>
          </select>
          <select :value="currentDate.getFullYear()" @change="setYear($event.target.value)" class="bg-transparent border-l border-slate-200 pl-4 outline-none cursor-pointer text-slate-700">
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <button @click="changeMonth(1)" class="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-2xl transition font-black">▶</button>
      </div>

      <div class="flex gap-3">
        <button @click="exportToExcel" class="bg-emerald-50 text-emerald-600 font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition">📊 Export Excel</button>
        <button @click="showSummary = true" class="bg-blue-600 text-white font-black px-8 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition">📋 Summary Report</button>
      </div>
    </div>

    <div class="grid grid-cols-7 gap-3">
      <div v-for="d in daysOfWeek" :key="d" class="text-center text-[10px] font-black text-slate-300 py-3 uppercase tracking-widest">{{ d }}</div>
      
      <div v-for="(item, index) in calendarDays" :key="index" @click="item.day && openModal(item.date)"
        class="min-h-[160px] rounded-[2.5rem] p-5 transition-all cursor-pointer hover:shadow-xl relative border-2 bg-white flex flex-col"
        :class="[!item.day ? 'invisible opacity-0' : '', item.isToday ? 'ring-4 ring-yellow-400 ring-offset-4 z-10' : 'border-slate-50', item.isHoliday ? 'bg-red-50/40' : '']">
        
        <div class="flex justify-between items-start mb-3">
          <span class="text-lg font-black" :class="[item.isToday ? 'text-yellow-600' : item.isHoliday ? 'text-red-500' : 'text-slate-200']">{{ item.day }}</span>
          <span v-if="item.holidayName" class="text-[8px] font-black text-red-500 text-right truncate max-w-[70%] leading-tight">{{ item.holidayName }}</span>
        </div>

        <div class="mb-2 space-y-1">
          <div v-for="dl in getDeadlinesForDate(item.date)" :key="dl.id" 
            class="text-[9px] font-black bg-red-600 text-white p-2 rounded-xl shadow-sm flex items-center gap-1 animate-pulse">
            <span class="shrink-0">⏱️</span>
            <span class="truncate">DL: {{ dl.title }}</span>
          </div>
        </div>

        <div class="space-y-1.5 mt-auto">
          <div v-for="task in tasks.filter(t => t.date === item.date)" :key="task.id" @click.stop="openModal(item.date, task)"
            :class="`group relative text-[10px] p-3 rounded-2xl font-black shadow-sm transition hover:brightness-95 ${statusTypes[task.status].bgColor} ${statusTypes[task.status].textColor}`">
            {{ task.title }}
            <button @click.stop="deleteTask(task.id)" class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center bg-white/50 hover:bg-red-500 hover:text-white rounded-lg transition-all font-sans">✕</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSummary" class="fixed inset-0 bg-white z-[60] overflow-y-auto p-6 md:p-16">
      <div class="max-w-4xl mx-auto">
        <div class="flex justify-between items-center mb-10 pb-6 border-b border-slate-100">
          <h2 class="text-4xl font-black text-slate-800 tracking-tighter uppercase">Summary Statistics</h2>
          <button @click="showSummary = false" class="w-14 h-14 flex items-center justify-center bg-slate-100 rounded-full font-black hover:bg-slate-200 transition">✕</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div class="bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100 shadow-sm">
            <div class="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-1">Working Days</div>
            <div class="text-5xl font-black text-blue-700 tracking-tighter">{{ summaryStats.workingDays }} <span class="text-lg opacity-50">Days</span></div>
          </div>
          <div class="bg-yellow-50 p-8 rounded-[2.5rem] border border-yellow-100 shadow-sm">
            <div class="text-[11px] font-black text-yellow-600 uppercase tracking-widest mb-1">Leave Days</div>
            <div class="text-5xl font-black text-yellow-700 tracking-tighter">{{ summaryStats.leaveDays }} <span class="text-lg opacity-50">Days</span></div>
          </div>
          <div class="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 shadow-sm">
            <div class="text-[11px] font-black text-red-400 uppercase tracking-widest mb-1">Public Holidays</div>
            <div class="text-5xl font-black text-red-700 tracking-tighter">{{ summaryStats.holidaysInMonth }} <span class="text-lg opacity-50">Days</span></div>
          </div>
        </div>
        
        <div v-for="group in summaryStats.groupedTasks" :key="group.date" 
          class="flex flex-col md:flex-row gap-6 p-8 rounded-[3rem] bg-slate-50 border border-slate-100 relative group transition-all hover:bg-white hover:shadow-xl mb-6">
          
          <div class="w-16 font-black text-blue-500 text-xl font-sans underline underline-offset-8 decoration-blue-100 decoration-4">
            {{ group.date.split('-')[2] }}
          </div>

          <div class="flex-1 space-y-4">
            <div v-for="(task, idx) in group.tasks" :key="task.id" 
              :class="idx !== 0 ? 'border-t border-slate-100 pt-4' : ''">
              <div class="flex items-center gap-3">
                <div :class="`w-2 h-2 rounded-full ${statusTypes[task.status].color}`"></div>
                <h4 class="font-black text-slate-800 text-lg">{{ task.title }}</h4>
              </div>
              <p v-if="task.description" class="text-slate-500 text-sm mt-2 whitespace-pre-wrap font-sans leading-relaxed border-l-4 border-slate-200 pl-6 italic">
                {{ task.description }}
              </p>
            </div>
          </div>

          <div class="flex flex-col justify-center">
            <button @click="copyGroupedTasks(group)" 
              class="bg-slate-900 text-white font-black px-8 py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-blue-600 transition shadow-lg whitespace-nowrap">
              Copy All Tasks
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-[4rem] p-12 w-full max-w-xl shadow-2xl relative">
        <div class="mb-10 flex flex-col gap-4 border-b border-slate-50 pb-8">
          <div class="flex justify-between items-center">
            <h3 class="text-4xl font-black text-slate-800 tracking-tighter uppercase">{{ isEditing ? 'Edit Task' : 'New Task' }}</h3>
            <span class="text-blue-600 font-black text-[10px] uppercase bg-blue-50 px-5 py-2 rounded-full tracking-widest shadow-sm">{{ taskInput.date }}</span>
          </div>
          
          <div v-if="currentHolidayName" class="flex items-center gap-3 bg-red-50 p-4 rounded-3xl border border-red-100 animate-pulse">
            <span class="text-xl">🎉</span>
            <div class="flex flex-col">
              <span class="text-[10px] font-black text-red-400 uppercase leading-none">Public Holiday</span>
              <span class="text-sm font-black text-red-600 leading-tight">{{ currentHolidayName }}</span>
            </div>
          </div>
        </div>

        <div class="space-y-8">
          <div class="grid grid-cols-2 gap-4">
            <button @click="taskInput.status = 'work'" 
              :class="`py-6 rounded-3xl text-[11px] font-black transition-all border-4 ${taskInput.status === 'work' ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-white text-slate-300 border-slate-50'}`">
              WORK
            </button>
            <button @click="taskInput.status = 'leave'" 
              :class="`py-6 rounded-3xl text-[11px] font-black transition-all border-4 ${taskInput.status === 'leave' ? 'bg-yellow-400 text-yellow-900 border-yellow-400 shadow-xl scale-105' : 'bg-white text-slate-300 border-slate-50'}`">
              LEAVE
            </button>
          </div>
          
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Subject</label>
            <input v-model="taskInput.title" type="text" placeholder="Subject..." class="w-full text-xl font-bold bg-slate-50 p-6 rounded-[2rem] border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition" />
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Description</label>
            <textarea v-model="taskInput.description" rows="5" placeholder="Details..." class="w-full border-2 border-transparent bg-slate-50 rounded-[2.5rem] p-8 focus:bg-white focus:border-blue-500 outline-none transition resize-none font-sans text-slate-600"></textarea>
          </div>
        </div>

        <div class="flex gap-4 mt-12">
          <button @click="saveTask" class="flex-1 bg-blue-600 text-white font-black py-6 rounded-[2rem] hover:bg-blue-700 transition text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-100">SAVE</button>
          <button @click="showModal = false" class="bg-slate-100 text-slate-400 font-black px-10 py-6 rounded-[2rem] hover:bg-slate-200 transition text-[11px] uppercase tracking-widest">CLOSE</button>
        </div>
      </div>
    </div>

  </div>
</template>