// picnivo-web-event.jsx — desktop Event hub (join + vote + items + summary) with 3 layouts
const { useState: useStateWE } = React;
const WEB_VOTE_ORDER = ['yes', 'maybe', 'no'];

// on phones, all vote styles collapse to one compact full-width segmented bar
function useWebNarrow(bp = 720) {
  const [narrow, setNarrow] = useStateWE(() => typeof window !== 'undefined' && window.innerWidth <= bp);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [bp]);
  return narrow;
}

function WebVoteSegmentedCompact({ value, onChange, onBest, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 4, width: '100%', background: onBest ? 'var(--card)' : 'var(--card-2)',
      border: '1px solid var(--line)', borderRadius: 999, padding: 3, opacity: disabled ? 0.6 : 1 }}>
      {WEB_VOTE_ORDER.map((k) => {
        const m = VOTE_META[k]; const on = value === k;
        return (
          <button key={k} onClick={() => !disabled && onChange(k)} disabled={disabled}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: 'none',
              cursor: disabled ? 'default' : 'pointer', borderRadius: 999, padding: '8px 4px', fontWeight: 700, fontSize: 13,
              background: on ? m.color : 'transparent', color: on ? '#fff' : 'var(--ink-soft)', transition: 'all 150ms ease' }}>
            <VoteGlyph kind={k} size={12} color={on ? '#fff' : m.color} /> {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- vote controls ----------
function WebVoteControl({ value, onChange, style, onBest, disabled }) {
  const narrow = useWebNarrow();
  if (narrow) return <WebVoteSegmentedCompact value={value} onChange={onChange} onBest={onBest} disabled={disabled} />;
  if (style === 'reactions') {
    return (
      <div style={{ display: 'flex', gap: 10, opacity: disabled ? 0.6 : 1 }}>
        {WEB_VOTE_ORDER.map((k) => {
          const m = VOTE_META[k]; const on = value === k;
          return (
            <button key={k} onClick={() => !disabled && onChange(k)} disabled={disabled} title={m.label}
              style={{ border: on ? '2.5px solid ' + m.color : '2px solid var(--line)', background: on ? m.tint : 'var(--card-2)',
                width: 46, height: 46, borderRadius: '50%', fontSize: 22, cursor: disabled ? 'default' : 'pointer',
                transform: on ? 'scale(1.08)' : 'scale(1)', transition: 'all 180ms cubic-bezier(0.16,1,0.3,1)' }}>{m.emoji}</button>
          );
        })}
      </div>
    );
  }
  if (style === 'buttons') {
    return (
      <div style={{ display: 'flex', gap: 8, opacity: disabled ? 0.6 : 1 }}>
        {WEB_VOTE_ORDER.map((k) => {
          const m = VOTE_META[k]; const on = value === k;
          return (
            <button key={k} onClick={() => !disabled && onChange(k)} disabled={disabled}
              style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: disabled ? 'default' : 'pointer', borderRadius: 999, padding: '9px 15px',
                fontWeight: 700, fontSize: 14, background: on ? m.color : m.tint, color: on ? '#fff' : m.color,
                border: on ? '2px solid ' + m.color : '2px solid transparent', transition: 'all 150ms ease' }}>
              <VoteGlyph kind={k} size={15} color={on ? '#fff' : m.color} /> {m.label}
            </button>
          );
        })}
      </div>
    );
  }
  // segmented
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 999, padding: 4, opacity: disabled ? 0.6 : 1 }}>
      {WEB_VOTE_ORDER.map((k) => {
        const m = VOTE_META[k]; const on = value === k;
        return (
          <button key={k} onClick={() => !disabled && onChange(k)} disabled={disabled}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: disabled ? 'default' : 'pointer', borderRadius: 999,
              padding: '9px 16px', fontWeight: 700, fontSize: 13.5, background: on ? m.color : 'transparent',
              color: on ? '#fff' : 'var(--ink-soft)', transition: 'all 150ms ease' }}>
            <VoteGlyph kind={k} size={14} color={on ? '#fff' : m.color} /> {m.label}
          </button>
        );
      })}
    </div>
  );
}

function StackBarW({ tally, height = 9 }) {
  const total = Math.max(tally.total, 1);
  const seg = (n, c) => n > 0 ? <span style={{ width: `${(n / total) * 100}%`, background: c }} /> : null;
  return (
    <div style={{ display: 'flex', height, borderRadius: 999, overflow: 'hidden', background: 'var(--line)' }}>
      {seg(tally.yes, 'var(--yes)')}{seg(tally.maybe, 'var(--maybe)')}{seg(tally.no, 'var(--no)')}
    </div>
  );
}

function WebDateRow({ event, d, me, joined, isBest, locked, voteStyle, onVote }) {
  const t = pvTally(event, d.id);
  const voters = event.participants.filter((p) => event.votes[p]?.[d.id] === 'yes');
  const myVote = event.votes[me]?.[d.id];
  return (
    <div className={'web-daterow' + (isBest ? ' web-daterow--best' : '')} style={{ flexWrap: 'wrap' }}>
      <div className="web-daterow__date">
        <div className="pv-mono" style={{ fontSize: 11, color: 'var(--accent-deep)' }}>{d.dow.toUpperCase()}</div>
        <div className="pv-display" style={{ fontSize: 30, margin: '2px 0' }}>{d.day}</div>
        <div className="pv-mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{d.mon}</div>
      </div>
      <div className="web-daterow__main" style={{ flex: 1, minWidth: 200 }}>
        <div className="pv-row" style={{ gap: 10, marginBottom: 9, flexWrap: 'wrap', minHeight: 24 }}>
          <span style={{ fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-display)' }}>{d.dow}, {d.mon} {d.day}</span>
          <span className="pv-mono pv-small" style={{ color: 'var(--ink-soft)' }}>{d.time}</span>
          {isBest && <span className={'pv-chip ' + (locked ? 'web-lockchip' : 'web-leadchip')} style={{ background: 'var(--accent)', color: '#fff', borderColor: 'transparent', fontSize: 11, padding: '3px 9px' }}>{locked ? '✓ Locked' : 'Leading'}</span>}
        </div>
        <StackBarW tally={t} />
        <div className="pv-row" style={{ gap: 12, marginTop: 9, flexWrap: 'wrap' }}>
          <span className="pv-small" style={{ fontWeight: 700, color: 'var(--yes)', whiteSpace: 'nowrap' }}>{t.yes} yes</span>
          <span className="pv-small" style={{ fontWeight: 700, color: 'var(--maybe)', whiteSpace: 'nowrap' }}>{t.maybe} maybe</span>
          <span className="pv-small" style={{ fontWeight: 700, color: 'var(--no)', whiteSpace: 'nowrap' }}>{t.no} no</span>
          {voters.length > 0 && <AvatarStack names={voters} size={22} max={5} />}
        </div>
      </div>
      {joined && (
        <div style={{ flexShrink: 0 }}>
          <WebVoteControl value={myVote} onChange={(k) => onVote(d.id, k)} style={voteStyle} onBest={isBest} disabled={locked} />
        </div>
      )}
    </div>
  );
}

function WebItems({ event, me, joined, canClaim = true, style, orphanIds = [], orphanBy = {}, onClaim, onUnclaim, onAdd }) {
  const [custom, setCustom] = useStateWE('');
  const active = joined && canClaim;
  const gateLabel = joined ? 'Confirm to claim' : 'Join to claim';
  const mine = (i) => i.by === me;
  const orphan = (i) => !i.by && orphanIds.includes(i.id);
  const add = () => { if (custom.trim()) { onAdd(custom.trim()); setCustom(''); } };

  const claimBtn = (i) => i.by ? (
    <div className="pv-row" style={{ gap: 8, flexShrink: 0 }}>
      <Avatar name={i.by} size={28} />
      <span className="pv-small" style={{ fontWeight: 700, color: mine(i) ? 'var(--accent-deep)' : 'var(--ink-soft)' }}>{mine(i) ? 'You' : i.by}</span>
      {mine(i) && <button onClick={() => onUnclaim(i.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2 }}>{Icon.close('var(--ink-faint)', 14)}</button>}
    </div>
  ) : (
    <button className="pv-btn pv-btn--ghost pv-btn--sm" disabled={!active} style={{ flexShrink: 0, opacity: active ? 1 : 0.5, ...(orphan(i) ? { borderColor: 'var(--no)', color: 'var(--no)' } : {}) }} onClick={() => onClaim(i.id)}>{orphan(i) ? "I'll cover it" : "I'll bring it"}</button>
  );

  let list;
  if (style === 'cards') {
    list = (
      <div className="web-itemcards">
        {event.items.map((i) => {
          const orf = orphan(i);
          return (
          <button key={i.id} onClick={() => active && (i.by ? (mine(i) && onUnclaim(i.id)) : onClaim(i.id))}
            className="pv-press" style={{ textAlign: 'left', minWidth: 0, overflow: 'hidden', cursor: active && (!i.by || mine(i)) ? 'pointer' : 'default',
              padding: 16, borderRadius: 'var(--r-md)', minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10,
              border: orf ? '1.5px solid var(--no)' : mine(i) ? '2px solid var(--accent)' : '1px solid var(--line)', background: orf ? 'var(--no-tint)' : mine(i) ? 'var(--accent-tint)' : 'var(--card)' }}>
            <span style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-display)', overflowWrap: 'anywhere' }}>{i.label}</span>
            {i.by ? (
              <div className="pv-row" style={{ gap: 7 }}><Avatar name={i.by} size={24} /><span className="pv-small" style={{ fontWeight: 700, color: mine(i) ? 'var(--accent-deep)' : 'var(--ink-soft)' }}>{mine(i) ? 'You' : i.by}</span></div>
            ) : orf ? (
              <span className="pv-small" style={{ fontWeight: 700, color: 'var(--no)' }}>Was {orphanBy[i.id]}'s · I'll cover it</span>
            ) : <span className="pv-row pv-small" style={{ gap: 5, color: active ? 'var(--accent-deep)' : 'var(--ink-faint)', fontWeight: 700 }}>{active ? <>{Icon.plus('var(--accent-deep)', 14)} I'll bring this</> : gateLabel}</span>}
          </button>
          );
        })}
      </div>
    );
  } else if (style === 'checklist') {
    list = (
      <div className="web-card" style={{ padding: '4px 6px' }}>
        {event.items.map((i, idx) => {
          const orf = orphan(i);
          return (
          <div key={i.id}>
            <div className="pv-row pv-between" style={{ padding: '13px 14px', gap: 14, cursor: active && (!i.by || mine(i)) ? 'pointer' : 'default' }}
              onClick={() => active && (i.by ? (mine(i) && onUnclaim(i.id)) : onClaim(i.id))}>
              <div className="pv-row" style={{ gap: 13, minWidth: 0, flex: 1 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: i.by ? 'var(--yes)' : 'transparent', border: i.by ? 'none' : orf ? '2px solid var(--no)' : '2px solid var(--line)' }}>{i.by && Icon.check('#fff', 15)}</span>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, overflowWrap: 'anywhere' }}>{i.label}</span>
                  {orf && <div className="pv-small" style={{ color: 'var(--no)', fontWeight: 700 }}>Was {orphanBy[i.id]}'s — needs a new owner</div>}
                </div>
              </div>
              {i.by ? <span className="pv-small" style={{ fontWeight: 700, color: mine(i) ? 'var(--accent-deep)' : 'var(--ink-soft)', flexShrink: 0 }}>{mine(i) ? 'You' : i.by}</span>
                    : <span className="pv-small" style={{ color: orf ? 'var(--no)' : active ? 'var(--accent-deep)' : 'var(--ink-faint)', fontWeight: 700, flexShrink: 0 }}>{active ? (orf ? "I'll cover it" : 'Claim') : gateLabel}</span>}
            </div>
            {idx < event.items.length - 1 && <hr className="pv-rule" style={{ marginLeft: 53 }} />}
          </div>
          );
        })}
      </div>
    );
  } else {
    list = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {event.items.map((i) => {
          const orf = orphan(i);
          return (
          <div key={i.id} className="web-itemrow" style={orf ? { borderColor: 'var(--no)', background: 'var(--no-tint)' } : {}}>
            <div className="pv-row" style={{ gap: 12, minWidth: 0, flex: 1 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: orf ? 'var(--no)' : i.by ? 'var(--yes)' : 'var(--line)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15, overflowWrap: 'anywhere' }}>{i.label}</span>
                {orf && <div className="pv-small" style={{ color: 'var(--no)', fontWeight: 700 }}>Was {orphanBy[i.id]}'s — needs a new owner</div>}
              </div>
            </div>
            {claimBtn(i)}
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {list}
      <div className="pv-row" style={{ gap: 10, marginTop: 14, maxWidth: 420 }}>
        <input className="pv-input" value={custom} placeholder={active ? "Add something you'll bring…" : joined ? "Confirm you're coming to add" : 'Join to add items'} disabled={!active}
          onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} style={{ padding: '10px 13px', fontSize: 15 }} />
        <button className="pv-btn pv-btn--ghost pv-btn--sm" disabled={!active} style={{ flexShrink: 0, padding: '10px 14px' }} onClick={add}>{Icon.plus('var(--ink)', 16)}</button>
      </div>
    </div>
  );
}

// pre-lock state: the haul is read-only until the date is set and the crew is known
function WebHaulGated({ event, isOrganizer }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '11px 14px', borderRadius: 'var(--r-md)', background: 'var(--card-2)', border: '1.5px dashed var(--line)' }}>
        <span style={{ flexShrink: 0 }}>{Icon.lock('var(--accent-deep)', 17)}</span>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Claiming opens once the date's locked. </span>
          <span className="pv-small" style={{ color: 'var(--ink-soft)' }}>{isOrganizer ? 'Lock the date above to open the haul.' : `${event.host} sets the final date.`}</span>
        </div>
      </div>
      <div className="pv-kicker" style={{ marginTop: 18, marginBottom: 10 }}>On the list · {event.items.length}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {event.items.map((i) => (
          <span key={i.id} className="pv-chip pv-small" style={{ background: 'var(--card)', color: 'var(--ink-soft)', fontWeight: 600, maxWidth: '100%', overflowWrap: 'anywhere' }}>{i.label}</span>
        ))}
      </div>
    </div>
  );
}

// post-lock: claiming requires confirming you're actually coming (yes), not just maybe/no
function WebConfirmClaim({ myVote, onConfirm }) {
  const reason = myVote === 'no'
    ? "You're marked can't-make-it for this date."
    : myVote === 'maybe'
    ? "You're down as a maybe for this date."
    : "You haven't confirmed this date yet.";
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '11px 14px', borderRadius: 'var(--r-md)', background: 'var(--marigold-tint)', border: '1.5px solid var(--accent)', marginBottom: 14 }}>
      <span style={{ flexShrink: 0 }}>{Icon.hand('var(--accent-deep)', 17)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Confirm you're coming to claim. </span>
        <span className="pv-small" style={{ color: 'var(--ink-soft)' }}>{reason}</span>
      </div>
      <Button size="sm" style={{ flexShrink: 0 }} onClick={onConfirm}>I'm in</Button>
    </div>
  );
}

function WebPerson({ event, me, p, status }) {
  return (
    <div className="pv-row pv-between" style={{ gap: 10 }}>
      <div className="pv-row" style={{ gap: 10, minWidth: 0 }}>
        <Avatar name={p} size={36} />
        <div style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{p === me ? 'You' : p}</div>
          {p === event.host && <div className="pv-mono" style={{ fontSize: 9.5, color: 'var(--ink-soft)' }}>HOST</div>}
        </div>
      </div>
      {status && <span className="pv-small" style={{ fontWeight: 700, color: status.color, whiteSpace: 'nowrap' }}>{status.label}</span>}
    </div>
  );
}

function WebAttendees({ event, me, columns = 1, locked, finalDateId, attendMap = {} }) {
  const statusFor = (p) => {
    const a = attendMap[p];
    if (a === 'trying') return { label: 'Trying to make it', color: 'var(--maybe)' };
    if (a === 'maybe') return { label: 'Maybe', color: 'var(--maybe)' };
    return { label: 'Coming', color: 'var(--yes)' };
  };
  const cell = (p, showStatus) => (
    <WebPerson key={p} event={event} me={me} p={p} status={showStatus ? statusFor(p) : null} />
  );
  const grid = (people, showStatus) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}>
      {people.map((p) => cell(p, showStatus))}
    </div>
  );

  if (!locked || !finalDateId) return grid(event.participants, false);

  const out = event.participants.filter((p) => attendMap[p] === 'out');
  const coming = event.participants.filter((p) => !out.includes(p));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div className="pv-kicker" style={{ color: 'var(--yes)', marginBottom: 11 }}>Coming · {coming.length}</div>
        {grid(coming, true)}
      </div>
      {out.length > 0 && (
        <>
          <hr className="pv-rule" />
          <div>
            <div className="pv-kicker" style={{ color: 'var(--no)', marginBottom: 11 }}>Can't make it · {out.length}</div>
            <div style={{ opacity: 0.9 }}>{grid(out, false)}</div>
          </div>
        </>
      )}
    </div>
  );
}

// the excluded guest's recovery view (shown above the hero when locked)
function WebGuestExit({ event, me, date, status, claim, onTry, onOut }) {
  if (status === 'out') {
    return (
      <div className="web-card web-card--pad" style={{ borderColor: 'var(--no)', borderWidth: 1.5, borderStyle: 'solid', background: 'var(--no-tint)' }}>
        <span className="pv-chip pv-small" style={{ background: '#fff', color: 'var(--no)', borderColor: 'transparent', fontWeight: 700 }}>You're marked: can't make it</span>
        <h3 className="pv-display pv-h2" style={{ fontSize: 24, marginTop: 12 }}>No worries — we'll catch you next time 🌅</h3>
        <p className="pv-body" style={{ marginTop: 8 }}>
          The group locked <strong style={{ color: 'var(--ink)' }}>{date.dow}, {date.mon} {date.day}</strong>, which you said doesn't work.
        </p>
        <Button variant="ghost" style={{ marginTop: 16 }} onClick={onTry}>Actually, I'll make it</Button>
      </div>
    );
  }
  const trying = status === 'trying';
  return (
    <div className="web-card web-card--pad" style={{ borderColor: 'var(--accent)', borderWidth: 2, borderStyle: 'solid' }}>
      <span className="pv-chip pv-small" style={{ background: 'var(--marigold-tint)', color: 'var(--accent-deep)', borderColor: 'transparent', fontWeight: 700 }}>{Icon.spark('var(--accent)', 13)} Heads up, {me}</span>
      <h3 className="pv-display pv-h2" style={{ fontSize: 24, marginTop: 12 }}>The group locked {date.dow}, {date.mon} {date.day} — you voted no.</h3>
      <p className="pv-body" style={{ marginTop: 8 }}>
        That's the date that worked for most people. {trying ? "You said you'll try — we've saved your spot and kept your original vote on record." : 'Can you still swing by, or should we count you out?'}
      </p>
      {claim && (
        <div className="pv-row" style={{ gap: 10, marginTop: 14, padding: '11px 14px', borderRadius: 'var(--r-sm)', background: 'var(--card-2)', border: '1px solid var(--line)' }}>
          {Icon.hand('var(--accent-deep)', 18)}
          <span className="pv-small" style={{ fontWeight: 600 }}>You're down for <strong>{claim.label}</strong>. If you bow out, we'll free it up for someone else.</span>
        </div>
      )}
      <div className="pv-row" style={{ gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <Button onClick={onTry}>{Icon.check('#fff', 16)} {trying ? "I'm in — keep my spot" : "I'll make it"}</Button>
        <Button variant="ghost" onClick={onOut}>Count me out</Button>
      </div>
    </div>
  );
}

function SectionCard({ kicker, title, right, children, className, style }) {
  return (
    <section className={'web-card web-card--pad ' + (className || '')} style={style}>
      <div className="web-secthead">
        <div><div className="pv-kicker">{kicker}</div><h3 className="pv-h3" style={{ fontSize: 21, marginTop: 4 }}>{title}</h3></div>
        {right}
      </div>
      {children}
    </section>
  );
}

// single-date events are announcements — no vote, guests just RSVP yes / no
function AnnounceHero({ event, date, coming, comingNames, outNames = [], joined, isOrganizer, status, onIn, onOut }) {
  if (!date) return null;
  const iAmIn = status === 'in';
  const iAmOut = status === 'out';
  return (
    <div className="web-card pv-pop" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="pv-row" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--accent-tint)', padding: '26px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 150 }}>
          <div className="pv-mono" style={{ fontSize: 12, color: 'var(--accent-deep)' }}>{date.dow.toUpperCase()}</div>
          <div className="pv-display" style={{ fontSize: 64, lineHeight: 1, margin: '4px 0' }}>{date.day}</div>
          <div className="pv-mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{date.mon}</div>
        </div>
        <div style={{ flex: 1, padding: '24px 30px', minWidth: 240 }}>
          <span className="pv-chip pv-small" style={{ background: 'var(--yes-tint)', borderColor: 'transparent', color: 'var(--yes)' }}>📣 It's happening</span>
          <h2 className="pv-display pv-h2" style={{ marginTop: 12 }}>{date.dow}, {date.mon} {date.day}</h2>
          <div className="pv-row pv-small" style={{ gap: 7, color: 'var(--ink-soft)', marginTop: 6 }}>
            {Icon.clock('var(--ink-soft)', 14)} {date.time} · {Icon.pin('var(--ink-soft)', 14)} {event.location}
          </div>
          <div className="pv-row" style={{ gap: 10, marginTop: 16 }}>
            <AvatarStack names={comingNames} size={30} max={6} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{coming} of {event.participants.length} coming</span>
          </div>
          {outNames.length > 0 && (
            <div className="pv-row" style={{ gap: 9, marginTop: 12, padding: '9px 13px', borderRadius: 'var(--r-sm)', background: 'var(--no-tint)', border: '1px solid rgba(216,90,60,0.22)', flexWrap: 'wrap' }}>
              <AvatarStack names={outNames} size={22} max={4} />
              <span className="pv-small" style={{ fontWeight: 700, color: 'var(--no)' }}>{outNames.join(' & ')} can't make it</span>
            </div>
          )}
          {!joined ? (
            <p className="pv-body pv-small" style={{ marginTop: 14, display: 'flex', gap: 6, alignItems: 'center' }}>{Icon.spark('var(--marigold)', 14)} Add your name below to RSVP — nothing to vote on, just say if you're in.</p>
          ) : isOrganizer ? (
            <p className="pv-body pv-small" style={{ marginTop: 14, display: 'flex', gap: 6, alignItems: 'center' }}>{Icon.spark('var(--marigold)', 14)} One date set — guests just RSVP yes or no. No voting needed.</p>
          ) : (
            <div>
              {(iAmIn || iAmOut) && (
                <p className="pv-body pv-small" style={{ marginTop: 14, fontWeight: 700, color: iAmIn ? 'var(--yes)' : 'var(--no)' }}>
                  {iAmIn ? "You're in — see you there." : "You're marked can't-make-it. Changed your mind?"}
                </p>
              )}
              <div className="pv-row" style={{ gap: 10, marginTop: (iAmIn || iAmOut) ? 10 : 18, flexWrap: 'wrap' }}>
                <Button variant={iAmIn ? 'primary' : 'ghost'} onClick={onIn}>{Icon.check(iAmIn ? '#fff' : 'var(--ink)', 16)} I'm in</Button>
                <Button variant="ghost" onClick={onOut} style={iAmOut ? { borderColor: 'var(--no)', color: 'var(--no)' } : undefined}>Can't make it</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BestHero({ event, heroDate, heroT, yesVoters, isOrganizer, locked, onLock, cantMakeNames = [] }) {
  if (!heroDate) return null;
  return (
    <div className="web-card pv-pop web-besthero" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="pv-row web-besthero__row" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div className="web-besthero__date" style={{ background: 'var(--accent-tint)', padding: '26px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 150 }}>
          <div className="pv-mono" style={{ fontSize: 12, color: 'var(--accent-deep)' }}>{heroDate.dow.toUpperCase()}</div>
          <div className="pv-display" style={{ fontSize: 64, lineHeight: 1, margin: '4px 0' }}>{heroDate.day}</div>
          <div className="pv-mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{heroDate.mon}</div>
        </div>
        <div className="web-besthero__body" style={{ flex: 1, padding: '24px 30px', minWidth: 240 }}>
          <span className="pv-chip pv-small" style={{ background: locked ? 'var(--yes-tint)' : 'var(--marigold-tint)', borderColor: 'transparent', color: locked ? 'var(--yes)' : 'var(--accent-deep)' }}>
            {locked ? "✓ It's official" : <>{Icon.spark('var(--accent)', 13)} Best date so far</>}
          </span>
          <h2 className="pv-display pv-h2" style={{ marginTop: 12 }}>{heroDate.dow}, {heroDate.mon} {heroDate.day}</h2>
          <div className="pv-row pv-small" style={{ gap: 7, color: 'var(--ink-soft)', marginTop: 6 }}>
            {Icon.clock('var(--ink-soft)', 14)} {heroDate.time} · {Icon.pin('var(--ink-soft)', 14)} {event.location}
          </div>
          <div className="pv-row" style={{ gap: 10, marginTop: 16 }}>
            <AvatarStack names={yesVoters} size={30} max={6} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{heroT.yes} of {event.participants.length} can make it</span>
          </div>
          {locked && cantMakeNames.length > 0 && (
            <div className="pv-row" style={{ gap: 9, marginTop: 12, padding: '9px 13px', borderRadius: 'var(--r-sm)', background: 'var(--no-tint)', border: '1px solid rgba(216,90,60,0.22)', flexWrap: 'wrap' }}>
              <AvatarStack names={cantMakeNames} size={22} max={4} />
              <span className="pv-small" style={{ fontWeight: 700, color: 'var(--no)' }}>{cantMakeNames.join(' & ')} can't make it</span>
            </div>
          )}
          {isOrganizer && !locked
            ? <Button onClick={onLock} style={{ marginTop: 18 }}>Lock in this date</Button>
            : !locked && <p className="pv-body pv-small" style={{ marginTop: 14, display: 'flex', gap: 6, alignItems: 'center' }}>{Icon.spark('var(--marigold)', 14)} {event.host} picks the final date once everyone's voted.</p>}
        </div>
      </div>
    </div>
  );
}

function JoinBar({ event, onJoin }) {
  const [name, setName] = useStateWE('');
  const dupe = event.participants.some((p) => p.toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim().length > 1;
  return (
    <div className="web-joinbar">
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: 18 }}>👋 Add your name to join in</div>
        <p className="pv-body pv-small" style={{ marginTop: 3 }}>Vote on dates and claim what you'll bring — no account needed.</p>
      </div>
      <div className="pv-row" style={{ gap: 10 }}>
        <input className="pv-input" value={name} placeholder="Your name" style={{ width: 200, padding: '12px 14px' }}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && valid) onJoin(name.trim()); }} />
        <Button disabled={!valid} onClick={() => onJoin(name.trim())}>Join</Button>
      </div>
      {dupe && <p className="pv-small" style={{ color: 'var(--no)', width: '100%', display: 'flex', gap: 6, alignItems: 'center' }}>{Icon.spark('var(--no)', 13)} Someone's already using that name — add a last initial?</p>}
    </div>
  );
}

function ShareAside() {
  const [copied, setCopied] = useStateWE(false);
  return (
    <SectionCard kicker="Spread the word" title="Invite more friends">
      <div className="pv-row" style={{ gap: 8, background: 'var(--card-2)', border: '1.5px dashed var(--line)', borderRadius: 'var(--r-sm)', padding: '11px 14px', marginBottom: 12 }}>
        {Icon.link('var(--accent-deep)', 17)}<span className="pv-mono" style={{ fontSize: 13, flex: 1 }}>picnivo.com/a7K2f9</span>
      </div>
      <Button variant={copied ? 'primary' : 'ghost'} block onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? Icon.check('#fff', 18) : Icon.copy('var(--ink)', 18)} {copied ? 'Copied!' : 'Copy invite link'}
      </Button>
    </SectionCard>
  );
}

// ---------- main hub ----------
function WebEventHub({ event, setEvent, me, joined, layout, voteStyle, itemStyle, isOrganizer, onToggleRole, onJoin }) {
  const [toast, showToast] = useToast();
  const [outNames, setOutNames] = useStateWE([]);
  const [orphanIds, setOrphanIds] = useStateWE([]);
  const [orphanBy, setOrphanBy] = useStateWE({});
  const [attendOverride, setAttendOverride] = useStateWE({});   // name -> 'coming' | 'trying' (attendance, not a vote)
  const { date: best, tally: bestT } = pvBestDate(event);
  const isAnnouncement = event.dateOptions.length === 1;            // single date → RSVP, no voting
  const announceId = isAnnouncement ? event.dateOptions[0].id : null;
  const locked = isAnnouncement || !!event.finalDate;              // announcement is fixed on its one date
  const finalDateId = isAnnouncement ? announceId : event.finalDate;
  const lockedDate = locked ? event.dateOptions.find((d) => d.id === finalDateId) : null;
  const heroDate = lockedDate || best;
  const heroT = locked ? pvTally(event, finalDateId) : bestT;
  const yesVoters = event.participants.filter((p) => event.votes[p]?.[heroDate?.id] === 'yes');
  const claimed = event.items.filter((i) => i.by).length;

  // Attendance is tracked apart from the recorded vote, so a guest changing their
  // mind after the lock never rewrites the voting history (the date tallies).
  const attendanceOf = (p) => {
    if (outNames.includes(p)) return 'out';
    const o = attendOverride[p];
    if (o) return o;                                  // 'coming' | 'trying'
    const v = event.votes[p]?.[finalDateId];
    if (v === 'no') return 'out';
    if (v === 'maybe') return 'maybe';
    if (v === 'yes') return 'coming';
    return 'undecided';
  };
  const attendMap = {};
  event.participants.forEach((p) => { attendMap[p] = attendanceOf(p); });

  const cantMakeNames = locked ? event.participants.filter((p) => attendMap[p] === 'out') : [];
  const iAmOut = locked && attendMap[me] === 'out';
  const myStatus = attendMap[me] === 'out' ? 'out' : (attendOverride[me] === 'trying' ? 'trying' : 'undecided');
  const myClaim = event.items.find((i) => i.by === me);

  const vote = (dateId, kind) => { setEvent((ev) => ({ ...ev, votes: { ...ev.votes, [me]: { ...(ev.votes[me] || {}), [dateId]: kind } } })); showToast(VOTE_META[kind].label + ' saved'); };
  const claim = (id) => { setEvent((ev) => ({ ...ev, items: ev.items.map((i) => i.id === id && !i.by ? { ...i, by: me } : i) })); setOrphanIds((o) => o.filter((x) => x !== id)); showToast("You're bringing it!"); };
  const unclaim = (id) => setEvent((ev) => ({ ...ev, items: ev.items.map((i) => i.id === id && i.by === me ? { ...i, by: null } : i) }));
  const addItem = (label) => { setEvent((ev) => ({ ...ev, items: [...ev.items, { id: 'wu' + Date.now(), label, by: me }] })); showToast('Added & claimed'); };
  const lock = () => { setEvent((ev) => ({ ...ev, finalDate: best.id })); showToast('Date locked in 🎉'); };

  // ---- excluded-guest recovery ----
  const countOut = () => {
    const mineItems = event.items.filter((i) => i.by === me).map((i) => i.id);
    setEvent((ev) => ({ ...ev, items: ev.items.map((i) => i.by === me ? { ...i, by: null } : i) }));
    setOrphanIds((o) => [...new Set([...o, ...mineItems])]);
    setOrphanBy((m) => { const n = { ...m }; mineItems.forEach((id) => { n[id] = me; }); return n; });
    setOutNames((o) => o.includes(me) ? o : [...o, me]);
    setAttendOverride((m) => { const n = { ...m }; delete n[me]; return n; });
    showToast('Got it — you’re marked out');
  };
  const tryMakeIt = () => {
    const restore = Object.keys(orphanBy).filter((id) => orphanBy[id] === me);
    // Attendance only — keep the recorded "no" vote intact.
    setEvent((ev) => ({ ...ev,
      items: ev.items.map((i) => (restore.includes(i.id) && !i.by) ? { ...i, by: me } : i) }));
    setAttendOverride((m) => ({ ...m, [me]: 'coming' }));
    setOrphanIds((o) => o.filter((x) => !restore.includes(x)));
    setOutNames((o) => o.filter((n) => n !== me));
    showToast("You're in — marked as coming 🎉");
  };

  const comingNames = event.participants.filter((p) => attendMap[p] !== 'out');
  const comingCount = locked ? comingNames.length : 0;
  const myFinalVote = locked ? event.votes[me]?.[finalDateId] : null;     // historical vote, never overwritten
  const confirmedAttend = attendMap[me] === 'coming';
  // 'trying' guests have already declared they'll be there — let them claim without re-confirming
  const canClaim = confirmedAttend || attendMap[me] === 'trying';
  const confirmAttend = () => { setAttendOverride((m) => ({ ...m, [me]: 'coming' })); setOutNames((o) => o.filter((n) => n !== me)); showToast(isAnnouncement ? "You're in — see you there 🎉" : "You're confirmed — claim away 🎉"); };

  const exitEl = (!isAnnouncement && locked && !isOrganizer && iAmOut)
    ? <WebGuestExit event={event} me={me} date={heroDate} status={myStatus} claim={myClaim} onTry={tryMakeIt} onOut={countOut} />
    : null;
  const announceStatus = confirmedAttend ? 'in' : (iAmOut ? 'out' : 'undecided');
  const bestHeroEl = isAnnouncement
    ? <AnnounceHero event={event} date={heroDate} coming={comingCount} comingNames={comingNames} outNames={cantMakeNames} joined={joined} isOrganizer={isOrganizer} status={announceStatus} onIn={confirmAttend} onOut={countOut} />
    : <BestHero event={event} heroDate={heroDate} heroT={heroT} yesVoters={yesVoters} isOrganizer={isOrganizer} locked={locked} onLock={lock} cantMakeNames={cantMakeNames} />;
  const heroEl = exitEl
    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{exitEl}{bestHeroEl}</div>
    : bestHeroEl;
  const datesEl = event.dateOptions.map((d) => <WebDateRow key={d.id} event={event} d={d} me={me} joined={joined} isBest={d.id === heroDate?.id} locked={locked} voteStyle={voteStyle} onVote={vote} />);
  const itemsEl = locked ? (
    <div>
      {canClaim
        ? <p className="pv-body pv-small" style={{ marginBottom: 14, display: 'flex', gap: 7, alignItems: 'center' }}>{Icon.check('var(--yes)', 15)} <span><strong style={{ color: 'var(--ink)' }}>{comingCount} coming</strong> — grab what you'll bring.</span></p>
        : <WebConfirmClaim myVote={myFinalVote} onConfirm={confirmAttend} />}
      <WebItems event={event} me={me} joined={joined} canClaim={canClaim} style={itemStyle} orphanIds={orphanIds} orphanBy={orphanBy} onClaim={claim} onUnclaim={unclaim} onAdd={addItem} />
    </div>
  ) : <WebHaulGated event={event} isOrganizer={isOrganizer} />;
  const haulChip = locked
    ? <span className="pv-chip pv-small">{claimed}/{event.items.length} covered</span>
    : null;
  const crewEl = <WebAttendees event={event} me={me} columns={1} locked={locked} finalDateId={finalDateId} attendMap={attendMap} />;

  // ---- band ----
  const band = (
    <div className="web-eventband">
      <div className="web-eventband__cover"><PicnicScene variant="sunset" slot="wide" /></div>
      <div className="web-eventband__body">
        <div style={{ minWidth: 0 }}>
          <div className="pv-kicker" style={{ overflowWrap: 'anywhere' }}>{event.host} is hosting · {event.location}</div>
          <h1 className="pv-display web-eventband__title" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>{event.title}</h1>
          <p className="pv-body" style={{ marginTop: 8, maxWidth: '54ch', overflowWrap: 'anywhere' }}>{event.note}</p>
        </div>
        <div className="pv-row" style={{ gap: 26, flexShrink: 0 }}>
          <div className="web-stat"><span className="web-stat__num">{event.participants.length}</span><span className="web-stat__lbl">going</span></div>
          <div className="web-stat"><span className="web-stat__num">{claimed}/{event.items.length}</span><span className="web-stat__lbl">items</span></div>
          <button className="pv-chip pv-press" onClick={onToggleRole} style={{ cursor: 'pointer', alignSelf: 'center', background: isOrganizer ? 'var(--accent-tint)' : 'var(--card)', borderColor: isOrganizer ? 'var(--accent)' : 'var(--line)' }}>
            {isOrganizer ? 'Maya · host ⇄' : 'Noah · guest ⇄'}
          </button>
        </div>
      </div>
    </div>
  );

  // ---- layouts ----
  let hub;
  if (layout === 'summary') {
    hub = (
      <div className="web-hub web-hub--summary">
        <div className="web-col">
          {heroEl}
          {!isAnnouncement && (
          <SectionCard kicker="When works?" title={locked ? 'How everyone voted' : 'Vote on the dates'} right={<span className="pv-chip pv-small">{event.participants.length} voted</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{datesEl}</div>
          </SectionCard>
          )}
          <SectionCard kicker="The haul" title="Who brings what" right={haulChip}>{itemsEl}</SectionCard>
        </div>
        <aside className="web-aside">
          <SectionCard kicker="The crew" title={`${event.participants.length} invited`}>{crewEl}</SectionCard>
          <ShareAside />
        </aside>
      </div>
    );
  } else if (layout === 'cards') {
    hub = (
      <div className="web-hub web-hub--cards">
        <div className="web-span2">{heroEl}</div>
        <div className="web-cardgrid">
          {!isAnnouncement && (
          <SectionCard className="web-span2" kicker="When works?" title={locked ? 'How everyone voted' : 'Vote on the dates'} right={<span className="pv-chip pv-small">{event.participants.length} voted</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{datesEl}</div>
          </SectionCard>
          )}
          <SectionCard kicker="The haul" title="Who brings what" right={haulChip}>{itemsEl}</SectionCard>
          <SectionCard kicker="The crew" title={`${event.participants.length} invited`}>
            {crewEl}
            <div style={{ marginTop: 18 }}><ShareAside /></div>
          </SectionCard>
        </div>
      </div>
    );
  } else {
    const TL = ({ children, last }) => (
      <div className="pv-row" style={{ gap: 16, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, boxShadow: '0 0 0 4px var(--accent-tint)' }} />
          {!last && <span style={{ flex: 1, width: 2, background: 'var(--line)', marginTop: 4 }} />}
        </div>
        <div style={{ flex: 1, paddingBottom: 28, minWidth: 0 }}>{children}</div>
      </div>
    );
    hub = (
      <div className="web-hub web-hub--timeline">
        <div style={{ marginBottom: 24 }}>{heroEl}</div>
        {!isAnnouncement && <TL><div className="pv-kicker" style={{ marginBottom: 14 }}>When · vote standings</div><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{datesEl}</div></TL>}
        <TL><div className="web-secthead"><div className="pv-kicker">What to bring</div>{locked && <span className="pv-small" style={{ color: 'var(--ink-soft)' }}>{claimed}/{event.items.length} covered</span>}</div>{itemsEl}</TL>
        <TL last><div className="pv-kicker" style={{ marginBottom: 14 }}>The crew · {event.participants.length}</div><WebAttendees event={event} me={me} columns={2} locked={locked} finalDateId={finalDateId} attendMap={attendMap} /><div style={{ marginTop: 18, maxWidth: 360 }}><ShareAside /></div></TL>
      </div>
    );
  }

  return (
    <div className="web-wrap web-page">
      {band}
      {!joined && <JoinBar event={event} onJoin={onJoin} />}
      {hub}
      {toast}
    </div>
  );
}

Object.assign(window, { WebEventHub, WebVoteControl, StackBarW });
