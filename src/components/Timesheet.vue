<script setup>
import { ref, computed, onMounted, watch } from 'vue'

// --- 1. การตั้งค่า API ---
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzFOK53UJ1S24inNAjcD9GiMX_GX9uDndwTI8uxBvuwVSYojggrPNlBECpaa0ZX9BFf5w/exec'

// --- 2. ข้อมูลพื้นฐาน ---
const tasks = ref([])
const deadlinesList = ref([])
const holidayData = ref({})
const isLoading = ref(false)
const currentDate = ref(new Date())
const todayStr = new Date().toLocaleDateString('en-CA')
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const isReportView = ref(false) // สถานะสลับหน้า Calendar / Report

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const years = computed(() => {
  const currentYear = new Date().getFullYear()
  const arr = []
  for (let i = currentYear - 5; i <= currentYear + 5; i++) arr.push(i)
  return arr
})

// --- 3. ฟังก์ชันดึงวันหยุดไทย (API Nager.Date) ---
const fetchThaiHolidays = async () => {
  const year = currentDate.value.getFullYear();
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/TH`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Response Error');
    const data = await response.json();
    const formattedHolidays = {};
    data.forEach(h => { formattedHolidays[h.date] = h.localName; });
    holidayData.value = formattedHolidays;
  } catch (error) { fallbackHolidays(year); }
};

const fallbackHolidays = (year) => {
  holidayData.value = {
    [`${year}-01-01`]: "วันขึ้นปีใหม่", [`${year}-04-06`]: "วันจักรี",
    [`${year}-04-13`]: "วันสงกรานต์", [`${year}-04-14`]: "วันสงกรานต์",
    [`${year}-04-15`]: "วันสงกรานต์", [`${year}-05-01`]: "วันแรงงาน",
    [`${year}-12-05`]: "วันพ่อแห่งชาติ", [`${year}-12-31`]: "วันสิ้นปี"
  };
};

// --- 4. ดึงข้อมูลจาก Google Sheets ---
const fetchTasksFromSheet = async () => {
  isLoading.value = true
  try {
    const response = await fetch(SCRIPT_URL, { method: 'GET', redirect: 'follow' })
    const data = await response.json()
    tasks.value = data.map(item => {
      const [d, m, y] = item.date.split('/')
      return {
        id: item.rowId, sheetName: item.sheetName, title: item.subject,
        description: item.description, status: (item.type || 'work').toLowerCase(),
        date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      }
    })
  } catch (error) { console.error("Fetch Error:", error) }
  finally { isLoading.value = false }
}

// --- 5. การคำนวณ Summary & Filter รายเดือน ---
const monthlyTasks = computed(() => {
  const m = currentDate.value.getMonth()
  const y = currentDate.value.getFullYear()
  return tasks.value
    .filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === m && d.getFullYear() === y
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

const monthSummary = computed(() => {
  const holidayInMonth = Object.keys(holidayData.value).filter(dateStr => {
    const d = new Date(dateStr)
    return d.getMonth() === currentDate.value.getMonth() && d.getFullYear() === currentDate.value.getFullYear()
  }).length
  return {
    workDays: monthlyTasks.value.filter(t => t.status === 'work').length,
    leaveDays: monthlyTasks.value.filter(t => t.status === 'leave').length,
    holidayInMonth
  }
})

// --- 6. ฟังก์ชันจัดการข้อมูล & Copy ---
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
  alert('Copied to clipboard!')
}

const copyMonthlyReport = () => {
  const report = monthlyTasks.value.map(t => `${t.date}: [${t.status.toUpperCase()}] ${t.title}`).join('\n')
  copyToClipboard(`Monthly Report - ${months[currentDate.value.getMonth()]} ${currentDate.value.getFullYear()}\n\n${report}`)
}

const sendToSheet = async (payload) => {
  isLoading.value = true
  try {
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) })
    setTimeout(() => { fetchTasksFromSheet() }, 1500)
  } catch (error) { alert("บันทึกไม่สำเร็จ") }
  finally { isLoading.value = false }
}

const saveTask = async () => {
  if (!taskInput.value.title) return
  const [y, m, d] = taskInput.value.date.split('-')
  await sendToSheet({
    date: `${d}/${m}/${y}`, type: taskInput.value.status === 'work' ? 'Work' : 'Leave',
    subject: taskInput.value.title, description: taskInput.value.description
  })
  showModal.value = false
}

const deleteTask = async (task) => {
  if (confirm(`ลบรายการ "${task.title}"?`)) {
    await sendToSheet({ action: 'delete', rowId: task.id, sheetName: task.sheetName, date: "01/01/2000" })
  }
}

// --- 7. UI Logic ---
const showModal = ref(false)
const taskInput = ref({ id: null, title: '', description: '', date: todayStr, status: 'work' })

const openModal = (date, existingTask = null) => {
  if (existingTask) {
    // ถ้ามีข้อมูลงานอยู่แล้ว ให้ดึงมาโชว์เพื่อดูรายละเอียดหรือแก้ไข
    taskInput.value = { 
      id: existingTask.id, 
      title: existingTask.title, 
      description: existingTask.description, 
      date: existingTask.date, 
      status: existingTask.status 
    }
  } else {
    // ถ้าไม่มี (กดที่ช่องว่าง) ให้เป็นการเพิ่มงานใหม่
    taskInput.value = { id: null, title: '', description: '', date: date, status: 'work' }
  }
  showModal.value = true
}

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      day: d, date: dateStr, tasks: tasks.value.filter(t => t.date === dateStr),
      deadlines: deadlinesList.value.filter(dl => dl.deadline === dateStr),
      isToday: dateStr === todayStr, holiday: holidayData.value[dateStr] || null
    })
  }
  return days
})

const changeMonth = (offset) => { currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + offset, 1) }
const goToDate = (event, type) => {
  const val = parseInt(event.target.value)
  const newDate = new Date(currentDate.value)
  if (type === 'month') newDate.setMonth(val); else newDate.setFullYear(val)
  currentDate.value = newDate
}



watch(() => currentDate.value.getFullYear(), fetchThaiHolidays)
onMounted(() => { fetchTasksFromSheet(); fetchThaiHolidays(); })
defineExpose({ addExternalTask: (d) => { /* logic เหมือนเดิม */ }, updateDeadlines: (l) => deadlinesList.value = l })
</script>

<template>
  <div class="relative min-h-screen pb-20">
    <div v-if="isLoading" class="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-md">
      <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <div class="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-2xl">
        <p class="text-[10px] font-black uppercase opacity-60 mb-2">Working</p>
        <h4 class="text-4xl font-black">{{ monthSummary.workDays }} <span class="text-sm opacity-60">Days</span></h4>
      </div>
      <div class="bg-amber-400 rounded-[2.5rem] p-8 text-white shadow-2xl">
        <p class="text-[10px] font-black uppercase opacity-80 mb-2">Leave</p>
        <h4 class="text-4xl font-black">{{ monthSummary.leaveDays }} <span class="text-sm opacity-80">Days</span></h4>
      </div>
      <div class="bg-rose-50 rounded-[2.5rem] p-8 border border-rose-100">
        <p class="text-[10px] font-black text-rose-400 uppercase mb-2">Holidays</p>
        <h4 class="text-4xl font-black text-rose-600">{{ monthSummary.holidayInMonth }}</h4>
      </div>
    </div>

    <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
      <div class="flex items-center gap-4">
        <h2 class="text-3xl font-black italic">{{ isReportView ? 'REPORT' : 'CALENDAR' }} <span class="text-blue-600">.</span></h2>
        <button @click="isReportView = !isReportView" class="px-4 py-2 bg-slate-900 text-white text-[10px] font-black rounded-full uppercase tracking-widest hover:bg-blue-600 transition">
          {{ isReportView ? 'Show Calendar' : 'Show Summary List' }}
        </button>
      </div>
      
      <div class="flex items-center gap-2 bg-white p-2 rounded-full shadow-sm border border-slate-100">
        <button @click="changeMonth(-1)" class="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-full transition">←</button>
        <select :value="currentDate.getMonth()" @change="goToDate($event, 'month')" class="bg-transparent font-black text-[11px] uppercase tracking-widest outline-none px-2 cursor-pointer">
          <option v-for="(m, i) in months" :key="m" :value="i">{{ m }}</option>
        </select>
        <select :value="currentDate.getFullYear()" @change="goToDate($event, 'year')" class="bg-transparent font-black text-[11px] uppercase tracking-widest outline-none px-2 cursor-pointer">
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
        <button @click="changeMonth(1)" class="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-full transition">→</button>
      </div>
    </header>

    <main v-if="!isReportView" class="grid grid-cols-7 gap-4">
      <div v-for="day in daysOfWeek" :key="day" class="text-center text-[10px] font-black text-slate-300 uppercase pb-4">{{ day }}</div>
      <div v-for="(item, idx) in calendarDays" :key="idx" 
        class="min-h-[140px] rounded-[2.5rem] p-5 transition-all relative overflow-hidden"
        :class="[!item ? 'opacity-0' : 'bg-white border border-slate-100 hover:border-blue-200 hover:shadow-lg cursor-pointer', item?.isToday ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-600 ring-offset-2' : '', item?.holiday ? 'bg-rose-50/50' : '']"
        @click="item && openModal(item.date)">
        <div v-if="item">
          <div class="flex justify-between items-start mb-2">
            <span class="text-sm font-black" :class="[item.isToday ? 'text-blue-700' : 'text-slate-900', item.holiday ? 'text-rose-500' : '']">{{ item.day }}</span>
            <div v-if="item.isToday" class="text-[8px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase">Today</div>
          </div>
          <div v-if="item.holiday" class="text-[8px] font-black text-rose-400 uppercase mb-2 leading-tight">{{ item.holiday }}</div>
          <div class="space-y-1.5">
            <div v-for="t in item.tasks" :key="t.id" 
              class="group/task flex items-center gap-2 p-2 rounded-xl text-[9px] font-bold cursor-help transition-all hover:ring-1 hover:ring-offset-1" 
              :class="t.status === 'leave' ? 'bg-amber-100 text-amber-700 hover:ring-amber-400' : 'bg-blue-50 text-blue-700 hover:ring-blue-400'"
              :title="'Detail: ' + (t.description || 'No description')" 
              @click.stop="openModal(item.date, t)"
            >
              <span class="truncate flex-1">{{ t.title }}</span>
              <button @click.stop="deleteTask(t)" class="opacity-0 group-hover/task:opacity-100 hover:text-red-500 p-0.5">✕</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <main v-else class="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="flex justify-between items-center mb-8">
        <h3 class="text-xl font-black italic uppercase">Monthly Task List <span class="text-blue-600">.</span></h3>
        <button @click="copyMonthlyReport" class="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition">
          <span>📋</span> Copy Monthly Report
        </button>
      </div>

      <div class="overflow-hidden">
        <table class="w-full text-left">
         <thead>
            <tr class="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50">
              <th class="pb-4 pl-4">Date</th>
              <th class="pb-4">Type</th>
              <th class="pb-4">Subject</th>
              <th class="pb-4 italic">Description</th> <th class="pb-4 text-right pr-4">Action</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-50">
            <tr v-for="t in monthlyTasks" :key="t.id" class="group hover:bg-slate-50/50 transition">
              <td class="py-4 pl-4 font-bold text-xs text-slate-400">{{ t.date }}</td>
              <td class="py-4">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase" :class="t.status === 'leave' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'">{{ t.status }}</span>
              </td>
              <td class="py-4 font-black text-sm text-slate-800">{{ t.title }}</td>
              <td class="py-4 text-xs text-slate-500 italic max-w-xs truncate">{{ t.description || '-' }}</td>
              <td class="py-4 text-right pr-4">
                <div class="flex justify-end gap-2">
                  <button @click="copyToClipboard(`${t.date}: ${t.title} - ${t.description || ''}`)" class="p-2 text-slate-400 hover:text-blue-600 transition" title="Copy detail">📄</button>
                  <button @click="deleteTask(t)" class="p-2 text-slate-400 hover:text-red-500 transition">✕</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
      <div class="bg-white w-full max-w-lg rounded-[3rem] p-10 relative shadow-2xl">
        <h3 class="text-2xl font-black mb-8 italic uppercase">Log Activity <span class="text-blue-600">.</span></h3>
        <div class="space-y-6">
          <div class="flex bg-slate-100 p-1.5 rounded-[2rem]">
            <button v-for="s in ['work', 'leave']" :key="s" @click="taskInput.status = s" class="flex-1 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition" :class="taskInput.status === s ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'">{{ s }}</button>
          </div>
          <input v-model="taskInput.title" type="text" placeholder="Title" class="w-full text-lg font-bold bg-slate-50 p-6 rounded-[2rem] outline-none border-2 border-transparent focus:border-blue-500" />
          <textarea v-model="taskInput.description" rows="3" placeholder="Description" class="w-full bg-slate-50 rounded-[2rem] p-6 outline-none resize-none"></textarea>
          <button @click="saveTask" class="w-full bg-blue-600 text-white font-black py-6 rounded-[2rem] hover:bg-blue-700 shadow-xl shadow-blue-200 uppercase tracking-widest text-xs">Confirm & Sync</button>
        </div>
      </div>
      <div class="absolute inset-0 -z-10" @click="showModal = false"></div>
    </div>
  </div>
</template>