// picnivo-web-auth.jsx — sign in / sign up with Google authentication
const { useState: useStateAU } = React;

// Standard "G" mark for the Sign in with Google button
function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 010-3.44V4.95H.96a9 9 0 000 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleMark({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#1d1d1f" d="M13.6 9.55c-.02-1.7 1.39-2.52 1.45-2.56-.79-1.16-2.02-1.32-2.46-1.34-1.05-.1-2.04.61-2.57.61-.53 0-1.34-.6-2.21-.58-1.14.02-2.19.66-2.77 1.68-1.18 2.05-.3 5.08.85 6.74.56.81 1.23 1.72 2.11 1.69.85-.04 1.17-.55 2.2-.55 1.02 0 1.31.55 2.21.53.91-.02 1.49-.83 2.05-1.64.65-.94.92-1.85.93-1.9-.02-.01-1.79-.69-1.8-2.73zM11.9 4.5c.47-.57.79-1.36.7-2.15-.68.03-1.5.45-1.98 1.02-.43.5-.81 1.3-.71 2.07.76.06 1.53-.39 1.99-.94z" />
    </svg>
  );
}

// Purpose-built pixel beach-sunset postcard for the tall brand panel.
// Wide horizon strip (viewBox 480x224, 60x28 cells @ 8px): a round sun
// setting into a layered sea with a triangular golden reflection, foam
// crests, clouds, birds and a sailboat on the horizon, then a sandy
// foreground with a beach umbrella, ball, starfish, shells and the logo
// basket resting on a gingham blanket. The middle ~6 cols each side are
// cropped by the cover-slice, so detail lives between cols 8 and 51.
function AuthScene() {
  const R = (c, r, w, h, fill, k) => <rect key={k} x={c * 8} y={r * 8} width={w * 8} height={h * 8} fill={fill} />;

  // sky
  const CLOUDS = [
    [9, 6, 7, 1, '#fff6e6'], [8, 7, 9, 1, '#fff6e6'], [10, 5, 4, 1, '#fffdf4'],
    [42, 4, 6, 1, '#fff6e6'], [41, 5, 8, 1, '#fff6e6'], [43, 3, 3, 1, '#fffdf4'],
    [20, 3, 4, 1, '#fff6e6'], [21, 2, 2, 1, '#fffdf4'],
  ];
  const BIRDS = [
    [16, 5, 1, 1], [17, 6, 1, 1], [18, 5, 1, 1],
    [34, 3, 1, 1], [35, 4, 1, 1], [36, 3, 1, 1],
  ];
  // round sun (11 cells), warm gradient top->bottom, dips at the horizon
  const SUN = [
    [28, 3, 5, 1, '#fff6d8'], [27, 4, 7, 1, '#ffeeb0'], [26, 5, 9, 1, '#ffe199'],
    [25, 6, 11, 1, '#ffd285'], [25, 7, 11, 1, '#ffc873'], [25, 8, 11, 1, '#ffba63'],
    [25, 9, 11, 1, '#ffac54'], [26, 10, 9, 1, '#ffa24e'], [27, 11, 7, 1, '#ff9444'],
  ];
  const SUN_HI = [[28, 5, 3, 1, '#fff4d2'], [28, 6, 4, 1, '#ffe6a8']];
  // sailboat on the horizon
  const BOAT = [
    [43, 7, 1, 3, '#cfa97a'], [44, 7, 1, 1, '#fff7ea'], [44, 8, 2, 1, '#fff7ea'],
    [44, 9, 3, 1, '#fff7ea'], [42, 9, 1, 1, '#ffe9c8'],
    [40, 10, 7, 1, '#b5742e'], [41, 10, 5, 1, '#d89a4f'],
  ];
  // layered sea
  const SEA = [
    [0, 11, 60, 1, '#8fcad9'], [0, 12, 60, 2, '#6db7cd'], [0, 14, 60, 2, '#4fa0bc'],
    [0, 16, 60, 2, '#3a8ca8'], [0, 18, 60, 2, '#2e7e9a'],
  ];
  const FOAM = [
    [10, 13, 4, 1, '#d8f0f6'], [40, 13, 5, 1, '#d8f0f6'],
    [22, 15, 4, 1, '#c2e6f0'], [48, 15, 4, 1, '#c2e6f0'],
    [8, 17, 5, 1, '#bfe0ea'], [44, 17, 4, 1, '#bfe0ea'],
  ];
  // triangular golden reflection under the sun
  const REFLECT = [
    [27, 12, 7, 1, '#ffd9a0'], [28, 13, 5, 1, '#ffca8a'],
    [26, 14, 3, 1, '#ffd9a0'], [30, 14, 2, 1, '#ffd9a0'], [33, 14, 2, 1, '#ffca8a'],
    [28, 15, 5, 1, '#ffca8a'], [25, 16, 4, 1, '#ffd09a'], [31, 16, 2, 1, '#ffd09a'],
    [34, 16, 2, 1, '#ffca8a'], [28, 17, 5, 1, '#ffc78f'], [27, 18, 3, 1, '#ffc78f'],
    [31, 18, 3, 1, '#ffc078'], [29, 19, 3, 1, '#ffc078'],
  ];
  // sand foreground
  const SAND = [
    [0, 20, 60, 1, '#f6e0b4'], [0, 21, 60, 2, '#f0d49a'],
    [0, 23, 60, 2, '#e8c585'], [0, 25, 60, 3, '#dcb673'],
  ];
  const PEBBLE = [[14, 24, 1, 1], [50, 23, 1, 1], [33, 27, 1, 1], [45, 25, 1, 1]];
  const SHELL = [[38, 24, 1, 1], [20, 27, 1, 1], [9, 26, 1, 1]];
  // gingham blanket under the basket
  const BLANKET = [
    [9, 24, 13, 1, '#fff2d8'], [9, 25, 13, 2, '#ffe9c8'],
    [11, 24, 1, 3, '#f3b6a0'], [15, 24, 1, 3, '#f3b6a0'], [19, 24, 1, 3, '#f3b6a0'],
  ];
  // beach umbrella (right foreground, planted at the water's edge)
  const UMBRELLA = [
    [46, 18, 1, 1, '#f15a37'], [44, 19, 5, 1, '#f15a37'], [43, 20, 7, 1, '#e0492a'],
    [45, 19, 1, 1, '#fff7ea'], [47, 19, 1, 1, '#fff7ea'],
    [44, 20, 1, 1, '#fff7ea'], [46, 20, 1, 1, '#fff7ea'], [48, 20, 1, 1, '#fff7ea'],
    [43, 21, 1, 1, '#e0492a'], [45, 21, 1, 1, '#e0492a'], [47, 21, 1, 1, '#e0492a'],
    [49, 21, 1, 1, '#e0492a'], [46, 21, 1, 5, '#8a5420'],
  ];
  // beach ball + starfish
  const BALL = [
    [34, 22, 2, 1, '#f2a93c'], [33, 23, 4, 1, '#f15a37'],
    [33, 24, 4, 1, '#fff7ea'], [34, 25, 2, 1, '#2e7e9a'],
  ];
  const STAR = [[24, 25, 1, 1], [23, 26, 3, 1], [24, 27, 1, 1], [24, 26, 1, 1]];

  const draw = (arr, pre, def) => arr.map((p, i) => R(p[0], p[1], p[2], p[3], p[4] || def, pre + i));

  return (
    <svg className="web-auth__brand-scene" viewBox="0 0 480 224"
      preserveAspectRatio="xMidYMax slice" role="img" aria-hidden="true">
      <g shapeRendering="crispEdges">
        {draw(CLOUDS, 'cl')}
        {draw(BIRDS, 'bd', '#b5742e')}
        {draw(SUN, 'sun')}
        {draw(SUN_HI, 'sh')}
        {draw(BOAT, 'bo')}
        {draw(SEA, 'sea')}
        {draw(FOAM, 'fm')}
        {draw(REFLECT, 'rf')}
        {draw(SAND, 'sd')}
        {draw(PEBBLE, 'pb', '#c99a52')}
        {draw(SHELL, 'sl', '#fff2d8')}
        {draw(BLANKET, 'bk')}
        {draw(BALL, 'bl')}
        {draw(STAR, 'st', '#f2a93c')}
        {draw(UMBRELLA, 'um')}
        <svg x={96} y={150} width={64} height={72} viewBox="60 46 240 252" overflow="visible">
          <g shapeRendering="crispEdges">{renderBasketPixels('as')}</g>
        </svg>
      </g>
    </svg>
  );
}

function AuthField({ label, type = 'text', placeholder, value, onChange, autoComplete }) {
  return (
    <div className="pv-field">
      <label className="pv-label">{label}</label>
      <input className="pv-input" type={type} placeholder={placeholder} value={value}
        autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function WebAuth({ layout = 'split', onAuthed }) {
  const [mode, setMode] = useStateAU('signin');  // 'signin' | 'signup'
  const isUp = mode === 'signup';
  const [name, setName] = useStateAU('');
  const [email, setEmail] = useStateAU('');
  const [pw, setPw] = useStateAU('');
  const [showPw, setShowPw] = useStateAU(false);
  const [remember, setRemember] = useStateAU(true);
  const [agree, setAgree] = useStateAU(false);

  const cardCls = 'web-auth__card' + (layout === 'centered' ? ' web-auth__card--centered' : '');
  const canSubmit = email.trim() && pw.trim() && (!isUp || (name.trim() && agree));

  function submit(e) { e && e.preventDefault(); onAuthed && onAuthed({ name: name || 'You', email, via: 'email' }); }
  function google() { onAuthed && onAuthed({ name: 'You', email: 'you@gmail.com', via: 'google' }); }
  function apple() { onAuthed && onAuthed({ name: 'You', email: 'you@icloud.com', via: 'apple' }); }

  return (
    <div className="web-auth">
      <div className={cardCls}>
        {/* brand panel */}
        <aside className="web-auth__brand">
          <AuthScene />
          <div className="web-auth__brand-top">
            <Logo size={22} />
            <h2 className="web-auth__brandline" style={{ marginTop: 30 }}>
              {isUp ? 'Plan the hang — together.' : 'Welcome back to the picnic.'}
            </h2>
            <p className="web-auth__brandsub">
              From scattered group chat to a ready-to-go plan — pick a date, claim what to bring, all on one shared page.
            </p>
          </div>
          <div className="web-auth__brand-stats">
            <AvatarStack names={['Maya', 'Leo', 'Priya', 'Sam', 'Noah']} size={30} />
            <span>Where good hangs come together</span>
          </div>
        </aside>

        {/* form panel */}
        <main className="web-auth__form">
          <div className="web-auth__formhead">
            <span className="pv-kicker">{isUp ? 'Create account' : 'Sign in'}</span>
            <h1 className="pv-display" style={{ marginTop: 8 }}>{isUp ? 'Join Picnivo' : 'Welcome back'}</h1>
            <p className="pv-body">
              {isUp ? 'Start planning get-togethers everyone actually shows up to.' : 'Sign in to pick dates and rally your crew.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="web-oauth" onClick={google}>
              <GoogleG size={18} /> Continue with Google
            </button>
          </div>

          <div className="web-auth__or">or {isUp ? 'sign up' : 'sign in'} with email</div>

          <form onSubmit={submit}>
            {isUp && (
              <AuthField label="Your name" placeholder="Maya Chen" value={name} onChange={setName} autoComplete="name" />
            )}
            <AuthField label="Email" type="email" placeholder="you@email.com" value={email} onChange={setEmail} autoComplete="email" />

            <div className="pv-field">
              <div className="web-auth__label-row">
                <label className="pv-label">Password</label>
                {!isUp && <span className="web-auth__forgot">Forgot?</span>}
              </div>
              <div className="web-auth__pw">
                <input className="pv-input" type={showPw ? 'text' : 'password'}
                  placeholder={isUp ? 'At least 8 characters' : '••••••••'} value={pw}
                  autoComplete={isUp ? 'new-password' : 'current-password'}
                  onChange={(e) => setPw(e.target.value)} />
                <button type="button" className="web-auth__reveal" onClick={() => setShowPw((s) => !s)}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {isUp ? (
              <label className="web-auth__check" style={{ marginBottom: 4 }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span className="web-auth__box">{agree && Icon.check('#fff', 13)}</span>
                <span>I agree to Picnivo's <a href="#terms" onClick={(e) => e.preventDefault()}>Terms</a> and <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.</span>
              </label>
            ) : (
              <label className="web-auth__check" style={{ marginBottom: 4 }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span className="web-auth__box">{remember && Icon.check('#fff', 13)}</span>
                <span>Keep me signed in on this device</span>
              </label>
            )}

            <Button type="submit" block disabled={!canSubmit} style={{ marginTop: 18 }}>
              {isUp ? 'Create account' : 'Sign in'} {Icon.check('#fff', 16)}
            </Button>
          </form>

          <p className="web-auth__switch">
            {isUp ? 'Already have an account? ' : 'New to Picnivo? '}
            <button type="button" onClick={() => setMode(isUp ? 'signin' : 'signup')}>
              {isUp ? 'Sign in' : 'Create one'}
            </button>
          </p>

          {layout === 'centered' && (
            <p className="web-auth__legal">
              By continuing you agree to our <a href="#terms" onClick={(e) => e.preventDefault()}>Terms</a> &amp; <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { WebAuth, GoogleG });
