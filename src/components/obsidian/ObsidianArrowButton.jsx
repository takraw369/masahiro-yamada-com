import './obsidian-arrow-button.css';

// Interaction pattern adapted for ACE METHOD from ObsidianUI's MIT-licensed
// Arrow Fill Button: https://www.obsidianui.dev/docs/arrow-fill-button
export function ObsidianArrowButton({
  href = '#',
  children,
  className = '',
  bg = 'transparent',
  text = '#C9A96E',
  fill = '#C9A96E',
  fillText = '#0D0B08',
}) {
  return (
    <a
      href={href}
      className={`ace-obsidian-arrow ${className}`.trim()}
      style={{
        '--obs-bg': bg,
        '--obs-text': text,
        '--obs-fill': fill,
        '--obs-fill-text': fillText,
      }}
    >
      <span className="ace-obsidian-arrow__label">{children}</span>
      <span className="ace-obsidian-arrow__orb" aria-hidden="true" />
      <span className="ace-obsidian-arrow__icon" aria-hidden="true">→</span>
    </a>
  );
}

export default ObsidianArrowButton;
