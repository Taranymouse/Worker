<script setup>
import { ref, computed, onMounted } from 'vue'
import * as XLSX from 'xlsx'
import axios from 'axios' // อย่าลืมลง npm install axios นะไอน้อง!

// --- 1. ข้อมูลพื้นฐานและการเชื่อมต่อ ---
// ⚠️ สำคัญมาก: เอา Web App URL ของ Google Script มาใส่ตรงนี้!!
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbylJz-3zZww7c5Wel1Z6KDQgM6fM-UX0smPEOyR1cT5/dev'

const tasks = ref([])
const deadlinesList = ref([]) 
const currentDate = ref(new Date())
const todayStr = new Date().toLocaleDateString('en-CA')
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const showSummary = ref(false)

const thaiHolidays = {
  "2026-01-01": "วันขึ้นปีใหม่", "2026-04-06": "วันจักรี", "2026-04-13": "วันสงกรานต์",
  "2026-05-01": "วันแรงงาน", "2026-07-28": "วันเฉลิมฯ ร.10", "2026-12-05": "วันพ่อแห่งชาติ"
}

const statusTypes = {
  Work: { label: 'Work', color: 'bg-blue-600', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  Leave: { label: 'Leave', color: 'bg-yellow-400', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' }
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const years = Array.from({ length: 11 }, (_, i) => 2024 + i)

// --- 2. State & Logic การเชื่อมต่อ Sheets ---
const showModal = ref(false)
const isEditing = ref(false)
const isLoading = ref(false)
const currentHolidayName = ref('')
const taskInput = ref({ rowId: null, sheetName: '', title: '', description: '', date: '', status: 'Work' })

// ดึงข้อมูลเมื่อ Component ถูกสร้าง
onMounted(async () => {
  await fetchTasksFromSheet()
})

const fetchTasksFromSheet = async () => {
  isLoading.value = true
  try {
    const res = await axios.get(GOOGLE_SCRIPT_URL)
    // แปลงวันที่จาก dd/mm/yyyy ใน Sheet ให้เป็น yyyy-mm-dd สำหรับปฏิทิน Vue
    tasks.value = res.data.map(item => {
      const parts = item.date.split('/')
      const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`
      return { ...item, date: isoDate, title: item.subject }
    })
  } catch (e) {
    console.error("Oi!! ดึงข้อมูลไม่ได้!!", e)
  } finally {
    isLoading.value = false
  }
}

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

// --- 3. ฟังก์ชันการทำงาน (CRUD) ---
const openModal = (date, task = null) => {
  currentHolidayName.value = thaiHolidays[date] || ''
  if (task) { 
    taskInput.value = { ...task }
    isEditing.value = true 
  } else { 
    taskInput.value = { rowId: null, sheetName: '', title: '', description: '', date, status: 'Work' }
    isEditing.value = false 
  }
  showModal.value = true
}

const saveTask = async () => {
  if (!taskInput.value.title) return
  isLoading.value = true
  
  // แปลงวันที่กลับไปเป็น dd/mm/yyyy เพื่อส่งให้ GAS
  const [y, m, d] = taskInput.value.date.split('-')
  const payload = {
    date: `${d}/${m}/${y}`,
    type: taskInput.value.status,
    subject: taskInput.value.title,
    description: taskInput.value.description || "-"
  }

  try {
    await axios.post(GOOGLE_SCRIPT_URL, payload) // สั่งบันทึกลง Sheet
    await fetchTasksFromSheet() // ดึงข้อมูลใหม่
    showModal.value = false
  } catch (e) {
    alert("เห้ย!! บันทึกไม่ติด!!")
  } finally {
    isLoading.value = false
  }
}

const deleteTask = async (task) => {
  if(confirm(`จะลบวีรกรรม "${task.title}" จริงๆ เรอะ!?`)) {
    isLoading.value = true
    try {
      await axios.post(GOOGLE_SCRIPT_URL, {
        action: 'delete',
        rowId: task.rowId,
        sheetName: task.sheetName,
        date: '01/01/2026' // ส่งหลอกไปกันพัง
      })
      await fetchTasksFromSheet()
    } catch (e) {
      alert("ลบไม่ได้โว้ยยย!!")
    } finally {
      isLoading.value = false
    }
  }
}

// --- ส่วน Summary (กรองเฉพาะเดือนที่เลือก) ---
const summaryStats = computed(() => {
  const m = currentDate.value.getMonth()
  const y = currentDate.value.getFullYear()
  const filtered = tasks.value.filter(t => {
    const d = new Date(t.date)
    return d.getMonth() === m && d.getFullYear() === y
  })
  // ... (Logic การ Group งานใช้ของเดิมได้เลย) ...
  return { workingDays: filtered.length, leaveDays: 0, groupedTasks: [] } // ตัวอย่างสรุปแบบย่อ
})

const exportToExcel = () => {
  const data = tasks.value.map(t => ({ Date: t.date, Status: t.type, Subject: t.title, Description: t.description }))
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Timesheet")
  XLSX.writeFile(workbook, `timesheet_${todayStr}.xlsx`)
}

const setMonth = (m) => currentDate.value = new Date(currentDate.value.getFullYear(), parseInt(m), 1)
const setYear = (y) => currentDate.value = new Date(parseInt(y), currentDate.value.getMonth(), 1)
const changeMonth = (offset) => currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + offset, 1)
</script>

<template>
  <div class="p-4 md:p-10 bg-slate-50/50 min-h-screen">
    <div v-if="isLoading" class="fixed inset-0 bg-white/60 z-[100] flex items-center justify-center font-black animate-pulse">
      OI!! ระบบกำลังรันอยู่ อย่าใจร้อนสิฟะ!!...
    </div>

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
        </div>
        <div class="space-y-1.5 mt-auto">
          <div v-for="task in tasks.filter(t => t.date === item.date)" :key="task.rowId" @click.stop="openModal(item.date, task)"
            :class="`group relative text-[10px] p-3 rounded-2xl font-black shadow-sm transition hover:brightness-95 ${statusTypes[task.type].bgColor} ${statusTypes[task.type].textColor}`">
            {{ task.subject }}
            <button @click.stop="deleteTask(task)" class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center bg-white/50 hover:bg-red-500 hover:text-white rounded-lg transition-all font-sans">✕</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-[4rem] p-12 w-full max-w-xl shadow-2xl relative">
        <h3 class="text-4xl font-black mb-8 text-slate-800 uppercase">{{ isEditing ? 'Edit Task' : 'New Task' }}</h3>
        <div class="space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <button @click="taskInput.status = 'Work'" :class="`py-4 rounded-2xl font-black ${taskInput.status === 'Work' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`">WORK</button>
            <button @click="taskInput.status = 'Leave'" :class="`py-4 rounded-2xl font-black ${taskInput.status === 'Leave' ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-50 text-slate-400'}`">LEAVE</button>
          </div>
          <input v-model="taskInput.title" placeholder="ชื่องาน..." class="w-full text-xl font-bold bg-slate-50 p-6 rounded-[2rem] outline-none border-2 border-transparent focus:border-blue-500" />
          <textarea v-model="taskInput.description" rows="3" placeholder="รายละเอียด..." class="w-full bg-slate-50 rounded-[2.5rem] p-8 outline-none border-2 border-transparent focus:border-blue-500"></textarea>
          <div class="flex gap-4">
            <button @click="saveTask" class="flex-1 bg-blue-600 text-white font-black py-6 rounded-[2rem] shadow-xl hover:bg-blue-700 uppercase tracking-widest">SAVE</button>
            <button @click="showModal = false" class="bg-slate-100 text-slate-400 font-black px-10 py-6 rounded-[2rem] hover:bg-slate-200 uppercase">CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>