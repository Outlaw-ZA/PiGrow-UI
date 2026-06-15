import { createApp } from 'vue'
import { createPinia } from 'pinia' // 1. Import Pinia engine
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia()) // 2. Tell Vue to use Pinia FIRST
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.mount('#app') // 3. Mount the UI last
