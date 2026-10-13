(() => {
  document.querySelectorAll('[data-playground]').forEach(setupInteractiveDemo);

  function setupInteractiveDemo(root) {
    const english = document.documentElement.lang.toLowerCase().startsWith('en');
    const labels = english
      ? {
          toLight: 'Switch preview to light theme',
          toDark: 'Switch preview to dark theme',
          reset: 'Preview reset',
          checked: 'Task completed',
          unchecked: 'Task reopened',
          document: 'Document view',
          source: 'Markdown source',
        }
      : {
          toLight: '切换样机为浅色主题',
          toDark: '切换样机为深色主题',
          reset: '已重置示例',
          checked: '已完成任务',
          unchecked: '已取消完成',
          document: '文档视图',
          source: 'Markdown 源码',
        };
    const compact = window.matchMedia('(max-width: 760px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const files = [...root.querySelectorAll('[data-pg-file]')];
    const documents = [...root.querySelectorAll('[data-pg-document]')];
    const tasks = [...root.querySelectorAll('input[type="checkbox"]')];
    const initialTasks = tasks.map((input) => input.checked);
    const viewport = root.querySelector('.pg-document-scroll');
    const source = root.querySelector('.pg-source');
    const outline = root.querySelector('[data-pg-outline-items]');
    const status = root.querySelector('[data-pg-status]');
    let activeFile = files[0].dataset.pgFile;
    let mode = 'document';
    let headings = [];
    let outlineFrame = 0;

    documents.forEach((doc) => {
      doc.querySelectorAll('h3, h4').forEach((heading, index) => {
        heading.id = `pg-${doc.dataset.pgDocument}-${index}`;
        heading.tabIndex = -1;
      });
    });

    const activeDocument = () => documents.find((doc) => doc.dataset.pgDocument === activeFile);
    const announce = (message) => {
      status.textContent = message;
    };

    // Derive the read-only Markdown from the same sample DOM as the document.
    // Checkboxes stay in their original nodes, so file/mode switches keep their state.
    function markdown(node) {
      const children = () => [...node.children].map(markdown).join('');
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      switch (node.tagName) {
        case 'H3':
          return `# ${text}\n\n`;
        case 'H4':
          return `## ${text}\n\n`;
        case 'P':
          return `${text}\n\n`;
        case 'BLOCKQUOTE':
          return `${children()
            .trim()
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n')}\n\n`;
        case 'UL':
          return `${children()}\n`;
        case 'LI': {
          const input = node.querySelector('input[type="checkbox"]');
          return `- ${input ? `[${input.checked ? 'x' : ' '}] ` : ''}${text}\n`;
        }
        case 'TABLE': {
          const rows = [...node.rows].map(
            (row) =>
              `| ${[...row.cells].map((cell) => cell.textContent.replace(/\s+/g, ' ').trim().replaceAll('|', '\\|')).join(' | ')} |`,
          );
          rows.splice(1, 0, `| ${[...node.rows[0].cells].map(() => '---').join(' | ')} |`);
          return `${rows.join('\n')}\n\n`;
        }
        default:
          return children();
      }
    }

    function refreshSource() {
      source.querySelector('code').textContent = markdown(activeDocument()).trimEnd();
      const text = activeDocument().textContent.replace(/\s+/g, ' ').trim();
      const count = [
        ...new Intl.Segmenter(english ? 'en' : 'zh-CN', { granularity: 'word' }).segment(text),
      ].filter((part) => part.isWordLike).length;
      root.querySelector('[data-pg-count]').textContent = `${count}${english ? ' words' : '词'}`;
    }

    function markHeading(id) {
      outline.querySelectorAll('[data-pg-heading]').forEach((button) => {
        if (button.dataset.pgHeading === id) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
    }

    function updateOutline() {
      outlineFrame = 0;
      if (mode !== 'document') return;
      const top = viewport.getBoundingClientRect().top;
      let current = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top - top <= 48) current = heading;
      }
      if (
        viewport.scrollHeight > viewport.clientHeight &&
        viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2
      )
        current = headings.at(-1);
      markHeading(current.id);
    }

    function renderOutline() {
      headings = [...activeDocument().querySelectorAll('h3, h4')];
      outline.replaceChildren(
        ...headings.map((heading) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'pg-outline-item';
          button.dataset.pgHeading = heading.id;
          button.textContent = heading.textContent;
          return button;
        }),
      );
      markHeading(headings[0].id);
    }

    function setMode(nextMode) {
      mode = nextMode;
      root.dataset.mode = mode;
      root.querySelector('.pg-documents').hidden = mode === 'source';
      source.hidden = mode !== 'source';
      root.querySelectorAll('[data-pg-mode]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.pgMode === mode));
      });
      refreshSource();
      viewport.scrollTop = 0;
      markHeading(headings[0].id);
    }

    function selectFile(key) {
      activeFile = key;
      documents.forEach((doc) => {
        doc.hidden = doc.dataset.pgDocument !== key;
      });
      files.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.pgFile === key));
      });
      const filename = files.find((button) => button.dataset.pgFile === key).textContent.trim();
      root.querySelector('[data-pg-filename]').textContent = filename;
      renderOutline();
      refreshSource();
      viewport.scrollTop = 0;
      return filename;
    }

    function setPanel(panel, open) {
      root.dataset[`${panel}Open`] = String(open);
      root.querySelector(`[data-pg-action="${panel}"]`).setAttribute('aria-expanded', String(open));
    }

    function setTheme(theme) {
      root.dataset.demoTheme = theme;
      const dark = theme === 'dark';
      const button = root.querySelector('[data-pg-action="theme"]');
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? labels.toLight : labels.toDark);
      button.title = dark ? labels.toLight : labels.toDark;
    }

    function reset() {
      tasks.forEach((input, index) => {
        input.checked = initialTasks[index];
      });
      selectFile(files[0].dataset.pgFile);
      setMode('document');
      setTheme('light');
      setPanel('sidebar', !compact.matches);
      setPanel('outline', !compact.matches);
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.dataset.pgFile) {
        announce(selectFile(button.dataset.pgFile));
        if (compact.matches) {
          setPanel('sidebar', false);
          root.querySelector('[data-pg-action="sidebar"]').focus({ preventScroll: true });
        }
      } else if (button.dataset.pgMode) {
        setMode(button.dataset.pgMode);
        announce(labels[mode]);
      } else if (button.dataset.pgHeading) {
        if (mode !== 'document') setMode('document');
        const heading = headings.find((item) => item.id === button.dataset.pgHeading);
        const offset =
          heading.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top +
          viewport.scrollTop -
          24;
        heading.focus({ preventScroll: true });
        viewport.scrollTo({
          top: Math.max(0, offset),
          behavior: reducedMotion.matches ? 'auto' : 'smooth',
        });
        markHeading(heading.id);
      } else {
        switch (button.dataset.pgAction) {
          case 'sidebar':
          case 'outline': {
            const panel = button.dataset.pgAction;
            setPanel(panel, root.dataset[`${panel}Open`] !== 'true');
            break;
          }
          case 'theme':
            setTheme(root.dataset.demoTheme === 'dark' ? 'light' : 'dark');
            break;
          case 'reset':
            reset();
            announce(labels.reset);
            break;
        }
      }
    });
    root.addEventListener('change', (event) => {
      if (!event.target.matches('input[type="checkbox"]')) return;
      refreshSource();
      announce(event.target.checked ? labels.checked : labels.unchecked);
    });
    viewport.addEventListener(
      'scroll',
      () => {
        if (!outlineFrame) outlineFrame = requestAnimationFrame(updateOutline);
      },
      { passive: true },
    );
    compact.addEventListener('change', () => {
      // Keep the reading surface usable when moving between desktop and phone widths.
      const focused = document.activeElement;
      if (
        compact.matches &&
        (root.querySelector('.pg-sidebar').contains(focused) ||
          root.querySelector('.pg-outline').contains(focused))
      ) {
        root.querySelector('[data-pg-action="sidebar"]').focus({ preventScroll: true });
      }
      setPanel('sidebar', !compact.matches);
      setPanel('outline', !compact.matches);
    });

    reset();
    root.classList.add('pg-ready');
    root.querySelectorAll('button, input[type="checkbox"]').forEach((control) => {
      control.disabled = false;
    });
  }
})();
