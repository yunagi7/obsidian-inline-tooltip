const { Plugin, PluginSettingTab, Setting, Notice, MarkdownView } = require('obsidian');
// npm install @codemirror/view @codemirror/state
const { EditorView, Decoration, ViewPlugin, WidgetType } = require('@codemirror/view');
const { RangeSetBuilder } = require('@codemirror/state');

const DEFAULT_SETTINGS = {
  language: 'en', // Default language is English, can switch to Chinese in the settings.
  borderColor: 'rgba(184,135,46,0.95)',
  backgroundTop: 'rgba(18,18,18,0.98)',
  backgroundBottom: 'rgba(10,10,10,0.95)',
  textColor: '#f6f2e9',
  widthPx: 300,
  maxWidthVw: 90,
  fontSizePx: 14,
  lineHeight: 1.4,
  showArrow: true
};

class TooltipWidget extends WidgetType {
  constructor(term, definition) {
    super();
    this.term = term;
    this.definition = definition;
  }

  toDOM(view) {
    const span = document.createElement('span');
    span.className = 'p-tooltip';
    span.setAttribute('data-tip', this.definition);
    span.textContent = this.term;
    return span;
  }
}

const tooltipExtension = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.buildDecorations(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view) {
    const builder = new RangeSetBuilder();
    const REGEX = /\{([^{}]+)\}\{([^{}]+)\}/g;

    const cursor = view.state.selection.main.head;

    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      let match;

      while ((match = REGEX.exec(text)) !== null) {
        const matchStart = from + match.index;
        const matchEnd = matchStart + match[0].length;

        const isCursorInside = cursor >= matchStart && cursor <= matchEnd;

        if (!isCursorInside) {
          builder.add(
            matchStart,
            matchEnd,
            Decoration.replace({
              widget: new TooltipWidget(match[1], match[2])
            })
          );
        }
      }
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations
});

// --- Plugin Setting Tab ---

class TooltipSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Language
  t(en, zh) {
    return this.plugin.settings.language === 'zh' ? zh : en;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();


    containerEl.createEl('h3', { text: 'General / 常规' });
    new Setting(containerEl)
      .setName(this.t('Language', '语言'))
      .setDesc(this.t('Switch plugin interface language', '切换插件界面语言'))
      .addDropdown(dropdown => dropdown
        .addOption('en', 'English')
        .addOption('zh', '中文')
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => {
          this.plugin.settings.language = value;
          await this.plugin.saveData(this.plugin.settings);
          this.display();
        }));

    // Appearance Settings
    containerEl.createEl('h3', { text: this.t('Appearance Settings', '外观设置') });

    const addText = (name, desc, get, onChange) => {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText(t => t.setValue(String(get())).onChange(async (v) => { await onChange(v); }));
    };

    addText(
      this.t('Border color', '边框颜色'),
      this.t('CSS color value (e.g. #FF0000 or rgba...)', 'CSS 颜色值 (如 #FF0000 或 rgba...)'),
      () => this.plugin.settings.borderColor,
      async (v) => { this.plugin.settings.borderColor = v || DEFAULT_SETTINGS.borderColor; await this.plugin.saveData(this.plugin.settings); this.plugin.applyStyles(); }
    );

    addText(
      this.t('Background color (top)', '背景色 (上)'),
      this.t('Top color of the gradient background', '渐变背景顶部颜色'),
      () => this.plugin.settings.backgroundTop,
      async (v) => { this.plugin.settings.backgroundTop = v || DEFAULT_SETTINGS.backgroundTop; await this.plugin.saveData(this.plugin.settings); this.plugin.applyStyles(); }
    );

    addText(
      this.t('Background color (bottom)', '背景色 (下)'),
      this.t('Bottom color of the gradient background', '渐变背景底部颜色'),
      () => this.plugin.settings.backgroundBottom,
      async (v) => { this.plugin.settings.backgroundBottom = v || DEFAULT_SETTINGS.backgroundBottom; await this.plugin.saveData(this.plugin.settings); this.plugin.applyStyles(); }
    );

    addText(
      this.t('Text color', '文字颜色'),
      this.t('Color of the tooltip text', 'Tooltip 文字颜色'),
      () => this.plugin.settings.textColor,
      async (v) => { this.plugin.settings.textColor = v || DEFAULT_SETTINGS.textColor; await this.plugin.saveData(this.plugin.settings); this.plugin.applyStyles(); }
    );

    addText(
      this.t('Fixed width (px)', '固定宽度 (px)'),
      this.t('Width of the tooltip', 'Tooltip 的宽度'),
      () => this.plugin.settings.widthPx,
      async (v) => { this.plugin.settings.widthPx = parseInt(v) || DEFAULT_SETTINGS.widthPx; await this.plugin.saveData(this.plugin.settings); this.plugin.applyStyles(); }
    );

    addText(
      this.t('Font size (px)', '字体大小 (px)'),
      this.t('Font size of the content', '内容字体大小'),
      () => this.plugin.settings.fontSizePx,
      async (v) => { this.plugin.settings.fontSizePx = parseInt(v) || DEFAULT_SETTINGS.fontSizePx; await this.plugin.saveData(this.plugin.settings); this.plugin.applyStyles(); }
    );

    new Setting(containerEl)
      .setName(this.t('Show arrow', '显示箭头'))
      .setDesc(this.t('Display a small arrow below the tooltip', '在 Tooltip 下方显示小箭头'))
      .addToggle(t => t.setValue(this.plugin.settings.showArrow).onChange(async (v) => { this.plugin.settings.showArrow = v; await this.plugin.saveData(this.plugin.settings); this.plugin.applyStyles(); }));
  }
}


module.exports = class InlineTooltip extends Plugin {

  txt(en, zh) {
    return this.settings.language === 'zh' ? zh : en;
  }

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() || {});

    console.log('Loading Inline Tooltip plugin...');

    this.addSettingTab(new TooltipSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((el, ctx) => {
      this.processTooltips(el);
    });

    this.registerEditorExtension(tooltipExtension);

    this.addCommand({
      id: 'insert-inline-tooltip',
      name: this.txt('Insert Inline Tooltip', '插入提示框 (Tooltip)'),
      editorCallback: (editor, view) => {
        const selection = editor.getSelection();

        if (!selection) {

          const placeholder = this.txt('{Term}{Description}', '{词语}{提示}');
          editor.replaceSelection(placeholder);

          // Cursor offset
          // English {Term}{Description} (Cursor offset -13)
          // 中文 {词语}{提示} (光标回退6)
          const isZh = this.settings.language === 'zh';
          const offset = isZh ? 6 : 13;

          const cursor = editor.getCursor();
          const chPos = Math.max(0, cursor.ch - offset);
          editor.setCursor({ line: cursor.line, ch: chPos });
          return;
        }

        editor.replaceSelection(`{${selection}}{}`);
        const cursor = editor.getCursor();
        editor.setCursor({ line: cursor.line, ch: cursor.ch - 1 });
      }
    });

    this.applyStyles();
  }

  onunload() {
    const el = document.getElementById('inline-tooltip-styles');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  applyStyles() {
    const id = 'inline-tooltip-styles';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    const s = this.settings;
    el.textContent = `
      .p-tooltip {
        position: relative;
        cursor: help;
        border-bottom: 1px dashed ${s.borderColor};
        color: inherit;
        display: inline-block; 
      }
      .p-tooltip::after {
        content: attr(data-tip);
        position: absolute;
        top: 100%; 
        left: 50%;
        transform: translateX(-50%) translateY(8px);
        z-index: 9999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
        visibility: hidden; 
        display: block;
        width: max-content;
        max-width: ${s.widthPx}px; 
        min-width: 100px;
        white-space: normal;
        font-size: ${s.fontSizePx}px;
        line-height: ${s.lineHeight};
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid ${s.borderColor};
        background: linear-gradient(180deg, ${s.backgroundTop}, ${s.backgroundBottom});
        color: ${s.textColor};
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        text-align: left;
      }
      .p-tooltip::before {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(-2px);
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.2s, transform 0.2s;
        visibility: hidden;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid ${s.borderColor}; 
        ${s.showArrow ? '' : 'display:none;'}
      }
      .p-tooltip:hover::after {
        opacity: 1;
        visibility: visible;
        transform: translateX(-50%) translateY(12px);
      }
      .p-tooltip:hover::before {
        opacity: 1;
        visibility: visible;
        transform: translateX(-50%) translateY(6px);
      }
    `;
  }

  processTooltips(rootEl) {
    const REGEX = /\{([^{}]+)\}\{([^{}]+)\}/g;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
      if (REGEX.test(walker.currentNode.nodeValue)) {
        textNodes.push(walker.currentNode);
      }
      REGEX.lastIndex = 0;
    }

    for (const textNode of textNodes) {
      const text = textNode.nodeValue;
      if (!textNode.parentElement) continue;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match;
      REGEX.lastIndex = 0;
      while ((match = REGEX.exec(text)) !== null) {
        const matchStart = match.index;
        if (matchStart > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, matchStart)));
        const span = document.createElement('span');
        span.className = 'p-tooltip';
        span.setAttribute('data-tip', match[2].trim());
        span.textContent = match[1].trim();
        frag.appendChild(span);
        lastIndex = matchStart + match[0].length;
      }
      if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.parentElement.replaceChild(frag, textNode);
    }
  }
};