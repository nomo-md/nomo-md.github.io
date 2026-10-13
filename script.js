document.documentElement.classList.add('js');

const revealItems = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

let hashTarget = null;
try {
  hashTarget = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
} catch {
  hashTarget = null;
}
if (hashTarget instanceof HTMLDetailsElement) hashTarget.open = true;

const copyButtons = document.querySelectorAll('[data-copy-text]');
const pageLanguage = document.documentElement.lang.toLowerCase();
const copyFeedback = pageLanguage.startsWith('en')
  ? { success: 'Copied', failure: 'Copy manually' }
  : { success: '已复制', failure: '请手动复制' };

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const originalLabel = button.textContent;

    try {
      const value = button.dataset.copyText;
      if (!value) return;

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }

      button.textContent = copyFeedback.success;
    } catch {
      button.textContent = copyFeedback.failure;
    }

    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1800);
  });
});

const homepage = document.getElementById('nomo-site');
if (homepage) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const replayWriting = setupWritingDemo(homepage, reducedMotion, finePointer);

  const previewThemeButton = homepage.querySelector('.n-theme-toggle');
  previewThemeButton.disabled = false;
  previewThemeButton.addEventListener('click', () => {
    const dark = homepage.dataset.productTheme !== 'dark';
    homepage.dataset.productTheme = dark ? 'dark' : 'light';
    previewThemeButton.setAttribute('aria-pressed', String(dark));
    previewThemeButton.setAttribute(
      'aria-label',
      dark ? previewThemeButton.dataset.darkLabel : previewThemeButton.dataset.lightLabel,
    );
  });

  homepage.querySelectorAll('[data-feature-mode]').forEach((button) => {
    button.disabled = false;
    button.addEventListener('click', () => {
      const source = button.dataset.featureMode === 'source';
      homepage.querySelector('.nv-mode-semantic').hidden = source;
      homepage.querySelector('.nv-mode-source').hidden = !source;
      homepage.querySelectorAll('[data-feature-mode]').forEach((tab) => {
        tab.setAttribute('aria-pressed', String(tab === button));
      });
    });
  });

  homepage.querySelectorAll('[data-outline]').forEach((button) => {
    button.disabled = false;
    button.addEventListener('click', () => {
      homepage.querySelectorAll('[data-outline]').forEach((item) => {
        item.classList.toggle('nv-selected', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      homepage.querySelector('.nv-outline-result').textContent = button.dataset.excerpt;
    });
  });

  const focusButton = homepage.querySelector('.nv-focus-toggle');
  const focusCaption = homepage.querySelector('.nv-desktop-caption');
  focusButton.disabled = false;
  focusButton.addEventListener('click', () => {
    const mini = homepage.querySelector('.nv-small-app').classList.toggle('nv-is-mini');
    focusButton.setAttribute('aria-pressed', String(mini));
    focusButton.textContent = mini ? focusButton.dataset.miniLabel : focusButton.dataset.normalLabel;
    focusCaption.textContent = mini ? focusCaption.dataset.miniLabel : focusCaption.dataset.normalLabel;
  });

  homepage.querySelector('.nv-watch').addEventListener('click', (event) => {
    event.preventDefault();
    homepage.querySelector('#nv-writing').scrollIntoView({
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
      block: 'start',
    });
    replayWriting();
  });

  homepage.querySelectorAll('[data-spotlight]').forEach((panel) => {
    let bounds = null;
    panel.addEventListener('pointerenter', () => {
      bounds = panel.getBoundingClientRect();
    });
    panel.addEventListener('pointermove', (event) => {
      if (!bounds || !finePointer.matches || reducedMotion.matches) return;
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      panel.style.setProperty('--spot-x', `${x * 100}%`);
      panel.style.setProperty('--spot-y', `${y * 100}%`);
      panel.style.setProperty('--spot-alpha', '1');
    });
    const clear = () => {
      bounds = null;
      panel.style.setProperty('--spot-alpha', '0');
    };
    panel.addEventListener('pointerleave', clear);
    reducedMotion.addEventListener('change', clear);
    window.addEventListener('resize', clear, { passive: true });
    window.addEventListener('scroll', clear, { passive: true });
  });
}

function setupWritingDemo(root, reducedMotion, finePointer) {
  const paper = root.querySelector('.n-paper');
  const svg = root.querySelector('.n-writing-svg');
  const panel = root.querySelector('.n-window');
  const pauseButton = root.querySelector('.n-pause');
  const replayButton = root.querySelector('.n-replay');
  const stageLabel = root.querySelector('.n-stage-label');
  const title = root.querySelector('.n-doc-title');
  const rawTitle = root.querySelector('.n-raw-title');
  const listRows = [...root.querySelectorAll('.n-list-row')];
  const table = root.querySelector('.n-table');
  const cells = [...root.querySelectorAll('.n-cell')];
  const grid = root.querySelector('.n-table-grid');
  const back = root.querySelector('.n-table-back');
  const head = root.querySelector('.n-table-head');
  const caret = root.querySelector('.n-caret');
  const slash = root.querySelector('.n-slash');
  const menu = root.querySelector('.n-insert-menu');
  const fallback = root.querySelector('.n-writing-fallback');
  const outlineTitle = root.querySelector('.n-outline-current');
  const writingCount = root.querySelector('.n-writing-count');
  const titleText = fallback.querySelector('h3').textContent;
  const bodyText = fallback.querySelector('p').textContent;
  const listTexts = [...fallback.querySelectorAll('li')].map((item) => item.textContent);
  const cellTexts = [...fallback.querySelectorAll('th,td')].map((item) => item.textContent);
  const stages = pageLanguage.startsWith('en')
    ? [
        'Write a heading',
        'Add a paragraph',
        'Organize a list',
        'Insert a table',
        'Fill the table',
        'Document complete',
      ]
    : ['写入标题', '写下正文', '整理列表', '快捷插入表格', '填写表格', '文档已成形'];

  const total = 15800;
  const canvas = document.createElement('canvas').getContext('2d');
  let time = total;
  let paused = false;
  let began = false;
  let inView = !('IntersectionObserver' in window);
  let frame = 0;
  let anchor = 0;
  let layout = null;
  let pointerBounds = null;
  let bodyLines = [...root.querySelectorAll('.n-body-line')];
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const setText = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  const attr = (element, name, value) => {
    const text = String(value);
    if (element.getAttribute(name) !== text) element.setAttribute(name, text);
  };
  const visible = (element, show) => attr(element, 'visibility', show ? 'visible' : 'hidden');
  const typed = (text, start, duration) => {
    const characters = Array.from(text);
    return characters.slice(0, Math.floor(clamp((time - start) / duration) * characters.length)).join('');
  };

  // 预先测量字宽；英文和中文都按实际字形换行，动画帧只更新内容与属性。
  function widths(text, element) {
    const style = getComputedStyle(element);
    canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing = parseFloat(style.letterSpacing) || 0;
    const characters = Array.from(text);
    return [
      0,
      ...characters.map(
        (_, index) => canvas.measureText(characters.slice(0, index + 1).join('')).width + spacing * index,
      ),
    ];
  }

  function wrapBody(maxWidth) {
    const characters = Array.from(bodyText);
    const lines = [];
    let start = 0;
    while (start < characters.length) {
      let end = start + 1;
      while (
        end < characters.length &&
        widths(characters.slice(start, end + 1).join(''), bodyLines[0]).at(-1) <= maxWidth
      )
        end += 1;
      if (end < characters.length) {
        const space = characters.slice(start, end).lastIndexOf(' ');
        if (space > 0) end = start + space + 1;
      }
      const content = characters.slice(start, end).join('').trimEnd();
      lines.push({ start, end: start + Array.from(content).length, widths: widths(content, bodyLines[0]) });
      start = end;
      while (characters[start] === ' ') start += 1;
    }
    return lines;
  }

  function measure(force = false) {
    const width = paper.clientWidth;
    if (!width || (!force && layout?.width === width)) return;
    const x = width < 420 ? 24 : Math.min(88, Math.max(40, width * 0.12));
    const bodyWidth = width - x * 2;
    const lines = wrapBody(bodyWidth);
    while (bodyLines.length < lines.length) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      line.classList.add('n-body-line');
      bodyLines.at(-1).after(line);
      bodyLines.push(line);
    }
    const listY = 141 + (lines.length - 1) * 27;
    const tableY = listY + 112;
    const tableWidth = Math.min(bodyWidth, 300);
    const columnEdges = [x, x + tableWidth * 0.45, x + tableWidth * 0.67, x + tableWidth];
    layout = {
      width,
      x,
      lines,
      listY,
      tableY,
      titleFontSize: parseFloat(getComputedStyle(title).fontSize),
      titleWidths: widths(titleText, title),
      listWidths: listTexts.map((text, index) => widths(text, listRows[index].querySelector('text'))),
      cellWidths: cellTexts.map((text, index) => widths(text, cells[index])),
    };
    attr(svg, 'viewBox', `0 0 ${width} ${tableY + 112}`);
    attr(svg, 'height', tableY + 112);
    attr(rawTitle, 'x', x);
    attr(rawTitle, 'y', 46);
    attr(title, 'x', x);
    attr(title, 'y', 60);
    bodyLines.forEach((line, index) => {
      attr(line, 'x', x);
      attr(line, 'y', 101 + index * 27);
    });
    listRows.forEach((row, index) => {
      attr(row.querySelector('circle'), 'cx', x + 4);
      attr(row.querySelector('circle'), 'cy', listY + index * 32 - 5);
      attr(row.querySelector('text'), 'x', x + 20);
      attr(row.querySelector('text'), 'y', listY + index * 32);
    });
    attr(slash, 'x', x);
    attr(slash, 'y', tableY + 12);
    attr(menu, 'transform', `translate(${x},${tableY - 142})`);
    [back, head].forEach((element) => {
      attr(element, 'x', x);
      attr(element, 'y', tableY);
      attr(element, 'width', tableWidth);
    });
    attr(back, 'height', 84);
    attr(head, 'height', 42);
    const right = x + tableWidth;
    const bottom = tableY + 84;
    attr(
      grid,
      'd',
      `M${x},${tableY} H${right} V${bottom} H${x} Z M${columnEdges[1]},${tableY} V${bottom} M${columnEdges[2]},${tableY} V${bottom} M${x},${tableY + 42} H${right}`,
    );
    cells.forEach((cell, index) => {
      const column = index % 3;
      attr(
        cell,
        'x',
        index < 3 ? (columnEdges[column] + columnEdges[column + 1]) / 2 : columnEdges[column] + 11,
      );
      attr(cell, 'text-anchor', index < 3 ? 'middle' : 'start');
      attr(cell, 'y', tableY + Math.floor(index / 3) * 42 + 26);
    });
    render();
  }

  function render() {
    if (!layout) return;
    if (reducedMotion.matches) {
      time = total;
      paused = false;
    }
    const { x, lines, listY, tableY } = layout;
    const titleValue = typed(titleText, 450, 1700);
    const bodyValue = Array.from(typed(bodyText, 2450, 1500));
    setText(rawTitle, time < 450 ? typed('# ', 0, 350) : '');
    setText(title, titleValue);
    setText(outlineTitle, titleValue || '\u00a0');
    bodyLines.forEach((line, index) => {
      const range = lines[index];
      setText(line, range ? bodyValue.slice(range.start, range.end).join('') : '');
    });
    listRows.forEach((row, index) => {
      const start = 4350 + index * 900;
      visible(row, time >= start);
      setText(row.querySelector('text'), typed(listTexts[index], start, 740));
    });
    visible(slash, time >= 7450 && time < 8700);
    visible(menu, time >= 7750 && time < 8700);
    const progress = clamp((time - 8700) / 500);
    visible(table, time >= 8700);
    attr(back, 'opacity', progress);
    attr(head, 'opacity', progress);
    attr(grid, 'stroke-dasharray', '1');
    attr(grid, 'stroke-dashoffset', 1 - progress);
    cells.forEach((cell, index) => setText(cell, typed(cellTexts[index], 9350 + index * 670, 540)));
    const writtenText = [
      titleValue,
      bodyValue.join(''),
      ...listRows.map((row) => row.querySelector('text').textContent),
      ...cells.map((cell) => cell.textContent),
    ].join(' ');
    const count = writtenText.match(/[\u3400-\u9fff]|[A-Za-z0-9]+/g)?.length || 0;
    setText(writingCount, `${count}${writingCount.dataset.unit}`);

    let cx = x;
    let cy = 29;
    let height = 24;
    if (time < 450) cx += rawTitle.textContent.length * 9;
    else if (time < 2450) {
      cx += layout.titleWidths[Array.from(titleValue).length];
      cy = 33;
      height = layout.titleFontSize;
    } else if (time < 4350) {
      const index = Math.max(
        0,
        lines.findLastIndex((line) => bodyValue.length > line.start),
      );
      const line = lines[index];
      cx += line.widths[Math.min(line.end - line.start, Math.max(0, bodyValue.length - line.start))];
      cy = 84 + index * 27;
      height = 21;
    } else if (time < 7450) {
      const index = Math.min(2, Math.floor((time - 4350) / 900));
      cx +=
        20 + layout.listWidths[index][Array.from(listRows[index].querySelector('text').textContent).length];
      cy = listY + index * 32 - 17;
      height = 21;
    } else if (time < 8700) {
      cx += 9;
      cy = tableY - 5;
      height = 21;
    } else if (time >= 9350) {
      const index = Math.min(5, Math.floor((time - 9350) / 670));
      cx =
        Number(cells[index].getAttribute('x')) +
        layout.cellWidths[index][Array.from(cells[index].textContent).length] * (index < 3 ? 0.5 : 1);
      cy = Number(cells[index].getAttribute('y')) - 15;
      height = 19;
    }
    attr(caret, 'x', Math.min(layout.width - x - 2, cx + 2));
    attr(caret, 'y', cy);
    attr(caret, 'height', height);
    visible(caret, time < 14200 && !(time >= 8700 && time < 9350));
    const stage =
      time < 2450 ? 0 : time < 4350 ? 1 : time < 7450 ? 2 : time < 8700 ? 3 : time < 14200 ? 4 : 5;
    setText(stageLabel, stages[stage]);
    setText(
      pauseButton,
      time >= total
        ? pauseButton.dataset.completeLabel
        : paused
          ? pauseButton.dataset.resumeLabel
          : pauseButton.dataset.pauseLabel,
    );
    pauseButton.disabled = time >= total || reducedMotion.matches;
  }

  function tick(now) {
    time = Math.min(total, now - anchor);
    render();
    if (time < total && !paused) frame = requestAnimationFrame(tick);
  }
  function run() {
    cancelAnimationFrame(frame);
    anchor = performance.now() - time;
    if (inView && !document.hidden && !paused && time < total && !reducedMotion.matches)
      frame = requestAnimationFrame(tick);
  }
  function replay() {
    began = true;
    time = reducedMotion.matches ? total : 0;
    paused = false;
    render();
    run();
  }
  pauseButton.addEventListener('click', () => {
    if (time >= total || reducedMotion.matches) return;
    paused = !paused;
    run();
    render();
  });
  replayButton.disabled = false;
  replayButton.addEventListener('click', replay);

  const settle = () => {
    panel.style.setProperty('--rx', '0deg');
    panel.style.setProperty('--ry', '0deg');
    panel.style.setProperty('--light', '0');
    pointerBounds = null;
  };
  panel.addEventListener('pointerenter', () => {
    pointerBounds = panel.getBoundingClientRect();
  });
  panel.addEventListener('pointermove', (event) => {
    if (!finePointer.matches || reducedMotion.matches || !pointerBounds) return;
    const x = clamp((event.clientX - pointerBounds.left) / pointerBounds.width);
    const y = clamp((event.clientY - pointerBounds.top) / pointerBounds.height);
    panel.style.setProperty('--rx', `${(0.5 - y) * 4}deg`);
    panel.style.setProperty('--ry', `${(x - 0.5) * 4}deg`);
    panel.style.setProperty('--sx', `${x * 100}%`);
    panel.style.setProperty('--sy', `${y * 100}%`);
    panel.style.setProperty('--light', '1');
  });
  panel.addEventListener('pointerleave', settle);
  window.addEventListener('scroll', settle, { passive: true });
  window.addEventListener('resize', settle, { passive: true });
  reducedMotion.addEventListener('change', () => {
    settle();
    if (reducedMotion.matches) {
      time = total;
      paused = false;
    }
    run();
    render();
  });
  document.addEventListener('visibilitychange', run);

  measure();
  root.setAttribute('data-writer-ready', '');
  svg.removeAttribute('aria-hidden');
  root.querySelector('.nv-demo-controls-right').hidden = false;
  if ('ResizeObserver' in window) new ResizeObserver(() => measure()).observe(paper);
  else window.addEventListener('resize', () => measure(), { passive: true });
  document.fonts?.ready.then(() => measure(true));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        if (inView && !began && !reducedMotion.matches) replay();
        else run();
      },
      { threshold: 0.2 },
    );
    observer.observe(panel);
  } else if (!reducedMotion.matches) replay();
  return replay;
}
