import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'
import router from './router'
import App from './App.vue'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import 'primeicons/primeicons.css'
import './assets/main.css'

const AppPreset = definePreset(Aura, {
  components: {
    button: {
      colorScheme: {
        dark: {
          danger: {
            background: 'rgba(239, 68, 68, 0.12)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: 'rgba(239, 68, 68, 1)',
            hoverBackground: 'rgba(239, 68, 68, 0.2)',
          },
          primary: {
            activeBackground: 'rgba(21, 128, 61, 1)',
            activeBorderColor: 'rgba(21, 128, 61, 1)',
            activeColor: '#0b1120',
            background: 'rgba(34, 197, 94, 1)',
            borderColor: 'rgba(34, 197, 94, 1)',
            color: '#0b1120',
            hoverBackground: 'rgba(22, 163, 74, 1)',
            hoverBorderColor: 'rgba(22, 163, 74, 1)',
            hoverColor: '#0b1120',
          },
          secondary: {
            activeBackground: 'rgba(42, 54, 84, 1)',
            activeBorderColor: 'rgba(51, 65, 85, 1)',
            activeColor: '#ffffff',
            background: 'rgba(28, 38, 64, 1)',
            borderColor: 'rgba(28, 38, 64, 1)',
            color: 'rgba(241, 245, 249, 1)',
            hoverBackground: 'rgba(34, 46, 72, 1)',
            hoverBorderColor: 'rgba(42, 54, 84, 1)',
            hoverColor: '#ffffff',
          },
          success: {
            background: 'rgba(34, 197, 94, 1)',
            color: '#0b1120',
            hoverBackground: 'rgba(22, 163, 74, 1)',
          },
          text: {
            activeBackground: 'rgba(28, 38, 64, 0.8)',
            color: 'rgba(148, 163, 184, 1)',
            hoverBackground: 'rgba(28, 38, 64, 0.5)',
          },
        },
      },
      root: {
        borderRadius: '6px',
        fontWeight: '500',
      },
    },
    card: {
      body: {
        padding: '1.25rem',
      },
      root: {
        background: 'rgba(21, 29, 46, 1)',
        borderColor: 'rgba(28, 38, 64, 1)',
        borderRadius: '10px',
        color: 'rgba(241, 245, 249, 1)',
        shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      },
      subtitle: {
        color: 'rgba(148, 163, 184, 1)',
      },
      title: {
        color: 'rgba(241, 245, 249, 1)',
        fontSize: '1.0625rem',
        fontWeight: '600',
      },
    },
    datatable: {
      bodyCell: {
        borderColor: 'rgba(28, 38, 64, 0.6)',
        color: 'rgba(241, 245, 249, 1)',
        fontSize: '0.875rem',
        padding: '0.875rem 1rem',
      },
      columnFooter: {
        background: 'transparent',
        color: 'rgba(148, 163, 184, 1)',
      },
      footer: {
        background: 'transparent',
        color: 'rgba(148, 163, 184, 1)',
      },
      header: {
        background: 'transparent',
        borderColor: 'rgba(28, 38, 64, 1)',
        padding: '0.875rem 1rem',
      },
      headerCell: {
        background: 'transparent',
        borderColor: 'rgba(28, 38, 64, 1)',
        color: 'rgba(148, 163, 184, 1)',
        fontSize: '0.6875rem',
        fontWeight: '600',
        letterSpacing: '0.05em',
        padding: '0.875rem 1rem',
        textTransform: 'uppercase',
      },
      root: {
        borderRadius: '8px',
      },
      row: {
        background: 'transparent',
        hoverBackground: 'rgba(34, 197, 94, 0.04)',
        selectedBackground: 'rgba(34, 197, 94, 0.08)',
        stripedBackground: 'rgba(28, 38, 64, 0.4)',
      },
    },
    dialog: {
      header: {
        background: 'transparent',
        color: 'rgba(241, 245, 249, 1)',
      },
      root: {
        background: 'rgba(21, 29, 46, 1)',
        borderColor: 'rgba(28, 38, 64, 1)',
        borderRadius: '10px',
        color: 'rgba(241, 245, 249, 1)',
      },
    },
    dropdown: {
      root: {
        background: 'rgba(11, 17, 32, 0.6)',
        borderColor: 'rgba(28, 38, 64, 1)',
        borderRadius: '6px',
        color: 'rgba(241, 245, 249, 1)',
        focusBorderColor: 'rgba(34, 197, 94, 1)',
        hoverBorderColor: 'rgba(42, 54, 84, 1)',
      },
    },
    inputnumber: {
      root: {
        background: 'rgba(11, 17, 32, 0.6)',
        borderColor: 'rgba(28, 38, 64, 1)',
        borderRadius: '6px',
        color: 'rgba(241, 245, 249, 1)',
        focusBorderColor: 'rgba(34, 197, 94, 1)',
        hoverBorderColor: 'rgba(42, 54, 84, 1)',
      },
    },
    inputswitch: {
      checked: {
        background: 'rgba(34, 197, 94, 1)',
        hoverBackground: 'rgba(22, 163, 74, 1)',
      },
      handle: {
        background: '#cbd5e1',
        color: '#0b1120',
      },
      root: {
        height: '1.25rem',
        width: '2.25rem',
      },
      slider: {
        background: 'rgba(42, 54, 84, 1)',
      },
    },
    inputtext: {
      root: {
        background: 'rgba(11, 17, 32, 0.6)',
        borderColor: 'rgba(28, 38, 64, 1)',
        borderRadius: '6px',
        color: 'rgba(241, 245, 249, 1)',
        focusBorderColor: 'rgba(34, 197, 94, 1)',
        hoverBorderColor: 'rgba(42, 54, 84, 1)',
        placeholderColor: 'rgba(100, 116, 139, 1)',
      },
    },
    select: {
      dropdown: {
        background: 'rgba(21, 29, 46, 1)',
        borderColor: 'rgba(28, 38, 64, 1)',
        color: 'rgba(241, 245, 249, 1)',
      },
      root: {
        background: 'rgba(11, 17, 32, 0.6)',
        borderColor: 'rgba(28, 38, 64, 1)',
        borderRadius: '6px',
        color: 'rgba(241, 245, 249, 1)',
        focusBorderColor: 'rgba(34, 197, 94, 1)',
        hoverBorderColor: 'rgba(42, 54, 84, 1)',
        placeholderColor: 'rgba(100, 116, 139, 1)',
      },
    },
    tag: {
      icon: {
        size: '0.75rem',
      },
      root: {
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '500',
      },
    },
    toggleswitch: {
      checked: {
        background: 'rgba(34, 197, 94, 1)',
        hoverBackground: 'rgba(22, 163, 74, 1)',
        slider: {
          background: 'rgba(34, 197, 94, 1)',
        },
      },
      handle: {
        background: '#cbd5e1',
      },
      root: {
        height: '1.4rem',
        width: '2.5rem',
      },
      slider: {
        background: 'rgba(42, 54, 84, 1)',
      },
    },
    tooltip: {
      root: {
        background: 'rgba(11, 17, 32, 1)',
        borderRadius: '6px',
        color: 'rgba(241, 245, 249, 1)',
      },
    },
  },
  semantic: {
    colorScheme: {
      dark: {
        content: {
          background: '{surface.50}',
          borderColor: '{surface.200}',
          color: '{surface.900}',
          hoverBackground: '{surface.100}',
          hoverColor: '{surface.950}',
        },
        formField: {
          background: '{surface.100}',
          color: '{surface.900}',
          floatLabelActiveColor: '{surface.700}',
          floatLabelColor: '{surface.700}',
          floatLabelFocusColor: '{primary.500}',
          floatLabelInvalidColor: '#ef4444',
          focusBorderColor: '{primary.500}',
          hoverBorderColor: '{surface.300}',
          iconColor: '{surface.700}',
          invalidBorderColor: '#ef4444',
          placeholderColor: '{surface.700}',
        },
        highlight: {
          background: 'rgba(34, 197, 94, 0.16)',
          color: 'rgba(34, 197, 94, 1)',
          focusBackground: 'rgba(34, 197, 94, 0.24)',
          focusColor: 'rgba(134, 239, 172, 1)',
        },
        list: {
          option: {
            color: '{surface.900}',
            focusBackground: 'rgba(34, 197, 94, 0.08)',
            focusColor: '{surface.950}',
            icon: {
              color: '{surface.700}',
              focusColor: '{surface.800}',
            },
            selectedBackground: 'rgba(34, 197, 94, 0.12)',
            selectedColor: '{surface.950}',
            selectedFocusBackground: 'rgba(34, 197, 94, 0.16)',
            selectedFocusColor: '{surface.950}',
          },
          optionGroup: {
            background: 'transparent',
            color: '{surface.700}',
          },
        },
        navigation: {
          item: {
            activeBackground: 'rgba(34, 197, 94, 0.16)',
            activeColor: '{surface.950}',
            color: '{surface.700}',
            focusBackground: 'rgba(34, 197, 94, 0.08)',
            focusColor: '{surface.900}',
            icon: {
              activeColor: '{primary.400}',
              color: '{surface.700}',
              focusColor: '{surface.800}',
            },
          },
          submenuIcon: {
            activeColor: '{primary.400}',
            color: '{surface.700}',
            focusColor: '{surface.800}',
          },
          submenuLabel: {
            background: 'transparent',
            color: '{surface.700}',
          },
        },
        overlay: {
          modal: {
            background: '{surface.100}',
            borderColor: '{surface.200}',
            color: '{surface.900}',
          },
          popover: {
            background: '{surface.100}',
            borderColor: '{surface.200}',
            color: '{surface.900}',
          },
          select: {
            background: '{surface.100}',
            borderColor: '{surface.200}',
            color: '{surface.900}',
          },
        },
        primary: {
          activeColor: '{primary.500}',
          color: '{primary.400}',
          contrastColor: '{surface.900}',
          hoverColor: '{primary.300}',
        },
        surface: {
          0: '#ffffff',
          100: '#151d2e',
          200: '#1c2640',
          300: '#222e48',
          400: '#2a3654',
          50: '#0b1120',
          500: '#334155',
          600: '#475569',
          700: '#64748b',
          800: '#94a3b8',
          900: '#cbd5e1',
          950: '#f1f5f9',
        },
        text: {
          color: '{surface.900}',
          hoverColor: '{surface.950}',
          hoverMutedColor: '{surface.800}',
          mutedColor: '{surface.700}',
        },
      },
      light: {
        highlight: {
          background: '{primary.50}',
          color: '{primary.700}',
          focusBackground: '{primary.100}',
          focusColor: '{primary.800}',
        },
        primary: {
          activeColor: '{primary.600}',
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.400}',
        },
      },
    },
    primary: {
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      50: '#ecfdf5',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    options: {
      cssLayer: false,
      darkModeSelector: '.app-dark',
    },
    preset: AppPreset,
  },
})
app.use(ConfirmationService)
app.use(ToastService)

document.documentElement.classList.add('app-dark')

app.mount('#app')
