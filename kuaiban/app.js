(function () {
  const data = window.KUAIBAN_DATA;
  const video = document.getElementById("video");
  const audio = document.getElementById("audio");
  const playBtn = document.getElementById("playBtn");
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const speedBtn = document.getElementById("speedBtn");
  const searchInput = document.getElementById("searchInput");
  const phraseList = document.getElementById("phraseList");
  const currentLine = document.getElementById("currentLine");
  const metaGrid = document.getElementById("metaGrid");
  const stats = document.getElementById("stats");
  const sourceEaf = document.getElementById("sourceEaf");
  const pageTitle = document.getElementById("pageTitle");
  const miniVideo = document.getElementById("miniVideo");
  const miniCaption = document.getElementById("miniCaption");
  const miniClose = document.getElementById("miniClose");
  const modes = { ch: true, jp: true, en: true, words: true };
  const speeds = [0.75, 1, 1.25, 1.5];
  let speedIndex = 1;
  let activeIndex = 0;
  let stopAt = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

  const sec = (ms) => Math.max(0, (ms || 0) / 1000);

  function showMiniPlayer(caption, start) {
    miniCaption.textContent = caption;
    miniVideo.playbackRate = video.playbackRate;
    miniVideo.currentTime = start;
    document.body.classList.add("segment-playing");
    miniVideo.play().catch(() => {});
  }

  function hideMiniPlayer() {
    document.body.classList.remove("segment-playing");
    miniVideo.pause();
  }

  function syncMiniPlayer() {
    if (!document.body.classList.contains("segment-playing")) return;
    if (Math.abs(miniVideo.currentTime - video.currentTime) > 0.18) {
      miniVideo.currentTime = video.currentTime;
    }
    if (video.paused) {
      miniVideo.pause();
    } else if (miniVideo.paused) {
      miniVideo.play().catch(() => {});
    }
  }

  function renderMeta() {
    pageTitle.textContent = data.title;
    sourceEaf.textContent = data.sourceEaf;
    const preferred = ["映像ファイル提供", "表演", "标注", "方言"];
    const entries = [];
    preferred.forEach((key) => {
      if (data.metadata[key]) entries.push([key, data.metadata[key]]);
    });
    Object.keys(data.metadata).forEach((key) => {
      if (!preferred.includes(key)) entries.push([key, data.metadata[key]]);
    });
    metaGrid.innerHTML = entries.map(([key, value]) => `
      <div class="meta-item">
        <span class="meta-name">${esc(key)}</span>
        <span class="meta-value">${esc(value)}</span>
      </div>
    `).join("");
    stats.textContent = `${data.stats.phrases} lines / ${data.stats.words} words`;
  }

  function phraseHtml(phrase) {
    const showSeg = phrase.pglx && phrase.pglx.trim() !== phrase.tx.trim();
    const wordHtml = phrase.words.map((word) => `
      <div class="word" data-start="${sec(word.start)}" data-end="${sec(word.end)}" title="単語再生">
        <span class="han">${esc(word.text)}</span>
        <span>${esc(word.py)}</span>
        <span>${esc(word.ipa)}</span>
        <span class="gloss">${esc(word.gloss)}</span>
      </div>
    `).join("");
    return `
      <article class="phrase" id="line-${phrase.n}" data-index="${phrase.n - 1}">
        <div class="phrase-head">
          <span>Line ${String(phrase.n).padStart(2, "0")} · ${(sec(phrase.start)).toFixed(2)}s</span>
          <button class="jump" type="button" data-jump="${phrase.n - 1}" title="この句から再生">▶</button>
        </div>
        <div class="tx">${esc(phrase.tx)}</div>
        ${showSeg ? `<div class="seg">${esc(phrase.pglx)}</div>` : ""}
        <p class="translation line-ch">${esc(phrase.ch)}</p>
        <p class="translation line-jp">${esc(phrase.jp)}</p>
        <p class="translation line-en">${esc(phrase.en)}</p>
        <div class="words">${wordHtml}</div>
      </article>
    `;
  }

  function renderPhrases() {
    phraseList.innerHTML = data.phrases.map(phraseHtml).join("");
    phraseList.querySelectorAll(".jump").forEach((button) => {
      button.addEventListener("click", () => {
        playPhrase(Number(button.dataset.jump));
      });
    });
    phraseList.querySelectorAll(".word").forEach((word) => {
      word.addEventListener("click", () => {
        const phraseNode = word.closest(".phrase");
        const phraseIndex = Number(phraseNode.dataset.index);
        const start = Number(word.dataset.start);
        setActive(phraseIndex, false);
        video.currentTime = start;
        stopAt = Number(word.dataset.end);
        showMiniPlayer(`${data.phrases[phraseIndex].tx} · ${word.querySelector(".han").textContent}`, start);
        video.play();
      });
    });
  }

  function renderCurrent(phrase) {
    const showSeg = phrase.pglx && phrase.pglx.trim() !== phrase.tx.trim();
    currentLine.innerHTML = `
      <div class="tx">${esc(phrase.tx)}</div>
      ${showSeg ? `<div class="seg">${esc(phrase.pglx)}</div>` : ""}
      <p class="translation line-ch">${esc(phrase.ch)}</p>
      <p class="translation line-jp">${esc(phrase.jp)}</p>
      <p class="translation line-en">${esc(phrase.en)}</p>
    `;
  }

  function setActive(index, scroll) {
    activeIndex = Math.max(0, Math.min(data.phrases.length - 1, index));
    document.querySelectorAll(".phrase.active").forEach((node) => node.classList.remove("active"));
    const node = document.getElementById(`line-${data.phrases[activeIndex].n}`);
    if (node) {
      node.classList.add("active");
      if (scroll) node.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    renderCurrent(data.phrases[activeIndex]);
  }

  function playPhrase(index) {
    setActive(index, true);
    const start = sec(data.phrases[activeIndex].start);
    video.currentTime = start;
    stopAt = sec(data.phrases[activeIndex].end);
    showMiniPlayer(data.phrases[activeIndex].tx, start);
    video.play();
  }

  function updateFromTime() {
    if (stopAt !== null && video.currentTime >= stopAt) {
      video.pause();
      video.currentTime = stopAt;
      stopAt = null;
      hideMiniPlayer();
      return;
    }
    const ms = video.currentTime * 1000;
    const idx = data.phrases.findIndex((phrase) => ms >= phrase.start && ms < phrase.end);
    if (idx >= 0 && idx !== activeIndex) setActive(idx, false);
    syncMiniPlayer();
  }

  function applyModes() {
    document.body.classList.toggle("hide-ch", !modes.ch);
    document.body.classList.toggle("hide-jp", !modes.jp);
    document.body.classList.toggle("hide-en", !modes.en);
    document.body.classList.toggle("hide-words", !modes.words);
  }

  function applySearch() {
    const q = searchInput.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll(".phrase").forEach((node) => {
      const phrase = data.phrases[Number(node.dataset.index)];
      const haystack = [
        phrase.tx, phrase.pglx, phrase.ch, phrase.jp, phrase.en,
        ...phrase.words.flatMap((word) => [word.text, word.py, word.ipa, word.gloss])
      ].join(" ").toLowerCase();
      const match = q === "" || haystack.includes(q);
      node.classList.toggle("hidden", !match);
      if (match) visible += 1;
    });
    stats.textContent = `${visible} / ${data.stats.phrases} lines · ${data.stats.words} words`;
  }

  document.querySelectorAll(".toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      modes[mode] = !modes[mode];
      button.classList.toggle("active", modes[mode]);
      applyModes();
    });
  });

  playBtn.addEventListener("click", () => {
    if (video.paused) {
      playPhrase(activeIndex);
    } else {
      video.pause();
      stopAt = null;
      hideMiniPlayer();
    }
  });

  backBtn.addEventListener("click", () => playPhrase(activeIndex - 1));
  nextBtn.addEventListener("click", () => playPhrase(activeIndex + 1));
  speedBtn.addEventListener("click", () => {
    speedIndex = (speedIndex + 1) % speeds.length;
    video.playbackRate = speeds[speedIndex];
    audio.playbackRate = speeds[speedIndex];
    miniVideo.playbackRate = speeds[speedIndex];
    speedBtn.textContent = `${speeds[speedIndex].toFixed(2).replace(".00", "")}×`;
  });

  video.addEventListener("play", () => {
    playBtn.textContent = "Ⅱ";
  });
  video.addEventListener("pause", () => {
    playBtn.textContent = "▶";
    miniVideo.pause();
  });
  video.addEventListener("timeupdate", updateFromTime);
  video.addEventListener("seeked", syncMiniPlayer);
  miniClose.addEventListener("click", hideMiniPlayer);
  searchInput.addEventListener("input", applySearch);

  renderMeta();
  renderPhrases();
  setActive(0, false);
  applyModes();
  applySearch();
}());
