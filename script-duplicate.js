(() => {
  const hero = document.querySelector('[data-hero-dots]')?.closest('.hero');
  const siteHeader = document.querySelector('[data-header]');

  // Start the first-page header drop independently of the decorative hero systems.
  // This keeps the brand entrance reliable even if media/canvas setup is delayed.
  if (hero && siteHeader) {
    document.body.classList.add('hero-motion-ready');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => siteHeader.classList.add('header--motion-open'));
    });
  }

  const initHeroDots = (section) => {
    const canvas = section?.querySelector('canvas.hero-dots');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const settings = { spacing: 30, radius: 260, pull: 0.42, color: '255, 236, 226', rest: 0.18 };
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let cols = 0;
    let rows = 0;
    let points = [];
    let pointerX = -9999;
    let pointerY = -9999;
    let targetX = -9999;
    let targetY = -9999;
    let active = 0;
    let targetActive = 0;
    let lastFrame = 0;
    let raf = 0;
    let running = true;

    const resize = () => {
      pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      width = section.clientWidth;
      height = section.clientHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const spacing = width < 700 ? settings.spacing * 0.8 : settings.spacing;
      cols = Math.ceil(width / spacing) + 3;
      rows = Math.ceil(height / spacing) + 3;
      const startX = (width - (cols - 1) * spacing) / 2;
      const startY = (height - (rows - 1) * spacing) / 2;
      points = [];

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = startX + col * spacing;
          const y = startY + row * spacing;
          points.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0, weight: 0 });
        }
      }
    };

    const draw = () => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;
      context.strokeStyle = `rgba(${settings.color}, ${settings.rest})`;
      context.beginPath();
      const activeLines = [];

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const point = points[row * cols + col];
          const right = col + 1 < cols ? points[row * cols + col + 1] : null;
          const below = row + 1 < rows ? points[(row + 1) * cols + col] : null;

          for (const next of [right, below]) {
            if (!next) continue;
            const weight = (point.weight + next.weight) / 2;
            if (weight > 0.02) activeLines.push([point, next, weight]);
            else {
              context.moveTo(point.x, point.y);
              context.lineTo(next.x, next.y);
            }
          }
        }
      }

      context.stroke();

      for (const [from, to, weight] of activeLines) {
        context.strokeStyle = `rgba(${settings.color}, ${(settings.rest + weight * 0.62).toFixed(3)})`;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }

      for (const point of points) {
        const alpha = Math.min(1, settings.rest * 1.8 + point.weight * 0.8);
        const radius = 0.9 + point.weight * 1.5;
        context.fillStyle = `rgba(${settings.color}, ${alpha.toFixed(3)})`;

        if (point.weight < 0.02) context.fillRect(point.x - 0.8, point.y - 0.8, 1.6, 1.6);
        else {
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
    };

    const update = (delta) => {
      const radius = width < 700 ? settings.radius * 0.75 : settings.radius;
      let moving = false;

      for (const point of points) {
        const dx = pointerX - point.homeX;
        const dy = pointerY - point.homeY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = distance < radius ? (1 - distance / radius) ** 2 * active : 0;
        const destinationX = point.homeX + dx * influence * settings.pull * 1.6;
        const destinationY = point.homeY + dy * influence * settings.pull * 1.6;

        point.vx += ((destinationX - point.x) * 120 - point.vx * 14) * delta;
        point.vy += ((destinationY - point.y) * 120 - point.vy * 14) * delta;
        point.x += point.vx * delta;
        point.y += point.vy * delta;
        point.weight += (influence - point.weight) * Math.min(1, delta * 8);

        if (Math.abs(point.vx) + Math.abs(point.vy) > 0.02 || point.weight > 0.003 || Math.abs(point.x - point.homeX) + Math.abs(point.y - point.homeY) > 0.05) moving = true;
      }

      return moving;
    };

    const frame = (time) => {
      const delta = Math.min(0.033, (time - lastFrame) / 1000 || 0);
      lastFrame = time;
      if (window.performance.now() - lastPointerTime > 1400) targetActive = 0;
      active += (targetActive - active) * Math.min(1, delta * (targetActive > active ? 5 : 1.6));
      pointerX += (targetX - pointerX) * Math.min(1, delta * 10);
      pointerY += (targetY - pointerY) * Math.min(1, delta * 10);

      const moving = reducedMotion ? false : update(delta);
      draw();
      if (moving || active > 0.001 || Math.abs(targetActive - active) > 0.001) raf = requestAnimationFrame(frame);
      else raf = 0;
    };

    let lastPointerTime = 0;
    const wake = () => {
      if (!raf && running && !reducedMotion) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    section.addEventListener('pointermove', (event) => {
      const rect = section.getBoundingClientRect();
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
      if (pointerX < -9000) {
        pointerX = targetX;
        pointerY = targetY;
      }
      targetActive = 1;
      lastPointerTime = performance.now();
      wake();
    });

    section.addEventListener('pointerleave', () => {
      targetActive = 0;
      wake();
    });

    new ResizeObserver(resize).observe(section);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) wake();
    });

    resize();
    draw();
  };

  const initHeroCardWall = (section) => {
    const wall = section?.querySelector('[data-hero-card-wall]');
    const track = wall?.querySelector('[data-hero-card-wall-track]');
    if (!wall || !track) return;

    const media = [
      { type: 'image', src: './assets/eventoria-header.jpg', label: 'EVENTORIA / IMAGE STUDY' },
      { type: 'image', src: './assets/eventoria-hero.jpg', label: 'EVENTORIA / LIVE ATMOSPHERE' },
      { type: 'video', src: './assets/eventoria-scroll-video.mp4?v=4', poster: './assets/eventoria-hero.jpg' },
      { type: 'image', src: './assets/eventoria-header.jpg', label: 'SELECTED WORK / 01' },
    ];
    const verticalColumns = [
      { x: 3, rows: [7, 24, 41, 58, 75, 92] },
      { x: 16, rows: [9, 26, 43, 60, 77, 94] },
      { x: 29, rows: [5, 22, 39, 56, 73, 90] },
      { x: 42, rows: [9, 26, 43, 60, 77, 94] },
      { x: 55, rows: [5, 22, 39, 56, 73, 90] },
      { x: 68, rows: [9, 26, 43, 60, 77, 94] },
      { x: 81, rows: [5, 22, 39, 56, 73, 90] },
      { x: 94, rows: [9, 26, 43, 60, 77, 94] },
    ];
    const rotationCycle = [-7, 5, -3, 7, -6, 4, -5, 6];
    const scaleCycle = [0.78, 1.02, 0.86, 1.08, 0.74, 0.94];
    const placements = verticalColumns.flatMap(({ x, rows }, columnIndex) =>
      rows.map((y, rowIndex) => {
        const index = columnIndex * rows.length + rowIndex;
        return [
          x,
          y,
          rotationCycle[(columnIndex + rowIndex) % rotationCycle.length],
          scaleCycle[index % scaleCycle.length],
          ((index * 0.07) % 0.5).toFixed(2),
        ];
      }),
    );
    const sizeVariants = [
      { width: 'clamp(7.5rem, 12vw, 14rem)', ratio: '1.18' },
      { width: 'clamp(8.5rem, 15vw, 17rem)', ratio: '1.52' },
      { width: 'clamp(10rem, 19vw, 21rem)', ratio: '1.72' },
      { width: 'clamp(7rem, 11vw, 13rem)', ratio: '1.34' },
      { width: 'clamp(9rem, 17vw, 19rem)', ratio: '1.42' },
    ];
    const fragment = document.createDocumentFragment();

    placements.forEach(([x, y, rotation, scale, delay], index) => {
      const source = media[index % media.length];
      const size = sizeVariants[index % sizeVariants.length];
      const card = document.createElement('article');
      card.className = 'hero-card';
      card.style.setProperty('--x', `${x}%`);
      card.style.setProperty('--column-x', `${x}%`);
      card.style.setProperty('--y', `${y}%`);
      card.style.setProperty('--rotation', `${rotation}deg`);
      card.style.setProperty('--card-scale', scale);
      card.style.setProperty('--delay', `${delay}s`);
      card.style.setProperty('--card-width', size.width);
      card.style.setProperty('--card-ratio', size.ratio);

      const intro = document.createElement('div');
      intro.className = 'hero-card__intro';
      const surface = document.createElement('div');
      surface.className = 'hero-card__surface';
      const mediaElement = document.createElement(source.type === 'video' ? 'video' : 'img');
      mediaElement.className = 'hero-card__media';
      mediaElement.setAttribute('aria-hidden', 'true');

      if (source.type === 'video') {
        mediaElement.src = source.src;
        mediaElement.poster = source.poster;
        mediaElement.muted = true;
        mediaElement.loop = true;
        mediaElement.autoplay = true;
        mediaElement.playsInline = true;
        mediaElement.preload = 'metadata';
      } else {
        mediaElement.src = source.src;
        mediaElement.alt = '';
        mediaElement.loading = 'eager';
        mediaElement.decoding = 'async';
      }

      if (source.label) {
        const label = document.createElement('span');
        label.className = 'hero-card__label';
        label.textContent = source.label;
        surface.append(mediaElement, label);
      } else {
        surface.append(mediaElement);
      }
      intro.append(surface);
      card.append(intro);
      fragment.append(card);
    });

    track.append(fragment);

    const updateWallPointer = (event) => {
      const rect = section.getBoundingClientRect();
      const x = ((event.clientX - (rect.left + rect.width / 2)) / rect.width) * 34;
      const y = ((event.clientY - (rect.top + rect.height / 2)) / rect.height) * 24;
      wall.style.setProperty('--wall-pointer-x', `${x.toFixed(2)}px`);
      wall.style.setProperty('--wall-pointer-y', `${y.toFixed(2)}px`);
    };

    section.addEventListener('pointermove', updateWallPointer);
    section.addEventListener('pointerleave', () => {
      wall.style.setProperty('--wall-pointer-x', '0px');
      wall.style.setProperty('--wall-pointer-y', '0px');
    });

    section.classList.add('hero--motion-ready');
    document.body.classList.add('hero-motion-ready');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        section.classList.add('hero--motion-open');
        document.querySelector('[data-header]')?.classList.add('header--motion-open');
      });
    });
  };

  initHeroDots(hero);
  initHeroCardWall(hero);

  const sectionFlow = (() => {
    const sections = [...document.querySelectorAll('[data-section-index]')];
    const phaseOrder = { hero: 1, about: 2, work: 3, events: 4, reference: 5 };
    let thirdComplete = false;
    const documentTop = (section) => section
      ? section.getBoundingClientRect().top + window.scrollY
      : Number.POSITIVE_INFINITY;

    const sync = () => {
      const about = document.querySelector('[data-about-panel]');
      const work = document.querySelector('[data-selected-work]');
      const workStage = document.querySelector('[data-selected-work-stage]');
      const events = document.querySelector('[data-event-agenda]');
      const reference = document.querySelector('[data-reference-scroll]');
      const aboutStart = documentTop(about);
      const workStart = documentTop(workStage || work);
      const eventsEnd = events ? documentTop(events) + events.offsetHeight : Number.POSITIVE_INFINITY;
      const referenceStart = documentTop(reference);
      const releasePoint = workStage
        ? workStart + workStage.offsetHeight
        : work
          ? workStart + work.offsetHeight
          : Number.POSITIVE_INFINITY;
      const scrollY = window.scrollY;

      thirdComplete = Boolean(work?.classList.contains('is-video-complete') && scrollY >= releasePoint);
      const phase = scrollY < aboutStart
        ? 'hero'
        : scrollY < workStart
          ? 'about'
          : thirdComplete ? (scrollY < referenceStart ? 'events' : 'reference') : 'work';
      const phaseIndex = phaseOrder[phase];

      document.body.setAttribute('data-section-phase', phase);
      sections.forEach((section) => {
        const sectionIndex = Number(section.dataset.sectionIndex);
        section.dataset.sectionState = sectionIndex === phaseIndex
          ? 'active'
          : sectionIndex < phaseIndex
            ? 'complete'
            : 'upcoming';
      });

      return thirdComplete;
    };

    const requestUpdate = () => requestAnimationFrame(sync);
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    sync();

    return {
      sync,
      isThirdComplete: () => thirdComplete,
      getThirdReleasePoint: () => {
        const work = document.querySelector('[data-selected-work]');
        const workStage = document.querySelector('[data-selected-work-stage]');
        if (workStage) return documentTop(workStage) + workStage.offsetHeight;
        return work ? documentTop(work) + work.offsetHeight : Number.POSITIVE_INFINITY;
      },
    };
  })();

  const aboutPanel = document.querySelector('[data-about-panel]');
  const selectedWork = document.querySelector('[data-selected-work]');
  if (aboutPanel && hero) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Capture the flow positions before the sticky About panel starts moving.
    // Reading offsetTop on every scroll frame makes a sticky element's value
    // drift with the scroll and can push the third-section reveal forever.
    const aboutDocumentTop = aboutPanel.getBoundingClientRect().top + window.scrollY;
    const aboutStage = document.querySelector('[data-about-stage]');
    const selectedWorkStage = document.querySelector('[data-selected-work-stage]');
    const nextSection = document.querySelector('[data-selected-work-deck]') || selectedWorkStage || selectedWork;
    const selectedWorkDocumentTop = selectedWorkStage
      ? selectedWorkStage.getBoundingClientRect().top + window.scrollY
      : selectedWork
        ? selectedWork.getBoundingClientRect().top + window.scrollY
      : aboutDocumentTop + window.innerHeight * 2;
    const nextSectionDocumentTop = nextSection
      ? nextSection.getBoundingClientRect().top + window.scrollY
      : selectedWorkDocumentTop;
    let aboutRaf = 0;
    const aboutStatement = aboutPanel.querySelector('.about-panel__statement');
    const aboutVideoAnchor = aboutPanel.querySelector('[data-video-anchor]');
    const mediaReveal = aboutPanel.querySelector('[data-media-reveal]');
    const mediaVideo = mediaReveal?.querySelector('video');
    let aboutFinishTarget = null;
    let aboutFinishRaf = 0;

    const getAboutTransitionBounds = () => {
      const expansionStart = aboutDocumentTop + window.innerHeight * 0.14;
      const nextEnterScroll = nextSectionDocumentTop - window.innerHeight;
      const aboutStageDocumentTop = aboutStage
        ? aboutStage.getBoundingClientRect().top + window.scrollY
        : aboutDocumentTop;
      const aboutStageRelease = aboutStage
        ? aboutStageDocumentTop + aboutStage.offsetHeight - window.innerHeight
        : nextEnterScroll;
      const expansionEnd = Math.max(
        expansionStart + window.innerHeight * 0.45,
        Math.min(nextEnterScroll, aboutStageRelease),
      );

      return { expansionStart, expansionEnd };
    };

    const trackAboutFinish = () => {
      aboutFinishRaf = 0;
      if (aboutFinishTarget === null) return;
      if (Math.abs(window.scrollY - aboutFinishTarget) <= 2) {
        window.scrollTo({ top: aboutFinishTarget, behavior: 'auto' });
        aboutFinishTarget = null;
        return;
      }
      aboutFinishRaf = requestAnimationFrame(trackAboutFinish);
    };

    const guardAboutTransitionHandoff = (event) => {
      if (reduceMotion.matches || event.deltaY <= 0) return;
      if (aboutFinishTarget !== null) {
        event.preventDefault();
        return;
      }

      const { expansionStart, expansionEnd } = getAboutTransitionBounds();
      const scrollY = window.scrollY;
      const projectedScrollY = scrollY + event.deltaY;
      if (scrollY < expansionStart || scrollY >= expansionEnd || projectedScrollY <= expansionEnd) return;

      // Finish the video expansion at its exact endpoint before native flow
      // can carry the page into the next section.
      event.preventDefault();
      aboutFinishTarget = expansionEnd;
      window.scrollTo({ top: expansionEnd, behavior: 'smooth' });
      if (!aboutFinishRaf) aboutFinishRaf = requestAnimationFrame(trackAboutFinish);
    };

    const updateAboutPanel = () => {
      aboutRaf = 0;
      if (reduceMotion.matches) {
        aboutPanel.style.transform = 'none';
        hero.style.transform = 'none';
        hero.style.setProperty('--hero-dim', '0');
        hero.querySelector('.hero__content')?.style.setProperty('transform', 'none');
        aboutPanel.classList.add('is-revealed');
        if (mediaReveal) {
          mediaReveal.style.width = '100vw';
          mediaReveal.style.height = '100svh';
          mediaReveal.style.borderRadius = '0px';
          mediaReveal.style.opacity = '1';
        }
        return;
      }

      const rect = aboutPanel.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / window.innerHeight));
      const panelDocumentTop = aboutDocumentTop;
      const { expansionStart, expansionEnd } = getAboutTransitionBounds();
      const workEnterScroll = selectedWorkDocumentTop - window.innerHeight;
      const videoTransitionComplete = window.scrollY >= expansionEnd;
      const workIsActive = selectedWork && window.scrollY >= workEnterScroll && videoTransitionComplete;
      const workProgress = selectedWork
        ? Math.max(0, Math.min(1, (window.scrollY - workEnterScroll) / Math.max(1, window.innerHeight * 0.32)))
        : 0;
      const workRect = selectedWork?.getBoundingClientRect();
      const guildScrollProgress = workRect
        ? Math.max(0, Math.min(1, (window.innerHeight - workRect.top) / Math.max(1, window.innerHeight + workRect.height)))
        : 0;
      selectedWork?.classList.toggle('is-video-complete', videoTransitionComplete);
      sectionFlow.sync();
      const workRevealOpacity = workIsActive ? 1 : 0;
      const workInnerOpacity = workIsActive ? 1 : 0;
      const workCardOpacity = workIsActive ? 1 : 0;
      const workTint = Math.max(0, Math.min(1, (workProgress - 0.88) / 0.12));
      selectedWork?.style.setProperty('--work-progress', workProgress.toFixed(4));
      selectedWork?.style.setProperty('--guild-scroll-scale', (0.82 + guildScrollProgress * 0.3).toFixed(4));
      // Keep the entire third layer hidden until the video handoff is done,
      // then reach readable opacity quickly instead of double-fading it.
      selectedWork?.style.setProperty('--work-panel-opacity', workRevealOpacity.toFixed(4));
      selectedWork?.style.setProperty('--work-tint', workTint.toFixed(4));
      selectedWork?.style.setProperty('--work-tint-opacity', (workTint * 0.08).toFixed(4));
      selectedWork?.style.setProperty('--work-inner-opacity', workInnerOpacity.toFixed(4));
      selectedWork?.style.setProperty('--work-inner-y', `${((1 - workProgress) * 2).toFixed(3)}rem`);
      selectedWork?.style.setProperty('--work-inner-scale', (0.965 + workProgress * 0.035).toFixed(4));
      selectedWork?.style.setProperty('--work-title-y', `${((1 - workProgress) * 1.2).toFixed(3)}rem`);
      selectedWork?.style.setProperty('--work-card-opacity', workCardOpacity.toFixed(4));
      selectedWork?.style.setProperty('--work-card-y', `${((1 - workProgress) * 1.4).toFixed(3)}rem`);
      selectedWork?.style.setProperty('--work-card-scale', (0.94 + workProgress * 0.06).toFixed(4));
      aboutPanel.style.setProperty('--orvel-progress', progress.toFixed(4));
      // Keep the transition edge flush: no expanding radius or scaled hero
      // should reveal the page background as a white border.
      aboutPanel.style.transform = 'none';
      aboutPanel.style.borderTopLeftRadius = '0px';
      aboutPanel.style.borderTopRightRadius = '0px';
      hero.style.transform = 'none';
      hero.style.setProperty('--hero-dim', `${progress * 0.35}`);
      hero.querySelector('.hero__content')?.style.setProperty('transform', `translateY(${-progress * 24}px)`);

      if (mediaReveal) {
        // The panel opens first, then the video expands to fullscreen while
        // native scrolling remains responsive for the next section handoff.
        const mediaProgress = Math.max(0, Math.min(1, (window.scrollY - expansionStart) / Math.max(1, expansionEnd - expansionStart))) ** 0.92;
        const transitionProgress = mediaProgress;
        const width = 160 + transitionProgress * (window.innerWidth - 160);
        const height = 96 + transitionProgress * (window.innerHeight - 96);
        const anchorRect = (() => {
          if (!aboutVideoAnchor) return aboutStatement?.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(aboutVideoAnchor);
          const lineRects = [...range.getClientRects()];
          return lineRects.sort((a, b) => b.top - a.top || b.left - a.left)[0]
            ?? aboutVideoAnchor.getBoundingClientRect();
        })();
        const panelRect = aboutPanel.getBoundingClientRect();
        const cardGap = Math.max(12, Math.min(28, window.innerHeight * 0.02));
        const initialCardCenterY = anchorRect
          ? anchorRect.top - panelRect.top + anchorRect.height * 0.5
          : window.innerHeight * 0.72;
        const initialCardCenterX = anchorRect
          ? Math.min(
              window.innerWidth - 104,
              Math.max(104, anchorRect.right - panelRect.left + cardGap + 80),
            )
          : window.innerWidth * 0.5;
        const cardCenterX = initialCardCenterX + (window.innerWidth * 0.5 - initialCardCenterX) * transitionProgress;
        const cardCenterY = initialCardCenterY + (window.innerHeight * 0.5 - initialCardCenterY) * transitionProgress;
        mediaReveal.style.left = `${cardCenterX}px`;
        mediaReveal.style.top = `${cardCenterY}px`;
        mediaReveal.style.width = `${width}px`;
        mediaReveal.style.height = `${height}px`;
        mediaReveal.style.borderRadius = `${Math.max(0, 12 - transitionProgress * 12)}px`;
        mediaReveal.style.transform = `translate(-50%, -50%) scale(${0.72 + transitionProgress * 0.28})`;
        mediaReveal.style.setProperty('--orvel-progress', transitionProgress.toFixed(4));
        // The small card is visible after the statement and becomes the
        // fullscreen video as the user scrolls; it never appears as a blank
        // hidden placeholder before the expansion begins.
        mediaReveal.style.opacity = '1';
        mediaReveal.style.visibility = 'visible';
        if (transitionProgress > 0.08) mediaVideo?.play().catch(() => {});
        else mediaVideo?.pause();
      }

      // Start the about reveal as soon as the panel enters view so the first
      // scroll gesture produces visible motion instead of a blank hold.
      if (progress > 0.08) aboutPanel.classList.add('is-revealed');
    };

    const requestAboutUpdate = () => {
      if (!aboutRaf) aboutRaf = requestAnimationFrame(updateAboutPanel);
    };

    window.addEventListener('scroll', requestAboutUpdate, { passive: true });
    window.addEventListener('resize', requestAboutUpdate, { passive: true });
    window.addEventListener('wheel', guardAboutTransitionHandoff, { passive: false });
    reduceMotion.addEventListener?.('change', requestAboutUpdate);

    const syncAboutAnchor = () => {
      if (window.location.hash === '#about') {
        aboutPanel.style.transform = 'none';
        aboutPanel.style.borderTopLeftRadius = '0px';
        aboutPanel.style.borderTopRightRadius = '0px';
        aboutPanel.classList.add('is-revealed');
        requestAboutUpdate();
      } else {
        requestAboutUpdate();
      }
    };

    window.addEventListener('hashchange', syncAboutAnchor);
    syncAboutAnchor();
  }

  if (selectedWork) {
    const workVideo = selectedWork.querySelector('video');
    selectedWork.classList.add('is-visible');
    const workObserver = 'IntersectionObserver' in window && workVideo
      ? new IntersectionObserver(([entry]) => entry.isIntersecting ? workVideo.play().catch(() => {}) : workVideo.pause(), { threshold: 0.2 })
      : null;
    workObserver?.observe(workVideo);
  }

  // Pin the process story and resolve one step per scroll interval, matching
  // the editorial progression of the reference section without introducing a
  // dependency or changing the page's native scroll behavior.
  const processSection = document.querySelector('[data-process-section]');
  const processSteps = processSection ? [...processSection.querySelectorAll('[data-process-step]')] : [];
  if (processSection && processSteps.length) {
    const reduceProcessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let processRaf = 0;

    const updateProcess = () => {
      processRaf = 0;
      const sectionTop = processSection.getBoundingClientRect().top + window.scrollY;
      const travel = Math.max(1, processSection.offsetHeight - window.innerHeight);
      const progress = reduceProcessMotion.matches
        ? 0
        : Math.max(0, Math.min(1, (window.scrollY - sectionTop) / travel));
      const activeIndex = Math.min(processSteps.length - 1, Math.floor(progress * processSteps.length));

      processSteps.forEach((step, index) => {
        step.classList.toggle('is-active', index === activeIndex);
      });
      processSection.style.setProperty('--process-progress', progress.toFixed(4));
    };

    const requestProcessUpdate = () => {
      if (!processRaf) processRaf = requestAnimationFrame(updateProcess);
    };

    window.addEventListener('scroll', requestProcessUpdate, { passive: true });
    window.addEventListener('resize', requestProcessUpdate, { passive: true });
    reduceProcessMotion.addEventListener?.('change', requestProcessUpdate);
    requestProcessUpdate();

    // Keep one row's preview card attached to the pointer. The card is fixed
    // to the viewport so it can travel through the whole row instead of being
    // constrained by the article's layout box.
    const processPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let processPreviewRaf = 0;
    let processPreviewTarget = null;
    const processPreviewSegments = processSteps.map((step) => {
      const video = step.querySelector('.process-step__preview video');
      const start = Number(video?.dataset.previewStart ?? 0);
      const end = Number(video?.dataset.previewEnd ?? start + 10);
      return { step, video, start, end };
    });

    processPreviewSegments.forEach(({ video, start, end }) => {
      if (!video) return;
      video.addEventListener('timeupdate', () => {
        if (!video.paused && video.currentTime >= end - 0.04) {
          video.currentTime = start;
        }
      });
      video.addEventListener('ended', () => {
        if (!step.classList.contains('is-pointer-preview')) return;
        video.currentTime = start;
        video.play().catch(() => {});
      });
    });

    const startProcessPreview = (step) => {
      const segment = processPreviewSegments.find((candidate) => candidate.step === step);
      if (!segment?.video) return;
      const { video, start, end } = segment;
      const playSegment = () => {
        if (!step.classList.contains('is-pointer-preview')) return;
        if (video.currentTime < start || video.currentTime >= end - 0.04) {
          video.currentTime = start;
        }
        video.play().catch(() => {});
      };

      if (video.readyState >= 1) {
        playSegment();
      } else {
        video.addEventListener('loadedmetadata', playSegment, { once: true });
      }
    };

    const stopProcessPreview = (step) => {
      const segment = processPreviewSegments.find((candidate) => candidate.step === step);
      if (!segment?.video) return;
      segment.video.pause();
      if (segment.video.readyState >= 1) segment.video.currentTime = segment.start;
    };

    const clampProcessPreview = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

    const positionProcessPreview = (step, clientX, clientY) => {
      const preview = step.querySelector('.process-step__preview');
      if (!preview) return;
      const previewBounds = preview.getBoundingClientRect();
      const gap = Math.max(28, Math.min(48, window.innerWidth * 0.032));
      const x = clampProcessPreview(clientX + gap, 12, window.innerWidth - previewBounds.width - 12);
      const y = clampProcessPreview(clientY - previewBounds.height * 0.58, 12, window.innerHeight - previewBounds.height - 12);
      const rotation = ((clientX / Math.max(1, window.innerWidth)) - 0.5) * 4;
      step.style.setProperty('--preview-x', `${x.toFixed(2)}px`);
      step.style.setProperty('--preview-y', `${y.toFixed(2)}px`);
      step.style.setProperty('--preview-rotation', `${rotation.toFixed(2)}deg`);
    };

    const requestProcessPreviewPosition = (step, event) => {
      processPreviewTarget = { step, clientX: event.clientX, clientY: event.clientY };
      if (processPreviewRaf) return;
      processPreviewRaf = requestAnimationFrame(() => {
        processPreviewRaf = 0;
        if (processPreviewTarget) {
          const { step: targetStep, clientX, clientY } = processPreviewTarget;
          positionProcessPreview(targetStep, clientX, clientY);
        }
      });
    };

    const hideProcessPreviews = (except = null) => {
      processSteps.forEach((step) => {
        if (step !== except) {
          step.classList.remove('is-pointer-preview');
          stopProcessPreview(step);
        }
      });
    };

    processSteps.forEach((step) => {
      step.addEventListener('pointerenter', (event) => {
        if (!processPointer.matches || event.pointerType === 'touch') return;
        hideProcessPreviews(step);
        positionProcessPreview(step, event.clientX, event.clientY);
        step.classList.add('is-pointer-preview');
        startProcessPreview(step);
      }, { passive: true });
      step.addEventListener('pointermove', (event) => {
        if (!processPointer.matches || event.pointerType === 'touch') return;
        requestProcessPreviewPosition(step, event);
      }, { passive: true });
      step.addEventListener('pointerleave', () => {
        step.classList.remove('is-pointer-preview');
        stopProcessPreview(step);
      });

      step.addEventListener('focusin', () => {
        const bounds = step.getBoundingClientRect();
        hideProcessPreviews(step);
        positionProcessPreview(step, bounds.left + bounds.width * 0.72, bounds.top + bounds.height * 0.42);
        step.classList.add('is-pointer-preview');
        startProcessPreview(step);
      });
      step.addEventListener('focusout', (event) => {
        if (!step.contains(event.relatedTarget)) {
          step.classList.remove('is-pointer-preview');
          stopProcessPreview(step);
        }
      });
    });

    processPointer.addEventListener?.('change', () => {
      if (!processPointer.matches) hideProcessPreviews();
    });
  }

  const eventAgenda = document.querySelector('[data-event-agenda]');
  const eventCardsViewport = eventAgenda?.querySelector('.event-agenda__cards');
  const eventTrack = eventCardsViewport?.querySelector('.event-agenda__cards-track');
  const eventCards = eventAgenda ? [...eventAgenda.querySelectorAll('[data-event-card]')] : [];
  const eventCard = eventAgenda?.querySelector('[data-event-card]');
  const eventPrevious = eventAgenda?.querySelector('[data-event-prev]');
  const eventNext = eventAgenda?.querySelector('[data-event-next]');
  let eventOffset = 0;
  let eventAutoFrame = 0;
  let eventAutoLastTime = 0;
  let eventAutoPaused = false;

  const setEventAutoPaused = (paused) => {
    eventAutoPaused = paused;
    eventAutoLastTime = 0;
    eventAgenda?.classList.toggle('is-card-hovered', paused);
  };

  eventCards.forEach((card) => {
    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      setEventAutoPaused(true);
    });
    card.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch') return;
      setEventAutoPaused(false);
    });
  });

  const scrollEventCards = (direction) => {
    if (!eventCardsViewport || !eventCard || !eventTrack) return;
    if (direction > 0) {
      eventTrack.append(eventTrack.firstElementChild);
    } else {
      eventTrack.prepend(eventTrack.lastElementChild);
    }
    eventOffset = 0;
    eventTrack.style.transform = 'translate3d(0, 0, 0)';
  };

  eventPrevious?.addEventListener('click', () => scrollEventCards(-1));
  eventNext?.addEventListener('click', () => scrollEventCards(1));

  const eventAutoAnimate = (time) => {
    if (!eventTrack || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (eventAutoPaused) {
      eventAutoLastTime = time;
      eventAutoFrame = requestAnimationFrame(eventAutoAnimate);
      return;
    }
    if (!eventAutoLastTime) eventAutoLastTime = time;
    const delta = Math.min(48, time - eventAutoLastTime);
    eventAutoLastTime = time;
    const firstCard = eventTrack.firstElementChild;
    const gap = parseFloat(getComputedStyle(eventTrack).gap) || 0;
    const step = (firstCard?.getBoundingClientRect().width || 0) + gap;
    eventOffset += delta * 0.06;

    if (step > 0 && eventOffset >= step && firstCard) {
      eventOffset -= step;
      eventTrack.append(firstCard);
    }

    eventTrack.style.transform = `translate3d(${-eventOffset}px, 0, 0)`;
    eventAutoFrame = requestAnimationFrame(eventAutoAnimate);
  };

  if (eventTrack && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    eventAutoFrame = requestAnimationFrame(eventAutoAnimate);
  }

  // Keep the reference-style media preview isolated to the index section.
  // It intentionally does not participate in the section scroll animation above.
  const selectedWorkIndex = document.querySelector('.selected-work--index');
  const indexPreview = selectedWorkIndex?.querySelector('[data-index-preview]');
  const indexPreviewVideo = selectedWorkIndex?.querySelector('[data-index-preview-video]');
  const indexPreviewLabel = selectedWorkIndex?.querySelector('[data-index-preview-label]');
  const indexPreviewInner = selectedWorkIndex?.querySelector('.selected-work__inner');
  const indexRows = selectedWorkIndex ? [...selectedWorkIndex.querySelectorAll('[data-index-row]')] : [];
  const indexCards = selectedWorkIndex ? [...selectedWorkIndex.querySelectorAll('[data-index-card]')] : [];
  let indexCenterIndex = 0;

  if (selectedWorkIndex && indexCards.length) {
    const reduceIndexMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const lerp = (start, end, amount) => start + (end - start) * amount;
    let indexCardTravelTarget = 0;
    let indexCardTravelProgress = 0;
    let indexCardTravelRaf = 0;
    let indexCardFlowRaf = 0;
    let indexScrollGuardRaf = 0;

    const getIndexScrollBounds = () => {
      const sectionTop = selectedWorkIndex.getBoundingClientRect().top + window.scrollY;
      const workBottom = sectionTop + Math.max(0, selectedWorkIndex.offsetHeight - window.innerHeight);
      return { sectionTop, workBottom };
    };

    const keepIndexScrollInsideSection = () => {
      indexScrollGuardRaf = 0;
      const { sectionTop, workBottom } = getIndexScrollBounds();
      const rawProgress = (window.scrollY - sectionTop) / Math.max(1, workBottom - sectionTop);
      const animationIncomplete = indexCardTravelTarget < 0.999 || indexCardTravelProgress < 0.999;

      if (rawProgress > 1 && animationIncomplete) {
        window.scrollTo({ top: workBottom, behavior: 'auto' });
      }
    };

    const requestIndexScrollGuard = () => {
      if (!indexScrollGuardRaf) indexScrollGuardRaf = requestAnimationFrame(keepIndexScrollInsideSection);
    };

    const guardIndexWheelExit = (event) => {
      if (event.deltaY <= 0) return;
      const { sectionTop, workBottom } = getIndexScrollBounds();
      const currentScroll = window.scrollY;
      const nextScroll = currentScroll + event.deltaY;
      const animationIncomplete = indexCardTravelTarget < 0.999 || indexCardTravelProgress < 0.999;
      const insideWork = currentScroll >= sectionTop && currentScroll <= workBottom;

      if (!insideWork || !animationIncomplete) return;

      if (currentScroll >= workBottom - 1 || nextScroll > workBottom) {
        event.preventDefault();
        window.scrollTo({ top: workBottom, behavior: 'auto' });
      }
    };

    const renderIndexCardTravel = (time = performance.now()) => {
      if (!indexPreviewInner) return;
      const innerRect = indexPreviewInner.getBoundingClientRect();
      const reduced = reduceIndexMotion.matches;
      const progress = reduced
        ? 0.5
        : indexCardTravelProgress;
      const flowTime = time * 0.001;
      const centerIndex = Math.round(progress * Math.max(indexCards.length - 1, 0));

      if (centerIndex !== indexCenterIndex) {
        indexCenterIndex = centerIndex;
        indexPreview?.classList.remove('is-visible');
        indexPreview?.setAttribute('aria-hidden', 'true');
        indexPreviewVideo?.pause();
      }

      indexCards.forEach((card, index) => {
        const cardOffset = index - progress;
        const distance = Math.abs(cardOffset);
        const centerBlend = clamp(1 - distance);
        const stackDistance = Math.min(4, Math.max(0, distance - 0.4));
        const cardRect = card.getBoundingClientRect();
        const flowLift = Math.sin(flowTime * 0.72 + index * 0.58) * Math.min(8, innerRect.height * 0.008);
        const flowOffset = reduced ? 0 : -flowLift;
        const sideDirection = cardOffset < 0 ? -1 : 1;
        const centerX = (innerRect.width - cardRect.width) / 2;
        const centerY = (innerRect.height - cardRect.height) / 2;
        const sideX = sideDirection < 0
          ? innerRect.width * 0.72 - stackDistance * cardRect.width * 0.16
          : innerRect.width * 0.08 + stackDistance * cardRect.width * 0.16;
        const sideY = sideDirection < 0
          ? innerRect.height * 0.08 + stackDistance * cardRect.height * 0.18
          : innerRect.height * 0.68 - stackDistance * cardRect.height * 0.18;
        const sideRotation = sideDirection < 0
          ? 5 + stackDistance * 1.4
          : -5 - stackDistance * 1.4;
        const rotation = lerp(sideRotation, 0, centerBlend);
        const scale = lerp(0.86, 1.04, centerBlend);
        const cardWidth = card.offsetWidth || cardRect.width;
        const cardHeight = card.offsetHeight || cardRect.height;
        const angle = Math.abs(rotation) * Math.PI / 180;
        const rotatedWidth = (Math.abs(Math.cos(angle)) * cardWidth + Math.abs(Math.sin(angle)) * cardHeight) * scale;
        const rotatedHeight = (Math.abs(Math.sin(angle)) * cardWidth + Math.abs(Math.cos(angle)) * cardHeight) * scale;
        const horizontalSafety = Math.max(0, (rotatedWidth - cardWidth * scale) / 2);
        const verticalSafety = Math.max(0, (rotatedHeight - cardHeight * scale) / 2);
        const edgeInset = Math.min(innerRect.width, innerRect.height) * 0.04;
        const minX = edgeInset + horizontalSafety;
        const maxX = Math.max(minX, innerRect.width - cardWidth * scale - edgeInset - horizontalSafety);
        const minY = edgeInset + verticalSafety;
        const maxY = Math.max(minY, innerRect.height - cardHeight * scale - edgeInset - verticalSafety);
        const x = clamp(lerp(sideX, centerX, centerBlend), minX, maxX);
        const y = clamp(
          lerp(sideY, centerY, centerBlend),
          minY - flowOffset,
          maxY - flowOffset,
        );
        const opacity = lerp(0.58, 1, centerBlend);
        const isCenter = index === centerIndex;

        card.style.setProperty('--index-card-x', `${x.toFixed(2)}px`);
        card.style.setProperty('--index-card-y', `${y.toFixed(2)}px`);
        card.style.setProperty('--index-card-flow-y', `${flowOffset.toFixed(2)}px`);
        card.style.setProperty('--index-card-rotate', `${rotation.toFixed(2)}deg`);
        card.style.setProperty('--index-card-scale', scale.toFixed(3));
        card.style.setProperty('--index-card-opacity', opacity.toFixed(3));
        card.style.setProperty('--index-card-z', String(isCenter ? 30 : Math.max(1, 20 - Math.round(distance))));
        card.classList.toggle('is-center', isCenter);
      });
    };

    const animateIndexCardTravel = () => {
      indexCardTravelRaf = 0;
      if (reduceIndexMotion.matches) {
        indexCardTravelProgress = 0.5;
        renderIndexCardTravel();
        return;
      }

      indexCardTravelProgress += (indexCardTravelTarget - indexCardTravelProgress) * 0.12;
      renderIndexCardTravel();
      if (Math.abs(indexCardTravelTarget - indexCardTravelProgress) > 0.001) {
        indexCardTravelRaf = requestAnimationFrame(animateIndexCardTravel);
      }
    };

    const animateIndexCardFlow = (time) => {
      indexCardFlowRaf = 0;
      if (reduceIndexMotion.matches) return;

      const sectionRect = selectedWorkIndex.getBoundingClientRect();
      if (sectionRect.bottom <= 0 || sectionRect.top >= window.innerHeight) return;

      renderIndexCardTravel(time);
      indexCardFlowRaf = requestAnimationFrame(animateIndexCardFlow);
    };

    const requestIndexCardTravel = () => {
      const { sectionTop, workBottom } = getIndexScrollBounds();
      const sectionRange = Math.max(1, workBottom - sectionTop);
      const rawProgress = (window.scrollY - sectionTop) / sectionRange;
      indexCardTravelTarget = clamp(rawProgress);
      if (reduceIndexMotion.matches) indexCardTravelProgress = 0.5;
      if (!indexCardTravelRaf) indexCardTravelRaf = requestAnimationFrame(animateIndexCardTravel);
      if (!reduceIndexMotion.matches && !indexCardFlowRaf) {
        indexCardFlowRaf = requestAnimationFrame(animateIndexCardFlow);
      }
    };

    window.addEventListener('scroll', requestIndexCardTravel, { passive: true });
    window.addEventListener('resize', requestIndexCardTravel, { passive: true });
    reduceIndexMotion.addEventListener?.('change', requestIndexCardTravel);
    requestIndexCardTravel();
  }

  if (selectedWorkIndex && indexPreview && indexPreviewVideo && indexRows.length) {
    let activeRow = null;

    const hideIndexPreview = (row = activeRow) => {
      if (row && activeRow && row !== activeRow) return;
      if (row && (row.matches(':hover') || row.matches(':focus'))) return;
      row?.classList.remove('is-active');
      activeRow = null;
      indexPreview.classList.remove('is-visible');
      indexPreview.setAttribute('aria-hidden', 'true');
      indexPreviewVideo.pause();
    };

    const showIndexPreview = (row) => {
      const source = row.dataset.previewVideo;
      if (!source || row !== indexCards[indexCenterIndex]) {
        hideIndexPreview();
        return;
      }

      indexRows.forEach((candidate) => candidate.classList.toggle('is-active', candidate === row));
      activeRow = row;
      if (indexPreviewLabel) indexPreviewLabel.textContent = row.querySelector('strong')?.textContent ?? 'Eventoria preview';
      if (indexPreviewVideo.dataset.previewSource !== source) {
        indexPreviewVideo.dataset.previewSource = source;
        indexPreviewVideo.src = source;
        indexPreviewVideo.load();
      }

      indexPreview.classList.add('is-visible');
      indexPreview.setAttribute('aria-hidden', 'false');
      indexPreviewVideo.play().catch(() => {});
    };

    const moveIndexPreview = (event) => {
      if (!indexPreviewInner || activeRow !== indexCards[indexCenterIndex]) {
        hideIndexPreview();
        return;
      }
      const innerRect = indexPreviewInner.getBoundingClientRect();
      const previewWidth = indexPreview.offsetWidth;
      const previewHeight = indexPreview.offsetHeight;
      const gap = 24;
      const maxX = Math.max(gap, innerRect.width - previewWidth - gap);
      const maxY = Math.max(gap, innerRect.height - previewHeight - gap);
      const x = Math.min(Math.max(event.clientX - innerRect.left + gap, gap), maxX);
      const y = Math.min(Math.max(event.clientY - innerRect.top + gap, gap), maxY);
      indexPreview.style.setProperty('--index-preview-x', `${x}px`);
      indexPreview.style.setProperty('--index-preview-y', `${y}px`);
    };

    indexRows.forEach((row) => {
      row.addEventListener('pointerenter', () => showIndexPreview(row));
      row.addEventListener('pointermove', moveIndexPreview);
      row.addEventListener('pointerleave', () => hideIndexPreview(row));
      row.addEventListener('focusin', () => showIndexPreview(row));
      row.addEventListener('focusout', () => requestAnimationFrame(() => hideIndexPreview(row)));
    });
  }

  const clientRotators = [...document.querySelectorAll('[data-client-rotator]')];
  if (clientRotators.length) {
    const reduceClientMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const shuffleClientSlides = (slides, previous = null) => {
      const shuffled = [...slides];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
      }
      if (previous && shuffled.length > 1 && shuffled[0] === previous) {
        [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
      }
      return shuffled;
    };

    clientRotators.forEach((rotator) => {
      const slides = [...rotator.querySelectorAll('[data-client-slide]')];
      if (slides.length < 2) return;

      const interval = Math.max(2000, Number(rotator.dataset.clientInterval) || 2000);
      let order = shuffleClientSlides(slides);
      let currentIndex = 0;
      let timer = 0;

      const setActiveSlide = (slide) => {
        slides.forEach((candidate) => {
          const active = candidate === slide;
          candidate.classList.toggle('is-active', active);
          candidate.setAttribute('aria-hidden', String(!active));
        });
      };

      const showNextSlide = () => {
        const previous = order[currentIndex];
        order = currentIndex >= order.length - 1
          ? shuffleClientSlides(slides, previous)
          : order;
        currentIndex = currentIndex >= order.length - 1 ? 0 : currentIndex + 1;
        setActiveSlide(order[currentIndex]);
      };

      const start = () => {
        if (reduceClientMotion.matches || timer) return;
        timer = window.setInterval(showNextSlide, interval);
      };

      const stop = () => {
        if (!timer) return;
        window.clearInterval(timer);
        timer = 0;
      };

      setActiveSlide(order[currentIndex]);
      start();
      reduceClientMotion.addEventListener?.('change', () => {
        if (reduceClientMotion.matches) stop();
        else start();
      });
    });
  }

  // Always allow reverse scrolling to leave the clients area, even while the
  // preceding pinned transition is settling at its boundary.
  const clientsSection = document.querySelector('.clients-section');
  if (clientsSection) {
    window.addEventListener('wheel', (event) => {
      if (event.deltaY >= 0) return;
      const rect = clientsSection.getBoundingClientRect();
      if (rect.top >= window.innerHeight || rect.bottom <= 0) return;
      event.preventDefault();
      window.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' });
    }, { passive: false });
  }

  // Restart the nav typing effect on every hover/focus so it can be replayed.
  document.querySelectorAll('.desktop-nav a').forEach((link) => {
    const label = link.querySelector('span');
    if (!label) return;

    const replayTyping = () => {
      label.style.animation = 'none';
      void label.offsetWidth;
      label.style.animation = '';
    };

    link.addEventListener('pointerenter', replayTyping);
    link.addEventListener('focus', replayTyping);
  });

  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  const header = document.querySelector('[data-header]');

  if (!toggle || !menu || !header) return;

  const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let lastFocused = null;

  const setMenuState = (open) => {
    lastFocused = open ? document.activeElement : lastFocused;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.classList.toggle('menu-open', open);

    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      menu.querySelector('a')?.focus();
    } else {
      menu.classList.remove('is-open');
      menu.hidden = true;
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }
  };

  toggle.addEventListener('click', () => {
    setMenuState(toggle.getAttribute('aria-expanded') !== 'true');
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuState(false);
  });

  document.addEventListener('keydown', (event) => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    if (!open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuState(false);
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = [...menu.querySelectorAll(focusableSelector)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const selectedWorkDeck = document.querySelector('[data-selected-work-deck]');
  const deckCards = selectedWorkDeck ? [...selectedWorkDeck.querySelectorAll('[data-deck-card]')] : [];
  const deckWords = selectedWorkDeck ? [...selectedWorkDeck.querySelectorAll('[data-deck-word]')] : [];
  const deckGlowImages = selectedWorkDeck ? [...selectedWorkDeck.querySelectorAll('[data-deck-glow-image]')] : [];
  const deckCurrent = selectedWorkDeck?.querySelector('[data-deck-current]');

  if (selectedWorkDeck && deckCards.length) {
    const reduceDeckMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compactDeck = window.matchMedia('(max-width: 48rem)');
    const clampDeck = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const deckTones = [
      { background: '#fff', accent: '#010101' },
      { background: '#fff', accent: '#010101' },
      { background: '#fff', accent: '#010101' },
      { background: '#fff', accent: '#010101' },
    ];
    let deckTarget = 0;
    let deckProgress = 0;
    let deckRaf = 0;
    let deckActiveIndex = -1;

    const getDeckBounds = () => {
      const sectionTop = selectedWorkDeck.getBoundingClientRect().top + window.scrollY;
      const range = Math.max(1, selectedWorkDeck.offsetHeight - window.innerHeight);
      return { sectionTop, range };
    };

    const setDeckActive = (index) => {
      if (deckActiveIndex === index) return;
      deckActiveIndex = index;
      const tone = deckTones[index] || deckTones[0];
      selectedWorkDeck.style.setProperty('--deck-bg', tone.background);
      selectedWorkDeck.style.setProperty('--deck-accent', tone.accent);
      if (deckCurrent) deckCurrent.textContent = String(index + 1).padStart(2, '0');
      deckWords.forEach((word, wordIndex) => {
        const isCurrent = wordIndex === index;
        word.classList.toggle('is-on', isCurrent);
        word.classList.toggle('was', wordIndex < index);
      });
      deckGlowImages.forEach((image, imageIndex) => image.classList.toggle('is-on', imageIndex === index));
    };

    const renderDeck = () => {
      deckRaf = 0;
      if (compactDeck.matches) {
        deckCards.forEach((card) => {
          card.style.removeProperty('transform');
          card.style.removeProperty('opacity');
          card.style.removeProperty('z-index');
          card.style.removeProperty('pointer-events');
        });
        setDeckActive(0);
        return;
      }

      deckProgress += (deckTarget - deckProgress) * (reduceDeckMotion.matches ? 1 : 0.13);
      const cardProgress = reduceDeckMotion.matches ? 0 : deckProgress * Math.max(0, deckCards.length - 1);
      const activeIndex = Math.min(deckCards.length - 1, Math.max(0, Math.round(cardProgress)));
      setDeckActive(activeIndex);

      deckCards.forEach((card, index) => {
        const offset = index - cardProgress;
        const isAhead = offset > 0.02;
        const isBehind = offset < -0.02;
        let transform = 'translateY(0) rotateX(0deg) scale(1)';
        let opacity = 1;
        let zIndex = 20;

        if (isAhead) {
          // Future cards start face-down behind the current card and
          // rotate into view as the scroll reaches their position.
          const incomingProgress = clampDeck(offset, 0, 1);
          transform = `translate3d(0, 0, 0) rotateX(${90 * incomingProgress}deg)`;
          opacity = 1;
          zIndex = 20 - index;
        } else if (isBehind) {
          // The card being left turns upward from its top edge and remains
          // behind the incoming card, like a physical book leaf.
          const outgoingProgress = clampDeck(Math.abs(offset), 0, 1);
          transform = `translate3d(0, ${-2 * outgoingProgress}%, 0) rotateX(${-90 * outgoingProgress}deg)`;
          opacity = 1;
          zIndex = 10 - index;
        }

        // Keep the active card on top. At the section start this guarantees
        // the first card is visible; at the end it keeps the final card fixed
        // until native scrolling hands off to the next section.
        if (index === activeIndex) zIndex = 50;

        card.style.transform = transform;
        card.style.opacity = String(opacity);
        card.style.zIndex = String(zIndex);
        card.style.pointerEvents = Math.abs(offset) < 0.36 ? 'auto' : 'none';
        card.style.setProperty('--deck-shade', isAhead ? String(Math.min(0.18, Math.abs(offset) * 0.18)) : '0');
      });

      if (!reduceDeckMotion.matches && Math.abs(deckTarget - deckProgress) > 0.001) {
        deckRaf = requestAnimationFrame(renderDeck);
      }
    };

    const requestDeckUpdate = () => {
      const { sectionTop, range } = getDeckBounds();
      deckTarget = clampDeck((window.scrollY - sectionTop) / range);
      if (!deckRaf) deckRaf = requestAnimationFrame(renderDeck);
    };

    window.addEventListener('scroll', requestDeckUpdate, { passive: true });
    window.addEventListener('resize', requestDeckUpdate, { passive: true });
    reduceDeckMotion.addEventListener?.('change', requestDeckUpdate);
    compactDeck.addEventListener?.('change', requestDeckUpdate);
    requestDeckUpdate();
  }

  const updateHeader = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 16);
  };

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  const finalStory = document.querySelector('[data-final-story]');
  const finalTitle = finalStory?.querySelector('[data-final-title]');
  if (finalStory && finalTitle) {
    const updateFinalStory = () => {
      const bounds = finalStory.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight - bounds.top) / Math.max(1, bounds.height)));
      finalTitle.style.setProperty('--final-title-y', `${(progress - 0.5) * -42}px`);
    };
    window.addEventListener('scroll', updateFinalStory, { passive: true });
    window.addEventListener('resize', updateFinalStory, { passive: true });
    updateFinalStory();
  }

  const siteFooter = document.querySelector('[data-site-footer]');
  const footerWordmark = siteFooter?.querySelector('[data-footer-wordmark]');
  if (siteFooter && footerWordmark) {
    const updateFooterWordmark = () => {
      const bounds = siteFooter.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight - bounds.top) / Math.max(1, bounds.height)));
      footerWordmark.style.setProperty('--footer-wordmark-y', `${(1 - progress) * 18}%`);
      footerWordmark.style.setProperty('--footer-wordmark-x', `${(1 - progress) * -4}vw`);
    };
    window.addEventListener('scroll', updateFooterWordmark, { passive: true });
    window.addEventListener('resize', updateFooterWordmark, { passive: true });
    updateFooterWordmark();
  }

  const showcase = document.querySelector('[data-showcase-section]');
  if (showcase) {
    const images = ['./assets/selected-works-story.jpg','./assets/selected-works-design.jpg','./assets/selected-works-show.jpg','./assets/card-confetti.jpg'];
    const data = [['Every event starts with a story worth carrying into the room.','01','story-led experiences','Story','2026','#2140ff','#fff'],['We shape the visual language until every detail feels inevitable.','02','designed with intent','Design','2026','#e84d17','#fff'],['Sound, light, and movement turn the idea into a shared memory.','03','live moments delivered','Show','2025','#cc1320','#fff'],['From first cue to final guest, we carry the experience through.','04','production without compromise','Delivery','2025','#111111','#fff']];
    const words=[...showcase.querySelectorAll('.selected-work-showcase__word span')], labels=[...showcase.querySelectorAll('.selected-work-showcase__labels span')], items=[...showcase.querySelectorAll('[data-showcase-item]')], image=showcase.querySelector('[data-showcase-image]');
    const setState=(index)=>{const d=data[index];showcase.style.setProperty('--showcase-accent',d[5]);showcase.style.setProperty('--showcase-bg',d[6]);words.forEach((el,i)=>el.classList.toggle('is-on',i===index));labels.forEach((el,i)=>el.classList.toggle('is-on',i===index));items.forEach((el,i)=>el.classList.toggle('is-on',i===index));showcase.querySelector('[data-showcase-counter]').textContent=String(index+1).padStart(2,'0');showcase.querySelector('[data-showcase-kicker]').textContent=d[3];showcase.querySelector('[data-showcase-year]').textContent=d[4];if(image&&image.dataset.current!==images[index]){const media=image.closest('.selected-work-showcase__media');image.dataset.current=images[index];media?.classList.remove('is-turning');void media?.offsetWidth;media?.classList.add('is-turning');image.style.opacity='0';setTimeout(()=>{image.src=images[index];image.style.opacity='1'},180);setTimeout(()=>media?.classList.remove('is-turning'),900)}};
    items.forEach((item)=>item.addEventListener('click',()=>setState(Number(item.dataset.showcaseItem))));
    const update=()=>{const sectionTop=showcase.getBoundingClientRect().top+window.scrollY;const travel=Math.max(1,showcase.offsetHeight-innerHeight);const progress=Math.max(0,Math.min(1,(window.scrollY-sectionTop)/travel));setState(Math.min(data.length-1,Math.round(progress*(data.length-1))))};addEventListener('scroll',update,{passive:true});addEventListener('resize',update,{passive:true});update();
  }

  const axiomSection = document.querySelector('.axiom-cards');
  const axiomCards = axiomSection ? [...axiomSection.querySelectorAll('.axiom-card')] : [];
  const axiomTrack = axiomSection?.querySelector('.axiom-cards__track');
  if (axiomSection && axiomCards.length) {
    const reduceAxiomMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let axiomTarget = 0;
    let axiomProgress = 0;
    let axiomRaf = 0;
    let axiomLastTime = 0;

    const clampAxiom = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

    const renderAxiomCards = (progress) => {
      if (axiomTrack) {
        const horizontalTravel = Math.max(0, axiomTrack.scrollWidth - axiomSection.clientWidth);
        axiomTrack.style.transform = `translate3d(${-horizontalTravel * progress}px, 0, 0)`;
      }

      axiomCards.forEach((card, index) => {
        const step = clampAxiom(progress * axiomCards.length - index);
        const lift = Math.max(0, 1 - step) * 22;
        const rotate = (1 - step) * (index % 2 ? 4 : -4);
        const scale = 0.9 + step * 0.1;

        card.style.transform = `translate3d(${index * -2.5 * (1 - step)}vw, ${lift}vh, 0) rotateX(${(1 - step) * 82}deg) rotate(${rotate}deg) scale(${scale})`;
        card.style.opacity = String(Math.max(0.35, Math.min(1, step + 0.2)));
        card.style.zIndex = String(axiomCards.length - index);
      });
    };

    const updateAxiomCards = (time = performance.now()) => {
      axiomRaf = 0;
      const bounds = axiomSection.getBoundingClientRect();
      const travel = Math.max(1, axiomSection.offsetHeight - innerHeight);
      axiomTarget = clampAxiom(-bounds.top / travel);

      if (reduceAxiomMotion.matches) {
        axiomProgress = axiomTarget;
      } else {
        const delta = Math.min(0.05, Math.max(0.001, (time - axiomLastTime) / 1000 || 1 / 60));
        axiomLastTime = time;
        const easing = 1 - Math.exp(-12 * delta);
        axiomProgress += (axiomTarget - axiomProgress) * easing;
      }

      renderAxiomCards(axiomProgress);

      if (!reduceAxiomMotion.matches && Math.abs(axiomTarget - axiomProgress) > 0.0005) {
        axiomRaf = requestAnimationFrame(updateAxiomCards);
      }
    };

    const requestAxiomUpdate = () => {
      if (!axiomRaf) axiomRaf = requestAnimationFrame(updateAxiomCards);
    };

    addEventListener('scroll', requestAxiomUpdate, { passive: true });
    addEventListener('resize', requestAxiomUpdate, { passive: true });
    reduceAxiomMotion.addEventListener?.('change', requestAxiomUpdate);
    requestAxiomUpdate();
  }
})();
