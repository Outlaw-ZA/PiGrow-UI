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

// `defineComponent` returns a `DefineComponent` whose signature is wider than
// the `true | ConcreteComponent` shape that `@vue/test-utils` accepts in its
// stubs map. Cast to the structural type so the stubs are usable in tests.
export const primeVueStubs: Record<string, true | ConcreteComponent> = {
  Button: true,
  Dialog: DialogStub as unknown as ConcreteComponent,
  InputNumber: InputNumberStub as unknown as ConcreteComponent,
  Message: true,
  Select: true,
  'primevue/button': true,
  'primevue/dialog': DialogStub as unknown as ConcreteComponent,
  'primevue/inputnumber': InputNumberStub as unknown as ConcreteComponent,
  'primevue/message': true,
  'primevue/select': true,
}
