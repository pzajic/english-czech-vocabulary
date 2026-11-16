const lessonList = document.getElementById('lessonList');
const quizList = document.getElementById('quizList');
const quizSection = document.getElementById('quizSection');
const quizInstructions = document.getElementById('quizInstructions');
const resultSection = document.getElementById('resultSection');
const resultSummary = document.getElementById('resultSummary');
const resultDetails = document.getElementById('resultDetails');
const sourceLanguage = document.getElementById('sourceLanguage');
const targetLanguage = document.getElementById('targetLanguage');
const wordCountInput = document.getElementById('wordCount');
const generateQuizBtn = document.getElementById('generateQuizBtn');
const submitQuizBtn = document.getElementById('submitQuizBtn');

let vocabulary = { lessons: [] };
let currentQuiz = [];

const normalizeText = (text = '') =>
  String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const languageLabel = (code) => (code === 'en' ? 'English' : code === 'cs' ? 'Czech' : code);
const getQuizMode = () => document.querySelector('input[name="quizMode"]:checked').value;

const shuffle = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
};

const getAcceptedAnswers = (word, language) => {
  const value = word[language];
  return (Array.isArray(value) ? value : [value]).filter((answer) => typeof answer === 'string' && answer.trim());
};

const loadVocabulary = async () => {
  try {
    const response = await fetch('data/vocabulary.json', {cache: 'no-store',});
    if (!response.ok) throw new Error('Could not load vocabulary file.');
    vocabulary = await response.json();
    renderLessons();
  } catch (error) {
    lessonList.textContent = 'Unable to load vocabulary data. Please check data/vocabulary.json.';
    console.error(error);
  }
};

const renderLessons = () => {
  lessonList.replaceChildren();
  (vocabulary.lessons || []).forEach((lesson) => {
    const label = document.createElement('label');
    label.className = 'lesson-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.value = lesson.id;
    checkbox.name = 'lesson';
    const title = document.createElement('span');
    title.textContent = lesson.title;
    label.append(checkbox, title);
    lessonList.appendChild(label);
  });
};

const getSelectedWords = () => {
  const selectedIds = new Set(
    [...document.querySelectorAll('input[name="lesson"]:checked')].map((checkbox) => checkbox.value),
  );
  return (vocabulary.lessons || [])
    .filter((lesson) => selectedIds.has(lesson.id))
    .flatMap((lesson) => (lesson.words || []).map((word) => ({ lessonTitle: lesson.title, word })));
};

// Returns true only for a single insertion, deletion, or substitution.
const hasOneSpellingError = (submitted, expected) => {
  const left = normalizeText(submitted);
  const right = normalizeText(expected);
  if (!left || !right || Math.abs(left.length - right.length) > 1) return false;
  if (left === right) return false;

  let leftIndex = 0;
  let rightIndex = 0;
  let differences = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    differences += 1;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  if (leftIndex < left.length || rightIndex < right.length) differences += 1;
  return differences === 1;
};

const buildOptions = (quizItem, targetVocabulary) => {
  const acceptedNormalized = new Set(quizItem.acceptedAnswers.map(normalizeText));
  const distractors = [];
  const seen = new Set(acceptedNormalized);

  targetVocabulary.forEach((answer) => {
    const normalized = normalizeText(answer);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    distractors.push(answer);
  });

  return shuffle([quizItem.acceptedAnswers[0], ...shuffle(distractors).slice(0, 4)]);
};

const generateQuiz = () => {
  const wordPool = getSelectedWords();
  const sourceCode = sourceLanguage.value;
  const targetCode = targetLanguage.value;
  const usableWords = wordPool.filter(({ word }) =>
    getAcceptedAnswers(word, sourceCode).length && getAcceptedAnswers(word, targetCode).length,
  );

  if (!usableWords.length) {
    resultSection.classList.remove('hidden');
    resultSummary.textContent = 'Select at least one lesson with words in both languages.';
    resultDetails.replaceChildren();
    quizSection.classList.add('hidden');
    return;
  }

  const requestedCount = Math.max(1, Math.min(Number(wordCountInput.value) || 10, usableWords.length, 50));
  const chosen = shuffle(usableWords).slice(0, requestedCount);
  const targetVocabulary = usableWords.flatMap(({ word }) => getAcceptedAnswers(word, targetCode));

  currentQuiz = chosen.map(({ lessonTitle, word }) => ({
    lessonTitle,
    prompt: getAcceptedAnswers(word, sourceCode)[0],
    acceptedAnswers: getAcceptedAnswers(word, targetCode),
    options: [],
    userAnswer: '',
    sourceCode,
    targetCode,
    isCorrect: false,
    isSpellingSlip: false,
    isIncorrect: false,
  }));

  if (getQuizMode() === 'drag') {
    currentQuiz.forEach((item) => {
      item.options = buildOptions(item, targetVocabulary);
    });
    quizInstructions.textContent = 'Drag the right translation into its empty slot. On a phone or tablet, tap an answer to place it.';
  } else {
    quizInstructions.textContent = `Type each translation in ${languageLabel(targetCode)}. One wrong letter is allowed, but we’ll show you any spelling slips.`;
  }

  renderQuiz();
  quizSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
  resultDetails.replaceChildren();
};

const chooseOption = (questionIndex, optionIndex) => {
  const item = currentQuiz[questionIndex];
  if (!item || !item.options[optionIndex]) return;
  item.userAnswer = item.options[optionIndex];
  const slot = quizList.querySelector(`[data-drop-slot="${questionIndex}"]`);
  if (!slot) return;
  slot.textContent = item.userAnswer;
  slot.classList.add('has-answer');
  slot.setAttribute('aria-label', `Selected answer: ${item.userAnswer}`);
  slot.classList.remove('is-over');
};

const renderQuiz = () => {
  quizList.replaceChildren();
  currentQuiz.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'quiz-item';
    card.dataset.questionIndex = String(index);

    const prompt = document.createElement('h3');
    prompt.textContent = `${index + 1}. ${item.prompt}`;
    card.appendChild(prompt);

    if (getQuizMode() === 'type') {
      const input = document.createElement('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', `Translation for ${item.prompt}`);
      input.placeholder = `Write in ${languageLabel(item.targetCode)}`;
      input.addEventListener('input', (event) => {
        item.userAnswer = event.target.value;
      });
      card.appendChild(input);
    } else {
      const slot = document.createElement('div');
      slot.className = 'drop-slot';
      slot.dataset.dropSlot = String(index);
      slot.textContent = 'Drop the correct word here';
      slot.setAttribute('role', 'status');
      slot.setAttribute('aria-label', 'Empty answer slot');
      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
        slot.classList.add('is-over');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('is-over'));
      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        const optionIndex = Number(event.dataTransfer.getData('text/plain'));
        chooseOption(index, optionIndex);
      });
      card.appendChild(slot);

      const options = document.createElement('div');
      options.className = 'answer-options';
      options.setAttribute('aria-label', `Answer choices for ${item.prompt}`);
      item.options.forEach((option, optionIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'answer-option';
        button.textContent = option;
        button.draggable = true;
        button.addEventListener('dragstart', (event) => {
          event.dataTransfer.setData('text/plain', String(optionIndex));
          event.dataTransfer.effectAllowed = 'copy';
        });
        button.addEventListener('click', () => chooseOption(index, optionIndex));
        options.appendChild(button);
      });
      card.appendChild(options);
    }
    quizList.appendChild(card);
  });
};

const applyResultStyles = () => {
  currentQuiz.forEach((item, index) => {
    const card = quizList.querySelector(`[data-question-index="${index}"]`);
    if (!card) return;
    card.classList.remove('is-correct', 'is-spelling-slip', 'is-incorrect');
    if (item.isCorrect) {
      card.classList.add('is-correct');
    } else if (item.isSpellingSlip) {
      card.classList.add('is-spelling-slip');
    } else if (item.isIncorrect) {
      card.classList.add('is-incorrect');
    }

    const inputOrSlot = getQuizMode() === 'type'
      ? card.querySelector('input')
      : card.querySelector('.drop-slot');

    if (inputOrSlot) {
      inputOrSlot.classList.remove('is-correct', 'is-spelling-slip', 'is-incorrect');
      if (item.isCorrect) {
        inputOrSlot.classList.add('is-correct');
      } else if (item.isSpellingSlip) {
        inputOrSlot.classList.add('is-spelling-slip');
      } else if (item.isIncorrect) {
        inputOrSlot.classList.add('is-incorrect');
      }
    }
  });
};

const addResultLine = (list, text, className) => {
  const line = document.createElement('li');
  line.className = className;
  line.textContent = text;
  list.appendChild(line);
};

const submitQuiz = () => {
  if (!currentQuiz.length) {
    resultSection.classList.remove('hidden');
    resultSummary.textContent = 'Start a quiz before checking your answers.';
    return;
  }

  let errors = 0;
  const spellingSlips = [];
  const incorrect = [];

  currentQuiz.forEach((item) => {
    const exact = item.acceptedAnswers.some((answer) => normalizeText(answer) === normalizeText(item.userAnswer));
    if (exact) {
      item.isCorrect = true;
      item.isSpellingSlip = false;
      item.isIncorrect = false;
      return;
    }

    const nearMatch = getQuizMode() === 'type'
      ? item.acceptedAnswers.find((answer) => hasOneSpellingError(item.userAnswer, answer))
      : null;
    if (nearMatch) {
      item.isCorrect = false;
      item.isSpellingSlip = true;
      item.isIncorrect = false;
      spellingSlips.push(`${item.prompt}: you wrote “${item.userAnswer}”; correct spelling: “${nearMatch}”. Counted as correct.`);
      return;
    }

    item.isCorrect = false;
    item.isSpellingSlip = false;
    item.isIncorrect = true;
    errors += 1;
    incorrect.push(`${item.prompt} → ${item.acceptedAnswers.join(' / ')}`);
  });

  applyResultStyles();

  resultSummary.textContent = errors === 0
    ? `Great job! No incorrect answers. (${spellingSlips.length} spelling slip${spellingSlips.length === 1 ? '' : 's'} counted as correct.)`
    : `You got ${errors} answer${errors === 1 ? '' : 's'} wrong. ${spellingSlips.length} spelling slip${spellingSlips.length === 1 ? '' : 's'} counted as correct.`;
  resultDetails.replaceChildren();

  if (spellingSlips.length) {
    const heading = document.createElement('h3');
    heading.textContent = 'Check your spelling';
    const list = document.createElement('ul');
    spellingSlips.forEach((line) => addResultLine(list, line, 'spelling-slip'));
    resultDetails.append(heading, list);
  }
  if (incorrect.length) {
    const heading = document.createElement('h3');
    heading.textContent = 'Answers to review';
    const list = document.createElement('ul');
    incorrect.forEach((line) => addResultLine(list, line, 'incorrect-answer'));
    resultDetails.append(heading, list);
  }
  resultSection.classList.remove('hidden');
};

sourceLanguage.addEventListener('change', () => {
  if (sourceLanguage.value === targetLanguage.value) targetLanguage.value = sourceLanguage.value === 'en' ? 'cs' : 'en';
});
targetLanguage.addEventListener('change', () => {
  if (sourceLanguage.value === targetLanguage.value) sourceLanguage.value = targetLanguage.value === 'en' ? 'cs' : 'en';
});
generateQuizBtn.addEventListener('click', generateQuiz);
submitQuizBtn.addEventListener('click', submitQuiz);
loadVocabulary();
