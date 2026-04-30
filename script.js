(() => {
  const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  const JUNGSEONG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
  const JONGSEONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

  const CONSONANTS = new Set([...CHOSEONG, ...JONGSEONG.filter(Boolean)]);
  const VOWELS = new Set(JUNGSEONG);
  const COLOR_PALETTE = [
    { ink: [190, 38, 54], shadow: [92, 18, 26] },
    { ink: [28, 82, 181], shadow: [16, 45, 94] },
    { ink: [17, 133, 99], shadow: [9, 69, 52] },
    { ink: [170, 92, 12], shadow: [84, 46, 8] },
    { ink: [123, 50, 163], shadow: [62, 24, 82] },
    { ink: [24, 116, 137], shadow: [12, 58, 69] },
    { ink: [197, 64, 122], shadow: [95, 30, 59] },
    { ink: [101, 74, 36], shadow: [50, 36, 18] },
  ];

  const state = {
    raw: "",
    mode: "jamo",
    nodes: [],
    wordDisplay: null,
    familySeed: Math.floor(Math.random() * 100000),
    pointer: { x: 0, y: 0, active: false, lastCall: 0 },
    stageRect: null,
    running: false,
    isComposing: false,
  };

  const dom = {
    stage: document.getElementById("stage"),
    hint: document.getElementById("call-hint"),
    callInput: document.getElementById("call-input"),
    line: document.getElementById("live-line"),
    glyphLayer: document.getElementById("glyph-layer"),
  };

  function isHangulSyllable(char) {
    const code = char.charCodeAt(0);
    return code >= 0xac00 && code <= 0xd7a3;
  }

  function decomposeSyllable(char) {
    const code = char.charCodeAt(0) - 0xac00;
    const cho = Math.floor(code / 588);
    const jung = Math.floor((code % 588) / 28);
    const jong = code % 28;
    return [CHOSEONG[cho], JUNGSEONG[jung], ...(jong > 0 ? [JONGSEONG[jong]] : [])];
  }

  function splitToJamo(raw) {
    const source = raw || "";
    const out = [];
    let syllableIndex = 0;

    for (const char of source) {
      if (char === " ") {
        out.push({ text: "/", family: "other", syllableIndex: -1, partIndex: 0, isSpace: true });
        continue;
      }

      if (isHangulSyllable(char)) {
        const parts = decomposeSyllable(char);
        parts.forEach((part, partIndex) => {
          out.push({
            text: part,
            family: classifyJamo(part),
            syllableIndex,
            partIndex,
            isSpace: false,
          });
        });
        syllableIndex += 1;
      } else {
        out.push({
          text: char,
          family: classifyJamo(char),
          syllableIndex,
          partIndex: 0,
          isSpace: false,
        });
        syllableIndex += 1;
      }
    }

    return out;
  }

  function classifyJamo(char) {
    if (CONSONANTS.has(char)) return "consonant";
    if (VOWELS.has(char)) return "vowel";
    return "other";
  }

  function pseudoRandom(token, mode) {
    const code = token.text?.charCodeAt(0) ?? 0;
    const a = (token.syllableIndex + 3) * 92821;
    const b = (token.partIndex + 5) * 68917;
    const c = mode === "word" ? 137 : 61;
    const n = (code * 131 + a + b + c + state.familySeed) >>> 0;
    return (n % 1000) / 1000;
  }

  function mixedFamily(token, mode) {
    if (token.isSpace) return "tf-1";
    const r = pseudoRandom(token, mode);
    return `tf-${Math.floor(r * 9)}`;
  }

  function randomVisualProfile(mode) {
    const tf = `tf-${Math.floor(Math.random() * 9)}`;
    const tracking = mode === "word" ? -0.02 + Math.random() * 0.05 : -0.03 + Math.random() * 0.08;
    const lineHeight = mode === "word" ? 0.92 + Math.random() * 0.16 : 0.88 + Math.random() * 0.3;
    const scale = mode === "word" ? 0.88 + Math.random() * 0.42 : 0.84 + Math.random() * 0.34;
    const weight = mode === "word" ? 430 + Math.random() * 280 : 410 + Math.random() * 260;
    const palette = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    return { tf, tracking, lineHeight, scale, weight, ink: palette.ink, shadow: palette.shadow };
  }

  function makeGlyphTokens() {
    if (state.mode === "word") {
      const sentence = state.raw.trim();
      if (!sentence) return [];
      return splitToJamo(sentence).map((item) => ({
        ...item,
        mode: "word",
        renderFamily: mixedFamily(item, "word"),
      }));
    }

    const jamo = splitToJamo(state.raw);
    return jamo.map((item) => ({
      ...item,
      mode: "jamo",
      renderFamily: mixedFamily(item, "jamo"),
    }));
  }

  function partOffset(partIndex, partCount, mode) {
    if (partCount <= 1) return { x: 0, y: 0 };

    if (mode === "word") {
      if (partCount === 2) {
        if (partIndex === 0) return { x: -42, y: -30 };
        return { x: 44, y: -3 };
      }

      if (partIndex === 0) return { x: -44, y: -32 };
      if (partIndex === 1) return { x: 45, y: -4 };
      return { x: 0, y: 52 };
    }

    if (partCount === 2) {
      if (partIndex === 0) return { x: -20, y: -17 };
      return { x: 22, y: 0 };
    }

    if (partIndex === 0) return { x: -22, y: -18 };
    if (partIndex === 1) return { x: 22, y: 0 };
    return { x: 0, y: 28 };
  }

  function baseNode(token, rect, bornAt, cfg) {
    const spawnAtHome = cfg.spawnAtHome ?? false;
    const baseX = spawnAtHome ? cfg.homeX : rect.width * 0.5;
    const baseY = spawnAtHome ? cfg.homeY : rect.height * 0.5;
    const profile = cfg.visualProfile ?? randomVisualProfile(token.mode);
    return {
      token,
      x: baseX + (Math.random() - 0.5) * cfg.spawnSpread,
      y: baseY + (Math.random() - 0.5) * cfg.spawnSpread,
      homeX: cfg.homeX,
      homeY: cfg.homeY,
      vx: (Math.random() - 0.5) * cfg.velocity,
      vy: (Math.random() - 0.5) * cfg.velocity,
      driftX: (Math.random() - 0.5) * cfg.drift,
      driftY: (Math.random() - 0.5) * cfg.drift,
      clarity: cfg.clarity,
      pulse: 0,
      trace: 0,
      rot: (Math.random() - 0.5) * cfg.rot,
      bornAt,
      birthMs: cfg.birthMs,
      fadeDelay: cfg.fadeDelay ?? 0,
      fadeDuration: cfg.fadeDuration ?? 900,
      fade: 1,
      tracking: cfg.tracking ?? profile.tracking,
      lineHeight: cfg.lineHeight ?? profile.lineHeight,
      scale: cfg.scale ?? profile.scale,
      weight: cfg.weight ?? profile.weight,
      styleVariant: cfg.styleVariant ?? profile.tf,
      ink: cfg.ink ?? profile.ink,
      shadow: cfg.shadow ?? profile.shadow,
    };
  }

  function layoutNodes(tokens, prevNodes = []) {
    state.stageRect = dom.stage.getBoundingClientRect();
    const rect = state.stageRect;
    if (!tokens.length) return [];

    const bornAt = performance.now();

    if (state.mode === "jamo") {
      const seed = tokens.filter((t) => !t.isSpace);
      if (!seed.length) return [];

      const targetCount = Math.max(seed.length, Math.floor((rect.width * rect.height) / (94 * 88)));
      const expanded = [];
      for (let i = 0; i < targetCount; i += 1) {
        expanded.push(seed[i % seed.length]);
      }

      const topPadding = Math.max(130, rect.height * 0.23);
      const sidePadding = 34;
      const cols = Math.max(6, Math.floor((rect.width - sidePadding * 2) / 90));
      const rows = Math.max(1, Math.ceil(targetCount / cols));
      const stepX = cols <= 1 ? 0 : (rect.width - sidePadding * 2) / (cols - 1);
      const availableHeight = Math.max(120, rect.height - topPadding - 54);
      const stepY = rows <= 1 ? 0 : availableHeight / (rows - 1);

      return expanded.map((token, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
      const homeX = sidePadding + col * stepX + (Math.random() - 0.5) * 10;
      const homeY = topPadding + row * stepY + (Math.random() - 0.5) * 10;

        const prev = prevNodes[i];
        if (prev) {
          prev.token = token;
          prev.homeX = homeX;
          prev.homeY = homeY;
          prev.clarity = Math.max(0.33, prev.clarity);
          prev.birthMs = 320;
          if (Math.random() < 0.22) {
            const v = randomVisualProfile("jamo");
            prev.styleVariant = v.tf;
            prev.scale = v.scale;
            prev.weight = v.weight;
            prev.tracking = v.tracking;
            prev.lineHeight = v.lineHeight;
            prev.ink = v.ink;
            prev.shadow = v.shadow;
          }
          return prev;
        }

        return baseNode(token, rect, bornAt, {
          homeX,
          homeY,
          spawnSpread: 7,
          velocity: 0.45,
          drift: 2.2,
          clarity: 0.38,
          rot: 2.6,
          birthMs: 260,
          spawnAtHome: true,
          visualProfile: randomVisualProfile("jamo"),
        });
      });
    }

    const units = [];
    let group = [];
    let currentIndex = null;

    tokens.forEach((token) => {
      if (token.isSpace) {
        if (group.length) {
          units.push({ type: "syllable", tokens: group });
          group = [];
          currentIndex = null;
        }
        units.push({ type: "space" });
        return;
      }

      if (currentIndex === null || token.syllableIndex === currentIndex) {
        group.push(token);
        currentIndex = token.syllableIndex;
        return;
      }

      units.push({ type: "syllable", tokens: group });
      group = [token];
      currentIndex = token.syllableIndex;
    });

    if (group.length) {
      units.push({ type: "syllable", tokens: group });
    }

    const syllableAdvance = Math.max(172, rect.width / 10.6);
    const spaceAdvance = Math.max(102, rect.width / 14.6);
    const maxLineWidth = rect.width * 0.86;
    const lines = [];
    let line = [];
    let lineWidth = 0;

    units.forEach((unit) => {
      const width = unit.type === "space" ? spaceAdvance : syllableAdvance;
      const overflow = lineWidth + width > maxLineWidth;

      if (overflow && line.length && unit.type !== "space") {
        lines.push({ units: line, width: lineWidth });
        line = [];
        lineWidth = 0;
      }

      if (unit.type === "space" && !line.length) return;

      line.push(unit);
      lineWidth += width;
    });

    if (line.length) {
      lines.push({ units: line, width: lineWidth });
    }

    if (!lines.length) return [];

    const lineGap = Math.max(182, rect.height / 4.3);
    const totalHeight = (lines.length - 1) * lineGap;
    const startBaseline = rect.height * 0.5 - totalHeight * 0.5;
    const nodes = [];

    lines.forEach((lineItem, lineIndex) => {
      let cursorX = (rect.width - lineItem.width) * 0.5;
      const baselineY = startBaseline + lineIndex * lineGap;

      lineItem.units.forEach((unit) => {
        if (unit.type === "space") {
          cursorX += spaceAdvance;
          return;
        }

        const anchorX = cursorX + syllableAdvance * 0.5;
        const partCount = unit.tokens.length;

        unit.tokens.forEach((token) => {
          const offset = partOffset(token.partIndex, partCount, "word");
          nodes.push(
            baseNode(token, rect, bornAt, {
              homeX: anchorX + offset.x + (Math.random() - 0.5) * 2,
              homeY: baselineY + offset.y + (Math.random() - 0.5) * 2,
              spawnSpread: 6,
              velocity: 0.4,
              drift: 1.5,
              clarity: 0.68,
              rot: 1.4,
              birthMs: 260,
              spawnAtHome: true,
              fadeDelay: Math.random() * 3400,
              fadeDuration: 700 + Math.random() * 900,
              visualProfile: randomVisualProfile("word"),
            })
          );
        });

        cursorX += syllableAdvance;
      });
    });

    return nodes;
  }

  function syncLiveLine() {
    if (state.mode === "word") {
      dom.line.classList.add("word");
      dom.line.value = state.raw || " ";
      dom.line.style.opacity = "1";
      return;
    }

    dom.line.classList.remove("word");
    const parts = splitToJamo(state.raw);
    let preview = "";
    let currentSyllable = -1;

    parts.forEach((part) => {
      if (part.isSpace) {
        preview += "   ";
        currentSyllable = -1;
        return;
      }

      if (currentSyllable !== -1 && part.syllableIndex !== currentSyllable) {
        preview += " · ";
      }

      preview += part.text;
      currentSyllable = part.syllableIndex;
    });

    dom.line.value = preview || " ";
    dom.line.style.opacity = state.raw ? "1" : "0";
  }

  function paint() {
    dom.glyphLayer.innerHTML = "";

    state.nodes.forEach((node) => {
      const el = document.createElement("span");
      el.className = `glyph ${node.token.mode} ${node.styleVariant}`;
      el.textContent = node.token.text;
      if (node.token.isSpace) {
        el.style.opacity = "0";
      }
      node.el = el;
      applyNodeStyle(node);
      dom.glyphLayer.appendChild(el);
    });
  }

  function applyNodeStyle(node) {
    const isWord = node.token.mode === "word";
    const visualClarity = isWord ? Math.min(1, node.clarity) : Math.min(0.36, node.clarity);
    node.el.style.setProperty("--x", `${node.x.toFixed(2)}px`);
    node.el.style.setProperty("--y", `${node.y.toFixed(2)}px`);
    node.el.style.setProperty("--rot", `${node.rot.toFixed(2)}deg`);
    node.el.style.setProperty("--pulse", node.pulse.toFixed(3));
    node.el.style.setProperty("--clarity", visualClarity.toFixed(3));
    node.el.style.setProperty("--trace", node.trace.toFixed(3));
    node.el.style.setProperty("--trace-x", `${(node.trace * 1.2 + node.driftX * 0.04).toFixed(2)}px`);
    node.el.style.setProperty("--trace-y", `${(node.trace * 0.9 + node.driftY * 0.04).toFixed(2)}px`);
    node.el.style.setProperty("--ls", `${node.tracking.toFixed(3)}em`);
    node.el.style.setProperty("--lh", node.lineHeight.toFixed(3));
    node.el.style.setProperty("--sc", node.scale.toFixed(3));
    node.el.style.fontWeight = `${Math.round(node.weight)}`;
    const [r, g, b] = node.ink;
    node.el.style.setProperty("--ink-rgb", `${r} ${g} ${b}`);
    const [sr, sg, sb] = node.shadow;
    node.el.style.setProperty("--shadow-rgb", `${sr} ${sg} ${sb}`);
    const baseOpacity = isWord ? 0.34 + visualClarity * 0.66 : 0.22 + visualClarity * 0.52;
    const fade = node.fade ?? 1;
    node.el.style.opacity = `${Math.max(0, baseOpacity * fade).toFixed(3)}`;
  }

  function rebuild() {
    const tokens = makeGlyphTokens();
    state.nodes = layoutNodes(tokens, state.nodes);
    syncLiveLine();
    paint();

    if (!state.running) {
      state.running = true;
      tick();
    }
  }

  function animateNode(node, dt, now) {
    const t = Math.min(dt / 16.67, 2);
    const birthPower = Math.max(0, 1 - (now - node.bornAt) / node.birthMs);

    const toHomeX = node.homeX - node.x;
    const toHomeY = node.homeY - node.y;

    node.vx += toHomeX * 0.0022 * (1 + birthPower * 0.4) * t;
    node.vy += toHomeY * 0.0022 * (1 + birthPower * 0.4) * t;

    if (birthPower > 0) {
      node.pulse = Math.min(1, node.pulse + 0.012 * birthPower * t);
    }

    if (state.pointer.active) {
      const dx = state.pointer.x - node.x;
      const dy = state.pointer.y - node.y;
      const dist = Math.hypot(dx, dy);
      const radius = Math.min(state.stageRect.width, state.stageRect.height) * 0.16;

      if (dist < radius) {
        const power = 1 - dist / radius;
        const safe = Math.max(dist, 0.001);
        node.vx += (dx / safe) * 0.013 * power * t;
        node.vy += (dy / safe) * 0.013 * power * t;
        node.clarity = Math.min(1, node.clarity + 0.05 * power * t);
        node.trace = Math.min(1.1, node.trace + 0.03 * power * t);
      }
    }

    node.vx *= 0.86;
    node.vy *= 0.86;

    node.x += node.vx;
    node.y += node.vy;

    node.pulse = Math.max(0, node.pulse - 0.015 * t);
    node.clarity = Math.max(0.24, node.clarity - 0.007 * t);
    node.trace = Math.max(0.03, node.trace - 0.003 * t);

    if (state.mode === "word" && state.wordDisplay) {
      const fadeStart = state.wordDisplay.committedAt + node.fadeDelay;
      const fadeDuration = node.fadeDuration;
      const elapsed = now - fadeStart;

      if (elapsed <= 0) {
        node.clarity = 1;
        node.trace = Math.min(node.trace, 0.05);
        node.fade = 1;
      } else {
        const p = Math.min(1, elapsed / fadeDuration);
        node.fade = 1 - p;
      }
    } else {
      node.fade = 1;
    }

    const idle = now - state.pointer.lastCall;
    if (idle > 420) {
      const fade = Math.min(1, (idle - 420) / 2800);
      node.x += (Math.random() - 0.5) * 0.12 * fade * t;
      node.y += (Math.random() - 0.5) * 0.12 * fade * t;
    }

    node.driftX += (Math.random() - 0.5) * 0.06;
    node.driftY += (Math.random() - 0.5) * 0.06;
    node.driftX *= 0.992;
    node.driftY *= 0.992;

    applyNodeStyle(node);
  }

  let last = performance.now();
  function tick(now = performance.now()) {
    const dt = now - last;
    last = now;

    state.nodes.forEach((node) => animateNode(node, dt, now));

    if (state.mode === "word" && state.wordDisplay && now > state.wordDisplay.committedAt + state.wordDisplay.totalMaxMs) {
      state.wordDisplay = null;
      state.raw = "";
      dom.callInput.value = "";
      dom.hint.style.opacity = "1";
      state.mode = "jamo";
      rebuild();
    }

    if (state.mode === "word" && state.wordDisplay) {
      const elapsed = now - state.wordDisplay.committedAt;
      const fadeProgress = elapsed <= 0 ? 0 : Math.min(1, elapsed / state.wordDisplay.totalMaxMs);
      dom.line.style.opacity = `${(1 - fadeProgress).toFixed(3)}`;
    }

    requestAnimationFrame(tick);
  }

  function setRaw(value) {
    state.raw = value;
    state.wordDisplay = null;
    dom.hint.style.opacity = state.raw ? "0.24" : "1";
    if (state.mode === "word") {
      state.mode = "jamo";
    }
    rebuild();
  }

  function commitWords() {
    if (!state.raw.trim()) return;
    const now = performance.now();
    state.familySeed = Math.floor(Math.random() * 100000);
    state.wordDisplay = {
      committedAt: now,
      totalMaxMs: 5000,
    };
    state.mode = "word";
    rebuild();
  }

  function bind() {
    dom.callInput.value = state.raw;

    dom.callInput.addEventListener("compositionstart", () => {
      state.isComposing = true;
    });

    dom.callInput.addEventListener("compositionupdate", () => {
      setRaw(dom.callInput.value);
    });

    dom.callInput.addEventListener("compositionend", () => {
      state.isComposing = false;
      setRaw(dom.callInput.value);
    });

    dom.callInput.addEventListener("input", () => {
      setRaw(dom.callInput.value);
    });

    dom.callInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitWords();
      }
    });

    dom.stage.addEventListener("pointermove", (event) => {
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
      state.pointer.active = true;
      state.pointer.lastCall = performance.now();
    });

    dom.stage.addEventListener("pointerleave", () => {
      state.pointer.active = false;
    });

    dom.stage.addEventListener("pointerdown", () => {
      dom.callInput.focus({ preventScroll: true });
      state.pointer.lastCall = performance.now();
    });

    window.addEventListener("resize", rebuild);
  }

  bind();
  dom.callInput.value = "";
  dom.callInput.focus({ preventScroll: true });
  rebuild();
})();
