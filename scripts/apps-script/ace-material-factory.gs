const ACE_MATERIAL_CONTENT_OS_ID = '1mB9ZodA700hd3IRnV2Ijp-4tQ3_Y1tg_ZwGKOq_DWA8';
const ACE_MATERIAL_CONTENT_OS_SHEET = '01_MASTER';
const ACE_MATERIAL_DRAFT_FOLDER_ID = '1niiAcO4AdLxqx4PohdhWS_-6RtKLgkzo';
const ACE_MATERIAL_INBOX_FOLDER_ID = '1fQgmupO4w7oZfhKSFEselFzc651gkqE4';
const ACE_MATERIAL_GEMINI_KEY_PROPERTY = 'GEMINI_API_KEY';
const ACE_MATERIAL_MODEL_PROPERTY = 'ACE_MATERIAL_MODEL';
const ACE_MATERIAL_DEFAULT_MODEL = 'gemini-3.5-flash';
const ACE_MATERIAL_DONE_PREFIX = 'ACE_MATERIAL_DONE_';
const ACE_MATERIAL_MAX_SOURCE_CHARS = 30000;

/**
 * ACE Material Factory
 *
 * CONTENT_OS is the candidate ledger. The factory creates at most one pending
 * draft at a time, so MASA stays the editor / human gate instead of being
 * flooded with generated material.
 *
 * Flow:
 * CONTENT_OS -> Gemini draft -> ACE_MATERIAL_DRAFTS -> MASA edits
 * -> rename DRAFT|... to APPROVED|... -> ACE_ASSET_INBOX -> existing watcher
 */
function aceMaterialFactory() {
  const key = getAceMaterialGeminiKey_();
  const draftFolder = DriveApp.getFolderById(ACE_MATERIAL_DRAFT_FOLDER_ID);

  const pending = findPendingAceMaterialDraft_(draftFolder);
  if (pending) {
    console.log(`ACE material factory idle: pending draft ${pending.getName()}`);
    return { ok: true, action: 'waiting_for_masa', fileId: pending.getId(), title: pending.getName() };
  }

  const candidate = pickNextAceMaterialCandidate_();
  if (!candidate) {
    console.log('ACE material factory idle: no eligible CONTENT_OS candidate');
    return { ok: true, action: 'no_candidate' };
  }

  const sourceText = readAceMaterialSource_(candidate.sourceUrl);
  if (!sourceText || sourceText.trim().length < 200) {
    console.warn(`ACE material source skipped: ${candidate.assetId} has insufficient readable text`);
    return { ok: false, action: 'source_unreadable', assetId: candidate.assetId };
  }

  const draftText = generateAceMaterialDraft_(key, candidate, sourceText);
  const titleBase = candidate.proposedName || candidate.currentTitle || candidate.assetId;
  const title = `DRAFT｜[${candidate.assetId}] ${titleBase}｜ACE教材 v0.1`;
  const doc = DocumentApp.create(title);
  const body = doc.getBody();
  body.clear();
  body.appendParagraph(draftText);
  body.appendParagraph('');
  body.appendParagraph('---');
  body.appendParagraph(`SOURCE ASSET: ${candidate.assetId}`);
  body.appendParagraph(`SOURCE URL: ${candidate.sourceUrl}`);
  body.appendParagraph('APPROVAL: 編集が終わったらファイル名の先頭を DRAFT｜ から APPROVED｜ に変更する。');
  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(draftFolder);

  PropertiesService.getScriptProperties().setProperty(
    `${ACE_MATERIAL_DONE_PREFIX}${candidate.assetId}`,
    JSON.stringify({ draftFileId: doc.getId(), createdAt: new Date().toISOString() })
  );

  console.log(`ACE material draft created: ${title}`);
  return {
    ok: true,
    action: 'draft_created',
    assetId: candidate.assetId,
    fileId: doc.getId(),
    url: doc.getUrl(),
    title,
  };
}

/**
 * Human gate watcher.
 * MASA's approval signal is only a rename:
 * DRAFT|... -> APPROVED|... (or READY|...).
 * The approved file is moved to ACE_ASSET_INBOX and the existing Drive watcher
 * performs runtime registration as Draft. Nothing here auto-publishes Live.
 */
function aceMaterialApprovalWatch() {
  const draftFolder = DriveApp.getFolderById(ACE_MATERIAL_DRAFT_FOLDER_ID);
  const inboxFolder = DriveApp.getFolderById(ACE_MATERIAL_INBOX_FOLDER_ID);
  const files = draftFolder.getFiles();
  const moved = [];

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (!/^(APPROVED|READY)｜/i.test(name)) continue;

    const cleanName = name.replace(/^(APPROVED|READY)｜/i, 'ACE｜');
    file.setName(cleanName);
    file.moveTo(inboxFolder);
    moved.push({ fileId: file.getId(), title: cleanName });
    console.log(`ACE material approved -> inbox: ${cleanName}`);
  }

  return { ok: true, moved };
}

/**
 * One-time installer. Safe to run again.
 * - Factory checks hourly but creates nothing while a DRAFT is waiting.
 * - Approval watcher checks every five minutes.
 */
function installAceMaterialFactory() {
  getAceMaterialGeminiKey_();

  const handlers = new Set(['aceMaterialFactory', 'aceMaterialApprovalWatch']);
  ScriptApp.getProjectTriggers()
    .filter((trigger) => handlers.has(trigger.getHandlerFunction()))
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('aceMaterialFactory')
    .timeBased()
    .everyHours(1)
    .create();

  ScriptApp.newTrigger('aceMaterialApprovalWatch')
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    factory: aceMaterialFactory(),
    approval: aceMaterialApprovalWatch(),
  };
}

function uninstallAceMaterialFactory() {
  const handlers = new Set(['aceMaterialFactory', 'aceMaterialApprovalWatch']);
  ScriptApp.getProjectTriggers()
    .filter((trigger) => handlers.has(trigger.getHandlerFunction()))
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

/** Reset one CONTENT_OS asset so it can be regenerated. */
function retryAceMaterialAsset(assetId) {
  if (!assetId || typeof assetId !== 'string') throw new Error('assetId is required');
  PropertiesService.getScriptProperties().deleteProperty(`${ACE_MATERIAL_DONE_PREFIX}${assetId.trim()}`);
  return aceMaterialFactory();
}

function getAceMaterialGeminiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty(ACE_MATERIAL_GEMINI_KEY_PROPERTY);
  if (!key) throw new Error('GEMINI_API_KEY is not configured in Script Properties');
  return key.trim();
}

function getAceMaterialModel_() {
  return (
    PropertiesService.getScriptProperties().getProperty(ACE_MATERIAL_MODEL_PROPERTY) ||
    ACE_MATERIAL_DEFAULT_MODEL
  ).trim();
}

function findPendingAceMaterialDraft_(folder) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (/^DRAFT｜/i.test(file.getName())) return file;
  }
  return null;
}

function pickNextAceMaterialCandidate_() {
  const sheet = SpreadsheetApp.openById(ACE_MATERIAL_CONTENT_OS_ID)
    .getSheetByName(ACE_MATERIAL_CONTENT_OS_SHEET);
  if (!sheet) throw new Error(`CONTENT_OS sheet not found: ${ACE_MATERIAL_CONTENT_OS_SHEET}`);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;

  const headers = values[0].map((value) => String(value || '').trim());
  const index = {};
  headers.forEach((header, i) => { index[header] = i; });

  const required = ['Asset ID', 'Genre', 'Current title', 'Proposed naming / direction', 'Sell readiness', 'Productization status', 'Rights / source', 'Product format candidate', 'Target', 'Next action', 'Source URL', 'Related project'];
  required.forEach((header) => {
    if (index[header] === undefined) throw new Error(`CONTENT_OS header missing: ${header}`);
  });

  const props = PropertiesService.getScriptProperties();
  const candidates = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const assetId = String(row[index['Asset ID']] || '').trim();
    const genre = String(row[index['Genre']] || '').trim();
    const readiness = String(row[index['Sell readiness']] || '').trim().toUpperCase();
    const status = String(row[index['Productization status']] || '').trim().toUpperCase();
    const rights = String(row[index['Rights / source']] || '').trim();
    const sourceUrl = String(row[index['Source URL']] || '').trim();

    if (!assetId || !sourceUrl) continue;
    if (!['S', 'A'].includes(readiness)) continue;
    if (!/(BUILD|CANONICAL)/.test(status)) continue;
    if (/REFERENCE/.test(status) || /参考資料限定/.test(rights)) continue;
    // Political source material is not autonomously turned into persuasive lessons.
    if (/POLITIC|政治/i.test(genre)) continue;
    if (props.getProperty(`${ACE_MATERIAL_DONE_PREFIX}${assetId}`)) continue;

    candidates.push({
      rowIndex: rowIndex + 1,
      assetId,
      genre,
      currentTitle: String(row[index['Current title']] || '').trim(),
      proposedName: String(row[index['Proposed naming / direction']] || '').trim(),
      readiness,
      status,
      rights,
      format: String(row[index['Product format candidate']] || '').trim(),
      target: String(row[index['Target']] || '').trim(),
      nextAction: String(row[index['Next action']] || '').trim(),
      sourceUrl,
      relatedProject: String(row[index['Related project']] || '').trim(),
    });
  }

  const readinessScore = { S: 20, A: 10 };
  candidates.sort((a, b) => {
    const scoreA = (readinessScore[a.readiness] || 0) + (/CANONICAL/.test(a.status) ? 5 : 0) + (/BUILD/.test(a.status) ? 2 : 0);
    const scoreB = (readinessScore[b.readiness] || 0) + (/CANONICAL/.test(b.status) ? 5 : 0) + (/BUILD/.test(b.status) ? 2 : 0);
    return scoreB - scoreA || a.rowIndex - b.rowIndex;
  });

  return candidates[0] || null;
}

function readAceMaterialSource_(sourceUrl) {
  const fileId = extractGoogleFileId_(sourceUrl);
  if (!fileId) throw new Error(`Could not extract Drive file ID from source URL: ${sourceUrl}`);

  const file = DriveApp.getFileById(fileId);
  const mimeType = file.getMimeType();
  let text = '';

  if (mimeType === MimeType.GOOGLE_DOCS) {
    text = DocumentApp.openById(fileId).getBody().getText();
  } else if (mimeType === MimeType.GOOGLE_SHEETS) {
    const book = SpreadsheetApp.openById(fileId);
    const chunks = [];
    book.getSheets().slice(0, 8).forEach((sheet) => {
      const values = sheet.getDataRange().getDisplayValues();
      chunks.push(`# SHEET: ${sheet.getName()}`);
      values.slice(0, 250).forEach((row) => chunks.push(row.join('\t')));
    });
    text = chunks.join('\n');
  } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    text = file.getBlob().getDataAsString('UTF-8');
  } else {
    throw new Error(`Unsupported source MIME type for autonomous material generation: ${mimeType}`);
  }

  return String(text || '').slice(0, ACE_MATERIAL_MAX_SOURCE_CHARS);
}

function extractGoogleFileId_(url) {
  const match = String(url || '').match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function generateAceMaterialDraft_(apiKey, candidate, sourceText) {
  const model = getAceMaterialModel_();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const systemInstruction = [
    'あなたはACEの教材編集者。完成原稿を断定的に量産するのではなく、MASAが短時間で直せる強い初稿を作る。',
    '元資料の長文コピーは禁止。要点を再構成し、教材として独自に書き直す。',
    'MASA固有の経験・語り・判断が必要な箇所には、必ず「🟠 MASA REVIEW：」で具体的な編集質問を入れる。',
    '事実と本人の解釈を分ける。科学・健康・医療・第三者理論の主張は必要に応じて「[要出典確認]」を付ける。',
    '健康テーマでは診断・治療・治癒を断定しない。実践案は一般的な教育情報として書く。',
    '政治的テーマは扱わない。',
    '読者が受け身で読むだけでなく、最後に小さな行動・観察・振り返りへ移れる構成にする。',
    '出力は日本語Markdownのみ。コードフェンスは付けない。',
  ].join('\n');

  const prompt = [
    `CONTENT_OS Asset ID: ${candidate.assetId}`,
    `Genre: ${candidate.genre}`,
    `Current title: ${candidate.currentTitle}`,
    `Proposed naming: ${candidate.proposedName}`,
    `Product format: ${candidate.format}`,
    `Target: ${candidate.target}`,
    `Related project: ${candidate.relatedProject}`,
    `Next action: ${candidate.nextAction}`,
    '',
    '以下のSOURCEからACE教材v0.1を作る。',
    '',
    '必須構成:',
    '1. タイトル',
    '2. この教材で何が変わるか（1〜3文）',
    '3. 直感で掴める全体像',
    '4. 3〜7個の主要セクション',
    '5. 各セクションに具体例または問い',
    '6. 3〜5分でできるMini Quest',
    '7. 振り返り3問',
    '8. MASA REVIEW候補まとめ（最大5点）',
    '',
    'SOURCE:',
    sourceText,
  ].join('\n');

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 6500,
      },
    }),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const raw = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`Gemini material generation failed: HTTP ${status} ${raw.slice(0, 500)}`);
  }

  const data = JSON.parse(raw);
  const parts = (((data || {}).candidates || [])[0] || {}).content?.parts || [];
  const text = parts.map((part) => part.text || '').join('\n').trim();
  if (!text) throw new Error('Gemini material generation returned no text');
  return text;
}
