<script setup>
// Reusable rich text field built on TipTap. Use with v-model; the value is an
// HTML string:
//   <RichTextEditor id="description" v-model="form.description" placeholder="…" />
import { computed, nextTick, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { TextStyleKit } from '@tiptap/extension-text-style'
import {
  Baseline,
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Minus,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from '@lucide/vue'
import { escapeHtml } from '@/lib/pages'

const props = defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, default: undefined },
  label: { type: String, default: 'Rich text editor' },
  placeholder: { type: String, default: '' },
  minHeight: { type: Number, default: 180 },
  readonly: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

// Values saved before this editor existed are plain text. Without wrapping them
// the editor would run their line breaks together, so turn those into paragraphs.
function toEditorHtml(value) {
  const text = String(value ?? '')
  if (!text || /<[a-z][\s\S]*>/i.test(text)) return text
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// An emptied editor still serialises to `<p></p>`; store it as empty so the API
// gets null rather than markup with nothing in it.
function readHtml(instance) {
  return instance.isEmpty ? '' : instance.getHTML()
}

const editor = useEditor({
  content: toEditorHtml(props.modelValue),
  editable: !props.readonly,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // The page's own title is the H1; a trailing empty paragraph would leak
      // into the saved HTML.
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: true,
        // `javascript:` and other unsafe schemes are refused by the extension.
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
    }),
    // Text colour and size are saved as `<span style="color:…; font-size:…">`.
    TextStyleKit.configure({ backgroundColor: false, fontFamily: false, lineHeight: false }),
    Placeholder.configure({ placeholder: props.placeholder }),
  ],
  editorProps: {
    attributes: {
      ...(props.id ? { id: props.id } : {}),
      role: 'textbox',
      'aria-label': props.label,
      'aria-multiline': 'true',
    },
  },
  onUpdate: ({ editor: instance }) => emit('update:modelValue', readHtml(instance)),
})

// The model can change from outside (the product loads after the form mounts).
watch(
  () => props.modelValue,
  (value) => {
    const instance = editor.value
    // Skip echoes of our own onUpdate, or the caret would jump.
    if (!instance || value === readHtml(instance)) return
    instance.commands.setContent(toEditorHtml(value), { emitUpdate: false })
  },
)

watch(
  () => props.readonly,
  (readonly) => editor.value?.setEditable(!readonly),
)

// Tools run through `chain().focus()` so the selection survives the click.
const TOOL_GROUPS = [
  {
    id: 'history',
    tools: [
      { label: 'Undo', icon: Undo2, run: (c) => c.undo(), can: (e) => e.can().undo() },
      { label: 'Redo', icon: Redo2, run: (c) => c.redo(), can: (e) => e.can().redo() },
    ],
  },
  {
    id: 'headings',
    tools: [
      {
        label: 'Heading 2',
        icon: Heading2,
        run: (c) => c.toggleHeading({ level: 2 }),
        active: (e) => e.isActive('heading', { level: 2 }),
      },
      {
        label: 'Heading 3',
        icon: Heading3,
        run: (c) => c.toggleHeading({ level: 3 }),
        active: (e) => e.isActive('heading', { level: 3 }),
      },
    ],
  },
  {
    id: 'marks',
    tools: [
      { label: 'Bold', icon: Bold, run: (c) => c.toggleBold(), active: (e) => e.isActive('bold') },
      {
        label: 'Italic',
        icon: Italic,
        run: (c) => c.toggleItalic(),
        active: (e) => e.isActive('italic'),
      },
      {
        label: 'Underline',
        icon: Underline,
        run: (c) => c.toggleUnderline(),
        active: (e) => e.isActive('underline'),
      },
      {
        label: 'Strikethrough',
        icon: Strikethrough,
        run: (c) => c.toggleStrike(),
        active: (e) => e.isActive('strike'),
      },
    ],
  },
  {
    id: 'blocks',
    tools: [
      {
        label: 'Bullet list',
        icon: List,
        run: (c) => c.toggleBulletList(),
        active: (e) => e.isActive('bulletList'),
      },
      {
        label: 'Numbered list',
        icon: ListOrdered,
        run: (c) => c.toggleOrderedList(),
        active: (e) => e.isActive('orderedList'),
      },
      {
        label: 'Quote',
        icon: Quote,
        run: (c) => c.toggleBlockquote(),
        active: (e) => e.isActive('blockquote'),
      },
      { label: 'Divider', icon: Minus, run: (c) => c.setHorizontalRule() },
    ],
  },
  {
    id: 'clear',
    tools: [
      {
        label: 'Clear formatting',
        icon: RemoveFormatting,
        // Also drops colour and size: they are marks too.
        run: (c) => c.clearNodes().unsetAllMarks(),
      },
    ],
  },
]

function runTool(tool) {
  if (!editor.value) return
  tool.run(editor.value.chain().focus()).run()
}
const isActive = (tool) => Boolean(editor.value && tool.active?.(editor.value))
const isDisabled = (tool) => !editor.value || (tool.can ? !tool.can(editor.value) : false)

// Font size. "Default" removes the mark so the text follows the field's size.
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '32px']
const currentFontSize = computed(() => editor.value?.getAttributes('textStyle').fontSize ?? '')
// A size that isn't in the presets (e.g. set by hand in the stored HTML) still
// has to show in the dropdown rather than leave it blank.
const fontSizeOptions = computed(() => {
  const sizes = [...FONT_SIZES]
  if (currentFontSize.value && !sizes.includes(currentFontSize.value)) sizes.push(currentFontSize.value)
  return sizes
})

function setFontSize(event) {
  const size = event.target.value
  const chain = editor.value.chain().focus()
  if (size) chain.setFontSize(size).run()
  else chain.unsetFontSize().run()
}

// Text colour. A palette of swatches that read on both themes, plus a native
// picker for anything else.
const COLORS = [
  { label: 'Black', value: '#111827' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Yellow', value: '#ca8a04' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Teal', value: '#0891b2' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
]
const currentColor = computed(() => editor.value?.getAttributes('textStyle').color ?? '')

// The editor can hand a colour back as `#rgb`, `#rrggbb` or `rgb(r, g, b)`
// depending on how it was parsed; the swatches and <input type="color"> want
// lowercase #rrggbb.
function toHex(color) {
  const value = String(color ?? '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  if (/^#[0-9a-f]{3}$/.test(value)) return `#${[...value.slice(1)].map((c) => c + c).join('')}`
  const rgb = value.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/)
  if (!rgb) return ''
  return `#${rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`
}
const currentHex = computed(() => toHex(currentColor.value))
const pickerColor = computed(() => currentHex.value || '#111827')

// One inline panel (link or colour) is open at a time, under the toolbar.
const panel = ref('')
const linkOpen = computed(() => panel.value === 'link')
const colorOpen = computed(() => panel.value === 'color')

function closePanel() {
  panel.value = ''
  editor.value?.chain().focus().run()
}

function setColor(color) {
  editor.value.chain().focus().setColor(color).run()
  panel.value = ''
}

function resetColor() {
  editor.value.chain().focus().unsetColor().run()
  panel.value = ''
}

// Link: an inline bar rather than window.prompt().
const linkUrl = ref('')
const linkInput = ref(null)
const linkActive = computed(() => Boolean(editor.value?.isActive('link')))

async function openLink() {
  if (!editor.value) return
  linkUrl.value = editor.value.getAttributes('link').href ?? ''
  panel.value = 'link'
  await nextTick()
  linkInput.value?.focus()
}

function applyLink() {
  const raw = linkUrl.value.trim()
  const chain = editor.value.chain().focus().extendMarkRange('link')
  if (!raw) {
    chain.unsetLink().run()
  } else {
    // Bare "example.com" gets https://; mailto:, tel:, #anchors and /paths pass through.
    const href = /^([a-z][a-z0-9+.-]*:|[/#])/i.test(raw) ? raw : `https://${raw}`
    chain.setLink({ href }).run()
  }
  panel.value = ''
}

function removeLink() {
  editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
  panel.value = ''
}
</script>

<template>
  <div
    class="rte"
    :class="{ 'rte--invalid': invalid, 'rte--readonly': readonly }"
    :style="{ '--rte-min-height': `${minHeight}px` }"
  >
    <div v-if="!readonly" class="rte__toolbar" role="toolbar" aria-label="Text formatting tools">
      <template v-for="(group, index) in TOOL_GROUPS" :key="group.id">
        <span v-if="index" class="rte__divider" aria-hidden="true"></span>

        <select
          v-if="group.id === 'headings'"
          class="rte__size"
          title="Font size"
          aria-label="Font size"
          :value="currentFontSize"
          :disabled="!editor"
          @change="setFontSize"
        >
          <option value="">Default</option>
          <option v-for="size in fontSizeOptions" :key="size" :value="size">{{ parseInt(size) }}</option>
        </select>

        <button
          v-for="tool in group.tools"
          :key="tool.label"
          type="button"
          class="rte__tool"
          :class="{ 'is-active': isActive(tool) }"
          :title="tool.label"
          :aria-label="tool.label"
          :aria-pressed="tool.active ? isActive(tool) : undefined"
          :disabled="isDisabled(tool)"
          @mousedown.prevent
          @click="runTool(tool)"
        >
          <component :is="tool.icon" :size="15" :stroke-width="2.2" aria-hidden="true" />
        </button>

        <button
          v-if="group.id === 'marks'"
          type="button"
          class="rte__tool rte__tool--color"
          :class="{ 'is-active': colorOpen }"
          title="Text color"
          aria-label="Text color"
          aria-haspopup="true"
          :aria-expanded="colorOpen"
          :disabled="!editor"
          @mousedown.prevent
          @click="panel = colorOpen ? '' : 'color'"
        >
          <Baseline :size="15" :stroke-width="2.2" aria-hidden="true" />
          <span class="rte__color-bar" :style="{ background: currentColor || 'var(--text-subtle)' }"></span>
        </button>
      </template>

      <span class="rte__divider" aria-hidden="true"></span>
      <button
        type="button"
        class="rte__tool"
        :class="{ 'is-active': linkActive || linkOpen }"
        title="Link"
        aria-label="Link"
        :aria-pressed="linkActive"
        :disabled="!editor"
        @mousedown.prevent
        @click="linkOpen ? closePanel() : openLink()"
      >
        <LinkIcon :size="15" :stroke-width="2.2" aria-hidden="true" />
      </button>
    </div>

    <div v-if="colorOpen && !readonly" class="rte__panel rte__colors" role="group" aria-label="Text color">
      <button
        v-for="color in COLORS"
        :key="color.value"
        type="button"
        class="rte__swatch"
        :class="{ 'is-selected': currentHex === color.value }"
        :style="{ background: color.value }"
        :title="color.label"
        :aria-label="color.label"
        @mousedown.prevent
        @click="setColor(color.value)"
      ></button>
      <label class="rte__picker" title="Custom color">
        <input
          type="color"
          :value="pickerColor"
          aria-label="Custom color"
          @change="setColor($event.target.value)"
        />
        <span>Custom</span>
      </label>
      <button type="button" class="rte__panel-btn" @mousedown.prevent @click="resetColor">Default</button>
    </div>

    <form v-if="linkOpen && !readonly" class="rte__panel" @submit.prevent="applyLink">
      <input
        ref="linkInput"
        v-model="linkUrl"
        type="text"
        class="rte__link-input"
        placeholder="Paste or type a link, e.g. example.com"
        aria-label="Link address"
        @keydown.esc.prevent="closePanel"
      />
      <button type="submit" class="rte__panel-btn rte__panel-btn--primary">Apply</button>
      <button v-if="linkActive" type="button" class="rte__panel-btn" @click="removeLink">Remove</button>
    </form>

    <EditorContent :editor="editor" class="rte__content" />
  </div>
</template>

<style scoped lang="scss">
.rte {
  overflow: hidden;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus-within {
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.16);
  }

  &--invalid {
    border-color: var(--danger);
    box-shadow: 0 0 0 3px rgb(var(--danger-rgb) / 0.14);
  }

  &--readonly:focus-within {
    border-color: var(--border);
    box-shadow: none;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.2rem;
    padding: 0.35rem 0.5rem;
    background: var(--surface-sunken);
    border-bottom: 1px solid var(--border-subtle);
  }

  &__divider {
    width: 1px;
    height: 18px;
    margin: 0 0.25rem;
    background: var(--border);
  }

  &__tool {
    appearance: none;
    position: relative;
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--text-body);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--surface-hover);
    }

    &.is-active {
      color: var(--text-strong);
      background: rgb(var(--accent-rgb) / 0.18);
      border-color: rgb(var(--accent-rgb) / 0.45);
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  // The "A" icon with a bar under it showing the colour at the cursor.
  &__color-bar {
    position: absolute;
    left: 7px;
    right: 7px;
    bottom: 3px;
    height: 3px;
    border-radius: 2px;
  }

  &__size {
    height: 28px;
    padding: 0 0.3rem;
    color: var(--text-body);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
    font-size: 0.72rem;

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  &__panel {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.4rem 0.5rem;
    background: var(--surface-sunken);
    border-bottom: 1px solid var(--border-subtle);
  }

  &__swatch {
    appearance: none;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 2px solid var(--surface-sunken);
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border);
    cursor: pointer;

    &:hover {
      transform: scale(1.12);
    }

    &.is-selected {
      box-shadow: 0 0 0 2px var(--text-strong);
    }
  }

  &__picker {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: 0.2rem;
    color: var(--text-body);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;

    input {
      width: 26px;
      height: 22px;
      padding: 0;
      background: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
    }
  }

  &__link-input {
    flex: 1;
    min-width: 0;
    padding: 0.4rem 0.6rem;
    color: var(--text-strong);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 7px;
    font: inherit;
    font-size: 0.8rem;

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
    }
  }

  &__panel-btn {
    appearance: none;
    padding: 0.35rem 0.65rem;
    color: var(--text-body);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 7px;
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;

    &:hover {
      background: var(--surface-hover);
    }

    &--primary {
      color: var(--text-strong);
      background: rgb(var(--accent-rgb) / 0.18);
      border-color: rgb(var(--accent-rgb) / 0.45);
    }
  }

  // ProseMirror renders the editable surface itself, outside this component's
  // scope id, so everything under it needs :deep().
  &__content {
    :deep(.ProseMirror) {
      min-height: var(--rte-min-height);
      padding: 0.75rem 0.9rem;
      color: var(--text-strong);
      font-size: 0.9rem;
      line-height: 1.6;
      outline: none;
      // Long unbroken strings (URLs, SKUs) shouldn't stretch the card.
      overflow-wrap: anywhere;

      > :first-child {
        margin-top: 0;
      }

      > :last-child {
        margin-bottom: 0;
      }

      p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: left;
        height: 0;
        color: var(--text-subtle);
        pointer-events: none;
      }

      p {
        margin: 0 0 0.8rem;
      }

      h2,
      h3 {
        margin: 1.1rem 0 0.5rem;
        line-height: 1.3;
        color: var(--text-strong);
      }

      h2 {
        font-size: 1.15rem;
      }

      h3 {
        font-size: 1rem;
      }

      ul,
      ol {
        margin: 0.6rem 0 0.8rem;
        padding-left: 1.4rem;
      }

      ul {
        list-style: disc;
      }

      ol {
        list-style: decimal;
      }

      li > p {
        margin: 0;
      }

      blockquote {
        margin: 0.8rem 0;
        padding: 0.1rem 0 0.1rem 0.9rem;
        color: var(--text-muted);
        border-left: 3px solid var(--border);
      }

      hr {
        margin: 1rem 0;
        border: 0;
        border-top: 1px solid var(--border);
      }

      a {
        color: var(--info);
        text-decoration: underline;
        cursor: pointer;
      }

      strong {
        font-weight: 700;
      }

      em {
        font-style: italic;
      }

      u {
        text-decoration: underline;
      }

      s {
        text-decoration: line-through;
      }
    }
  }

  &--readonly &__content :deep(.ProseMirror) {
    cursor: default;
    background: transparent;
  }
}
</style>
