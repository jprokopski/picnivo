// picnivo-web-events.jsx — desktop "My events" dashboard
const { useState: useStateEV } = React;

// Static events that belong to "me" — the Sunset Beach Picnic is the LIVE one
// (its card opens the real Event hub); the rest are realistic dashboard fixtures.
const WEB_MY_EVENTS = [
  {
    id: 'farmers', cover: 'sunset', role: 'host', status: 'now',
    title: 'Farmers Market Run', location: 'Ferry Building',
    host: 'You', when: 'Today · happening now',
    going: 5, items: 'In progress',
    crew: ['You', 'Maya', 'Leo', 'Sam', 'Mei'],
  },
  {
    id: 'rooftop', cover: 'sunset', role: 'host', status: 'locked',
    title: 'Rooftop Taco Night', location: 'Mission rooftop',
    host: 'You', when: 'Fri, Jun 20 · 7:00 PM',
    going: 9, items: '6 / 8 claimed',
    crew: ['Leo', 'Priya', 'Sam', 'Noah', 'Ava', 'Diego', 'Mei', 'Jonah', 'You'],
  },
  {
    id: 'hike', cover: 'sunset', role: 'host', status: 'voting',
    title: 'Sunday Trail Hike', location: 'Marin Headlands',
    host: 'You', when: '3 dates · voting open',
    going: 6, items: '2 / 5 claimed',
    crew: ['You', 'Maya', 'Leo', 'Sam', 'Mei', 'Diego'],
  },
  {
    id: 'boardgames', cover: 'sunset', role: 'host', status: 'past',
    title: 'Board Game Afternoon', location: 'My place',
    host: 'You', when: 'Sun, May 18',
    going: 8, items: 'Wrapped',
    crew: ['You', 'Maya', 'Priya', 'Sam', 'Noah'],
  },
];

function EvStatus({ status }) {
  if (status === 'voting') return <span className="web-evstatus web-evstatus--voting">{Icon.clock('var(--accent-deep)', 13)} Voting open</span>;
  if (status === 'locked') return <span className="web-evstatus web-evstatus--locked">{Icon.check('var(--yes)', 14)} Date set</span>;
  return <span className="web-evstatus web-evstatus--past">Wrapped</span>;
}

const WEB_SCENE_VARIANTS = ['sunset', 'sea', 'grove', 'berry'];
function webSceneFor(id) {
  const key = String(id || '');
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n + key.charCodeAt(i)) % 4;
  return WEB_SCENE_VARIANTS[n];
}

function EventCard({ ev, onOpen }) {
  return (
    <button className="web-evcard pv-press" onClick={onOpen} aria-label={'Open ' + ev.title}>
      <div className="web-evcard__cover">
        <PicnicScene variant="sunset" slot="card" />
        <div className="web-evcard__cfor">
          <span className="web-evbadge web-evbadge--host">{Icon.spark('#fff', 12)} Hosting</span>
        </div>
      </div>

      <div style={{ height: 5, background: 'var(--accent)', flexShrink: 0 }} />

      <div className="web-evcard__body">
        <div className="pv-kicker">{ev.location}</div>
        <h3 className="pv-display" style={{ fontSize: 23, marginTop: 5, lineHeight: 1.08 }}>{ev.title}</h3>

        <div className="web-evcard__hostline">
          <Avatar name={ev.host} size={24} />
          <span className="pv-small" style={{ fontWeight: 700, color: 'var(--ink-soft)' }}>
            {ev.host === 'You' ? 'Hosted by you' : ev.host + ' is hosting'}
          </span>
        </div>

        <div className="web-evcard__meta">
          {(() => {
            const v = {
              now:  { bg: 'var(--yes-tint)', color: 'var(--yes)', emote: '🟢', cls: ' web-datechip--now' },
              past: { bg: 'rgba(43,32,24,0.06)', color: 'var(--ink-soft)', emote: '🏁', cls: '' },
            }[ev.status];
            if (v) return (
              <span className={'pv-chip pv-small web-datechip' + v.cls} style={{ background: v.bg, color: v.color, fontWeight: 800 }}>
                <span style={{ fontSize: 12 }}>{v.emote}</span> {ev.when}
              </span>
            );
            return <span className="pv-chip pv-small" style={{ background: 'var(--card-2)' }}>{Icon.clock('var(--ink-soft)', 14)} {ev.when}</span>;
          })()}
        </div>

        <div className="web-evcard__foot" style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div className="pv-row" style={{ gap: 10 }}>
            <AvatarStack names={ev.crew} size={26} max={4} />
            <span className="web-statline">{ev.going} going</span>
          </div>
          <span className="web-evcard__open">Open event <span style={{ fontSize: 16 }}>→</span></span>
        </div>

        <div style={{ marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--line)' }}>
          <span className="pv-small" style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>{ev.items}</span>
        </div>
      </div>
    </button>
  );
}

function WebMyEvents({ event, onOpenEvent }) {
  const [toast, showToast] = useToast();
  const [filter, setFilter] = useStateEV('ongoing');

  // The live card mirrors the real event state so it stays in sync with Create edits.
  const { date: best } = pvBestDate(event);
  const locked = !!event.finalDate;
  const lockedDate = locked ? event.dateOptions.find((d) => d.id === event.finalDate) : best;
  const claimed = event.items.filter((i) => i.by).length;
  const liveCard = {
    id: 'live', live: true, cover: 'sunset',
    role: 'host', status: locked ? 'locked' : 'voting',
    title: event.title || 'Untitled event',
    location: event.location || 'Beach picnic',
    host: 'You',
    when: locked && lockedDate
      ? `${lockedDate.dow}, ${lockedDate.mon} ${lockedDate.day} · ${lockedDate.time}`
      : `${event.dateOptions.length} date${event.dateOptions.length !== 1 ? 's' : ''} · voting open`,
    going: event.participants.length,
    items: `${claimed} / ${event.items.length} claimed`,
    crew: event.participants,
  };

  const hosted = [liveCard, ...WEB_MY_EVENTS.filter((e) => e.role === 'host')];

  const isPast = (e) => e.status === 'past';
  const counts = {
    all: hosted.length,
    ongoing: hosted.filter((e) => !isPast(e)).length,
    past: hosted.filter(isPast).length,
  };
  const visible = hosted.filter((e) =>
    filter === 'all' ? true : filter === 'past' ? isPast(e) : !isPast(e)
  );

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'ongoing', label: 'Ongoing' },
    { id: 'past', label: 'Past' },
  ];

  return (
    <div className="web-wrap web-page">
      <div className="web-events__head">
        <div>
          <div className="pv-kicker" style={{ marginBottom: 10 }}>Your events</div>
          <h1 className="pv-display" style={{ fontSize: 44, lineHeight: 1.08 }}>Events you're hosting.</h1>
          <p className="pv-body" style={{ marginTop: 14, fontSize: 17, maxWidth: '52ch' }}>
            The plans you've set up. Pick up where the group left off — check the votes, the head count, and who's bringing what.
          </p>
        </div>
      </div>

      <div className="web-filters" style={{ marginBottom: 26 }} role="tablist" aria-label="Filter events">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id}
            className={'web-filter' + (filter === f.id ? ' is-active' : '')}
            onClick={() => setFilter(f.id)}>
            {f.label}
            <span className="web-filter__count">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <div className="web-eventgrid">
          {visible.map((ev) => (
            <EventCard key={ev.id} ev={ev}
              onOpen={ev.live ? onOpenEvent : () => showToast('Demo — open the live event to explore it')} />
          ))}
        </div>
      ) : (
        <div className="web-empty">
          <p className="pv-body" style={{ fontSize: 17, color: 'var(--ink-soft)' }}>
            No {filter} events yet.
          </p>
        </div>
      )}

      {toast}
    </div>
  );
}

Object.assign(window, { WebMyEvents, EventCard });
