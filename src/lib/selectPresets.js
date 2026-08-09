// Tailwind overrides that pull the vendored shadcn Select onto the admin
// toolbar's own scale — 10px radius, 0.82rem semibold, flat, no popup outline —
// so it sits with BaseButton and the search field rather than merely next to
// them. twMerge inside the component resolves them against shadcn's defaults,
// last class wins.
//
// Shared rather than repeated per view: every toolbar filter in the admin is
// meant to look identical, and four copied class strings would drift.
export const TOOLBAR_SELECT = {
  trigger:
    'w-auto gap-2 rounded-[10px] bg-transparent px-[0.7rem] text-[0.82rem] font-semibold text-[var(--text-body)] shadow-none',

  // For a glyph placed before the value inside the trigger slot.
  icon: 'size-3.5 shrink-0 stroke-current [stroke-width:1.8] text-[var(--text-subtle)]',

  // border-0 drops shadcn's 1px outline; the shadow alone separates the popup.
  content: 'rounded-[10px] border-0',

  item: 'rounded-[7px] text-[0.84rem] font-medium text-[var(--text-body)]',
}

// The same component as a form control rather than a toolbar filter: full
// width, the taller field scale, and the accent focus ring the .field inputs
// use, so a Select sits in a form beside a text input without looking foreign.
export const FORM_SELECT = {
  trigger: [
    'h-auto w-full rounded-[10px] px-[0.8rem] py-[0.65rem]',
    // The trigger is a flex row, so its height comes from the value span, not
    // from line-height on the button. Sizing that span to an input's text box
    // is what keeps the control level with the fields beside it.
    'text-[0.9rem] [&>span]:leading-[1.4] text-[var(--text-strong)] bg-[var(--surface)] shadow-none',
    // The app rings with border-colour plus a soft outer glow, not Tailwind's
    // ring utility, so shadcn's focus:ring-1 is switched off.
    'focus:ring-0 focus:border-[rgb(var(--accent-rgb))]',
    'focus:shadow-[0_0_0_3px_rgb(var(--accent-rgb)/0.18)]',
  ].join(' '),

  content: 'rounded-[10px] border-0',

  item: 'rounded-[7px] text-[0.9rem] text-[var(--text-body)]',
}
