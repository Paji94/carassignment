export function LineHeader() {
  return (
    <header className="line-header">
      <span className="line-header__mark">OH ODAKYU LINE</span>
      <h1 className="line-header__title">Train Watch</h1>
      <p className="line-header__subtitle">小田急線 運行監視 &mdash; 遅延・運転見合わせを自動検知</p>
      <div className="track" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>
    </header>
  );
}
