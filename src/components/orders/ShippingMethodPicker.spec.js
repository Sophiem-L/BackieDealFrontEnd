import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ShippingMethodPicker from '@/components/orders/ShippingMethodPicker.vue'

const METHODS = [
  { id: 1, name: 'Courier', fee: '14.00', available: true, estimated_delivery: '1-3 days' },
  { id: 2, name: 'Freight', fee: '40.00', available: false, estimated_delivery: 'N/A' },
]

const option = (wrapper, name) => wrapper.findAll('.shipping__option').find((o) => o.text().includes(name))

describe('ShippingMethodPicker', () => {
  it('lists each method with its fee and marks the selected one', () => {
    const wrapper = mount(ShippingMethodPicker, { props: { methods: METHODS, modelValue: 1, priced: true } })

    const courier = option(wrapper, 'Courier')
    expect(courier.text()).toContain('$14.00')
    expect(courier.text()).toContain('1-3 days')
    expect(courier.classes()).toContain('shipping__option--selected')
    expect(courier.text()).not.toContain('from')
    expect(option(wrapper, 'No shipping').classes()).not.toContain('shipping__option--selected')
  })

  it('labels base prices as "from" until the order lines price them', () => {
    const wrapper = mount(ShippingMethodPicker, { props: { methods: METHODS, priced: false } })

    expect(option(wrapper, 'Courier').text()).toContain('from')
  })

  it('emits the chosen id, and null for no shipping', async () => {
    const wrapper = mount(ShippingMethodPicker, { props: { methods: METHODS, modelValue: null } })

    await option(wrapper, 'Courier').find('input').trigger('change')
    await option(wrapper, 'No shipping').find('input').trigger('change')

    expect(wrapper.emitted('update:modelValue')).toEqual([[1], [null]])
  })

  it('does not let a method that cannot carry the order be picked', async () => {
    const wrapper = mount(ShippingMethodPicker, { props: { methods: METHODS, modelValue: null } })

    const freight = option(wrapper, 'Freight')
    expect(freight.text()).toContain("Can't carry this order's weight")
    expect(freight.find('input').attributes('disabled')).toBeDefined()

    await freight.find('input').trigger('change')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('warns when the selected method is no longer offered', () => {
    const wrapper = mount(ShippingMethodPicker, { props: { methods: METHODS, modelValue: 99 } })

    expect(wrapper.text()).toContain('no longer offered')
  })

  it('shows loading, empty and error states, and asks to retry', async () => {
    expect(mount(ShippingMethodPicker, { props: { loading: true } }).text()).toContain('Loading shipping methods')
    expect(mount(ShippingMethodPicker, { props: { methods: [] } }).text()).toContain('No shipping methods are set up')

    const failed = mount(ShippingMethodPicker, { props: { error: 'Network down' } })
    expect(failed.text()).toContain('Network down')
    await failed.find('button').trigger('click')
    expect(failed.emitted('retry')).toHaveLength(1)
  })

  it('shows the API validation message for the field', () => {
    const wrapper = mount(ShippingMethodPicker, {
      props: { methods: METHODS, fieldError: 'The selected shipping method is not available.' },
    })

    expect(wrapper.text()).toContain('The selected shipping method is not available.')
  })
})
