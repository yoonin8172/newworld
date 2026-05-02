(() => {
  const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  const JUNGSEONG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
  const JONGSEONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

  const CONSONANTS = new Set([...CHOSEONG, ...JONGSEONG.filter(Boolean)]);
  const VOWELS = new Set(JUNGSEONG);
  const BASIC_CONSONANTS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  const BASIC_CONSONANT_SET = new Set(BASIC_CONSONANTS);
  const DERIVED_CONSONANTS = {
    "ㄲ": ["ㄱ", "ㄱ"],
    "ㄸ": ["ㄷ", "ㄷ"],
    "ㅃ": ["ㅂ", "ㅂ"],
    "ㅆ": ["ㅅ", "ㅅ"],
    "ㅉ": ["ㅈ", "ㅈ"],
    "ㄳ": ["ㄱ", "ㅅ"],
    "ㄵ": ["ㄴ", "ㅈ"],
    "ㄶ": ["ㄴ", "ㅎ"],
    "ㄺ": ["ㄹ", "ㄱ"],
    "ㄻ": ["ㄹ", "ㅁ"],
    "ㄼ": ["ㄹ", "ㅂ"],
    "ㄽ": ["ㄹ", "ㅅ"],
    "ㄾ": ["ㄹ", "ㅌ"],
    "ㄿ": ["ㄹ", "ㅍ"],
    "ㅀ": ["ㄹ", "ㅎ"],
    "ㅄ": ["ㅂ", "ㅅ"],
  };
  const ROLE_VISUALS = {
    initial: {
      scale: 1.18,
      opacity: 0.98,
      saturation: 1.08,
      contrast: 1.04,
      brightness: 1,
      motion: 0.58,
      rotSpeed: 0.025,
      blendMode: "normal",
    },
    final: {
      scale: 0.9,
      opacity: 0.66,
      saturation: 0.52,
      contrast: 0.94,
      brightness: 0.98,
      motion: 0.82,
      rotSpeed: -0.045,
      blendMode: "multiply",
    },
    standalone: {
      scale: 1.04,
      opacity: 0.82,
      saturation: 0.9,
      contrast: 1,
      brightness: 1,
      motion: 0.68,
      rotSpeed: 0.035,
      blendMode: "normal",
    },
  };

  const state = {
    raw: "",
    mode: "jamo",
    nodes: [],
    wordDisplay: null,
    committedRaw: "",
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
    typedPreview: document.getElementById("typed-preview"),
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
    return {
      initial: CHOSEONG[cho],
      vowel: JUNGSEONG[jung],
      final: jong > 0 ? JONGSEONG[jong] : "",
    };
  }

  function expandConsonant(char) {
    if (BASIC_CONSONANT_SET.has(char)) return [char];
    return DERIVED_CONSONANTS[char] ?? [];
  }

  function patternSrc(consonant) {
    return `./patterns/${encodeURIComponent(consonant)}_2.png`;
  }

  function clamp(value, min, max) {
    if (max < min) return (min + max) * 0.5;
    return Math.min(max, Math.max(min, value));
  }

  function vowelProfile(vowel = "") {
    const index = JUNGSEONG.indexOf(vowel);
    if (index < 0) {
      return { index: -1, x: 0, y: 0, angle: 0, twist: 0, closeness: 0 };
    }

    const angle = index * 47 + (index % 4) * 29 - 28;
    const rad = (angle * Math.PI) / 180;
    const radius = 30 + (index % 6) * 8;

    return {
      index,
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
      angle,
      twist: ((index % 9) - 4) * 9,
      closeness: ((index % 5) - 2) * 13,
    };
  }

  function pushConsonantTokens(out, source, role, syllableIndex, partIndex, omittedVowel = "") {
    const parts = expandConsonant(source);
    const roleOffset = role === "final" ? 10 : 0;
    const vowel = vowelProfile(omittedVowel);

    parts.forEach((consonant, consonantIndex) => {
      out.push({
        text: consonant,
        source,
        consonant,
        family: "consonant",
        role,
        syllableIndex,
        partIndex: partIndex + roleOffset + consonantIndex,
        consonantIndex,
        omittedVowel,
        vowelIndex: vowel.index,
        vowelAngle: vowel.angle,
        vowelX: vowel.x,
        vowelY: vowel.y,
        vowelTwist: vowel.twist,
        vowelCloseness: vowel.closeness,
        patternSrc: patternSrc(consonant),
        isSpace: false,
      });
    });
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
        pushConsonantTokens(out, parts.initial, "initial", syllableIndex, 0, parts.vowel);
        if (parts.final) {
          pushConsonantTokens(out, parts.final, "final", syllableIndex, 1, parts.vowel);
        }
        syllableIndex += 1;
      } else {
        if (classifyJamo(char) === "consonant") {
          pushConsonantTokens(out, char, "standalone", syllableIndex, 0);
        }
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
    const code = token.consonant?.charCodeAt(0) ?? token.text?.charCodeAt(0) ?? 0;
    const vowelCode = token.omittedVowel?.charCodeAt(0) ?? 0;
    const a = (token.syllableIndex + 3) * 92821;
    const b = (token.partIndex + 5) * 68917;
    const c = mode === "word" ? 137 : 61;
    const n = (code * 131 + vowelCode * 211 + a + b + c + state.familySeed) >>> 0;
    return (n % 1000) / 1000;
  }

  function tokenKey(token) {
    return `${token.mode}:${token.syllableIndex}:${token.partIndex}:${token.role}:${token.consonant}:${token.omittedVowel}`;
  }

  function randomVisualProfile(token, mode) {
    const role = ROLE_VISUALS[token.role] ?? ROLE_VISUALS.standalone;
    const seeded = pseudoRandom(token, mode);
    const vowel = vowelProfile(token.omittedVowel);
    const size = mode === "word" ? 250 + seeded * 82 : 132 + seeded * 54;
    const baseScale = mode === "word" ? 1.02 + Math.random() * 0.22 : 0.98 + Math.random() * 0.2;
    const direction = token.consonantIndex % 2 === 0 ? 1 : -1;
    const layerDirection = vowel.index % 2 === 0 ? 1 : -1;

    return {
      size,
      scale: baseScale * role.scale,
      opacityMultiplier: role.opacity,
      saturation: role.saturation,
      contrast: role.contrast,
      brightness: role.brightness,
      motion: role.motion,
      rotBias: vowel.angle * 0.42 + vowel.twist * direction,
      rotSpeed: role.rotSpeed * direction * (0.9 + Math.random() * 0.8),
      orbitRadius: (mode === "word" ? 2.8 : 1.9) + seeded * 3.8,
      orbitSpeed: (0.006 + seeded * 0.01) * role.motion * layerDirection,
      layerGap: 5.5 + seeded * 7 + Math.abs(vowel.closeness) * 0.24,
      underRotSpeed: (-0.025 - seeded * 0.022) * role.motion * layerDirection,
      overRotSpeed: (0.018 + seeded * 0.02) * role.motion * direction,
      layerPhaseSpeed: (0.012 + seeded * 0.016) * role.motion,
      blendMode: role.blendMode,
    };
  }

  function applyVisualProfile(node, profile) {
    node.size = profile.size;
    node.scale = profile.scale;
    node.opacityMultiplier = profile.opacityMultiplier;
    node.saturation = profile.saturation;
    node.contrast = profile.contrast;
    node.brightness = profile.brightness;
    node.motion = profile.motion;
    node.rotBias = profile.rotBias;
    node.rotSpeed = profile.rotSpeed;
    node.orbitRadius = profile.orbitRadius;
    node.orbitSpeed = profile.orbitSpeed;
    node.layerGap = profile.layerGap;
    node.underRotSpeed = profile.underRotSpeed;
    node.overRotSpeed = profile.overRotSpeed;
    node.layerPhaseSpeed = profile.layerPhaseSpeed;
    node.blendMode = profile.blendMode;
    node.visualKey = tokenKey(node.token);
  }

  function makeGlyphTokens() {
    if (state.mode === "word") {
      const sentence = state.committedRaw.trim();
      if (!sentence) return [];
      return splitToJamo(sentence).map((item) => ({
        ...item,
        mode: "word",
      }));
    }

    const jamo = splitToJamo(state.raw);
    return jamo.map((item) => ({
      ...item,
      mode: "jamo",
    }));
  }

  function partOffset(token, orderIndex, partCount, mode) {
    const vowel = vowelProfile(token.omittedVowel);
    if (partCount <= 1) {
      if (mode === "word") {
        return { x: vowel.x * 1.15, y: vowel.y * 1.05 };
      }
      return { x: vowel.x * 0.78, y: vowel.y * 0.7 };
    }

    if (mode === "word") {
      const spread = Math.max(16, 34 + vowel.closeness);
      const clusterOffset = (orderIndex - (partCount - 1) * 0.5) * spread;
      const rad = ((vowel.angle + orderIndex * 41) * Math.PI) / 180;
      const orbitX = Math.cos(rad) * (18 + Math.abs(vowel.closeness) * 0.35);
      const orbitY = Math.sin(rad) * (18 + Math.abs(vowel.closeness) * 0.35);

      if (token.role === "initial") {
        return {
          x: -16 + clusterOffset * 0.24 + vowel.x * 1.05 + orbitX,
          y: -12 + clusterOffset * 0.12 + vowel.y * 0.95 + orbitY,
        };
      }

      if (token.role === "final") {
        return {
          x: 18 + clusterOffset * 0.44 - vowel.x * 0.72 - orbitY * 0.75,
          y: 16 + clusterOffset * 0.14 - vowel.y * 0.62 + orbitX * 0.75,
        };
      }

      return { x: clusterOffset + vowel.x * 0.9 + orbitX, y: vowel.y * 0.82 + orbitY };
    }

    return {
      x: (orderIndex - (partCount - 1) * 0.5) * 18 + vowel.x * 0.78,
      y: vowel.y * 0.7,
    };
  }

  function baseNode(token, rect, bornAt, cfg) {
    const spawnAtHome = cfg.spawnAtHome ?? false;
    const baseX = spawnAtHome ? cfg.homeX : rect.width * 0.5;
    const baseY = spawnAtHome ? cfg.homeY : rect.height * 0.5;
    const profile = cfg.visualProfile ?? randomVisualProfile(token, token.mode);
    const node = {
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
      rot: profile.rotBias + (Math.random() - 0.5) * cfg.rot,
      orbitPhase: Math.random() * Math.PI * 2,
      layerPhase: Math.random() * Math.PI * 2,
      underRot: (Math.random() - 0.5) * 8,
      overRot: (Math.random() - 0.5) * 4,
      underX: 0,
      underY: 0,
      overX: 0,
      overY: 0,
      bornAt,
      birthMs: cfg.birthMs,
      fadeDelay: cfg.fadeDelay ?? 0,
      fadeDuration: cfg.fadeDuration ?? 900,
      fade: 1,
    };
    applyVisualProfile(node, profile);
    const safe = Math.min(
      Math.max(72, node.size * node.scale * 0.64 + (node.layerGap ?? 0) + 14),
      Math.max(46, Math.min(rect.width, rect.height) * 0.42)
    );
    node.safe = safe;
    node.homeX = clamp(node.homeX, safe, rect.width - safe);
    node.homeY = clamp(node.homeY, safe, rect.height - safe);
    node.x = clamp(node.x, safe, rect.width - safe);
    node.y = clamp(node.y, safe, rect.height - safe);
    return node;
  }

  function layoutNodes(tokens, prevNodes = []) {
    state.stageRect = dom.glyphLayer.getBoundingClientRect();
    const rect = state.stageRect;
    if (!tokens.length) return [];

    const bornAt = performance.now();

    if (state.mode === "jamo") {
      const seed = tokens.filter((t) => !t.isSpace);
      if (!seed.length) return [];

      const targetCount = Math.max(seed.length, Math.floor((rect.width * rect.height) / (214 * 178)));
      const expanded = [];
      for (let i = 0; i < targetCount; i += 1) {
        expanded.push(seed[i % seed.length]);
      }

      const topPadding = Math.max(150, rect.height * 0.18);
      const bottomPadding = Math.max(132, rect.height * 0.16);
      const sidePadding = Math.max(132, rect.width * 0.08);
      const cols = Math.max(3, Math.floor((rect.width - sidePadding * 2) / 188));
      const rows = Math.max(1, Math.ceil(targetCount / cols));
      const stepX = cols <= 1 ? 0 : (rect.width - sidePadding * 2) / (cols - 1);
      const availableHeight = Math.max(120, rect.height - topPadding - bottomPadding);
      const stepY = rows <= 1 ? 0 : availableHeight / (rows - 1);

      return expanded.map((token, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const vowel = vowelProfile(token.omittedVowel);
        const homeX = sidePadding + col * stepX + vowel.x * 0.78 + (Math.random() - 0.5) * 14;
        const homeY = topPadding + row * stepY + vowel.y * 0.7 + (Math.random() - 0.5) * 14;

        const prev = prevNodes[i];
        if (prev) {
          prev.token = token;
          prev.homeX = homeX;
          prev.homeY = homeY;
          prev.clarity = Math.max(0.33, prev.clarity);
          prev.birthMs = 320;
          if (prev.visualKey !== tokenKey(token) || Math.random() < 0.18) {
            applyVisualProfile(prev, randomVisualProfile(token, "jamo"));
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
          visualProfile: randomVisualProfile(token, "jamo"),
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

    const syllableAdvance = Math.max(156, rect.width / 11.2);
    const spaceAdvance = Math.max(170, rect.width / 7.8);
    const maxLineWidth = rect.width * 0.78;
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

    const lineGap = Math.max(238, rect.height / 3.8);
    const totalHeight = (lines.length - 1) * lineGap;
    const wordSafeY = Math.min(Math.max(190, rect.height * 0.26), Math.max(96, rect.height * 0.39));
    const startBaseline = clamp(rect.height * 0.5 - totalHeight * 0.5, wordSafeY, rect.height - wordSafeY - totalHeight);
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

        unit.tokens.forEach((token, tokenIndex) => {
          const offset = partOffset(token, tokenIndex, partCount, "word");
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
              fadeDelay: Math.random() * 8200,
              fadeDuration: 1900 + Math.random() * 1900,
              visualProfile: randomVisualProfile(token, "word"),
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
      dom.line.value = consonantPreview(state.raw) || " ";
      dom.line.style.opacity = "1";
      return;
    }

    dom.line.classList.remove("word");
    const preview = consonantPreview(state.raw);
    dom.line.value = preview || " ";
    dom.line.style.opacity = state.raw && preview ? "1" : "0";
  }

  function consonantPreview(raw) {
    const parts = splitToJamo(raw);
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

    return preview;
  }

  function appendPatternLayers(target, token) {
    target.dataset.consonant = token.consonant;

    ["under", "over"].forEach((layer) => {
      const img = document.createElement("img");
      img.className = `pattern-layer ${layer}`;
      img.src = token.patternSrc;
      img.alt = "";
      img.draggable = false;
      target.appendChild(img);
    });
  }

  function syncTypedPreview() {
    dom.typedPreview.innerHTML = "";
    const tokens = splitToJamo(state.raw);
    dom.typedPreview.style.opacity = "1";

    tokens.slice(-18).forEach((token) => {
      if (token.isSpace) {
        const space = document.createElement("span");
        space.className = "preview-space";
        dom.typedPreview.appendChild(space);
        return;
      }

      const item = document.createElement("span");
      item.className = `preview-token ${token.role}`;
      item.setAttribute("aria-label", token.text);
      item.style.setProperty("--preview-rot", `${(token.vowelAngle * 0.08).toFixed(2)}deg`);
      item.style.setProperty("--preview-x", `${(token.vowelX * 0.08).toFixed(2)}px`);
      item.style.setProperty("--preview-y", `${(token.vowelY * 0.08).toFixed(2)}px`);
      appendPatternLayers(item, token);
      dom.typedPreview.appendChild(item);
    });
  }

  function paint() {
    dom.glyphLayer.innerHTML = "";

    state.nodes.forEach((node) => {
      const el = document.createElement("span");
      el.className = `glyph pattern ${node.token.mode} ${node.token.role}`;
      appendPatternLayers(el, node.token);
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
    const visualClarity = isWord ? Math.min(1, node.clarity) : Math.min(0.82, node.clarity + 0.24);
    node.el.style.setProperty("--x", `${node.x.toFixed(2)}px`);
    node.el.style.setProperty("--y", `${node.y.toFixed(2)}px`);
    node.el.style.setProperty("--rot", `${node.rot.toFixed(2)}deg`);
    node.el.style.setProperty("--pulse", node.pulse.toFixed(3));
    node.el.style.setProperty("--clarity", visualClarity.toFixed(3));
    node.el.style.setProperty("--trace", node.trace.toFixed(3));
    node.el.style.setProperty("--sc", node.scale.toFixed(3));
    node.el.style.setProperty("--pattern-size", `${node.size.toFixed(2)}px`);
    node.el.style.setProperty("--sat", node.saturation.toFixed(3));
    node.el.style.setProperty("--contrast", node.contrast.toFixed(3));
    node.el.style.setProperty("--brightness", node.brightness.toFixed(3));
    node.el.style.setProperty("--under-rot", `${node.underRot.toFixed(2)}deg`);
    node.el.style.setProperty("--over-rot", `${node.overRot.toFixed(2)}deg`);
    node.el.style.setProperty("--under-x", `${node.underX.toFixed(2)}px`);
    node.el.style.setProperty("--under-y", `${node.underY.toFixed(2)}px`);
    node.el.style.setProperty("--over-x", `${node.overX.toFixed(2)}px`);
    node.el.style.setProperty("--over-y", `${node.overY.toFixed(2)}px`);
    node.el.style.mixBlendMode = node.blendMode;
    const baseOpacity = isWord ? 0.42 + visualClarity * 0.58 : 0.68 + visualClarity * 0.28;
    const fade = node.fade ?? 1;
    node.el.style.opacity = `${Math.max(0, baseOpacity * (node.opacityMultiplier ?? 1) * fade).toFixed(3)}`;
  }

  function rebuild() {
    const tokens = makeGlyphTokens();
    state.nodes = layoutNodes(tokens, state.nodes);
    syncLiveLine();
    syncTypedPreview();
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

    const motion = node.motion ?? 1;

    node.vx += toHomeX * 0.0022 * (1 + birthPower * 0.4) * motion * t;
    node.vy += toHomeY * 0.0022 * (1 + birthPower * 0.4) * motion * t;
    node.orbitPhase += (node.orbitSpeed ?? 0.02) * t;
    node.vx += Math.cos(node.orbitPhase) * (node.orbitRadius ?? 2) * 0.0032 * motion * t;
    node.vy += Math.sin(node.orbitPhase * 0.82) * (node.orbitRadius ?? 2) * 0.0032 * motion * t;

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
        node.vx += (dx / safe) * 0.008 * power * motion * t;
        node.vy += (dy / safe) * 0.008 * power * motion * t;
        node.clarity = Math.min(1, node.clarity + 0.05 * power * t);
        node.trace = Math.min(1.1, node.trace + 0.03 * power * t);
      }
    }

    node.vx *= 0.86;
    node.vy *= 0.86;

    node.x += node.vx;
    node.y += node.vy;
    node.rot += (node.rotSpeed ?? 0) * t;
    node.layerPhase += (node.layerPhaseSpeed ?? 0.04) * t;
    node.underRot += (node.underRotSpeed ?? -0.1) * t;
    node.overRot += (node.overRotSpeed ?? 0.08) * t;

    const gap = node.layerGap ?? 6;
    node.underX = Math.cos(node.layerPhase) * gap;
    node.underY = Math.sin(node.layerPhase * 0.8) * gap;
    node.overX = Math.cos(node.layerPhase + Math.PI) * gap * 0.38;
    node.overY = Math.sin(node.layerPhase * 0.9 + Math.PI) * gap * 0.38;

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
      node.x += (Math.random() - 0.5) * 0.06 * fade * motion * t;
      node.y += (Math.random() - 0.5) * 0.06 * fade * motion * t;
    }

    node.driftX += (Math.random() - 0.5) * 0.03 * motion;
    node.driftY += (Math.random() - 0.5) * 0.03 * motion;
    node.driftX *= 0.992;
    node.driftY *= 0.992;

    const safe = node.safe ?? 72;
    node.x = clamp(node.x, safe, state.stageRect.width - safe);
    node.y = clamp(node.y, safe, state.stageRect.height - safe);

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
      state.committedRaw = "";
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
    state.committedRaw = "";
    state.wordDisplay = null;
    dom.hint.style.opacity = state.raw ? "0.24" : "1";
    if (state.mode === "word") {
      state.mode = "jamo";
    }
    rebuild();
  }

  function commitWords() {
    const sentence = state.raw.trim();
    if (!sentence) return;
    const now = performance.now();
    state.familySeed = Math.floor(Math.random() * 100000);
    state.committedRaw = sentence;
    state.wordDisplay = {
      committedAt: now,
      totalMaxMs: 12000,
    };
    state.mode = "word";
    rebuild();
  }

  function focusInput() {
    dom.callInput.focus({ preventScroll: true });
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
      const rect = state.stageRect ?? dom.glyphLayer.getBoundingClientRect();
      state.pointer.x = event.clientX - rect.left;
      state.pointer.y = event.clientY - rect.top;
      state.pointer.active = true;
      state.pointer.lastCall = performance.now();
    });

    dom.stage.addEventListener("pointerleave", () => {
      state.pointer.active = false;
    });

    dom.stage.addEventListener("pointerdown", () => {
      focusInput();
      state.pointer.lastCall = performance.now();
    });

    document.addEventListener("keydown", () => {
      if (document.activeElement !== dom.callInput) {
        focusInput();
      }
    });

    window.addEventListener("resize", rebuild);
  }

  bind();
  dom.callInput.value = "";
  focusInput();
  rebuild();
})();
