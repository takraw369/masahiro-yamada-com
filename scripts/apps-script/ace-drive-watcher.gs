const ACE_ASSET_INBOX_FOLDER_ID = '1fQgmupO4w7oZfhKSFEselFzc651gkqE4';
const ACE_DRIVE_INGEST_ENDPOINT = 'https://masahiroyamada.com/api/internal/ace-drive-ingest';
const ACE_DRIVE_INGEST_SECRET_PROPERTY = 'ACE_DRIVE_INGEST_SECRET';
const ACE_DRIVE_SEEN_PREFIX = 'ACE_DRIVE_SEEN_';

/**
 * Production Drive watcher for ACE learning assets.
 *
 * Scope is intentionally narrow:
 * - direct child files of ACE_ASSET_INBOX only;
 * - no recursive Drive scan;
 * - every registration is forced to Draft by the MASA API;
 * - Drive file ID is the stable source_ref, so retries are idempotent server-side.
 */
function aceDriveWatch() {
  const secret = PropertiesService.getScriptProperties().getProperty(ACE_DRIVE_INGEST_SECRET_PROPERTY);
  if (!secret) throw new Error('ACE_DRIVE_INGEST_SECRET is not configured in Script Properties');

  const folder = DriveApp.getFolderById(ACE_ASSET_INBOX_FOLDER_ID);
  const files = folder.getFiles();
  const properties = PropertiesService.getScriptProperties();
  const results = [];

  while (files.hasNext()) {
    const file = files.next();
    const fileId = file.getId();
    const seenKey = `${ACE_DRIVE_SEEN_PREFIX}${fileId}`;
    if (properties.getProperty(seenKey)) continue;

    const payload = buildAceAssetPayload_(file);
    const response = UrlFetchApp.fetch(ACE_DRIVE_INGEST_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${secret}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();
    const text = response.getContentText();
    if (status < 200 || status >= 300) {
      console.error(`ACE ingest failed for ${file.getName()} (${fileId}): ${status} ${text.slice(0, 500)}`);
      results.push({ fileId, title: file.getName(), ok: false, status });
      continue;
    }

    properties.setProperty(seenKey, new Date().toISOString());
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_) {
      // Successful registration is enough; response parsing is only for logs.
    }
    console.log(`ACE draft registered: ${file.getName()} (${fileId})`);
    results.push({ fileId, title: file.getName(), ok: true, status, data });
  }

  return results;
}

/**
 * One-time installer. Run manually after setting ACE_DRIVE_INGEST_SECRET.
 * Re-running is safe: existing aceDriveWatch triggers are replaced.
 */
function installAceDriveWatcher() {
  const secret = PropertiesService.getScriptProperties().getProperty(ACE_DRIVE_INGEST_SECRET_PROPERTY);
  if (!secret) throw new Error('Set ACE_DRIVE_INGEST_SECRET in Script Properties before installing');

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'aceDriveWatch')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('aceDriveWatch')
    .timeBased()
    .everyMinutes(1)
    .create();

  return aceDriveWatch();
}

function uninstallAceDriveWatcher() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'aceDriveWatch')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

/**
 * Removes the local seen marker for one Drive file. The MASA API remains
 * idempotent, so a retry updates the same runtime asset instead of duplicating it.
 */
function retryAceDriveFile(fileId) {
  if (!fileId || typeof fileId !== 'string') throw new Error('fileId is required');
  PropertiesService.getScriptProperties().deleteProperty(`${ACE_DRIVE_SEEN_PREFIX}${fileId}`);
  return aceDriveWatch();
}

function buildAceAssetPayload_(file) {
  const mimeType = file.getMimeType();
  return {
    folderId: ACE_ASSET_INBOX_FOLDER_ID,
    fileId: file.getId(),
    title: file.getName(),
    summary: file.getDescription() || '',
    assetType: inferAceAssetType_(mimeType, file.getName()),
    assetUrl: file.getUrl(),
    mimeType,
    createdTime: file.getDateCreated().toISOString(),
    modifiedTime: file.getLastUpdated().toISOString(),
    tags: inferAceTags_(file.getName()),
  };
}

function inferAceAssetType_(mimeType, fileName) {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();

  if (mime === 'application/vnd.google-apps.presentation' || /\.(ppt|pptx|odp)$/.test(name)) return 'slide';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/vnd.google-apps.spreadsheet' || /\.(xls|xlsx|csv)$/.test(name)) return 'worksheet';
  if (/quest|クエスト/.test(name)) return 'quest';
  if (/reflection|振り返り|ふりかえり/.test(name)) return 'reflection';
  return 'guide';
}

function inferAceTags_(fileName) {
  const source = String(fileName || '').toLowerCase();
  const rules = [
    ['body', ['body', '身体', '睡眠', '呼吸', '運動']],
    ['mind', ['mind', 'メンタル', '感情', '認知', '心理']],
    ['food-health', ['食', '健康', '栄養', '薬膳', '腸', '油']],
    ['learning', ['学習', '教育', '学び', '勉強']],
    ['relationships', ['関係', '対話', '家族', 'コミュニケーション']],
    ['ai-creation', ['ai', '生成', '自動化', 'content', 'コンテンツ']],
    ['athlete', ['athlete', 'アスリート', '競技', 'スポーツ', 'セパタクロー']],
    ['world-quest', ['歴史', '文化', '宗教', '哲学', '世界']],
  ];

  return rules
    .filter(([, keywords]) => keywords.some((keyword) => source.includes(keyword)))
    .map(([tag]) => tag)
    .slice(0, 8);
}
