(() => {
  const STORAGE_KEY = 'sat-math-practice-v1';
  const $ = id => document.getElementById(id);
  const E = {
    pdfFile:$('pdfFile'), domain:$('domainFilter'), mode:$('modeFilter'), search:$('skillSearch'),
    number:$('questionNumber'), domainTag:$('domainTag'), difficulty:$('difficultyTag'), skill:$('skillText'),
    id:$('questionId'), page:$('sourcePage'), canvas:$('questionCanvas'), placeholder:$('pdfPlaceholder'),
    renderStatus:$('renderStatus'), mcq:$('mcqArea'), spr:$('sprArea'), sprInput:$('sprInput'), answerType:$('answerType'),
    submit:$('submitBtn'), clear:$('clearBtn'), feedback:$('answerFeedback'), solution:$('solutionPanel'),
    solutionTitle:$('solutionTitle'), solutionBody:$('solutionBody'), solutionStatus:$('solutionStatus'),
    copyPrompt:$('copyPromptBtn'), bookmark:$('bookmarkBtn'), random:$('randomBtn'), prev:$('prevBtn'),
    next:$('nextBtn'), prevBottom:$('prevBottomBtn'), nextBottom:$('nextBottomBtn'), filtered:$('filteredCount'),
    sideAttempted:$('sideAttempted'), sideProgress:$('sideProgress'), sideAccuracy:$('sideAccuracy'),
    sideBookmarked:$('sideBookmarked'), metricTotal:$('metricTotal'), metricAttempted:$('metricAttempted'),
    metricRemaining:$('metricRemaining'), metricCorrect:$('metricCorrect'), metricAccuracy:$('metricAccuracy'),
    pdfDot:$('pdfStatusDot'), pdfTitle:$('pdfStatusTitle'), pdfText:$('pdfStatusText'), reset:$('resetProgress')
  };

  let bank = [], guides = {}, pdfDoc = null, currentIndex = 0, selected = null, checked = false;
  let visible = [], renderToken = 0;
  let state = readState();

  function readState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { attempts:s.attempts || {}, bookmarks:s.bookmarks || [], selectedIndex:s.selectedIndex || 0 };
    } catch (_) { return { attempts:{}, bookmarks:[], selectedIndex:0 }; }
  }
  function saveState() {
    state.selectedIndex = currentIndex;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateStats();
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function toast(message) {
    const n = document.createElement('div'); n.className = 'toast'; n.textContent = message;
    document.body.appendChild(n); setTimeout(() => n.remove(), 1800);
  }
  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); toast('Copied to clipboard'); }
    catch (_) {
      const t = document.createElement('textarea'); t.value = value; document.body.appendChild(t);
      t.select(); document.execCommand('copy'); t.remove(); toast('Copied to clipboard');
    }
  }

  async function init() {
    try {
      const pair = await Promise.all([fetch('data/questions.json'), fetch('data/desmos-solutions.json')]);
      if (!pair[0].ok) throw new Error('data/questions.json tidak ditemukan. Jalankan scripts/build_bank.py.');
      const manifest = await pair[0].json();
      bank = manifest.questions || [];
      if (pair[1].ok) guides = await pair[1].json();
      E.metricTotal.textContent = bank.length;
      populateDomains(); buildVisible();
      currentIndex = Math.min(Number(state.selectedIndex || 0), Math.max(0, bank.length - 1));
      if (!bank.length) throw new Error('Bank soal kosong.');
      renderQuestion(); updateStats();
      if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      else setPdfStatus(false, 'PDF.js unavailable', 'Check the internet connection and reload.');
    } catch (error) {
      console.error(error);
      E.placeholder.innerHTML = '<div class="placeholder-icon">!</div><strong>Bank data belum siap</strong><p>' + esc(error.message) + '</p><p>Pastikan data/questions.json tersedia dan jalankan localhost dari folder proyek.</p>';
    }
  }
  function populateDomains() {
    Array.from(new Set(bank.map(q => q.domain).filter(Boolean))).sort().forEach(domain => {
      const option = document.createElement('option'); option.value = domain; option.textContent = domain; E.domain.appendChild(option);
    });
  }
  function buildVisible() {
    const domain = E.domain.value, mode = E.mode.value, query = E.search.value.trim().toLowerCase();
    visible = bank.map((q,i) => ({q:q,i:i})).filter(item => {
      const q = item.q, attempt = state.attempts[q.id];
      if (domain !== 'all' && q.domain !== domain) return false;
      if (mode === 'unanswered' && attempt) return false;
      if (mode === 'incorrect' && (!attempt || attempt.correct)) return false;
      if (mode === 'bookmarked' && state.bookmarks.indexOf(q.id) < 0) return false;
      if (query && (q.id + ' ' + q.skill + ' ' + q.domain + ' ' + q.number).toLowerCase().indexOf(query) < 0) return false;
      return true;
    }).map(item => item.i);
    E.filtered.textContent = 'Showing ' + visible.length + ' question' + (visible.length === 1 ? '' : 's');
    if (visible.length && visible.indexOf(currentIndex) < 0) currentIndex = visible[0];
  }
  function updateStats() {
    const attempts = Object.values(state.attempts);
    const attempted = attempts.length, correct = attempts.filter(a => a.correct).length;
    const accuracy = attempted ? Math.round(correct / attempted * 100) : null;
    E.sideAttempted.textContent = attempted + ' / ' + bank.length;
    E.sideProgress.style.width = (bank.length ? attempted / bank.length * 100 : 0) + '%';
    E.sideAccuracy.textContent = accuracy == null ? '—' : accuracy + '%';
    E.sideBookmarked.textContent = state.bookmarks.length;
    E.metricAttempted.textContent = attempted;
    E.metricRemaining.textContent = Math.max(0, bank.length - attempted) + ' remaining';
    E.metricCorrect.textContent = correct;
    E.metricAccuracy.textContent = accuracy == null ? '—' : accuracy + '%';
  }
  function question() { return bank[currentIndex]; }
  function visiblePosition() { return Math.max(0, visible.indexOf(currentIndex)); }

  function renderQuestion() {
    if (!bank.length) return;
    const q = question(), pos = visiblePosition(), attempt = state.attempts[q.id];
    E.number.textContent = 'Question ' + q.number + ' / ' + bank.length;
    E.domainTag.textContent = q.domain; E.difficultyTag.textContent = q.difficulty;
    E.skill.textContent = q.skill; E.id.textContent = 'ID: ' + q.id;
    E.page.textContent = 'PDF page ' + q.page;
    E.answerType.textContent = q.type === 'mcq' ? 'MULTIPLE CHOICE' : 'GRID-IN';
    E.mcq.hidden = q.type !== 'mcq'; E.spr.hidden = q.type === 'mcq';
    selected = null; checked = false; E.sprInput.value = '';
    E.sprInput.disabled = false; E.submit.disabled = false;
    E.feedback.textContent = ''; E.feedback.className = 'answer-feedback';
    document.querySelectorAll('.choice-button').forEach(b => { b.classList.remove('selected'); b.disabled = false; });
    if (attempt) {
      checked = true;
      if (q.type === 'mcq') {
        selected = attempt.response;
        const active = document.querySelector('.choice-button[data-choice="' + selected + '"]');
        if (active) active.classList.add('selected');
      } else E.sprInput.value = attempt.response;
      lockResponse(); showFeedback(attempt.correct, q); showSolution(q);
    } else E.solution.hidden = true;
    const bookmarked = state.bookmarks.indexOf(q.id) >= 0;
    E.bookmark.classList.toggle('active', bookmarked); E.bookmark.textContent = bookmarked ? '★' : '☆';
    E.prev.disabled = visible.length < 2 || pos <= 0;
    E.prevBottom.disabled = visible.length < 2 || pos <= 0;
    E.next.disabled = visible.length < 2 || pos >= visible.length - 1;
    E.nextBottom.disabled = visible.length < 2 || pos >= visible.length - 1;
    if (pdfDoc) renderPdfQuestion(q);
    else { E.canvas.hidden = true; E.placeholder.hidden = false; E.renderStatus.textContent = 'Load the source PDF to display this question'; }
  }
  async function renderPdfQuestion(q) {
    const token = ++renderToken; E.renderStatus.textContent = 'Rendering page…';
    try {
      const page = await pdfDoc.getPage(q.page);
      const baseViewport = page.getViewport({scale:1});
      const scale = Math.min(1.8, Math.max(1.2, 1100 / baseViewport.width));
      const viewport = page.getViewport({scale:scale});
      const full = document.createElement('canvas');
      full.width = Math.ceil(viewport.width); full.height = Math.ceil(viewport.height);
      await page.render({canvasContext:full.getContext('2d', {alpha:false}), viewport:viewport}).promise;
      if (token !== renderToken) return;
      const height = Math.min(full.height, Math.ceil(q.cropBottom * scale));
      E.canvas.width = full.width; E.canvas.height = height;
      const context = E.canvas.getContext('2d', {alpha:false});
      context.fillStyle = '#fff'; context.fillRect(0,0,E.canvas.width,E.canvas.height);
      context.drawImage(full, 0,0,full.width,height, 0,0,full.width,height);
      E.canvas.hidden = false; E.placeholder.hidden = true;
      E.renderStatus.textContent = 'Page ' + q.page + ' · question area only';
    } catch (error) { console.error(error); E.renderStatus.textContent = 'Could not render this PDF page'; }
  }
  function parseNumeric(value) {
    const s = String(value).trim().replace(/\s/g,'').replace(/,/g,'.');
    if (!s) return NaN;
    const m = s.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
    if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
    return Number(s);
  }
  function isCorrect(q, response) {
    if (q.type === 'mcq') return String(response).trim().toUpperCase() === String(q.answer).trim().toUpperCase();
    const entered = parseNumeric(response);
    if (!Number.isFinite(entered)) return false;
    return (q.acceptedAnswers || [q.answer]).some(a => {
      const expected = parseNumeric(a);
      return Number.isFinite(expected) && Math.abs(entered - expected) <= Math.max(.00055, Math.abs(expected) * .00001);
    });
  }
  function submitAnswer() {
    const q = question();
    if (checked) return;
    const response = q.type === 'mcq' ? selected : E.sprInput.value.trim();
    if (!response) { toast(q.type === 'mcq' ? 'Choose an option first.' : 'Enter an answer first.'); return; }
    const correct = isCorrect(q, response);
    state.attempts[q.id] = {response:String(response), correct:correct, submittedAt:new Date().toISOString()};
    checked = true; lockResponse(); showFeedback(correct,q); showSolution(q); saveState();
  }
  function lockResponse() {
    E.submit.disabled = true; E.sprInput.disabled = true;
    document.querySelectorAll('.choice-button').forEach(b => b.disabled = true);
  }
  function showFeedback(correct,q) {
    E.feedback.textContent = correct ? 'Correct — well done.' : 'Not quite. Correct answer: ' + q.answer;
    E.feedback.className = 'answer-feedback ' + (correct ? 'correct' : 'incorrect');
  }
  function showSolution(q) {
    const guide = guides[q.id]; E.solution.hidden = false;
    E.solutionTitle.textContent = guide ? guide.title : 'Pembahasan dan panduan Desmos';
    E.solutionStatus.textContent = guide ? 'GUIDE AVAILABLE' : 'GUIDE TO BE PREPARED';
    E.solutionBody.innerHTML = '';
    if (!guide) {
      const p = document.createElement('p'); p.className = 'solution-empty';
      p.textContent = 'Pembahasan terjemahan dan panduan Desmos khusus untuk Question ID ini belum dimasukkan. Gunakan tombol di bawah untuk menyiapkan permintaan yang merujuk tepat pada soal dan halaman sumbernya.';
      E.solutionBody.appendChild(p); return;
    }
    const wrap = document.createElement('div'); wrap.className = 'solution-content';
    const summary = document.createElement('p'); summary.className = 'solution-summary'; summary.textContent = guide.explanation; wrap.appendChild(summary);
    const steps = document.createElement('div'); steps.className = 'solution-steps';
    (guide.steps || []).forEach((step,i) => {
      const node = document.createElement('article'); node.className = 'solution-step';
      const title = document.createElement('div'); title.className = 'step-title'; title.textContent = (i+1) + '. ' + step.title; node.appendChild(title);
      const body = document.createElement('div'); body.className = 'step-body'; body.textContent = step.text; node.appendChild(body);
      (step.expressions || []).forEach(expression => {
        const row = document.createElement('div'); row.className = 'expression-row';
        const code = document.createElement('code'); code.textContent = expression;
        const copy = document.createElement('button'); copy.className = 'copy-expression'; copy.textContent = 'Copy';
        copy.addEventListener('click', () => copyText(expression)); row.appendChild(code); row.appendChild(copy); node.appendChild(row);
      });
      if (step.expected) {
        const expected = document.createElement('div'); expected.className = 'step-body'; expected.style.marginTop = '7px';
        expected.innerHTML = '<strong>Hasil yang dicari:</strong> ' + esc(step.expected); node.appendChild(expected);
      }
      steps.appendChild(node);
    });
    wrap.appendChild(steps);
    if (guide.final) {
      const final = document.createElement('div'); final.className = 'solution-final'; final.textContent = guide.final; wrap.appendChild(final);
    }
    E.solutionBody.appendChild(wrap);
  }
  function makePrompt(q) {
    return [
      'BAHAS SOAL SAT MATH — DESMOS ONLY',
      '',
      'Gunakan PDF bank soal SAT Math yang sudah saya lampirkan dalam percakapan ini. Temukan soal berdasarkan metadata berikut:',
      '- Question ID: ' + q.id,
      '- Nomor urut di bank: ' + q.number,
      '- Halaman PDF: ' + q.page,
      '- Domain: ' + q.domain,
      '- Skill: ' + q.skill,
      '- Difficulty: ' + q.difficulty,
      '- Kunci di manifest: ' + q.answer,
      '',
      'Tugas:',
      '1. Baca soal dan rationale yang tepat pada halaman sumber. Jangan menebak bagian persamaan, tabel, diagram, atau pilihan jawaban yang kurang terbaca.',
      '2. Susun pembahasan dalam bahasa Indonesia baku dan resmi. Alihbahasakan seluruh alur penalaran secara setia dengan kalimat sendiri; jangan menyalin rationale panjang secara verbatim dan jangan menghilangkan langkah penting.',
      '3. Berikan panduan penyelesaian yang benar-benar menggunakan Desmos Graphing Calculator dari awal sampai akhir. Jangan mengganti dengan eliminasi, substitusi, faktorisasi, atau hitungan manual sebagai metode utama.',
      '4. Setiap langkah Desmos harus menyebutkan ekspresi persis yang diketik, tombol/aksi yang dilakukan, hasil visual atau numerik yang seharusnya muncul, serta cara membaca hasil tersebut.',
      '5. Jika soal perlu tabel, titik, regresi, slider, persamaan implisit, irisan grafik, statistik, atau fungsi, tunjukkan cara menyiapkannya di Desmos.',
      '6. Verifikasi jawaban akhir dan jelaskan jebakan yang paling mungkin.',
      '7. Jika suatu bagian memang tidak dapat diselesaikan secara andal hanya dengan Desmos, nyatakan batasannya secara jujur.',
      '',
      'Format: (A) Inti soal, (B) Pembahasan bahasa Indonesia, (C) Langkah Desmos dengan ekspresi siap salin, (D) Interpretasi hasil, (E) Verifikasi dan jawaban akhir, (F) Jebakan soal.',
      'Pastikan pembahasan mengacu pada Question ID dan halaman yang disebutkan.'
    ].join('\n');
  }

  function move(delta) {
    if (!visible.length) return;
    const pos = visiblePosition(), next = Math.min(visible.length-1, Math.max(0,pos+delta));
    currentIndex = visible[next]; saveState(); renderQuestion();
  }
  function selectChoice(choice) {
    if (checked) return; selected = choice;
    document.querySelectorAll('.choice-button').forEach(b => b.classList.toggle('selected', b.dataset.choice === choice));
  }
  function toggleBookmark() {
    const id = question().id, index = state.bookmarks.indexOf(id);
    if (index >= 0) state.bookmarks.splice(index,1); else state.bookmarks.push(id);
    saveState(); renderQuestion();
  }
  async function loadPdf(file) {
    if (!file) return;
    if (!window.pdfjsLib) { toast('PDF renderer unavailable. Check the internet connection.'); return; }
    try {
      setPdfStatus(false,'Loading PDF…',file.name);
      pdfDoc = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      const maxPage = Math.max.apply(null,bank.map(q => q.page));
      if (pdfDoc.numPages < maxPage) {
        setPdfStatus(false,'PDF page count mismatch',pdfDoc.numPages + ' pages loaded; expected at least ' + maxPage + '.');
        pdfDoc = null; return;
      }
      setPdfStatus(true,'PDF ready',file.name + ' · ' + pdfDoc.numPages + ' pages');
      renderQuestion();
    } catch (error) {
      console.error(error); pdfDoc = null; setPdfStatus(false,'Could not open PDF','Select the original PDF again.'); toast('PDF could not be opened.');
    }
  }
  function setPdfStatus(ready,title,text) {
    E.pdfDot.classList.toggle('ready',ready); E.pdfTitle.textContent = title; E.pdfText.textContent = text;
  }

  E.pdfFile.addEventListener('change',e => loadPdf(e.target.files && e.target.files[0]));
  E.domain.addEventListener('change',() => {buildVisible();renderQuestion();});
  E.mode.addEventListener('change',() => {buildVisible();renderQuestion();});
  E.search.addEventListener('input',() => {buildVisible();renderQuestion();});
  document.querySelectorAll('.choice-button').forEach(b => b.addEventListener('click',() => selectChoice(b.dataset.choice)));
  E.submit.addEventListener('click',submitAnswer);
  E.sprInput.addEventListener('keydown',e => {if(e.key === 'Enter') submitAnswer();});
  E.clear.addEventListener('click',() => {
    if (checked) return; selected = null; E.sprInput.value = '';
    document.querySelectorAll('.choice-button').forEach(b => b.classList.remove('selected'));
  });
  E.prev.addEventListener('click',() => move(-1)); E.prevBottom.addEventListener('click',() => move(-1));
  E.next.addEventListener('click',() => move(1)); E.nextBottom.addEventListener('click',() => move(1));
  E.random.addEventListener('click',() => {
    if (!visible.length) return;
    currentIndex = visible[Math.floor(Math.random()*visible.length)]; saveState(); renderQuestion();
  });
  E.bookmark.addEventListener('click',toggleBookmark);
  E.copyPrompt.addEventListener('click',() => copyText(makePrompt(question())));
  E.reset.addEventListener('click',() => {
    if (!confirm('Reset all saved answers and bookmarks in this browser?')) return;
    state = {attempts:{},bookmarks:[],selectedIndex:0}; currentIndex = visible[0] || 0;
    saveState(); buildVisible(); renderQuestion(); toast('Progress reset.');
  });
  init();
})();