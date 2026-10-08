(() => {
  const rows = window.OTSU4_TRAINING_SCHEDULE || [];
  if (!rows.length) return;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone:"Asia/Tokyo" });
  const current = [...rows].reverse().find((row) => row.date <= today) || rows[0];
  const next = rows.find((row) => row.date > today);
  const apply = () => {
    const phase = document.querySelector("#phase-label");
    const copy = document.querySelector("#mission-copy");
    if (phase) phase.textContent = current.phase;
    if (copy) {
      const weak = (copy.textContent.match(/弱点\d+問/) || ["弱点を優先"])[0];
      copy.textContent = `${current.phase}：${current.topics.join("・")}。${weak}→当日範囲→鑑別→未出の順で復習。${next ? `次回${next.date.slice(5).replace("-","/")} ${next.phase}。` : "11/1本番。"}`;
    }
  };
  apply();
  new MutationObserver(apply).observe(document.querySelector("#view-home") || document.body,{childList:true,subtree:true});
})();
