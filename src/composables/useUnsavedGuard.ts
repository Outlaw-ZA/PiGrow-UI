import { onBeforeUnmount, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'

/**
 * Guards against accidental loss of unsaved form state. Blocks in-app navigation
 * (Vue Router) and warns on browser tab close when `dirty` flips true.
 *
 * Caller is responsible for flipping `dirty` to false after a successful save
 * or when reverting to a known-good state.
 */
export function useUnsavedGuard(dirty: Ref<boolean>) {
  const confirm = useConfirm()

  function askLeave(then: (proceed: boolean) => void) {
    confirm.require({
      accept: () => then(true),
      acceptLabel: 'Discard changes',
      acceptProps: { severity: 'danger' },
      header: 'Discard unsaved changes?',
      icon: 'pi pi-exclamation-triangle',
      message:
        'You have unsaved changes on this form. Leaving now will discard them. This cannot be undone.',
      rejectLabel: 'Keep editing',
      onHide: () => {},
      reject: () => then(false),
    })
  }

  onBeforeRouteLeave((to, from, next) => {
    if (!dirty.value) {
      next()
      return
    }
    askLeave((proceed) => {
      if (proceed) {
        next()
      } else {
        next(false)
      }
    })
  })

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }

  watch(
    dirty,
    (isDirty) => {
      if (isDirty) {
        window.addEventListener('beforeunload', onBeforeUnload)
      } else {
        window.removeEventListener('beforeunload', onBeforeUnload)
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
}
