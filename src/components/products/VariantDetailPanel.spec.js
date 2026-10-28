import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import VariantDetailPanel from '@/components/products/VariantDetailPanel.vue'
import { blankRow } from '@/services/variants'

vi.mock('@/services/media', () => ({
  uploadImage: vi.fn(),
  ACCEPT_ATTR: 'image/jpeg,image/png',
}))

function row(sku, serials = []) {
  return { ...blankRow(), name: sku, sku, attributes: { Size: sku }, serials }
}

function mountPanel(props = {}) {
  return mount(VariantDetailPanel, {
    props: {
      rows: [row('S'), row('M')],
      index: 0,
      axisNames: ['Size'],
      serialized: true,
      ...props,
    },
  })
}

const serialInput = (wrapper) => wrapper.find('input[aria-label="Serial number"]')
const addButton = (wrapper) => wrapper.find('.serial-add__btn')
const trackSwitch = (wrapper) => wrapper.find('input[aria-label="Track serial numbers"]')
const chips = (wrapper) => wrapper.findAll('.serial-chip').map((chip) => chip.text())

async function typeSerial(wrapper, text) {
  await serialInput(wrapper).setValue(text)
  await serialInput(wrapper).trigger('keydown.enter')
}

describe('VariantDetailPanel serial numbers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('offers a switch to start tracking when the product does not track serials', () => {
    const wrapper = mountPanel({ serialized: false })
    expect(wrapper.text()).toContain('Serial numbers')
    expect(trackSwitch(wrapper).exists()).toBe(true)
    expect(trackSwitch(wrapper).element.checked).toBe(false)
    expect(serialInput(wrapper).exists()).toBe(false)
  })

  it('asks the product form to turn tracking on from the switch', async () => {
    const wrapper = mountPanel({ serialized: false })
    await trackSwitch(wrapper).setValue(true)

    expect(wrapper.emitted('update:serialized')).toEqual([[true]])
  })

  it('shows the switch on, with the entry box, once the product tracks serials', () => {
    const wrapper = mountPanel()
    expect(trackSwitch(wrapper).element.checked).toBe(true)
    expect(serialInput(wrapper).exists()).toBe(true)
  })

  it('asks the product form to turn tracking off from the switch', async () => {
    const wrapper = mountPanel()
    await trackSwitch(wrapper).setValue(false)

    expect(wrapper.emitted('update:serialized')).toEqual([[false]])
  })

  it('lists the serials already on the variant', () => {
    const wrapper = mountPanel({ rows: [row('S', ['SN1', 'SN2']), row('M')] })
    expect(chips(wrapper)).toEqual(['SN1', 'SN2'])
    expect(wrapper.text()).toContain('2 serial numbers waiting to be received')
  })

  it('adds the typed serial on Enter, upper-cased, and clears the box', async () => {
    const wrapper = mountPanel()
    await typeSerial(wrapper, ' sn-100 ')

    expect(wrapper.emitted('patch')).toEqual([[0, { serials: ['SN-100'] }]])
    expect(serialInput(wrapper).element.value).toBe('')
  })

  it('keeps only the first serial of a pasted list and reports the rest as skipped', async () => {
    const wrapper = mountPanel()
    await serialInput(wrapper).trigger('paste', {
      clipboardData: { getData: () => 'a1\nb2\nc3' },
    })

    expect(wrapper.emitted('patch')).toEqual([[0, { serials: ['A1'] }]])
    expect(wrapper.text()).toContain('Each variant can have only 1 serial number. Skipped: B2, C3')
  })

  it('leaves the entry box and Add button enabled while the variant has no serial', async () => {
    const wrapper = mountPanel()
    await serialInput(wrapper).setValue('sn1')

    expect(serialInput(wrapper).attributes('disabled')).toBeUndefined()
    expect(addButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('disables the entry box and Add button once the variant has a serial waiting', () => {
    const wrapper = mountPanel({ rows: [row('S', ['SN1']), row('M')] })

    expect(serialInput(wrapper).attributes('disabled')).toBeDefined()
    expect(addButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('disables them for a saved variant that already holds a serial', () => {
    const wrapper = mountPanel({ rows: [{ ...row('S'), receivedSerials: 1 }, row('M')] })

    expect(serialInput(wrapper).attributes('disabled')).toBeDefined()
    expect(addButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('This variant already has a serial number')
  })

  it('does not lock a variant because another one has a serial', () => {
    const wrapper = mountPanel({ rows: [row('S'), row('M', ['SN1'])] })

    expect(serialInput(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('unlocks the entry again once the waiting serial is removed', async () => {
    const wrapper = mountPanel({ rows: [row('S', ['SN1']), row('M')] })
    await wrapper.find('button[aria-label="Remove serial number SN1"]').trigger('click')
    await wrapper.setProps({ rows: [row('S'), row('M')] })

    expect(serialInput(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('refuses a serial already on another variant and says so', async () => {
    const wrapper = mountPanel({ rows: [row('S'), row('M', ['SN1'])] })
    await typeSerial(wrapper, 'sn1')

    expect(wrapper.emitted('patch')).toEqual([[0, { serials: [] }]])
    expect(wrapper.text()).toContain('Skipped, already in use: SN1')
  })

  it('removes a serial from the variant', async () => {
    const wrapper = mountPanel({ rows: [row('S', ['SN1', 'SN2']), row('M')] })
    await wrapper.find('button[aria-label="Remove serial number SN1"]').trigger('click')

    expect(wrapper.emitted('patch')).toEqual([[0, { serials: ['SN2'] }]])
  })

  it('keeps a new variant\'s serials until Done, then hands them over with it', async () => {
    const wrapper = mountPanel({ isNew: true, index: -1 })
    await typeSerial(wrapper, 'sn9')
    expect(chips(wrapper)).toEqual(['SN9'])

    await wrapper.find('.vp__done').trigger('click')
    // A new variant needs a name from its option values before it is appended.
    expect(wrapper.emitted('append')).toBeUndefined()

    await wrapper.find('.fields input').setValue('XL')
    await wrapper.find('.vp__done').trigger('click')
    expect(wrapper.emitted('append')[0][0].serials).toEqual(['SN9'])
  })
})
