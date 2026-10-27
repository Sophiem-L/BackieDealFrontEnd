import { flushPromises, mount } from '@vue/test-utils'
import { EditorContent } from '@tiptap/vue-3'
import { describe, expect, it, vi } from 'vitest'
import RichTextEditor from './RichTextEditor.vue'

// The editor is created on mount; grab it through the EditorContent it renders.
async function mountEditor(props) {
  const wrapper = mount(RichTextEditor, { props, attachTo: document.body })
  await flushPromises()
  return { wrapper, editor: wrapper.findComponent(EditorContent).props('editor') }
}

const lastEmit = (wrapper) => wrapper.emitted('update:modelValue').at(-1)[0]

describe('RichTextEditor', () => {
  it('renders HTML from the model into the editor', async () => {
    const { wrapper } = await mountEditor({ modelValue: '<p>Fast <strong>GPU</strong></p>' })

    expect(wrapper.find('.ProseMirror').html()).toContain('<strong>GPU</strong>')
  })

  it('turns legacy plain-text values into escaped paragraphs', async () => {
    const { wrapper } = await mountEditor({ modelValue: 'Line one\nLine two\n\nTom & Jerry <3' })
    const html = wrapper.find('.ProseMirror').element.innerHTML

    expect(html).toContain('<p>Line one<br>Line two</p>')
    expect(html).toContain('<p>Tom &amp; Jerry &lt;3</p>')
  })

  it('emits the edited HTML, and an empty string once the editor is cleared', async () => {
    const { wrapper, editor } = await mountEditor({ modelValue: '' })

    editor.commands.setContent('<p>Hello</p>', { emitUpdate: true })
    expect(lastEmit(wrapper)).toBe('<p>Hello</p>')

    editor.commands.clearContent(true)
    expect(lastEmit(wrapper)).toBe('')
  })

  it('applies formatting from the toolbar', async () => {
    const { wrapper, editor } = await mountEditor({ modelValue: '<p>Bold me</p>' })

    editor.commands.selectAll()
    await wrapper.find('button[aria-label="Bold"]').trigger('click')
    expect(lastEmit(wrapper)).toBe('<p><strong>Bold me</strong></p>')

    await wrapper.find('button[aria-label="Bullet list"]').trigger('click')
    expect(lastEmit(wrapper)).toContain('<ul>')
  })

  it('sets and clears the font size from the dropdown', async () => {
    const { wrapper, editor } = await mountEditor({ modelValue: '<p>Big</p>' })

    editor.commands.selectAll()
    await wrapper.find('select[aria-label="Font size"]').setValue('24px')
    expect(lastEmit(wrapper)).toContain('font-size: 24px')

    await wrapper.find('select[aria-label="Font size"]').setValue('')
    expect(lastEmit(wrapper)).not.toContain('font-size')
  })

  it('shows the size at the cursor in the dropdown, even one outside the presets', async () => {
    const { wrapper } = await mountEditor({
      modelValue: '<p><span style="font-size: 18px">Sized</span></p>',
    })
    expect(wrapper.find('select[aria-label="Font size"]').element.value).toBe('18px')

    const odd = await mountEditor({ modelValue: '<p><span style="font-size: 27px">Odd</span></p>' })
    odd.editor.commands.setTextSelection(2)
    await odd.wrapper.vm.$nextTick()
    expect(odd.wrapper.find('select[aria-label="Font size"]').element.value).toBe('27px')
  })

  it('applies a swatch colour, a custom colour, and resets to default', async () => {
    const { wrapper, editor } = await mountEditor({ modelValue: '<p>Colour me</p>' })
    editor.commands.selectAll()

    await wrapper.find('button[aria-label="Text color"]').trigger('click')
    await wrapper.find('button[aria-label="Red"]').trigger('click')
    // Serialised as hex or rgb() depending on the DOM; both are the same red.
    expect(lastEmit(wrapper)).toMatch(/color: (#dc2626|rgb\(220, 38, 38\))/)
    // The panel closes after a pick, and the swatch shows as selected on reopen.
    expect(wrapper.find('.rte__colors').exists()).toBe(false)
    await wrapper.find('button[aria-label="Text color"]').trigger('click')
    // TipTap's reactive state lags a tick behind the document.
    await vi.waitFor(() =>
      expect(wrapper.find('button[aria-label="Red"]').classes()).toContain('is-selected'),
    )

    await wrapper.find('input[aria-label="Custom color"]').setValue('#123456')
    expect(lastEmit(wrapper)).toMatch(/color: (#123456|rgb\(18, 52, 86\))/)

    await wrapper.find('button[aria-label="Text color"]').trigger('click')
    const reset = wrapper.findAll('.rte__colors button').find((b) => b.text() === 'Default')
    await reset.trigger('click')
    expect(lastEmit(wrapper)).not.toContain('color')
  })

  it('opens only one of the colour and link panels at a time', async () => {
    const { wrapper } = await mountEditor({ modelValue: '<p>Docs</p>' })

    await wrapper.find('button[aria-label="Text color"]').trigger('click')
    expect(wrapper.find('.rte__colors').exists()).toBe(true)

    await wrapper.find('button[aria-label="Link"]').trigger('click')
    expect(wrapper.find('.rte__colors').exists()).toBe(false)
    expect(wrapper.find('input[aria-label="Link address"]').exists()).toBe(true)
  })

  it('picks up a model value loaded after mount without echoing it back', async () => {
    const { wrapper } = await mountEditor({ modelValue: '' })

    await wrapper.setProps({ modelValue: '<p>Loaded</p>' })

    expect(wrapper.find('.ProseMirror').element.innerHTML).toBe('<p>Loaded</p>')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('adds a link, prefixing bare domains with https://', async () => {
    const { wrapper, editor } = await mountEditor({ modelValue: '<p>Docs</p>' })

    editor.commands.selectAll()
    await wrapper.find('button[aria-label="Link"]').trigger('click')
    await wrapper.find('input[aria-label="Link address"]').setValue('example.com/specs')
    await wrapper.find('form.rte__panel').trigger('submit')

    expect(lastEmit(wrapper)).toContain('href="https://example.com/specs"')
  })

  it('refuses javascript: links', async () => {
    const { wrapper, editor } = await mountEditor({ modelValue: '<p>Docs</p>' })

    editor.commands.selectAll()
    await wrapper.find('button[aria-label="Link"]').trigger('click')
    await wrapper.find('input[aria-label="Link address"]').setValue('javascript:alert(1)')
    await wrapper.find('form.rte__panel').trigger('submit')

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0] ?? '').not.toContain('javascript:')
  })

  it('hides the toolbar and blocks editing when readonly', async () => {
    const { wrapper, editor } = await mountEditor({ modelValue: '<p>Locked</p>', readonly: true })

    expect(wrapper.find('.rte__toolbar').exists()).toBe(false)
    expect(editor.isEditable).toBe(false)

    await wrapper.setProps({ readonly: false })
    expect(editor.isEditable).toBe(true)
  })
})
