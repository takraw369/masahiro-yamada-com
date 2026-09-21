import { useEffect, useMemo, useState } from 'react';
import {
  SLF_FIELD_MAP_AREAS,
  SLF_FIELD_MAP_RICH_MENU_CANDIDATE,
  SLF_FIELD_MAP_SIZE,
  type LineRichMenuArea,
} from '../../lib/line-rich-menu-field-map';

type GateDecision = 'KEEP' | 'TRY_REFINE' | 'DROP' | '';

const STORAGE_KEY = 'masa:slf-field-map:human-gate';

function routeHref(area: LineRichMenuArea) {
  return area.action.type === 'uri' ? area.action.uri : '#consult';
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#56785f';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, 52);
  ctx.bezierCurveTo(5, 20, 28, -4, 64, -14);
  ctx.bezierCurveTo(66, 22, 48, 48, 0, 52);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(7, 45);
  ctx.lineTo(54, -3);
  ctx.stroke();
  ctx.restore();
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#516f60';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + 70);
  ctx.lineTo(x, y - 52);
  ctx.stroke();
  ctx.fillStyle = '#d8ac54';
  ctx.beginPath();
  ctx.moveTo(x + 6, y - 48);
  ctx.lineTo(x + 84, y - 24);
  ctx.lineTo(x + 6, y + 2);
  ctx.closePath();
  ctx.fill();
}

function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#9a7332';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  const rays = [
    [0, -62, 0, -26],
    [0, 62, 0, 26],
    [-62, 0, -26, 0],
    [62, 0, 26, 0],
    [-42, -42, -18, -18],
    [42, -42, 18, -18],
  ];
  for (const [x1, y1, x2, y2] of rays) {
    ctx.beginPath();
    ctx.moveTo(x + x1, y + y1);
    ctx.lineTo(x + x2, y + y2);
    ctx.stroke();
  }
  ctx.fillStyle = '#d9ad54';
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawDialogue(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#6d675e';
  ctx.lineWidth = 8;
  roundedRect(ctx, x - 70, y - 52, 140, 100, 34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 48);
  ctx.lineTo(x - 30, y + 75);
  ctx.lineTo(x + 10, y + 48);
  ctx.stroke();
  ctx.fillStyle = '#6d675e';
  [-34, 0, 34].forEach((offset) => {
    ctx.beginPath();
    ctx.arc(x + offset, y - 2, 7, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawFieldMap(ctx: CanvasRenderingContext2D) {
  const { width, height } = SLF_FIELD_MAP_SIZE;
  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, '#f9f5ea');
  sky.addColorStop(0.36, '#edf4ee');
  sky.addColorStop(0.72, '#e7f0ef');
  sky.addColorStop(1, '#f4efe3');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sun = ctx.createRadialGradient(1840, 280, 40, 1840, 280, 420);
  sun.addColorStop(0, 'rgba(241, 196, 92, .52)');
  sun.addColorStop(.45, 'rgba(241, 196, 92, .18)');
  sun.addColorStop(1, 'rgba(241, 196, 92, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(1280, 0, 1100, 760);

  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(430, 1180, 680, 430, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(165, 192, 169, .22)';
  ctx.beginPath();
  ctx.ellipse(2130, 1350, 760, 470, 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(111, 139, 120, .34)';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1240, 690);
  ctx.bezierCurveTo(1080, 900, 1120, 1060, 780, 1290);
  ctx.bezierCurveTo(1120, 1180, 1460, 1160, 1630, 1370);
  ctx.bezierCurveTo(1760, 1530, 2050, 1510, 2270, 1390);
  ctx.stroke();

  ctx.fillStyle = '#6e6a61';
  ctx.font = '700 34px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('SUN LOVES FLOW', 130, 104);
  ctx.fillStyle = '#9c917f';
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
  ctx.fillText('SLF FIELD MAP · STAGE 0 / EXPLORE', 130, 143);

  ctx.fillStyle = '#454a43';
  ctx.font = '600 116px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
  ctx.fillText('まだ知らない自分へ。', 150, 395);
  ctx.fillStyle = '#72766f';
  ctx.font = '500 44px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
  ctx.fillText('今の自分を知るところから、次の道がひらく。', 158, 475);

  roundedRect(ctx, 150, 545, 660, 132, 66);
  ctx.fillStyle = '#415d4b';
  ctx.fill();
  ctx.fillStyle = '#fffdf7';
  ctx.font = '700 42px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
  ctx.fillText('FLOW CHECK', 214, 626);
  ctx.font = '600 48px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
  ctx.fillText('→', 720, 625);

  ctx.fillStyle = '#8e887d';
  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
  ctx.fillText('NEXT PATHS', 142, 910);

  drawFlag(ctx, 380, 1110);
  drawSpark(ctx, 1250, 1112);
  drawDialogue(ctx, 2080, 1110);
  drawLeaf(ctx, 2290, 1410, 1.3);

  const columns = [
    { x: 165, eyebrow: 'QUEST', title: 'やってみる', note: '小さく試す。' },
    { x: 980, eyebrow: 'LEARN', title: '知ってみる', note: '必要な知識に出会う。' },
    { x: 1810, eyebrow: 'DIALOGUE', title: '話してみる', note: 'ひとりで詰まったら対話へ。' },
  ];
  for (const column of columns) {
    ctx.fillStyle = '#8c846f';
    ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
    ctx.fillText(column.eyebrow, column.x, 1315);
    ctx.fillStyle = '#484d46';
    ctx.font = '650 66px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
    ctx.fillText(column.title, column.x, 1395);
    ctx.fillStyle = '#77786f';
    ctx.font = '500 30px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
    ctx.fillText(column.note, column.x, 1455);
  }

  ctx.fillStyle = 'rgba(73, 91, 77, .62)';
  ctx.font = '600 25px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';
  ctx.fillText('PLAY → LEARN → CONNECT → ACT → CONTRIBUTE', 130, 1620);
}

export default function LineRichMenuFieldMap() {
  const [decision, setDecision] = useState<GateDecision>('');
  const [notice, setNotice] = useState('');

  const json = useMemo(
    () => JSON.stringify(SLF_FIELD_MAP_RICH_MENU_CANDIDATE, null, 2),
    [],
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as GateDecision | null;
      if (saved) setDecision(saved);
    } catch {
      // Local Human Gate must never break the LINE control plane.
    }
  }, []);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  function setGate(value: GateDecision) {
    setDecision(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Best-effort only. No production write from this preview.
    }
    flash(`Human Gate: ${value === 'TRY_REFINE' ? 'TRY / REFINE' : value}`);
  }

  async function copyManifest() {
    try {
      await navigator.clipboard.writeText(json);
      flash('Tap JSONをコピーしました');
    } catch {
      flash('コピーできませんでした');
    }
  }

  function exportPng() {
    const canvas = document.createElement('canvas');
    canvas.width = SLF_FIELD_MAP_SIZE.width;
    canvas.height = SLF_FIELD_MAP_SIZE.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      flash('Canvasを初期化できませんでした');
      return;
    }
    drawFieldMap(ctx);
    canvas.toBlob((blob) => {
      if (!blob) {
        flash('PNGを書き出せませんでした');
        return;
      }
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = 'slf-field-map-stage0-2500x1686.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      const sizeKb = Math.round(blob.size / 1024);
      flash(`PNGを書き出しました · ${sizeKb}KB`);
    }, 'image/png');
  }

  function handleArea(area: LineRichMenuArea) {
    if (area.action.type === 'message') {
      navigator.clipboard.writeText(area.action.text).catch(() => undefined);
      flash(`LINE message: 「${area.action.text}」`);
    }
  }

  return (
    <section className="slf-rm-shell" aria-labelledby="slf-rm-title">
      <header className="slf-rm-head">
        <div>
          <p className="slf-rm-kicker">HUMAN VISUAL GATE · STAGE 0 / EXPLORE</p>
          <h1 id="slf-rm-title">SLF FIELD MAP</h1>
          <p>Nature × Quest × Lifecycle。6ボタン管理画面ではなく、ACE / SLF世界へ入る最初のMAP。</p>
        </div>
        <div className="slf-rm-meta" aria-label="Rich menu candidate status">
          <span>2500 × 1686</span>
          <span>4 TAP AREAS</span>
          <strong>PRODUCTION OFF</strong>
        </div>
      </header>

      <div className="slf-rm-workbench">
        <div className="slf-rm-preview-wrap">
          <div className="slf-rm-preview" aria-label="SLF FIELD MAP rich menu preview">
            <div className="slf-rm-ambient slf-rm-sun" />
            <div className="slf-rm-ambient slf-rm-water" />
            <div className="slf-rm-ambient slf-rm-meadow" />
            <svg className="slf-rm-path" viewBox="0 0 2500 1686" aria-hidden="true">
              <path d="M1240 690 C1080 900 1120 1060 780 1290 C1120 1180 1460 1160 1630 1370 C1760 1530 2050 1510 2270 1390" />
            </svg>

            <div className="slf-rm-brand">
              <b>SUN LOVES FLOW</b>
              <span>SLF FIELD MAP · STAGE 0 / EXPLORE</span>
            </div>

            <div className="slf-rm-stage-tabs" aria-label="Lifecycle preview">
              <span className="is-active">EXPLORE</span>
              <span>MY FLOW <small>STAGE 1+</small></span>
            </div>

            <div className="slf-rm-hero-copy">
              <small>DISCOVERY</small>
              <h2>まだ知らない自分へ。</h2>
              <p>今の自分を知るところから、次の道がひらく。</p>
              <span className="slf-rm-hero-cta">FLOW CHECK <b>→</b></span>
            </div>

            <div className="slf-rm-next">NEXT PATHS</div>
            <div className="slf-rm-route-label slf-rm-route-quest">
              <i>⚑</i><small>QUEST</small><b>やってみる</b><span>小さく試す。</span>
            </div>
            <div className="slf-rm-route-label slf-rm-route-tips">
              <i>✦</i><small>LEARN</small><b>知ってみる</b><span>必要な知識に出会う。</span>
            </div>
            <div className="slf-rm-route-label slf-rm-route-consult">
              <i>…</i><small>DIALOGUE</small><b>話してみる</b><span>詰まったら対話へ。</span>
            </div>

            <span className="slf-rm-flow-line">PLAY → LEARN → CONNECT → ACT → CONTRIBUTE</span>

            {SLF_FIELD_MAP_AREAS.map((area) =>
              area.action.type === 'uri' ? (
                <a
                  key={area.id}
                  className={`slf-rm-hit slf-rm-hit-${area.id}`}
                  href={routeHref(area)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${area.title}を開く`}
                />
              ) : (
                <button
                  key={area.id}
                  type="button"
                  className={`slf-rm-hit slf-rm-hit-${area.id}`}
                  onClick={() => handleArea(area)}
                  aria-label={`${area.title}のLINE message actionを確認`}
                />
              ),
            )}
          </div>
        </div>

        <aside className="slf-rm-panel">
          <section>
            <p className="slf-rm-panel-kicker">PRIMARY ACTION</p>
            <h3>自分を知る</h3>
            <p>最初の主役はFLOW CHECK。Quest / Learn / Dialogueは世界の中に置くが、同じ視覚強度にはしない。</p>
          </section>

          <section>
            <p className="slf-rm-panel-kicker">TAP MAP</p>
            <ol>
              {SLF_FIELD_MAP_AREAS.map((area) => (
                <li key={area.id}>
                  <span>{area.eyebrow}</span>
                  <b>{area.title}</b>
                  <small>{area.action.type === 'uri' ? area.action.uri.replace('https://', '') : `message: ${area.action.text}`}</small>
                </li>
              ))}
            </ol>
          </section>

          <div className="slf-rm-tools">
            <button type="button" onClick={exportPng}>PNGを書き出す</button>
            <button type="button" onClick={copyManifest}>Tap JSONをコピー</button>
          </div>

          <section className="slf-rm-gate">
            <p className="slf-rm-panel-kicker">HUMAN GATE</p>
            <div>
              <button className={decision === 'KEEP' ? 'is-selected' : ''} onClick={() => setGate('KEEP')} type="button">KEEP</button>
              <button className={decision === 'TRY_REFINE' ? 'is-selected' : ''} onClick={() => setGate('TRY_REFINE')} type="button">TRY / REFINE</button>
              <button className={decision === 'DROP' ? 'is-selected' : ''} onClick={() => setGate('DROP')} type="button">DROP</button>
            </div>
            <small>判断はこの端末にだけ保存。LINE本番設定・配信・Supabaseは変更しません。</small>
          </section>
        </aside>
      </div>

      {notice && <div className="slf-rm-toast" role="status">{notice}</div>}

      <style>{`
        .slf-rm-shell{max-width:1440px;margin:18px auto 8px;padding:0 22px;color:#4b5049;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Hiragino Sans","Noto Sans JP",system-ui,sans-serif}.slf-rm-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:18px 0 15px;border-top:1px solid #d7d1c8}.slf-rm-kicker,.slf-rm-panel-kicker{margin:0 0 5px;font-size:10px;font-weight:800;letter-spacing:.16em;color:#8b7555}.slf-rm-head h1{margin:0;font-size:24px;letter-spacing:.03em}.slf-rm-head p:not(.slf-rm-kicker){margin:5px 0 0;font-size:13px;line-height:1.55;color:#777269}.slf-rm-meta{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.slf-rm-meta span,.slf-rm-meta strong{padding:6px 8px;border:1px solid #d9d1c4;border-radius:999px;background:#fffaf2;font-size:10px;letter-spacing:.06em}.slf-rm-meta strong{color:#80502b;background:#fff2df}.slf-rm-workbench{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}.slf-rm-preview-wrap{padding:12px;border:1px solid #d8d2c8;border-radius:18px;background:#e7e2d9;box-shadow:0 20px 50px rgba(75,68,56,.08)}.slf-rm-preview{position:relative;overflow:hidden;width:100%;aspect-ratio:2500/1686;border-radius:10px;background:linear-gradient(135deg,#f9f5ea 0%,#edf4ee 38%,#e7f0ef 72%,#f4efe3 100%);isolation:isolate}.slf-rm-ambient{position:absolute;pointer-events:none}.slf-rm-sun{width:47%;aspect-ratio:1;right:2%;top:-28%;border-radius:50%;background:radial-gradient(circle,rgba(241,196,92,.56),rgba(241,196,92,.12) 48%,transparent 72%)}.slf-rm-water{width:58%;height:48%;left:-16%;bottom:-10%;border-radius:48% 56% 0 0;background:rgba(255,255,255,.48);transform:rotate(-4deg)}.slf-rm-meadow{width:62%;height:49%;right:-15%;bottom:-18%;border-radius:50% 46% 0 0;background:rgba(165,192,169,.23);transform:rotate(5deg)}.slf-rm-path{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}.slf-rm-path path{fill:none;stroke:rgba(91,124,100,.34);stroke-width:18;stroke-linecap:round}.slf-rm-brand{position:absolute;left:5.2%;top:4.6%;z-index:3;display:flex;flex-direction:column;gap:3px}.slf-rm-brand b{font-size:clamp(8px,1.35vw,17px);letter-spacing:.18em}.slf-rm-brand span{font-size:clamp(6px,.9vw,11px);font-weight:700;letter-spacing:.09em;color:#918978}.slf-rm-stage-tabs{position:absolute;right:5.2%;top:4.6%;z-index:3;display:flex;gap:5px}.slf-rm-stage-tabs>span{padding:5px 8px;border-radius:999px;font-size:clamp(6px,.85vw,10px);font-weight:800;letter-spacing:.06em;color:#827d73}.slf-rm-stage-tabs .is-active{background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 1px rgba(91,105,92,.16);color:#536b59}.slf-rm-stage-tabs small{font-size:.72em;opacity:.6}.slf-rm-hero-copy{position:absolute;z-index:3;left:6.1%;top:19%;max-width:62%}.slf-rm-hero-copy small,.slf-rm-route-label small{display:block;font-size:clamp(7px,.95vw,12px);font-weight:900;letter-spacing:.14em;color:#95815f}.slf-rm-hero-copy h2{margin:5px 0 3px;font-size:clamp(24px,5vw,64px);font-weight:650;letter-spacing:-.045em;line-height:1.04;color:#454a43}.slf-rm-hero-copy p{margin:0;font-size:clamp(9px,1.45vw,18px);font-weight:600;color:#71766f}.slf-rm-hero-cta{display:inline-flex;align-items:center;gap:20px;margin-top:7%;padding:10px 18px;border-radius:999px;background:#415d4b;color:#fffdf7;font-size:clamp(8px,1.15vw,14px);font-weight:900;letter-spacing:.06em;box-shadow:0 12px 30px rgba(51,78,60,.16)}.slf-rm-hero-cta b{font-size:1.3em}.slf-rm-next{position:absolute;left:5.7%;top:54%;z-index:3;font-size:clamp(6px,.85vw,10px);font-weight:900;letter-spacing:.16em;color:#928771}.slf-rm-route-label{position:absolute;z-index:3;top:64%;display:flex;flex-direction:column;align-items:flex-start}.slf-rm-route-label i{display:grid;place-items:center;width:42px;height:42px;margin-bottom:8px;border-radius:50%;font-style:normal;font-size:22px;color:#65745f;background:rgba(255,255,255,.54);box-shadow:inset 0 0 0 1px rgba(77,94,79,.12)}.slf-rm-route-label b{font-size:clamp(15px,2.7vw,34px);line-height:1.1;letter-spacing:-.03em}.slf-rm-route-label span{margin-top:5px;font-size:clamp(7px,1.05vw,13px);font-weight:600;color:#7b7b72}.slf-rm-route-quest{left:7%}.slf-rm-route-tips{left:39.3%}.slf-rm-route-consult{left:72.4%}.slf-rm-flow-line{position:absolute;left:5.3%;bottom:3.8%;z-index:3;font-size:clamp(6px,.85vw,11px);font-weight:800;letter-spacing:.08em;color:rgba(70,89,74,.64)}.slf-rm-hit{position:absolute;z-index:8;border:0;background:transparent;cursor:pointer}.slf-rm-hit:focus-visible{outline:3px solid #b68d49;outline-offset:-5px}.slf-rm-hit:hover{background:rgba(255,255,255,.055)}.slf-rm-hit-flow-check{left:0;top:9.49%;width:100%;height:37.37%}.slf-rm-hit-quest{left:0;top:46.86%;width:33.32%;height:53.14%}.slf-rm-hit-tips{left:33.32%;top:46.86%;width:33.36%;height:53.14%}.slf-rm-hit-consult{left:66.68%;top:46.86%;width:33.32%;height:53.14%}.slf-rm-panel{display:grid;gap:11px}.slf-rm-panel>section,.slf-rm-tools{padding:14px;border:1px solid #d9d2c7;border-radius:12px;background:rgba(255,255,255,.7)}.slf-rm-panel h3{margin:0 0 5px;font-size:18px}.slf-rm-panel p:not(.slf-rm-panel-kicker){margin:0;font-size:12px;line-height:1.6;color:#746f67}.slf-rm-panel ol{display:grid;gap:8px;margin:0;padding:0;list-style:none}.slf-rm-panel li{display:grid;grid-template-columns:68px 1fr;gap:1px 8px;padding-bottom:8px;border-bottom:1px solid #ece6dc}.slf-rm-panel li:last-child{padding-bottom:0;border-bottom:0}.slf-rm-panel li span{grid-row:1/3;align-self:center;font-size:9px;font-weight:900;letter-spacing:.08em;color:#988266}.slf-rm-panel li b{font-size:12px}.slf-rm-panel li small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#8b877f}.slf-rm-tools{display:grid;grid-template-columns:1fr 1fr;gap:7px}.slf-rm-tools button,.slf-rm-gate button{min-height:40px;border:1px solid #cdc6ba;border-radius:8px;background:#fffdf8;color:#625d55;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.slf-rm-tools button:hover,.slf-rm-gate button:hover{border-color:#9e8e73}.slf-rm-gate>div{display:grid;grid-template-columns:1fr 1.35fr 1fr;gap:6px}.slf-rm-gate button.is-selected{border-color:#5d7963;background:#e9f1e8;color:#3e5b45}.slf-rm-gate>small{display:block;margin-top:8px;font-size:9px;line-height:1.55;color:#90897e}.slf-rm-toast{position:fixed;right:22px;bottom:22px;z-index:60;padding:10px 13px;border-radius:9px;background:#384b3d;color:#fff;font-size:12px;box-shadow:0 15px 42px rgba(29,42,33,.24)}@media(max-width:980px){.slf-rm-workbench{grid-template-columns:1fr}.slf-rm-panel{grid-template-columns:1fr 1fr}.slf-rm-panel>.slf-rm-gate{grid-column:1/-1}}@media(max-width:760px){.slf-rm-shell{padding:0 14px;margin-top:12px}.slf-rm-head{align-items:flex-start;flex-direction:column}.slf-rm-meta{justify-content:flex-start}.slf-rm-preview-wrap{padding:6px;border-radius:12px}.slf-rm-preview{border-radius:7px}.slf-rm-stage-tabs{display:none}.slf-rm-panel{grid-template-columns:1fr}.slf-rm-panel>.slf-rm-gate{grid-column:auto}.slf-rm-tools button,.slf-rm-gate button{min-height:44px}.slf-rm-toast{left:14px;right:14px;bottom:14px;text-align:center}}
      `}</style>
    </section>
  );
}
