(() => {
  const root = document.getElementById('nomo-site');
  const { gsap, Flip } = window;
  if (!root || !gsap || !Flip) return;
  gsap.registerPlugin(Flip);
  const english = document.documentElement.lang.startsWith('en');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const demos = [];
  const entrances = new Set();
  let paused = false;
  const canMove = () => !reduced.matches && !paused;
  const phrase = (zh, en) => english ? en : zh;
  root.dataset.motionReady = 'true';

  // Each demo plays once. Adjacent demos take turns; manual input takes ownership.
  function schedule() {
    const active = demos.find((demo) => demo.visible && !demo.done && !demo.manual);
    demos.forEach((demo) => {
      const playing = demo === active && canMove() && !document.hidden;
      if (playing && !demo.timeline) demo.timeline = demo.build();
      if (demo.timeline) playing ? demo.timeline.play() : demo.timeline.pause();
      if (demo.transition) {
        demo.visible && canMove() && !document.hidden ? demo.transition.play() : demo.transition.pause();
      }
    });
  }

  function caption(element, initial) {
    const row = document.createElement('div');
    row.className = 'nv-demo-caption';
    const status = document.createElement('span');
    status.className = 'nv-demo-status';
    status.textContent = initial;
    const replay = document.createElement('button');
    replay.type = 'button';
    replay.className = 'nv-motion-link';
    replay.textContent = phrase('重播 ↺', 'Replay ↺');
    replay.setAttribute('aria-label', phrase('重播功能演示', 'Replay feature demo'));
    row.append(status, replay);
    element.append(row);
    return { status, replay };
  }

  function register(element, build, reset, initial, captionElement = element) {
    const { status, replay } = caption(captionElement, initial);
    const demo = { element, status, reset, visible: false, done: false, manual: false, timeline: null, transition: null };
    demo.build = () => {
      reset();
      return build(status).eventCallback('onComplete', () => {
        demo.done = true;
        schedule();
      });
    };
    demo.takeOver = (restore = true) => {
      demo.manual = true;
      demo.timeline?.kill();
      demo.timeline = null;
      demo.transition?.progress(1).kill();
      demo.transition = null;
      if (restore) reset();
      schedule();
    };
    replay.addEventListener('click', () => {
      demo.takeOver();
      if (!canMove()) return;
      demo.manual = false;
      demo.done = false;
      // A requested replay takes precedence over another card's automatic demo.
      demos.splice(demos.indexOf(demo), 1);
      demos.unshift(demo);
      schedule();
    });
    demos.push(demo);
    return demo;
  }

  // Entrance animation targets wrappers, leaving the editor's pointer tilt independent.
  function enter(elements, delay = 0) {
    if (!canMove() || !elements.length) return;
    const tween = gsap.from(elements, {
      autoAlpha: 0, y: 22, duration: .85, stagger: .09, delay,
      ease: 'power3.out', clearProps: 'opacity,visibility,transform',
      onComplete: () => entrances.delete(tween),
    });
    entrances.add(tween);
  }
  const hero = root.querySelector('.nv-hero');
  if (hero.getBoundingClientRect().bottom > 0 && window.scrollY < 160) {
    enter([
      hero.querySelector('.nv-release-link'), hero.querySelector('h1'),
      hero.querySelector('.nv-lede'), hero.querySelector('.nv-hero-actions'),
      hero.querySelector('.nv-trust-strip'), hero.querySelector('.nv-hero-demo'),
    ]);
  }
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      revealObserver.unobserve(target);
      const elements = target.matches('.nv-feature, .nv-focus-desktop, .nv-local, .nv-download')
        ? [target]
        : target.matches('.nv-playground')
          ? [...target.querySelectorAll('.pg-heading, .pg-window')]
          : [...target.children].filter((child) => child.matches('.nv-eyebrow, h2, .nv-section-lede, .nv-updates-heading, .nv-update-items'));
      enter(elements);
    });
  }, { threshold: .1, rootMargin: '0px 0px -35px 0px' });
  root.querySelectorAll('.nv-section, .nv-feature, .nv-focus-copy, .nv-focus-desktop').forEach((el) => revealObserver.observe(el));

  // A short writing sequence, followed by two views of the exact same document.
  const mode = root.querySelector('.nv-feature-primary');
  const semantic = mode.querySelector('.nv-mode-semantic');
  const source = mode.querySelector('.nv-mode-source');
  const modeParts = [...semantic.children];
  const typing = document.createElement('span');
  typing.className = 'nv-mode-typing';
  typing.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('span');
  hint.className = 'nv-insert-hint';
  hint.setAttribute('aria-hidden', 'true');
  const slash = document.createElement('kbd');
  slash.textContent = '/';
  hint.append(slash, document.createTextNode(phrase('插入表格', 'Insert table')));
  mode.querySelector('.nv-mode-body').append(typing, hint);
  gsap.set([typing, hint], { autoAlpha: 0 });
  let modeName = 'semantic';
  function setMode(name) {
    modeName = name;
    semantic.hidden = name === 'source';
    source.hidden = name !== 'source';
    mode.querySelectorAll('[data-feature-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.featureMode === name)));
  }
  function resetMode() {
    setMode('semantic');
    gsap.set([semantic, source, ...modeParts], { clearProps: 'all' });
    gsap.set([typing, hint], { autoAlpha: 0 });
  }
  const writing = register(mode, (status) => {
    const text = '# ' + semantic.querySelector('h4').textContent;
    const pen = { count: 0 };
    const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    timeline.set(modeParts, { autoAlpha: 0, y: 8 })
      .set(typing, { autoAlpha: 1 })
      .call(() => { status.textContent = phrase('写下想法', 'Start with an idea'); })
      .to(pen, { count: text.length, duration: 1.25, ease: 'none', onUpdate: () => { typing.textContent = text.slice(0, Math.round(pen.count)) + '▏'; } }, .25)
      .to(typing, { autoAlpha: 0, duration: .2 }, 1.65)
      .to(modeParts[0], { autoAlpha: 1, y: 0, duration: .55 }, 1.65)
      .to(modeParts[1], { autoAlpha: 1, y: 0, duration: .5 }, 2.1)
      .fromTo(hint, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: .3, immediateRender: false }, 2.8)
      .call(() => { status.textContent = phrase('用 /，把表格放进文档', 'Add a table with /'); }, [], 2.8)
      .to(hint, { autoAlpha: 0, duration: .2 }, 3.7)
      .to(modeParts[2], { autoAlpha: 1, y: 0, duration: .65 }, 3.8)
      .to(semantic, { autoAlpha: 0, y: -5, duration: .25 }, 5)
      .call(() => { setMode('source'); status.textContent = phrase('同一份内容，随时查看源码', 'The same content, in Markdown'); }, [], 5.25)
      .fromTo(source, { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: .4, immediateRender: false }, 5.25)
      .to(source, { autoAlpha: 0, duration: .25 }, 6.8)
      .call(() => setMode('semantic'), [], 7.05)
      .to(semantic, { autoAlpha: 1, y: 0, duration: .45 }, 7.05)
      .call(() => { status.textContent = phrase('文档成形，思路继续', 'Keep your train of thought'); }, [], 7.5);
    return timeline;
  }, resetMode, phrase('从一个想法，到一份文档', 'From an idea to a document'));
  mode.querySelectorAll('[data-feature-mode]').forEach((button) => button.addEventListener('click', () => {
    const previous = modeName;
    writing.takeOver();
    setMode(button.dataset.featureMode);
    writing.status.textContent = phrase('同一份内容，两种视图', 'One document, two views');
    if (canMove() && previous !== modeName) writing.transition = gsap.from(modeName === 'source' ? source : semantic, { autoAlpha: 0, y: 5, duration: .35, clearProps: 'all' });
  }));

  const organizer = root.querySelector('.nv-feature-secondary');
  const navigation = organizer.querySelector('.nv-outline-navigation');
  const paper = organizer.querySelector('.nv-outline-paper');
  const outlineButtons = [...navigation.children];
  const chapters = [...paper.children];
  const excerpt = organizer.querySelector('.nv-outline-result');
  function selectChapter(key) {
    outlineButtons.forEach((button) => {
      const selected = button.dataset.outline === key;
      button.classList.toggle('nv-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      if (selected) excerpt.textContent = button.dataset.excerpt;
    });
    chapters.forEach((chapter) => chapter.classList.toggle('is-active', chapter.dataset.chapter === key));
  }
  function resetOutline() {
    navigation.append(...outlineButtons);
    paper.append(...chapters);
    [...outlineButtons, ...chapters].forEach((el) => el.classList.remove('is-folded'));
    gsap.set([...outlineButtons, ...chapters], { clearProps: 'all' });
    selectChapter('intro');
  }
  const organize = register(organizer, (status) => {
    const timeline = gsap.timeline({ paused: true });
    timeline.call(() => { selectChapter('writing'); status.textContent = phrase('沿着大纲，找到这一节', 'Find a chapter in the outline'); }, [], .7)
      .fromTo(chapters[1], { x: 5 }, { x: 0, duration: .4, immediateRender: false }, .7)
      .call(() => {
        const state = Flip.getState(chapters);
        chapters[0].classList.add('is-folded');
        outlineButtons[0].classList.add('is-folded');
        status.textContent = phrase('折叠已读章节，留下当前重点', 'Fold what you have already read');
        timeline.add(Flip.from(state, { duration: .6, scale: true, ease: 'power2.inOut' }), 2.2);
      }, [], 2.2)
      .call(() => {
        const state = Flip.getState([...outlineButtons, ...chapters]);
        navigation.insertBefore(outlineButtons[2], outlineButtons[1]);
        paper.insertBefore(chapters[2], chapters[1]);
        selectChapter('next');
        status.textContent = phrase('整节移动，内容跟着结构走', 'Move a chapter with its content');
        timeline.add(Flip.from(state, { duration: .8, scale: true, ease: 'power2.inOut' }), 4.1);
      }, [], 4.1)
      .call(() => { status.textContent = phrase('方向清楚，继续往下写', 'A clear structure. Keep writing.'); }, [], 5.4);
    return timeline;
  }, resetOutline, phrase('浏览、折叠、整理章节', 'Browse, fold and arrange'));
  outlineButtons.forEach((button) => button.addEventListener('click', () => {
    organize.takeOver(false);
    gsap.set([...outlineButtons, ...chapters], { clearProps: 'all' });
    selectChapter(button.dataset.outline);
    organize.status.textContent = phrase('大纲与正文，始终对应', 'Your outline stays connected');
    if (canMove()) organize.transition = gsap.from(chapters.find((el) => el.dataset.chapter === button.dataset.outline), { x: 5, duration: .35, clearProps: 'transform' });
  }));

  const focus = root.querySelector('#nv-focus');
  const app = focus.querySelector('.nv-small-app');
  const documentPanel = app.querySelector('.nv-small-document');
  const chrome = [...app.querySelectorAll('.nv-small-sidebar, .nv-small-tabs, .nv-small-toolbar, .nv-small-top')];
  const focusButton = focus.querySelector('.nv-focus-toggle');
  const focusCaption = focus.querySelector('.nv-desktop-caption');
  function setMini(mini) {
    app.classList.toggle('nv-is-mini', mini);
    focusButton.setAttribute('aria-pressed', String(mini));
    focusButton.textContent = mini ? focusButton.dataset.miniLabel : focusButton.dataset.normalLabel;
    focusCaption.textContent = mini ? focusCaption.dataset.miniLabel : focusCaption.dataset.normalLabel;
  }
  function resetFocus() {
    setMini(false);
    gsap.set([app, documentPanel, ...chrome], { clearProps: 'all' });
  }
  function focusTransition(mini, status) {
    const timeline = gsap.timeline();
    if (mini) timeline.to(chrome, { autoAlpha: 0, duration: .22, stagger: .035 });
    timeline.call(() => {
      const state = Flip.getState([app, documentPanel]);
      setMini(mini);
      gsap.set(chrome, { clearProps: 'all' });
      status.textContent = mini ? phrase('同一份文档，留在眼前', 'The same words, still in view') : phrase('展开工具，接着整理', 'Bring your tools back');
      timeline.add(Flip.from(state, { duration: .85, ease: 'power2.inOut', scale: true, nested: true }), timeline.time());
      if (!mini) timeline.from(chrome, { autoAlpha: 0, duration: .3, stagger: .025, clearProps: 'opacity,visibility' }, timeline.time() + .45);
    });
    return timeline;
  }
  const focusDemo = register(focus.querySelector('.nv-focus-desktop'), (status) => {
    const timeline = gsap.timeline({ paused: true });
    timeline.call(() => {
      timeline.add(focusTransition(true, status), 1.1);
    }, [], 1.1).call(() => {}, [], 3.1);
    return timeline;
  }, resetFocus, phrase('工具收起，思路留下', 'Less interface. More room to think.'), focus.querySelector('.nv-focus-copy'));
  focusButton.addEventListener('click', () => {
    const mini = !app.classList.contains('nv-is-mini');
    focusDemo.takeOver();
    // Restore the previous stable layout before capturing the requested transition.
    setMini(!mini);
    if (canMove()) focusDemo.transition = focusTransition(mini, focusDemo.status);
    else {
      setMini(mini);
      focusDemo.status.textContent = mini ? phrase('同一份文档，留在眼前', 'The same words, still in view') : phrase('展开工具，接着整理', 'Bring your tools back');
    }
  });

  const demoObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
      demos.find((demo) => demo.element === target).visible = isIntersecting && intersectionRatio >= .3;
    });
    schedule();
  }, { threshold: [0, .3] });
  demos.forEach((demo) => demoObserver.observe(demo.element));

  const toggle = root.querySelector('[data-motion-toggle]');
  toggle.hidden = false;
  function updateMotion() {
    toggle.disabled = reduced.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = reduced.matches ? phrase('已减少动态效果', 'Reduced motion')
      : paused ? phrase('继续动效', 'Resume motion') : phrase('暂停动效', 'Pause motion');
    root.dispatchEvent(new CustomEvent('nomo:motion', { detail: { paused: !canMove() } }));
    root.querySelectorAll('.nv-demo-caption button, [data-writing-replay]').forEach((button) => { button.disabled = !canMove(); });
    if (!canMove()) entrances.forEach((tween) => tween.progress(1));
    demos.forEach((demo) => {
      if (reduced.matches) {
        demo.timeline?.kill();
        demo.transition?.progress(1).kill();
        demo.timeline = null;
        demo.transition = null;
        demo.reset();
        demo.done = true;
      } else if (demo.transition) paused ? demo.transition.pause() : demo.transition.play();
    });
    schedule();
  }
  toggle.addEventListener('click', () => { paused = !paused; updateMotion(); });
  reduced.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', () => {
    demos.forEach((demo) => {
      if (demo.transition) document.hidden || !canMove() ? demo.transition.pause() : demo.transition.play();
    });
    schedule();
  });
  // A keyboard user should never have to wait for an entrance to reach a control.
  root.addEventListener('focusin', () => entrances.forEach((tween) => tween.progress(1)));
  updateMotion();
})();
