export const SETTINGS_LINKS = [
  { label: 'General', to: '/settings/general', icon: 'general', description: 'Store profile, address, branding', permission: null },
  { label: 'Payments', to: '/settings/payments', icon: 'payments', description: 'Providers and checkout rules', permission: null },
  { label: 'Shipping', to: '/settings/shipping', icon: 'shipping', description: 'Zones, delivery, packaging', permission: null },
  { label: 'Taxes', to: '/settings/taxes', icon: 'taxes', description: 'Tax settings and rates', permission: null },
  { label: 'Notifications', to: '/settings/notifications', icon: 'notifications', description: 'Alerts and recipients', permission: null },
  { label: 'Team', to: '/settings/team', icon: 'team', description: 'Members and permissions', permission: null },
  { label: 'Integrations', to: '/settings/integrations', icon: 'integrations', description: 'Analytics and webhooks', permission: null },
]

export const generalMock = {
  storeName: 'Beckie Deal Webstore',
  storeUrl: 'beckiedeal.com',
  contactEmail: 'orders@yourstore.com',
  phone: '+855 12 345 678',
  timezone: 'Asia/Phnom_Penh',
  currency: 'USD',
  language: 'English',
  weightUnit: 'kg',
  lengthUnit: 'cm',
  businessAddress: '15 Street 184, Phnom Penh, Cambodia',
  country: 'Cambodia',
}

export const paymentsMock = {
  providers: [
    { id: 'cod', name: 'Cash on delivery', status: 'Active', enabled: true, mode: 'Live', connected: true },
    { id: 'bank', name: 'Bank transfer', status: 'Needs setup', enabled: false, mode: 'Test', connected: false },
    { id: 'card', name: 'Card', status: 'Active', enabled: true, mode: 'Live', connected: true },
    { id: 'paypal', name: 'PayPal', status: 'Inactive', enabled: false, mode: 'Test', connected: false },
  ],
  minimumOrder: 15,
  instructions: 'Please pay the total upon delivery and keep the receipt for confirmation.',
}

export const shippingMock = {
  zones: [
    { name: 'Cambodia', regions: 'Phnom Penh, Siem Reap', methods: 'Standard, Express', rates: '$2.50 / $8.00' },
    { name: 'Regional', regions: 'Thailand, Vietnam', methods: 'Standard', rates: '$9.00' },
  ],
  delivery: [
    { id: 'standard', name: 'Standard', enabled: true, days: '3–5 days', price: '$4.50' },
    { id: 'express', name: 'Express', enabled: true, days: '1–2 days', price: '$12.00' },
    { id: 'pickup', name: 'Pickup', enabled: false, days: 'Same day', price: 'Free' },
  ],
  warehouse: '1204 Preah Sihanouk Blvd, Phnom Penh',
  packageWeight: 1.2,
  freeShippingThreshold: 99,
}

export const taxesMock = {
  pricesIncludeTax: true,
  showTaxAtCheckout: true,
  taxId: 'VAT-2024-118',
  rates: [
    { region: 'Cambodia', name: 'Standard VAT', rate: 10, appliesTo: 'All taxable goods' },
    { region: 'International', name: 'No tax', rate: 0, appliesTo: 'Exports' },
  ],
}

export const notificationsMock = {
  rows: [
    { name: 'New order', email: true, inApp: true, sms: false },
    { name: 'Order shipped', email: true, inApp: true, sms: true },
    { name: 'Low stock', email: true, inApp: false, sms: false },
    { name: 'New customer', email: false, inApp: true, sms: false },
    { name: 'Refund requested', email: true, inApp: true, sms: true },
  ],
  recipients: ['ops@beckiedeal.com', 'finance@beckiedeal.com'],
  senderName: 'Beckie Deal',
  replyTo: 'support@beckiedeal.com',
}

export const teamMock = {
  filters: ['All roles', 'Owner', 'Admin', 'Manager', 'Staff'],
  members: [
    { name: 'Alya Vann', email: 'alya@beckiedeal.com', role: 'Owner', status: 'Active', lastActive: '2 min ago', avatar: 'AV' },
    { name: 'Nim Sothea', email: 'nim@beckiedeal.com', role: 'Admin', status: 'Active', lastActive: '18 min ago', avatar: 'NS' },
    { name: 'Rith Chenda', email: 'rith@beckiedeal.com', role: 'Manager', status: 'Pending', lastActive: '1 day ago', avatar: 'RC' },
  ],
}

export const integrationsMock = {
  cards: [
    { id: 'analytics', name: 'Analytics', status: 'Connected', description: 'Track orders, traffic, and conversions', enabled: true },
    { id: 'facebook', name: 'Facebook Pixel', status: 'Not connected', description: 'Track ad conversions and retargeting', enabled: false },
    { id: 'telegram', name: 'Telegram', status: 'Connected', description: 'Send order and stock alerts', enabled: true },
    { id: 'email', name: 'Email service', status: 'Needs setup', description: 'Sync product emails and automation', enabled: false },
    { id: 'maps', name: 'Google Maps', status: 'Connected', description: 'Store location and directions', enabled: true },
    { id: 'webhooks', name: 'Webhooks', status: 'Connected', description: 'Sent to fulfillment and CRM tools', enabled: true },
  ],
  webhooks: [
    { endpoint: 'https://hooks.example.com/shipments', events: 'Order shipped', secret: '••••••••', status: 'Healthy' },
    { endpoint: 'https://hooks.example.com/inventory', events: 'Low stock', secret: '••••••••', status: 'Failed 2h ago' },
  ],
}
