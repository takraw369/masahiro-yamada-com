// Presentation-only guidance using answers already submitted by the mental-check form.
// No health diagnosis, no extra data collection and no new tracking store.
const asText = (value) => String(Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim();
const answerFor = (answers, key) => Array.isArray(answers)
  ? answers.find((answer) => answer?.questionKey === key)?.value
  : undefined;
const isYes = (value) => /^(true|yes|1|はい|希望する)$/i.test(asText(value));
// Read-only interpretation of the current mental_condition_lead_v1 option keys.
// These are routing hints, not diagnostic scores or medical judgments.
const problemGuides = {
  pressure: ['緊張・感情との向き合い方', '本番で揺れた瞬間のサインと、次の一動作に注意を戻す合図を一つずつ決めましょう。'],
  mistake: ['ミスのあとの切り替え', '直近のミスを一つ振り返り、次のプレーに戻るための合図を一つ決めましょう。'],
  confidence: ['自信の根拠を見つける', 'うまくできた場面を一つ思い出し、次も再現できる行動を一つ書きましょう。'],
  direction: ['目標と次の一手', '次の目標を一文で書き、24時間以内に始められる最小の一手へ分解しましょう。'],
  continuity: ['行動・習慣の再現性', '次の2日間だけ試す行動を一つ決め、「いつ・どこで始めるか」を書きましょう。'],
  motivation: ['意欲の波との付き合い方', '調子が出ない日にも始められる、小さな行動を一つ決めておきましょう。'],
  relationship: ['対話と期待の整理', '相手への期待と自分から伝えたいことを、一つずつ書き分けてみましょう。'],
  body: ['身体・コンディション', '次の大事な場面の前後で、呼吸・姿勢・疲れのサインを一つだけ記録しましょう。'],
  verbalize: ['状態の言語化', '直近の出来事について、身体の感覚・気持ち・行動を一語ずつメモしましょう。'],
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
  const knownProblem = Object.prototype.hasOwnProperty.call(problemGuides, problemKey)
    ? problemGuides[problemKey] : null;
  const topic = knownProblem
    ? { focus: knownProblem[0], action: knownProblem[1] }
    : topicRules.find((entry) => entry.match.test(selectedProblem));
  const urgency = Number(asText(answerFor(answers, 'mental_v1_urgency')));
  const followupRequested = isYes(answerFor(answers, 'mental_v1_feedback_interest'));
  const supportFormat = asText(answerFor(answers, 'mental_v1_support_format'));
  const supportInterest = answerFor(answers, 'mental_v1_support_interest');
  const interestOptions = Array.isArray(supportInterest) ? supportInterest : [supportInterest];
  // "info"/"unknown", self-study and group learning are NOT purchase intent.
  const coachingRequested = interestOptions.some((value) => asText(value) === 'coaching');
  const individualSupportRequested = supportFormat === 'single' || supportFormat === 'ongoing';
  const highIntent = followupRequested || (
    Number.isFinite(urgency) && urgency >= 4 && (coachingRequested || individualSupportRequested)
  );
  const role = asText(answerFor(answers, 'mental_v1_role'));
  const isParentOrCoach = /parent|coach|guardian|保護者|親|指導者|コーチ/i.test(role);
  const offerFit = highIntent && (!isParentOrCoach || followupRequested);

  return {
    focus: topic?.focus || (problemLabel && !/^other$/i.test(problemKey)
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
