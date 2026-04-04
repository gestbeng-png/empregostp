function normalizeOption(value = '') {
  return String(value || '').trim();
}

export function normalizeSkillsAssessmentInput(input) {
  const enabled = Boolean(input?.enabled);
  const passingScoreRaw = Number.parseInt(input?.passingScore, 10);
  const passingScore = Number.isFinite(passingScoreRaw)
    ? Math.min(Math.max(passingScoreRaw, 0), 100)
    : 70;

  const questions = Array.isArray(input?.questions)
    ? input.questions
        .map((question, index) => {
          const prompt = String(question?.prompt || '').trim();
          const options = Array.isArray(question?.options)
            ? question.options.map((option) => normalizeOption(option)).filter(Boolean)
            : [];
          const correctOptionIndex = Number.parseInt(question?.correctOptionIndex, 10);

          if (!prompt || options.length < 2 || !Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
            return null;
          }

          return {
            id: question?.id || `q${index + 1}`,
            prompt,
            options,
            correctOptionIndex
          };
        })
        .filter(Boolean)
        .slice(0, 10)
    : [];

  return {
    enabled: enabled && questions.length > 0,
    passingScore,
    questions
  };
}

export function getPublicSkillsAssessment(assessment) {
  if (!assessment?.enabled || !Array.isArray(assessment.questions) || assessment.questions.length === 0) {
    return null;
  }

  return {
    enabled: true,
    passingScore: assessment.passingScore ?? 70,
    questions: assessment.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: Array.isArray(question.options) ? [...question.options] : []
    }))
  };
}

export function calculateSkillsAssessmentResult(assessment, answers = []) {
  const questions = Array.isArray(assessment?.questions) ? assessment.questions : [];
  const normalizedAnswers = Array.isArray(answers) ? answers : [];

  let correctAnswers = 0;
  const responses = questions.map((question, index) => {
    const selectedOptionIndex = Number.parseInt(normalizedAnswers[index], 10);
    const isValidSelection = Number.isInteger(selectedOptionIndex) && selectedOptionIndex >= 0 && selectedOptionIndex < question.options.length;
    const isCorrect = isValidSelection && selectedOptionIndex === question.correctOptionIndex;

    if (isCorrect) {
      correctAnswers += 1;
    }

    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedOptionIndex: isValidSelection ? selectedOptionIndex : null,
      selectedOption: isValidSelection ? question.options[selectedOptionIndex] : null,
      correctOptionIndex: question.correctOptionIndex,
      correctOption: question.options[question.correctOptionIndex] || null,
      isCorrect
    };
  });

  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return {
    totalQuestions,
    correctAnswers,
    score,
    passed: score >= (assessment?.passingScore ?? 70),
    responses
  };
}
