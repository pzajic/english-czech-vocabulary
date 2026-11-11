const lessonList = document.getElementById('lessonList');
const quizList = document.getElementById('quizList');
const quizSection = document.getElementById('quizSection');
const resultSection = document.getElementById('resultSection');
const resultSummary = document.getElementById('resultSummary');
const sourceLanguage = document.getElementById('sourceLanguage');
const targetLanguage = document.getElementById('targetLanguage');
const wordCountInput = document.getElementById('wordCount');
const generateQuizBtn = document.getElementById('generateQuizBtn');
const submitQuizBtn = document.getElementById('submitQuizBtn');

let vocabulary = { lessons: [] };
let currentQuiz = [];

const normalizeText = (text = '') =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getLanguageCodeLabel = (code) => {
  if (code === 'en') return 'English';
  if (code === 'cs') return 'Czech';
  return code;
};

const loadVocabulary = async () => {
  try {
    const response = await fetch('data/vocabulary.json');
    if (!response.ok) {
      throw new Error('Could not load vocabulary file.');
    }
    vocabulary = await response.json();
    renderLessons();
    selectAllLessons();
  } catch (error) {
    lessonList.innerHTML = '<p>Unable to load vocabulary data.</p>';
    console.error(error);
  }
};

const renderLessons = () => {
  lessonList.innerHTML = '';

  vocabulary.lessons.forEach((lesson) => {
    const item = document.createElement('label');
    item.className = 'lesson-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.value = lesson.id;
    checkbox.name = 'lesson';

    const text = document.createElement('span');
    text.textContent = lesson.title;

    item.appendChild(checkbox);
    item.appendChild(text);
    lessonList.appendChild(item);
  });
};

const selectAllLessons = () => {
  document.querySelectorAll('input[name="lesson"]').forEach((checkbox) => {
    checkbox.checked = true;
  });
};

const getSelectedLessons = () => {
  const checked = [...document.querySelectorAll('input[name="lesson"]:checked')];
  const selectedIds = checked.map((item) => item.value);

  return vocabulary.lessons.filter((lesson) => selectedIds.includes(lesson.id));
};

const getWordOptionsForLocale = (word, sourceCode, targetCode) => {
  const sourceText = word[sourceCode];
  const targetText = word[targetCode];

  if (Array.isArray(targetText)) {
    return { prompt: sourceText, acceptedAnswers: targetText };
  }

  return {
    prompt: sourceText,
    acceptedAnswers: Array.isArray(word[targetCode]) ? word[targetCode] : [word[targetCode] || ''],
  };
};

const generateQuiz = () => {
  const selectedLessons = getSelectedLessons();
  const totalWords = selectedLessons.reduce((sum, lesson) => sum + lesson.words.length, 0);

  if (totalWords === 0) {
    resultSection.classList.remove('hidden');
    resultSummary.textContent = 'Please select at least one lesson.';
    quizSection.classList.add('hidden');
    return;
  }

  const requestedCount = Math.min(Number(wordCountInput.value) || 10, totalWords);
  const wordPool = [];

  selectedLessons.forEach((lesson) => {
    lesson.words.forEach((word) => {
      wordPool.push({ lessonTitle: lesson.title, word });
    });
  });

  const shuffled = [...wordPool].sort(() => Math.random() - 0.5);
  const chosenWords = shuffled.slice(0, requestedCount);

  currentQuiz = chosenWords.map(({ lessonTitle, word }) => {
    const sourceCode = sourceLanguage.value;
    const targetCode = targetLanguage.value;
    const promptValue = word[sourceCode];
    const acceptedAnswers = Array.isArray(word[targetCode]) ? word[targetCode] : [word[targetCode]];

    return {
      lessonTitle,
      prompt: typeof promptValue === 'string' ? promptValue : String(promptValue),
      acceptedAnswers: acceptedAnswers.filter(Boolean),
      userAnswer: '',
      sourceCode,
      targetCode,
    };
  });

  renderQuiz();
  quizSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
};

const renderQuiz = () => {
  quizList.innerHTML = '';

  currentQuiz.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'quiz-item';

    const label = document.createElement('strong');
    label.textContent = `${index + 1}. ${item.lessonTitle} — ${getLanguageCodeLabel(item.sourceCode)}: ${item.prompt}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Translate to ${getLanguageCodeLabel(item.targetCode)}`;
    input.value = item.userAnswer;
    input.dataset.index = String(index);

    input.addEventListener('input', (event) => {
      currentQuiz[index].userAnswer = event.target.value;
    });

    card.appendChild(label);
    card.appendChild(input);
    quizList.appendChild(card);
  });
};

const submitQuiz = () => {
  if (!currentQuiz.length) {
    resultSection.classList.remove('hidden');
    resultSummary.textContent = 'Generate a quiz before submitting.';
    return;
  }

  let errors = 0;
  const correctAnswers = [];

  currentQuiz.forEach((item) => {
    const submittedAnswer = normalizeText(item.userAnswer);
    const acceptedAnswers = item.acceptedAnswers.map((answer) => normalizeText(answer));
    const isCorrect = acceptedAnswers.includes(submittedAnswer);

    if (!isCorrect) {
      errors += 1;
      correctAnswers.push(`${item.prompt} → ${item.acceptedAnswers.join(' / ')}`);
    }
  });

  resultSection.classList.remove('hidden');
  resultSummary.textContent = `You made ${errors} error${errors === 1 ? '' : 's'}.`;

  if (correctAnswers.length) {
    const details = document.createElement('div');
    details.innerHTML = `<p><strong>Correct answers:</strong></p><ul>${correctAnswers
      .map((answer) => `<li>${answer}</li>`)
      .join('')}</ul>`;
    resultSection.appendChild(details);
  }
};

sourceLanguage.addEventListener('change', () => {
  if (sourceLanguage.value === targetLanguage.value) {
    targetLanguage.value = sourceLanguage.value === 'en' ? 'cs' : 'en';
  }
});

targetLanguage.addEventListener('change', () => {
  if (sourceLanguage.value === targetLanguage.value) {
    sourceLanguage.value = targetLanguage.value === 'en' ? 'cs' : 'en';
  }
});

generateQuizBtn.addEventListener('click', generateQuiz);
submitQuizBtn.addEventListener('click', submitQuiz);

loadVocabulary();
