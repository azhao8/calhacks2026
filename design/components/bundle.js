/* @ds-bundle: {"format":4,"namespace":"Melos","components":[{"name":"Backdrop"},{"name":"MenuButton"},{"name":"Canvas"},{"name":"Wordmark"},{"name":"Button"},{"name":"SpotifyConnectButton"},{"name":"SchoolPicker"},{"name":"QuestionnaireStep"},{"name":"TasteSummary"},{"name":"ConcertCard"},{"name":"ArtistCard"},{"name":"MatchCard"},{"name":"ChatBubble"},{"name":"ConnectorButton"},{"name":"InfoCard"},{"name":"StateView"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  var PATHS = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    pin: 'M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0113 0C18.5 15.2 12 21 12 21zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
    ticket: 'M3 9V6.5h18V9a3 3 0 000 6v2.5H3V15a3 3 0 000-6zM14 6.5v11',
    music: 'M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z',
    spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18',
    at: 'M16 12a4 4 0 11-8 0 4 4 0 018 0zM16 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-3.5 7.1',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    alert: 'M12 8v5M12 16.5v.5M12 3l10 18H2z',
    offline: 'M2 8.5a15 15 0 0120 0M5.5 12a10 10 0 0113 0M9 15.5a5 5 0 016 0M12 19h.01M3 3l18 18',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    back: 'M19 12H5M11 6l-6 6 6 6'
  };
  function Icon(props) {
    return h('svg', { className: cx('ml-icon', props.className), viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
      h('path', { d: PATHS[props.name] || '' }));
  }

  function Wordmark(props) {
    var size = props.size || 'm';
    return h('span', { className: cx('ml-wordmark', 'ml-wordmark--' + size, props.className), role: 'img', 'aria-label': 'Melos' }, 'melos');
  }

  function Canvas(props) {
    var slot = null;
    if (props.image) slot = h('div', { className: 'ml-canvas__slot ml-canvas__slot--image', style: { backgroundImage: 'url(' + props.image + ')' }, 'aria-hidden': 'true' });
    else if (props.pattern) slot = h('div', { className: 'ml-canvas__slot', style: { backgroundImage: props.pattern, backgroundSize: props.patternSize || 'auto' }, 'aria-hidden': 'true' });
    return h('div', { className: cx('ml-canvas', props.image && 'ml-canvas--scrim', props.className), style: props.style, 'data-theme': props.school || undefined },
      h('div', { className: 'ml-canvas__glow', 'aria-hidden': 'true' }),
      slot,
      h('div', { className: 'ml-canvas__grain', 'aria-hidden': 'true' }),
      props.logo === false ? null : h('div', { className: 'ml-canvas__bar' }, h(Wordmark, { size: 'm' }), props.actions || null),
      h('div', { className: 'ml-canvas__body' }, props.children));
  }

  function Button(props) {
    var variant = props.variant || 'primary';
    var rest = Object.assign({}, props);
    ['variant', 'icon', 'iconAfter', 'loading', 'block', 'className', 'children', 'pressed'].forEach(function (k) { delete rest[k]; });
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('ml-btn', 'ml-btn--' + variant, props.block && 'ml-btn--block', props.className),
      'aria-busy': props.loading ? 'true' : undefined,
      'aria-pressed': props.pressed === undefined ? undefined : String(!!props.pressed)
    }),
      props.loading ? h('span', { className: 'ml-spin', 'aria-hidden': 'true' }) : (props.icon ? h(Icon, { name: props.icon }) : null),
      props.children,
      props.iconAfter ? h(Icon, { name: props.iconAfter }) : null);
  }

  function SpotifyConnectButton(props) {
    var state = props.state || 'idle';
    var logo = props.logo || h('span', { className: 'ml-spotify__slot', 'aria-hidden': 'true' }, 'logo');
    if (state === 'connected') {
      return h('div', { className: 'ml-spotify-wrap' },
        h('div', { className: 'ml-spotify-done', role: 'status' },
          h(Icon, { name: 'check' }),
          h('span', null, 'Spotify connected', props.account ? h('span', { className: 'ml-small' }, ' as ' + props.account) : null)),
        props.note ? h('p', { className: 'ml-caption' }, props.note) : null);
    }
    return h('div', { className: 'ml-spotify-wrap' },
      h('button', { type: 'button', className: 'ml-spotify', onClick: props.onClick, 'aria-busy': state === 'connecting' ? 'true' : undefined },
        h('span', { className: 'ml-spotify__logo' }, state === 'connecting' ? h('span', { className: 'ml-spin', 'aria-hidden': 'true' }) : logo),
        state === 'connecting' ? 'Connecting to Spotify' : (props.label || 'Connect Spotify')),
      props.note ? h('p', { className: 'ml-caption', style: { textAlign: 'center' } }, props.note) : null);
  }

  function SchoolPicker(props) {
    var schools = props.schools || [];
    return h('div', { className: 'ml-picker' },
      props.onSearch !== undefined || props.query !== undefined ? h('label', { className: 'ml-stack', style: { gap: '0.375rem' } },
        h('span', { className: 'ml-caption' }, 'Find your school'),
        h('input', { className: 'ml-input', id: props.inputId || 'ml-school-search', type: 'search', placeholder: 'Search by name or city', value: props.query, onChange: props.onSearch, readOnly: !props.onSearch })) : null,
      h('ul', { className: 'ml-schools', role: 'radiogroup', 'aria-label': props.label || 'Your school' },
        schools.map(function (s) {
          var selected = props.value === s.id, soon = s.status === 'soon';
          return h('li', { key: s.id },
            h('button', { type: 'button', role: 'radio', className: 'ml-school', 'aria-checked': String(selected), 'aria-disabled': soon ? 'true' : undefined,
              onClick: function () { if (!soon && props.onChange) props.onChange(s.id); } },
              h('span', { className: 'ml-school__chip', 'aria-hidden': 'true' },
                h('span', { style: { background: (s.colors || [])[0] } }), h('span', { style: { background: (s.colors || [])[1] } })),
              h('span', { className: 'ml-school__text' },
                h('span', { className: 'ml-school__name' }, s.name),
                h('span', { className: 'ml-school__meta' }, soon ? 'Coming soon' : s.city)),
              selected ? h('span', { className: 'ml-school__mark' }, h(Icon, { name: 'check' })) : null));
        })));
  }

  function QuestionnaireStep(props) {
    var total = props.total || 4, step = props.step || 1, value = props.value || [];
    var segs = [];
    for (var i = 1; i <= total; i++) segs.push(h('span', { key: i, className: cx('ml-progress__seg', i <= step && 'ml-progress__seg--done') }));
    var isOn = function (id) { return props.multi ? value.indexOf(id) > -1 : value === id; };
    return h('section', { className: 'ml-step', 'aria-labelledby': (props.id || 'q') + '-title' },
      h('div', { className: 'ml-stack', style: { gap: '0.5rem' } },
        h('div', { className: 'ml-progress', 'aria-hidden': 'true' }, segs),
        h('p', { className: 'ml-caption' }, 'Step ' + step + ' of ' + total)),
      h('div', { className: 'ml-step__head' },
        h('h2', { className: 'ml-title', id: (props.id || 'q') + '-title' }, props.title),
        props.hint ? h('p', { className: 'ml-small' }, props.hint) : null),
      h('div', { className: 'ml-chips', role: props.multi ? 'group' : 'radiogroup', 'aria-labelledby': (props.id || 'q') + '-title' },
        (props.options || []).map(function (o) {
          return h('button', { key: o.id, type: 'button', className: 'ml-chip', role: props.multi ? undefined : 'radio',
            'aria-pressed': props.multi ? String(isOn(o.id)) : undefined, 'aria-checked': props.multi ? undefined : String(isOn(o.id)),
            onClick: function () { if (props.onChange) props.onChange(o.id); } },
            isOn(o.id) ? h(Icon, { name: 'check' }) : null, o.label, o.sub ? h('span', { className: 'ml-chip__sub' }, ' ' + o.sub) : null);
        })),
      h('div', { className: 'ml-step__foot' },
        h(Button, { variant: 'quiet', icon: 'spark', onClick: props.onSurprise }, 'Surprise me'),
        h(Button, { variant: 'primary', iconAfter: 'arrow', onClick: props.onNext }, props.nextLabel || 'Continue')));
  }

  function TasteSummary(props) {
    return h('article', { className: 'ml-card' },
      h('p', { className: 'ml-caption' }, props.eyebrow || 'Here is how you sound'),
      h('p', { className: 'ml-taste__quote' }, props.summary),
      props.artists && props.artists.length ? h('div', { className: 'ml-chips' }, props.artists.map(function (a) { return h('span', { key: a, className: 'ml-tag' }, h(Icon, { name: 'music' }), a); })) : null,
      props.confirmed
        ? h('p', { className: 'ml-ok', role: 'status' }, h(Icon, { name: 'check' }), 'Saved. You can change this anytime.')
        : h('div', { className: 'ml-row' },
          h(Button, { variant: 'primary', onClick: props.onConfirm }, "That's me"),
          h(Button, { variant: 'secondary', onClick: props.onCorrect }, 'Not quite')));
  }

  function ConcertCard(props) {
    var going = !!props.going;
    return h('article', { className: cx('ml-card', going && 'ml-card--selected') },
      h('div', { className: 'ml-row', style: { justifyContent: 'space-between' } },
        props.revealed ? h('span', { className: 'ml-tag' }, props.kind || 'Concert') : h('span', { className: 'ml-tag ml-tag--accent' }, h(Icon, { name: 'spark' }), 'Revealed when you match'),
        props.distance ? h('span', { className: 'ml-caption' }, props.distance) : null),
      h('div', { className: 'ml-stack', style: { gap: '0.25rem' } },
        props.revealed && props.artist ? h('p', { className: 'ml-headline' }, props.artist) : null,
        h('h3', { className: 'ml-concert__day' }, props.day),
        h('p', { className: 'ml-concert__time' }, props.time)),
      h('div', { className: 'ml-card__meta' },
        h('span', null, h(Icon, { name: 'ticket' }), props.price),
        props.revealed && props.venue ? h('span', null, h(Icon, { name: 'pin' }), props.venue) : null),
      h(Button, { variant: going ? 'secondary' : 'primary', pressed: going, block: true, icon: going ? 'check' : null, onClick: props.onToggle },
        going ? 'You can make it' : 'I can make it'));
  }

  function ArtistCard(props) {
    return h('article', { className: 'ml-card' },
      h('div', { className: 'ml-artist__art', role: props.image ? 'img' : undefined, 'aria-label': props.image ? props.name : undefined, style: props.image ? { backgroundImage: 'url(' + props.image + ')' } : undefined }),
      h('div', { className: 'ml-stack', style: { gap: '0.375rem' } },
        h('div', { className: 'ml-row', style: { gap: '0.5rem' } },
          props.local ? h('span', { className: 'ml-tag ml-tag--accent' }, h(Icon, { name: 'pin' }), 'Local') : null,
          (props.genres || []).map(function (g) { return h('span', { key: g, className: 'ml-tag' }, g); })),
        h('h3', { className: 'ml-headline' }, props.name),
        props.why ? h('p', { className: 'ml-small' }, props.why) : null,
        props.next ? h('p', { className: 'ml-small', style: { color: 'var(--ink)' } }, h(Icon, { name: 'calendar' }), ' ', props.next) : null),
      h('a', { className: 'ml-attrib', href: props.spotifyUrl || '#', target: '_blank', rel: 'noopener' },
        props.logo || h('span', { className: 'ml-attrib__logo', 'aria-hidden': 'true' }), 'Listen on Spotify'));
  }

  function MatchCard(props) {
    var stage = props.stage || 'invite';
    var head = h('div', { className: 'ml-match__head' },
      h('p', { className: 'ml-caption', style: { color: 'var(--accent)' } },
        stage === 'invite' ? 'New invitation' : stage === 'confirmed' ? "You're both going" : 'Today'),
      h('h3', { className: 'ml-title' },
        stage === 'dayof' ? 'Look for ' + props.name : stage === 'confirmed' ? 'You and ' + props.name + ' are set' : props.name + ' can make it too'),
      h('div', { className: 'ml-card__meta' },
        h('span', null, h(Icon, { name: 'calendar' }), props.when),
        h('span', null, h(Icon, { name: 'ticket' }), props.price)));
    var body;
    if (stage === 'invite') {
      body = [
        props.event ? h('p', { key: 'e', className: 'ml-headline' }, props.event) : null,
        h('p', { key: 's', className: 'ml-match__shared' }, h(Icon, { name: 'music' }), props.shared),
        h('div', { key: 'a', className: 'ml-row' },
          h(Button, { variant: 'primary', onClick: props.onAccept }, 'Accept'),
          h(Button, { variant: 'secondary', onClick: props.onDecline }, 'Next time')),
        h('p', { key: 'n', className: 'ml-caption' }, 'Saying next time is always fine. ' + props.name + " won't be told why.")];
    } else if (stage === 'confirmed') {
      body = [
        h('div', { key: 'm', className: 'ml-stack', style: { gap: '0.25rem' } },
          h('p', { className: 'ml-caption' }, 'Meeting spot'),
          h('p', { className: 'ml-headline' }, props.meetSpot),
          h('p', { className: 'ml-small' }, props.meetTime)),
        props.ticketDone
          ? h('p', { key: 't', className: 'ml-ok', role: 'status' }, h(Icon, { name: 'check' }), 'Ticket ready')
          : h('div', { key: 't', className: 'ml-row' },
            h('a', { className: 'ml-btn ml-btn--secondary', href: props.ticketUrl || '#', target: '_blank', rel: 'noopener' }, h(Icon, { name: 'ticket' }), 'Get tickets'),
            h(Button, { variant: 'primary', icon: 'check', onClick: props.onTicket }, 'Got my ticket'))];
    } else {
      body = [
        h('div', { key: 'num', className: 'ml-stack', style: { gap: '0.25rem' } },
          h('p', { className: 'ml-caption' }, 'Their Melos number'),
          h('p', { className: 'ml-match__number' }, props.number)),
        h('div', { key: 'm', className: 'ml-card__meta' }, h('span', null, h(Icon, { name: 'pin' }), props.meetSpot + ', ' + props.meetTime)),
        h('div', { key: 'i', className: 'ml-match__ice ml-stack', style: { gap: '0.25rem' } },
          h('p', { className: 'ml-caption' }, 'Something to start with'),
          h('p', null, props.icebreaker))];
    }
    return h('article', { className: cx('ml-card ml-match', stage === 'invite' && 'ml-card--selected') }, head, h('div', { className: 'ml-match__body' }, body));
  }

  function ChatBubble(props) {
    var from = props.from || 'them';
    return h('div', { className: cx('ml-bubble', 'ml-bubble--' + from) },
      from !== 'me' && from !== 'system' && props.name ? h('span', { className: 'ml-sr' }, props.name + ': ') : null,
      props.children,
      props.time ? h('span', { className: 'ml-bubble__time' }, props.time) : null);
  }

  var KIND = { instagram: { icon: 'at', share: 'Share Instagram', sent: 'Instagram sent', label: 'Instagram' }, phone: { icon: 'phone', share: 'Share my number', sent: 'Number sent', label: 'Phone' } };

  function ConnectorButton(props) {
    var k = KIND[props.kind] || KIND.instagram;
    return h('button', { type: 'button', className: 'ml-connector', 'data-sent': props.sent ? 'true' : undefined, 'aria-disabled': props.sent ? 'true' : undefined,
      onClick: props.sent ? undefined : props.onClick },
      h(Icon, { name: props.sent ? 'check' : k.icon }), props.sent ? k.sent : (props.label || k.share));
  }

  function InfoCard(props) {
    var k = KIND[props.kind] || KIND.instagram;
    var copied = React.useState(false);
    function copy() {
      try { navigator.clipboard.writeText(props.value).then(function () { copied[1](true); }, function () {}); } catch (e) {}
    }
    return h('div', { className: 'ml-info' },
      h('span', { className: 'ml-info__icon', 'aria-hidden': 'true' }, h(Icon, { name: k.icon })),
      h('span', { className: 'ml-info__text' },
        h('span', { className: 'ml-caption' }, props.from + "'s " + k.label),
        h('span', { className: 'ml-info__value' }, props.value)),
      h('button', { type: 'button', className: 'ml-btn ml-btn--quiet', onClick: copy, 'aria-label': 'Copy ' + k.label },
        h(Icon, { name: copied[0] ? 'check' : 'copy' }), copied[0] ? 'Copied' : 'Copy'));
  }

  var STATE = {
    loading: { title: 'Finding shows that sound like you', body: 'This takes a few seconds.' },
    empty: { title: 'Nothing this week yet', body: 'New events land every Monday. We will let you know.' },
    error: { title: "We couldn't load your events", body: 'Check your connection and try again.', action: 'Try again', icon: 'alert' },
    offline: { title: "You're offline", body: 'Your plans are saved here and will update when you are back.', icon: 'offline' }
  };
  function StateView(props) {
    var kind = props.kind || 'empty', d = STATE[kind] || STATE.empty;
    if (props.inline && kind === 'offline') {
      return h('div', { className: 'ml-banner', role: 'status' }, h(Icon, { name: 'offline' }), props.title || d.title);
    }
    var visual = kind === 'loading'
      ? h('div', { className: 'ml-state__bars', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'), h('span'))
      : h('div', { className: 'ml-state__icon', 'aria-hidden': 'true' }, h(Icon, { name: d.icon || props.icon || 'calendar' }));
    var action = props.action !== undefined ? props.action : d.action;
    return h('div', { className: cx('ml-state', 'ml-state--' + kind), role: kind === 'error' ? 'alert' : 'status', 'aria-busy': kind === 'loading' ? 'true' : undefined },
      visual,
      h('p', { className: 'ml-headline' }, props.title || d.title),
      h('p', { className: 'ml-small', style: { maxWidth: '22rem' } }, props.body || d.body),
      action ? h(Button, { variant: 'secondary', onClick: props.onAction }, action) : null);
  }

  var OBJECT_PARTS = { speaker: ['a', 'b hot', 'c hot'], headphones: ['a', 'b hot', 'c hot'], cassette: ['a', 'b', 'c'], ticket: ['a', 'b'], records: ['a', 'b'], mic: ['a', 'b', 'c hot'], radio: ['a', 'b', 'c hot'] };
  function Backdrop(props) {
    var obj = props.object || 'none', parts = OBJECT_PARTS[obj];
    return h('div', { className: cx('ml-backdrop', props.quiet && 'ml-backdrop--quiet', props.className), 'aria-hidden': 'true', 'data-theme': props.school || undefined },
      h('div', { className: 'ml-backdrop__haze' }),
      h('div', { className: 'ml-backdrop__streak' }),
      h('div', { className: 'ml-backdrop__core' }),
      h('div', { className: 'ml-backdrop__floor' }),
      parts ? h('div', { className: 'ml-backdrop__cast' }) : null,
      parts ? h('div', { className: 'ml-backdrop__stage ml-o-' + obj }, parts.map(function (p) { return h('div', { key: p, className: p.replace('hot', 'ml-hot') }); })) : null,
      h('div', { className: 'ml-backdrop__vignette' }),
      h('div', { className: 'ml-backdrop__grain' }));
  }

  function MenuButton(props) {
    return h('button', { type: 'button', className: cx('ml-menu-btn', props.className), 'aria-label': props.label || 'Open menu', 'aria-expanded': props.expanded === undefined ? undefined : String(!!props.expanded), onClick: props.onClick },
      h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, h('path', { d: 'M4 9h16M4 15h10' })));
  }

  window.Melos = Object.assign(window.Melos || {}, {
    Backdrop: Backdrop, MenuButton: MenuButton,
    Icon: Icon, Canvas: Canvas, Wordmark: Wordmark, Button: Button, SpotifyConnectButton: SpotifyConnectButton, SchoolPicker: SchoolPicker,
    QuestionnaireStep: QuestionnaireStep, TasteSummary: TasteSummary, ConcertCard: ConcertCard, ArtistCard: ArtistCard,
    MatchCard: MatchCard, ChatBubble: ChatBubble, ConnectorButton: ConnectorButton, InfoCard: InfoCard, StateView: StateView
  });
})();
