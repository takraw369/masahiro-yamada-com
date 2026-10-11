// Presentation-only guidance using answers already submitted by the mental-check form.
// No health diagnosis, no extra data collection and no new tracking store.
const asText = (value) => String(Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim();
const answerFor = (answers, key) => Array.isArray(answers)
  ? answers.find((answer) => answer?.questionKey === key)?.value
  : undefined;
const isYes = (value) => /^(true|yes|1|はい|希望する)$/i.test(asText(value));
const hasInterest = (value) => {
  const text = asText(value);
  return Boolean(text) && !/^(false|no|none|0|いいえ|希望しない|不要)$/i.test(text);
};
const topicRules = [
  { match: /身体|体調|疲労|睡眠|コンディション|body|fatigue|sleep/i,
    focus: '身体・コンディション',
    action: '次の大事な場面の前後で、呼吸・姿勢・疲れのサインを一つだけ記録しましょう。' },
  { match: /緊張|不安|焦り|感情|プレッシャー|mental|emotion|stress|anxiety|nervous/i,
    focus: '緊張・感情との向き合い方',
    action: '本番で揺れた瞬間のサインと、次の一動作に注意を戻す合図を一つずつ決めましょう。' },
  { match: /習慣|行動|継続|集中|先延ばし|behavior|habit|focus|routine/i,
    focus: '行動・習慣の再現性',
    action: '明日やる行動を一つだけ決め、「いつ・どこで始めるか」を書き出しましょう。' },
  { match: /目標|方向|目的|計画|goal|direction|plan/i,
    focus: '目標と次の一手',
    action: '次の目標を一文で書き、24時間以内に始められる最小の一手へ分解しましょう。' },
];

export function buildMentalCheckRecommendation(answers, questions = [], followupConsent = false) {
  const problemKey = asText(answerFor(answers, 'mental_v1_main_problem'));
  const problemQuestion = Array.isArray(questions)
    ? questions.find((q) => q?.question_key === 'mental_v1_main_problem')
    : null;
  const problemLabel = problemQuestion?.options?.find((o) => o?.option_key === problemKey)?.label;
  const selectedProblem = asText(problemLabel || problemKey).slice(0, 80);
  const topic = topicRules.find((entry) => entry.match.test(selectedProblem));
  const urgency = Number(asText(answerFor(answers, 'mental_v1_urgency')));
  const followupRequested = isYes(answerFor(answers, 'mental_v1_feedback_interest'));
  const supportFormat = asText(answerFor(answers, 'mental_v1_support_format'));
  const supportInterest = answerFor(answers, 'mental_v1_support_interest');
  const wantsSupport = hasInterest(supportInterest) || /single|ongoing|個別|継続|単発/i.test(supportFormat);
  const highIntent = followupRequested || (Number.isFinite(urgency) && urgency >= 4 && wantsSupport);
  const role = asText(answerFor(answers, 'mental_v1_role'));
  const isParentOrCoach = /parent|coach|guardian|保護者|親|指導者|コーチ/i.test(role);
  const offerFit = highIntent && (!isParentOrCoach || followupRequested);

  return {
    focus: topic?.focus || (selectedProblem && !/^other|unknown|none$/i.test(selectedProblem)
      ? selectedProblem : '目標・身体・感情・行動のつながり'),
    nextAction: topic?.action || '直近の大事な場面を一つ振り返り、「最初のサイン」と「次の一手」を短く書き出しましょう。',
    primary: offerFit ? 'line' : 'toolkit',
    guidance: offerFit
      ? followupConsent
        ? '個別の整理をご希望なら、LINEでも「勝ち筋」と送ってください。送信済みの連絡先への返信を保証するものではありません。'
        : '個別に整理したい場合は、LINEで「勝ち筋」と送ってください。匿名回答から自動でご連絡することはありません。'
      : 'まずはセルフワークの入口をご覧ください。教材は先行プレビューです。個別相談は任意で選べます。',
  };
}
