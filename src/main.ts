import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import router from './router' // <-- Import the new router config
import App from './App.vue'
import 'primeicons/primeicons.css'

const app = createApp(App)

app.use(createPinia())
app.use(router) // <-- Register the router component engine
app.use(PrimeVue, { theme: { preset: Aura } })

app.mount('#app')
