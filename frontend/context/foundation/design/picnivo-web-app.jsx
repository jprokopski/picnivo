// picnivo-web-app.jsx — desktop nav, orchestration, Tweaks, mount
const { useState: useStateWA, useEffect: useEffectWA } = React;

const WEB_ACCENTS = {
  '#F15A37': { accent: '#F15A37', deep: '#D8401E', tint: '#FDE6DC' },
  '#E8961C': { accent: '#E8961C', deep: '#C2780F', tint: '#FBEBCB' },
  '#2E7E9A': { accent: '#2E7E9A', deep: '#246377', tint: '#DCEDF1' },
  '#C24E7D': { accent: '#C24E7D', deep: '#A23A64', tint: '#F7E0EB' },
};

const WEB_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "createFlow": "stepped",
  "voteStyle": "reactions",
  "itemStyle": "checklist",
  "eventLayout": "summary",
  "authLayout": "split",
  "accent": "#F15A37"
}/*EDITMODE-END*/;

function WebNav({ screen, onGo, user, onSignOut }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  return (
    <header className="web-nav">
      <div className="web-nav__inner">
        <a className="web-reset" style={{ cursor: 'pointer' }} onClick={() => onGo('events')}><Logo size={20} /></a>
        <nav className="web-nav__links">
          <span className={"web-nav__link" + (screen === 'events' ? " is-active" : "")} style={{ color: screen === 'events' ? 'var(--ink)' : undefined }} onClick={() => onGo('events')}>My events</span>
        </nav>
        <div className="web-nav__right">
          <span className="pv-chip pv-small web-nav__hint" style={{ color: 'var(--ink-soft)' }}>{Icon.spark('var(--marigold)', 13)} Toggle Tweaks to explore variations</span>
          <Button size="sm" onClick={() => onGo('create')}>{Icon.plus('#fff', 16)} <span className="web-nav__cta-text">New event</span></Button>
          <div className="web-nav__menu" ref={menuRef}>
            <button className="web-reset web-nav__user" aria-haspopup="menu" aria-expanded={menuOpen} title="Account"
              onClick={() => setMenuOpen((o) => !o)}
              style={{ display: 'inline-flex', cursor: 'pointer', background: 'none', border: 0, padding: 0, borderRadius: '50%' }}>
              <Avatar name="You" size={34} />
            </button>
            {menuOpen && (
              <div className="web-nav__sheet" role="menu">
                <div className="web-nav__sheet-id">
                  <Avatar name="You" size={36} />
                  <div>
                    <div className="web-nav__sheet-name">You</div>
                    <div className="web-nav__sheet-mail">you@picnivo.app</div>
                  </div>
                </div>
                <button className="web-reset web-nav__item web-nav__item--mobile" role="menuitem"
                  onClick={() => { setMenuOpen(false); onGo('events'); }}>{Icon.calendar('var(--ink-soft)', 16)} My events</button>
                <div className="web-nav__sheet-sep web-nav__sheet-sep--mobile" />
                <button className="web-reset web-nav__item" role="menuitem"
                  onClick={() => { setMenuOpen(false); onSignOut(); }}>{Icon.signout('var(--ink-soft)', 16)} Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function WebApp() {
  const [t, setTweak] = useTweaks(WEB_TWEAK_DEFAULTS);
  // Items start unclaimed — claiming opens only after the date is locked & the crew is known
  const [event, setEvent] = useStateWA(() => { const e = makeSeedEvent(); return { ...e, items: e.items.map((i) => ({ ...i, by: null })) }; });
  const [authed, setAuthed] = useStateWA(false);
  const [screen, setScreen] = useStateWA('events');
  const [showShare, setShowShare] = useStateWA(false);
  const [viewAs, setViewAs] = useStateWA('organizer');
  const isOrganizer = viewAs === 'organizer';
  const me = isOrganizer ? 'Maya' : 'Noah';   // event-hub viewer identity
  const joined = true;

  useEffectWA(() => {
    const a = WEB_ACCENTS[t.accent] || WEB_ACCENTS['#F15A37'];
    const r = document.documentElement.style;
    r.setProperty('--accent', a.accent); r.setProperty('--accent-deep', a.deep); r.setProperty('--accent-tint', a.tint);
  }, [t.accent]);

  function joinAs() {}
  function go(s) { setScreen(s); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  if (!authed) {
    return (
      <div>
        <WebAuth layout={t.authLayout} onAuthed={() => { setAuthed(true); go('events'); }} />
        <TweaksPanel>
          <TweakSection label="Auth page" />
          <TweakRadio label="Layout" value={t.authLayout}
            options={[{ label: 'Split panel', value: 'split' }, { label: 'Centered card', value: 'centered' }]}
            onChange={(v) => setTweak('authLayout', v)} />
          <TweakSection label="Brand accent" />
          <TweakColor label="Accent" value={t.accent} options={['#F15A37', '#E8961C', '#2E7E9A', '#C24E7D']}
            onChange={(v) => setTweak('accent', v)} />
        </TweaksPanel>
      </div>
    );
  }

  return (
    <div>
      <WebNav screen={screen} onGo={go} onSignOut={() => { setAuthed(false); go('events'); }} />
      {screen === 'create'
        ? <WebCreate event={event} setEvent={setEvent} mode={t.createFlow} onDone={() => setShowShare(true)} />
        : screen === 'events'
        ? <WebMyEvents event={event} onOpenEvent={() => go('event')} />
        : <WebEventHub event={event} setEvent={setEvent} me={me} joined={joined} layout={t.eventLayout}
            voteStyle={t.voteStyle} itemStyle={t.itemStyle} isOrganizer={isOrganizer}
            onToggleRole={() => setViewAs((v) => v === 'guest' ? 'organizer' : 'guest')} onJoin={joinAs} />}

      <footer className="web-footer">
        <div className="web-footer__inner">
          <Logo size={16} />
          <span className="pv-body pv-small">From scattered group chat to a ready-to-go plan — on one shared page.</span>
          <span className="pv-mono pv-small" style={{ color: 'var(--ink-faint)' }}>Picnivo · prototype</span>
        </div>
      </footer>

      {showShare && <WebShareModal event={event} onClose={() => setShowShare(false)} onOpenEvent={() => { setShowShare(false); go('event'); }} />}

      <TweaksPanel>
        <TweakSection label="Create flow" />
        <TweakRadio label="Layout" value={t.createFlow}
          options={[{ label: 'Single page', value: 'single' }, { label: 'Step-by-step', value: 'stepped' }]}
          onChange={(v) => { setTweak('createFlow', v); go('create'); }} />
        <TweakSection label="Voting UI" />
        <TweakRadio label="Style" value={t.voteStyle}
          options={[{ label: 'Segmented', value: 'segmented' }, { label: 'Big buttons', value: 'buttons' }, { label: 'Reactions', value: 'reactions' }]}
          onChange={(v) => { setTweak('voteStyle', v); go('event'); }} />
        <TweakSection label="Item claiming" />
        <TweakRadio label="Style" value={t.itemStyle}
          options={[{ label: 'List', value: 'list' }, { label: 'Cards', value: 'cards' }, { label: 'Checklist', value: 'checklist' }]}
          onChange={(v) => { setTweak('itemStyle', v); go('event'); }} />
        <TweakSection label="Event page" />
        <TweakRadio label="Layout" value={t.eventLayout}
          options={[{ label: 'Summary', value: 'summary' }, { label: 'Cards', value: 'cards' }, { label: 'Timeline', value: 'timeline' }]}
          onChange={(v) => { setTweak('eventLayout', v); go('event'); }} />
        <TweakSection label="Auth page" />
        <TweakRadio label="Layout" value={t.authLayout}
          options={[{ label: 'Split panel', value: 'split' }, { label: 'Centered card', value: 'centered' }]}
          onChange={(v) => { setTweak('authLayout', v); setAuthed(false); }} />
        <TweakSection label="Brand accent" />
        <TweakColor label="Accent" value={t.accent} options={['#F15A37', '#E8961C', '#2E7E9A', '#C24E7D']}
          onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<WebApp />);
