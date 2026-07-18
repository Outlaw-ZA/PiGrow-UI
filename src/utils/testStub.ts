import { defineComponent, h, type ConcreteComponent } from 'vue'

const DialogStub = defineComponent({
  name: 'DialogStub',
  setup(_props, { slots }) {
    return () => h('div', { class: 'dialog-stub' }, [slots.default?.(), slots.footer?.()])
  },
})

const InputNumberStub = defineComponent({
  name: 'InputNumberStub',
  props: ['dataTestid', 'modelValue'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        'data-testid': props.dataTestid,
        onInput: (event: Event) =>
          emit('update:modelValue', Number((event.target as HTMLInputElement).value)),
        type: 'number',
        value: String(props.modelValue ?? ''),
      })
  },
})

export const primeVueStubs: Record<string, true | ConcreteComponent> = {
  Button: true,
  Dialog: DialogStub,
  InputNumber: InputNumberStub,
  Message: true,
  Select: true,
  'primevue/button': true,
  'primevue/dialog': DialogStub,
  'primevue/inputnumber': InputNumberStub,
  'primevue/message': true,
  'primevue/select': true,
}
