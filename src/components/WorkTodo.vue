<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps(['todayStr'])
const emit = defineEmits(['sendToTimesheet', 'listUpdated'])

const todoList = ref([])
const todoInput = ref({ title: '', deadline: '' })
const editingId = ref(null)

onMounted(() => {
  const saved = localStorage.getItem('work-todo-list')
  if (saved) todoList.value = JSON.parse(saved)
})

watch(todoList, (newVal) => {
  localStorage.setItem('work-todo-list', JSON.stringify(newVal))
  emit('listUpdated', newVal)
}, { deep: true })

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const addTodo = () => {
  if (!todoInput.value.title ) {
    alert('กรุณากรอกชื่องาน')
    return
  }
  if (editingId.value) {
    const idx = todoList.value.findIndex(i => i.id === editingId.value)
    if (idx !== -1) todoList.value[idx] = { ...todoInput.value, id: editingId.value }
    editingId.value = null
  } else {
    todoList.value.push({ id: Date.now(), ...todoInput.value })
  }
  todoInput.value = { title: '', deadline: '' }
}

const startEdit = (item) => {
  editingId.value = item.id
  todoInput.value = { title: item.title, deadline: item.deadline }
}

const handleDone = (item) => {
  emit('sendToTimesheet', {
    title: item.title,
    date: props.todayStr, 
    // description: `(Completed Deadline: ${formatDate(item.deadline)})`
  })
  removeTodo(item.id)
}

const removeTodo = (id) => {
  todoList.value = todoList.value.filter(i => i.id !== id)
}

const isUrgent = (deadline) => deadline === props.todayStr
</script>

<template>
  <div class="bg-slate-50 p-5 rounded-[2.5rem] border border-slate-100 shadow-inner">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-[10px] font-black text-slate-500 uppercase tracking-widest">
        📌 {{ editingId ? 'Editing Mode' : 'Work To-Do (Deadline)' }}
      </h3>
      <button v-if="todoList.length > 0" @click="todoList = []" class="text-[9px] font-black text-red-400 uppercase cursor-pointer">Clear All</button>
    </div>
    
    <div class="space-y-2 mb-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-50">
      <input v-model="todoInput.title" type="text" placeholder="ชื่องาน..." class="w-full text-xs p-3 rounded-xl border border-slate-100 outline-none focus:border-blue-400 font-bold" />
      <div class="flex gap-2">
        <input v-model="todoInput.deadline" type="date" class="flex-1 text-[10px] p-2 rounded-xl border border-slate-100 font-bold outline-none" />
        <button @click="addTodo" class="px-6 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase transition shadow-lg cursor-pointer">
          {{ editingId ? 'Update' : 'Add' }}
        </button>
      </div>
      <button v-if="editingId" @click="editingId = null; todoInput = {title:'', deadline:''}" class="w-full text-[9px] text-slate-400 font-bold uppercase mt-1 cursor-pointer">Cancel</button>
    </div>

    <div class="space-y-3 max-h-[450px] overflow-y-auto pr-1">
      <div v-for="item in todoList" :key="item.id" 
        class="p-4 rounded-2xl shadow-sm border transition-all relative group"
        :class="[isUrgent(item.deadline) ? 'bg-red-50 border-red-200 ring-2 ring-red-500' : 'bg-white border-slate-100']"
      >
        <div class="absolute top-3 right-3 flex gap-2 z-30 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <button @click.stop="startEdit(item)" 
            class="w-8 h-8 bg-white text-blue-500 rounded-full flex items-center justify-center border border-blue-100 shadow-sm hover:bg-blue-500 hover:text-white transition-all cursor-pointer">
            ✎
          </button>
          <button @click.stop="removeTodo(item.id)" 
            class="w-8 h-8 bg-white text-red-400 rounded-full flex items-center justify-center border border-red-100 shadow-sm hover:bg-red-500 hover:text-white transition-all cursor-pointer">
            ✕
          </button>
        </div>

        <div class="mb-3 relative z-10">
          <div v-if="isUrgent(item.deadline)" class="text-[8px] font-black text-red-600 uppercase mb-1 flex items-center gap-1 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-red-600"></span> Urgent: Today!
          </div>
          <div class="text-[12px] font-black pr-14" :class="isUrgent(item.deadline) ? 'text-red-700' : 'text-slate-800'">
            {{ item.title }}
          </div>
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-slate-50 relative z-10">
          <span class="text-[9px] font-black flex items-center gap-1" :class="isUrgent(item.deadline) ? 'text-red-600' : 'text-slate-400'">
            ⏱️ DL: {{ formatDate(item.deadline) }}
          </span>
          <button @click="handleDone(item)" class="text-[9px] px-4 py-2 rounded-xl font-black uppercase bg-emerald-500 text-white shadow-md hover:bg-emerald-600 transition-colors cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
</template>