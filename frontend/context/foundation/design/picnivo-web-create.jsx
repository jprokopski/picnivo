// picnivo-web-create.jsx — desktop Create (two-pane) + Share modal
const { useState: useStateWC } = React;

const WEB_TIMES = ['3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM', 'Sunset'];
// auto-size the note textarea so it grows with content instead of scrolling inside a fixed box
const autoGrowNote = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  const cs = getComputedStyle(el);
  const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  el.style.height = Math.max(98, el.scrollHeight + border) + 'px';
};
// "15:45" -> "3:45 PM"
const fmt12 = (v) => {
  const [h, m] = v.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};
// "3:45 PM" -> "15:45" (for the native input value); blank for non-clock labels like 'Sunset'
const to24 = (t) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t || '');
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};
const WEB_DATE_POOL = [
  { id: 'd4', dow: 'Sun', day: '22', mon: 'Jun' },
  { id: 'd5', dow: 'Fri', day: '27', mon: 'Jun' },
  { id: 'd6', dow: 'Sat', day: '28', mon: 'Jun' },
];
const WEB_ITEM_POOL = ['Cups & plates', 'Dessert', 'Beach umbrella', 'Watermelon', 'Trash bags', 'Bug spray'];
let webIdSeq = 200;

// ---- date tile ----
function WebDateTile({ d, selected, onToggle, onTime, editable }) {
  const [open, setOpen] = useStateWC(false);
  const isCustomTime = !WEB_TIMES.includes(d.time);
  const [customMode, setCustomMode] = useStateWC(isCustomTime);
  return (
    <div style={{
      position: 'relative', borderRadius: 'var(--r-md)', padding: '14px 15px', cursor: 'pointer',
      border: selected ? '2px solid var(--accent)' : '1.5px solid var(--line)',
      background: selected ? 'var(--accent-tint)' : 'var(--card)',
      transition: 'all 160ms ease', boxShadow: selected ? 'none' : 'var(--sh-sm)',
    }}>
      <div className="pv-row pv-between" onClick={onToggle}>
        <div className="pv-row" style={{ gap: 12 }}>
          <div style={{ textAlign: 'center', lineHeight: 1 }}>
            <div className="pv-mono" style={{ fontSize: 10, color: 'var(--accent-deep)' }}>{d.dow.toUpperCase()}</div>
            <div className="pv-display" style={{ fontSize: 24, margin: '2px 0' }}>{d.day}</div>
            <div className="pv-mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{d.mon}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{d.dow}, {d.mon} {d.day}</div>
            {selected && editable && (
              <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className="pv-chip"
                style={{ marginTop: 7, padding: '4px 10px', fontSize: 12 }}>
                {Icon.clock('var(--ink-soft)', 13)} {d.time}
              </button>
            )}
          </div>
        </div>
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: selected ? 'var(--accent)' : 'transparent',
          border: selected ? 'none' : '2px solid var(--line)',
        }}>{selected && Icon.check('#fff', 15)}</span>
      </div>
      {open && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {WEB_TIMES.map((tm) => (
              <button key={tm} onClick={(e) => { e.stopPropagation(); onTime(tm); setCustomMode(false); setOpen(false); }} className="pv-chip"
                style={{ padding: '6px 11px', fontSize: 12, cursor: 'pointer',
                  background: d.time === tm ? 'var(--accent)' : 'var(--card-2)', color: d.time === tm ? '#fff' : 'var(--ink)',
                  borderColor: d.time === tm ? 'var(--accent)' : 'var(--line)' }}>{tm}</button>
            ))}
            <button onClick={(e) => { e.stopPropagation(); setCustomMode((v) => !v); }} className="pv-chip"
              style={{ padding: '6px 11px', fontSize: 12, cursor: 'pointer', borderStyle: 'dashed',
                background: customMode ? 'var(--accent)' : 'var(--card-2)', color: customMode ? '#fff' : 'var(--ink)',
                borderColor: customMode ? 'var(--accent)' : 'var(--line)' }}>{Icon.clock(customMode ? '#fff' : 'var(--ink-soft)', 13)} Custom</button>
          </div>
          {customMode && (
            <div className="pv-row" style={{ gap: 8, marginTop: 10 }}>
              <input type="time" className="pv-input" value={to24(d.time)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { if (e.target.value) onTime(fmt12(e.target.value)); }}
                style={{ width: 'auto', padding: '8px 12px', fontSize: 13, fontFamily: 'var(--mono, monospace)' }} />
              {isCustomTime && <span className="pv-mono" style={{ fontSize: 12, color: 'var(--accent-deep)' }}>{d.time}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- custom date picker (mini month calendar) ----
const WEB_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEB_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayId = (dt) => `c${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
const toDateOption = (dt) => ({
  id: dayId(dt), dow: WEB_DOW[dt.getDay()], day: String(dt.getDate()), mon: WEB_MON[dt.getMonth()],
});

function WebCustomDate({ selectedIds, onPick }) {
  const [open, setOpen] = useStateWC(false);
  const [pending, setPending] = useStateWC(null); // chosen Date awaiting a time
  const [time, setTime] = useStateWC('4:30 PM');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [view, setView] = useStateWC({ y: today.getFullYear(), m: today.getMonth() });
  const first = new Date(view.y, view.m, 1);
  const lead = first.getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(view.y, view.m, d));
  const shift = (n) => setView((v) => {
    const nm = v.m + n;
    return { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
  });
  const atMin = view.y === today.getFullYear() && view.m === today.getMonth();
  const close = () => { setOpen(false); setPending(null); };
  const commit = () => { if (pending) { onPick(toDateOption(pending), time); close(); } };
  const pendingId = pending && dayId(pending);
  const navBtn = (dir, disabled) => (
    <button onClick={() => !disabled && shift(dir)} disabled={disabled} aria-label={dir < 0 ? 'Previous month' : 'Next month'}
      style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', border: '1.5px solid var(--line)',
        background: 'var(--card)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d={dir < 0 ? 'M12 5l-5 5 5 5' : 'M8 5l5 5-5 5'} stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
  return (
    <div style={{ marginTop: 18 }}>
      <button onClick={() => { open ? close() : setOpen(true); }} className="pv-chip"
        style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          borderStyle: 'dashed', borderColor: open ? 'var(--accent)' : 'var(--line)',
          color: open ? 'var(--accent-deep)' : 'var(--ink)' }}>
        {Icon.calendar(open ? 'var(--accent-deep)' : 'var(--ink-soft)', 15)} Pick a custom date
      </button>
      {open && (
        <div style={{ marginTop: 12, maxWidth: 320, padding: 16, borderRadius: 'var(--r-md)',
          border: '1.5px solid var(--line)', background: 'var(--card)', boxShadow: 'var(--sh-md)' }}>
          <div className="pv-row pv-between" style={{ marginBottom: 12 }}>
            {navBtn(-1, atMin)}
            <div style={{ fontWeight: 700, fontSize: 15 }}>{WEB_MON[view.m]} {view.y}</div>
            {navBtn(1, false)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {WEB_DOW.map((w) => (
              <div key={w} className="pv-mono" style={{ fontSize: 10, textAlign: 'center', color: 'var(--ink-faint)', padding: '2px 0' }}>{w[0]}</div>
            ))}
            {cells.map((dt, i) => {
              if (!dt) return <div key={`e${i}`} />;
              const past = dt < today;
              const already = selectedIds.has(dayId(dt));
              const isPending = pendingId === dayId(dt);
              const isToday = dt.getTime() === today.getTime();
              const hi = already || isPending;
              return (
                <button key={dayId(dt)} disabled={past || already}
                  onClick={() => { setPending(dt); }}
                  style={{ aspectRatio: '1', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: hi ? 700 : 500,
                    border: isToday && !hi ? '1.5px solid var(--line)' : '1.5px solid transparent',
                    backgroundColor: isPending ? 'var(--accent)' : already ? 'var(--accent-tint)' : 'transparent',
                    color: isPending ? '#fff' : already ? 'var(--accent-deep)' : past ? 'var(--ink-faint)' : 'var(--ink)',
                    cursor: (past || already) ? 'default' : 'pointer', opacity: past ? 0.45 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {dt.getDate()}
                </button>
              );
            })}
          </div>
          {pending && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <div className="pv-row pv-between" style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {WEB_DOW[pending.getDay()]}, {WEB_MON[pending.getMonth()]} {pending.getDate()}
                </div>
                <span className="pv-chip pv-mono" style={{ padding: '4px 10px', fontSize: 12 }}>{Icon.clock('var(--accent-deep)', 13)} {time}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {WEB_TIMES.map((tm) => (
                  <button key={tm} onClick={() => setTime(tm)} className="pv-chip"
                    style={{ padding: '6px 11px', fontSize: 12, cursor: 'pointer',
                      background: time === tm ? 'var(--accent)' : 'var(--card-2)', color: time === tm ? '#fff' : 'var(--ink)',
                      borderColor: time === tm ? 'var(--accent)' : 'var(--line)' }}>{tm}</button>
                ))}
              </div>
              <div className="pv-row" style={{ gap: 8, marginTop: 10 }}>
                <input type="time" className="pv-input" value={to24(time)}
                  onChange={(e) => { if (e.target.value) setTime(fmt12(e.target.value)); }}
                  style={{ width: 'auto', padding: '8px 12px', fontSize: 13, fontFamily: 'var(--mono, monospace)' }} />
                <button onClick={commit} className="pv-btn pv-btn--primary"
                  style={{ flex: 1, padding: '9px 14px', fontSize: 13, justifyContent: 'center' }}>
                  {Icon.plus('#fff', 15)} Add this date
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WebBasics({ event, setEvent }) {
  return (
    <div>
      <div className="pv-field">
        <label className="pv-label">Event name</label>
        <input className="pv-input" value={event.title} placeholder="e.g. Sunset Beach Picnic"
          onChange={(e) => setEvent((ev) => ({ ...ev, title: e.target.value }))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
        <div className="pv-field">
          <label className="pv-label">Where <span style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>· optional</span></label>
          <input className="pv-input" value={event.location} placeholder="Add a spot"
            onChange={(e) => setEvent((ev) => ({ ...ev, location: e.target.value }))} />
        </div>
        <div className="pv-field" style={{ marginBottom: 0 }}>
          <label className="pv-label">A note <span style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>· optional</span></label>
          <textarea className="pv-input" rows={3} value={event.note} placeholder="Set the vibe…"
            ref={autoGrowNote}
            style={{ resize: 'none', lineHeight: 1.45, overflow: 'hidden', minHeight: 98, width: '100%', maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            onChange={(e) => { autoGrowNote(e.target); setEvent((ev) => ({ ...ev, note: e.target.value })); }} />
        </div>
      </div>
    </div>
  );
}

function WebDates({ event, setEvent }) {
  const selected = new Set(event.dateOptions.map((d) => d.id));
  const available = WEB_DATE_POOL.filter((d) => !selected.has(d.id));
  const toggle = (d) => setEvent((ev) => {
    const has = ev.dateOptions.some((x) => x.id === d.id);
    return has ? { ...ev, dateOptions: ev.dateOptions.filter((x) => x.id !== d.id) }
               : { ...ev, dateOptions: [...ev.dateOptions, { ...d, time: '4:30 PM' }] };
  });
  const setTime = (id, time) => setEvent((ev) => ({ ...ev, dateOptions: ev.dateOptions.map((d) => d.id === id ? { ...d, time } : d) }));
  const addCustom = (d, time = '4:30 PM') => setEvent((ev) => (
    ev.dateOptions.some((x) => x.id === d.id) ? ev : { ...ev, dateOptions: [...ev.dateOptions, { ...d, time }] }
  ));
  return (
    <div>
      <div className="web-grid-dates">
        {event.dateOptions.map((d) => <WebDateTile key={d.id} d={d} selected editable onToggle={() => toggle(d)} onTime={(tm) => setTime(d.id, tm)} />)}
      </div>
      {available.length > 0 && (
        <>
          <div className="pv-kicker" style={{ margin: '18px 0 10px' }}>Add more days</div>
          <div className="web-grid-dates">
            {available.map((d) => <WebDateTile key={d.id} d={{ ...d, time: '4:30 PM' }} selected={false} onToggle={() => toggle(d)} />)}
          </div>
        </>
      )}
      <WebCustomDate selectedIds={selected} onPick={addCustom} />
      <p className="pv-body pv-small" style={{ marginTop: 14 }}>
        {event.dateOptions.length === 0 ? 'Pick at least one day to continue.'
          : event.dateOptions.length === 1 ? 'With one date this is an announcement — add another to open voting.'
          : `${event.dateOptions.length} days proposed · friends vote Yes / Maybe / No`}
      </p>
    </div>
  );
}

function WebItemsEditor({ event, setEvent }) {
  const [custom, setCustom] = useStateWC('');
  const labels = new Set(event.items.map((i) => i.label.toLowerCase()));
  const suggestions = WEB_ITEM_POOL.filter((s) => !labels.has(s.toLowerCase()));
  const add = (label) => {
    const l = label.trim(); if (!l || labels.has(l.toLowerCase())) return;
    setEvent((ev) => ({ ...ev, items: [...ev.items, { id: 'w' + (webIdSeq++), label: l, by: null }] }));
  };
  const remove = (id) => setEvent((ev) => ({ ...ev, items: ev.items.filter((i) => i.id !== id) }));
  return (
    <div>
      <div className="web-pillrow">
        {event.items.map((i) => (
          <span key={i.id} className="pv-chip" style={{ paddingRight: 7, background: 'var(--accent-tint)', borderColor: 'transparent' }}>
            {i.label}
            <button onClick={() => remove(i.id)} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', padding: 2 }}>
              {Icon.close('var(--accent-deep)', 13)}
            </button>
          </span>
        ))}
      </div>
      <div className="pv-row" style={{ gap: 10, marginTop: 15, maxWidth: 420 }}>
        <input className="pv-input" value={custom} placeholder="Add an item…" onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { add(custom); setCustom(''); } }} style={{ padding: '11px 13px', fontSize: 15 }} />
        <button className="pv-btn pv-btn--ghost pv-btn--sm" style={{ flexShrink: 0, padding: '11px 14px' }} onClick={() => { add(custom); setCustom(''); }}>
          {Icon.plus('var(--ink)', 16)}
        </button>
      </div>
      {suggestions.length > 0 && (
        <>
          <div className="pv-kicker" style={{ margin: '16px 0 9px' }}>Tap to add</div>
          <div className="web-pillrow">
            {suggestions.map((s) => (
              <button key={s} className="pv-chip pv-press" onClick={() => add(s)} style={{ cursor: 'pointer', color: 'var(--ink-soft)' }}>
                {Icon.plus('var(--ink-soft)', 14)} {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- live preview ticket ----
function WebPreviewCard({ event }) {
  const token = 'a7K2f9';
  return (
    <div className="web-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="web-evcard__cover">
        <PicnicScene variant="sunset" slot="card" />
      </div>
      <div style={{ height: 5, background: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ padding: '18px 20px 20px' }}>
        <div className="pv-kicker" style={{ overflowWrap: 'anywhere' }}>{event.location || 'Beach picnic'}</div>
        <h3 className="pv-h3" style={{ marginTop: 5, fontSize: 21, overflowWrap: 'anywhere' }}>{event.title || 'Untitled event'}</h3>
        {event.note && <p className="pv-body pv-small" style={{ marginTop: 8, overflowWrap: 'anywhere' }}>{event.note}</p>}
        <div className="pv-row" style={{ gap: 10, marginTop: 14 }}>
          <span className="pv-chip pv-small">{Icon.clock('var(--ink-soft)', 14)} {event.dateOptions.length} dates</span>
          <span className="pv-chip pv-small">{Icon.hand('var(--ink-soft)', 14)} {event.items.length} items</span>
        </div>
        <div className="pv-row" style={{ gap: 8, marginTop: 16, background: 'var(--card-2)', border: '1.5px dashed var(--line)', borderRadius: 'var(--r-sm)', padding: '11px 14px' }}>
          {Icon.link('var(--accent-deep)', 18)}
          <span className="pv-mono" style={{ fontSize: 13.5, flex: 1 }}>picnivo.com/{token}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Create screen ----
function WebCreate({ event, setEvent, mode, onDone }) {
  const [step, setStep] = useStateWC(0);
  const stepped = mode === 'stepped';
  const canCreate = event.title.trim().length > 0;
  const stepValid = [
    event.title.trim().length > 0,
    event.dateOptions.length > 0,
    true,
  ];
  const steps = [
    { k: 'Basics', kicker: 'The basics', title: "What's the plan?", node: <WebBasics event={event} setEvent={setEvent} /> },
    { k: 'Dates', kicker: 'Pick some days', title: 'When could it happen?', node: <WebDates event={event} setEvent={setEvent} /> },
    { k: 'Items', kicker: 'Bring a little something', title: 'What do we need?', node: <WebItemsEditor event={event} setEvent={setEvent} /> },
  ];

  return (
    <div className="web-wrap web-page">
      <div className="web-pagehead">
        <div className="pv-kicker" style={{ marginBottom: 10 }}>New event</div>
        <h1 className="pv-display">Plan something good.</h1>
        <p className="pv-body">Set it up once, share one link, and watch the date, the food, and the guest list fill themselves in.</p>
      </div>

      <div className="web-create">
        <div className="web-create__form web-card web-card--pad">
          {stepped ? (
            <>
              <div className="pv-row pv-between" style={{ marginBottom: 20 }}>
                <div className="pv-dots">
                  {steps.map((_, i) => <span key={i} className={'pv-dot' + (i === step ? ' is-active' : i < step ? ' is-done' : '')} />)}
                </div>
                <span className="pv-mono pv-small" style={{ color: 'var(--ink-soft)' }}>Step {step + 1} of {steps.length}</span>
              </div>
              <div key={step} style={{ animation: 'pv-fade 300ms ease both' }}>
                <div className="pv-kicker" style={{ marginBottom: 5 }}>{steps[step].kicker}</div>
                <h3 className="pv-h3" style={{ fontSize: 24, marginBottom: 20 }}>{steps[step].title}</h3>
                {steps[step].node}
              </div>
              <div className="pv-row" style={{ gap: 12, marginTop: 28 }}>
                {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>}
                {step < steps.length - 1
                  ? <Button disabled={!stepValid[step]} onClick={() => setStep((s) => s + 1)} style={{ marginLeft: 'auto' }}>Continue</Button>
                  : <Button disabled={!canCreate} onClick={onDone} style={{ marginLeft: 'auto' }}>{Icon.share('#fff', 18)} Create &amp; get link</Button>}
              </div>
            </>
          ) : (
            steps.map((s, i) => (
              <div key={s.k} className="web-formsection">
                <div className="pv-kicker" style={{ marginBottom: 5 }}>{s.kicker}</div>
                <h3 className="pv-h3" style={{ fontSize: 22, marginBottom: 18 }}>{s.title}</h3>
                {s.node}
              </div>
            ))
          )}
        </div>

        <aside className="web-create__aside">
          <div className="pv-kicker">Live preview</div>
          <WebPreviewCard event={event} />
          {!stepped && (
            <Button block disabled={!canCreate} onClick={onDone}>{Icon.share('#fff', 18)} Create &amp; get link</Button>
          )}
          <p className="pv-body pv-small" style={{ textAlign: 'center' }}>No account needed for guests — they just open the link.</p>
        </aside>
      </div>
    </div>
  );
}

// ---- Share modal ----
function WebShareModal({ event, onClose, onOpenEvent }) {
  const [copied, setCopied] = useStateWC(false);
  const token = 'a7K2f9';
  return (
    <div className="web-modal-scrim" onClick={onClose}>
      <div className="web-modal" onClick={(e) => e.stopPropagation()}>
        <div className="web-evcard__cover" style={{ height: 132 }}>
          <PicnicScene variant="sunset" slot="card" />
        </div>
        <div style={{ height: 5, background: 'var(--accent)', flexShrink: 0 }} />
        <div style={{ padding: '26px 30px 30px', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, margin: '-56px auto 14px', borderRadius: '50%', position: 'relative',
            background: 'radial-gradient(circle at 40% 35%, #d9f0e0, var(--yes) 60%, #2f7d4d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(63,158,99,0.5)', border: '3px solid var(--card)' }}>
            {Icon.check('#fff', 30)}
          </div>
          <h2 className="pv-display pv-h2">Your picnic is live!</h2>
          <p className="pv-body" style={{ marginTop: 8 }}>Share this link with the group. They vote and claim items — no app, no login.</p>
          <div className="pv-row" style={{ gap: 8, marginTop: 20, background: 'var(--card-2)', border: '1.5px dashed var(--line)', borderRadius: 'var(--r-sm)', padding: '13px 16px' }}>
            {Icon.link('var(--accent-deep)', 18)}
            <span className="pv-mono" style={{ fontSize: 14.5, flex: 1, textAlign: 'left' }}>picnivo.com/{token}</span>
          </div>
          <div className="web-share-actions" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <Button variant={copied ? 'primary' : 'ghost'} onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }} style={{ flex: 1 }}>
              {copied ? Icon.check('#fff', 18) : Icon.copy('var(--ink)', 18)} {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <Button onClick={onOpenEvent} style={{ flex: 1 }}>Open event page →</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WebCreate, WebShareModal, WebPreviewCard, WEB_TIMES });
