// Fixture data shaped by the UI contract in convex/lib/views.ts. Keep these in step with that file:
// if a view gains a field, add it here, or the screens render against stale shapes.

const SCHOOL = { name: "UC Berkeley", themeId: "berkeley" };
const HOUR = 3600 * 1000;

const schools = [
  { _id: "uni_berkeley", name: "UC Berkeley", city: "Berkeley", colors: ["#002676", "#FDB515"], status: "open", themeId: "berkeley" },
  { _id: "uni_ucla", name: "UCLA", city: "Los Angeles", colors: ["#2774AE", "#FFD100"], status: "soon", themeId: "base" },
  { _id: "uni_stanford", name: "Stanford", city: "Stanford", colors: ["#8C1515", "#FFFFFF"], status: "soon", themeId: "base" },
];

function me(onboarding, over = {}) {
  return { userId: "user_me", email: "sam@berkeley.edu", firstName: "Sam", onboarding, school: SCHOOL, isAdmin: false, ...over };
}

const LONG = {
  firstName: "Wolfgangalexandria",
  email: "maximiliana.wolfgangalexandria.longname@eecs.berkeley.edu",
  eventTitle: "An Evening of Baroque Song and Harp Featuring Iestyn Davies, countertenor, and Oliver Wass, harp",
  venue: "Hertz Concert Hall, UC Berkeley Department of Music",
  spot: "The bench to the left of the main doors on University Avenue, across from the bike racks",
};

const access = {
  requested: { status: "requested", refused: false, spotifyEmail: "sam@berkeley.edu" },
  refused: { status: "allowlisted", refused: true, spotifyEmail: "sam.spotify@gmail.com" },
  noCapacity: { status: "no_capacity", refused: false, spotifyEmail: "sam@berkeley.edu" },
  connected: { status: "connected", refused: false, spotifyEmail: "sam@berkeley.edu" },
};

const preferencesCustom = {
  maxTicketPrice: 50,
  meetWho: ["woman", "non_binary"],
  gender: "woman",
  year: "third",
  prefersSimilarYear: true,
  area: "bart",
  source: "custom",
};
const preferencesSurprise = {
  maxTicketPrice: 25,
  meetWho: "anyone",
  gender: null,
  year: null,
  prefersSimilarYear: false,
  area: "berkeley_oakland",
  source: "surprise_me",
};

const taste = {
  summary: "Quiet, lyric heavy indie with a soft spot for live folk and the occasional bedroom pop crush.",
  artists: ["Big Thief", "Adrianne Lenker", "Phoebe Bridgers", "Clairo", "Alex G"],
  labels: ["indie folk", "bedroom pop", "singer songwriter", "lo fi"],
  revision: 0,
  confirmed: false,
};

function card(i, over = {}) {
  const days = ["Monday, Oct 26", "Tuesday, Oct 27", "Wednesday, Oct 28", "Thursday, Oct 29", "Friday, Oct 30", "Saturday, Oct 31", "Sunday, Nov 1", "Monday, Nov 2"];
  const prices = ["$18 to $25", "Free", "Price not listed", "$15 to $30", "$22"];
  return {
    askId: `ask_${i}`,
    dayLabel: days[i % days.length],
    timeLabel: ["7:30 pm", "8:00 pm", "6:00 pm"][i % 3],
    priceLabel: prices[i % prices.length],
    distanceLabel: ["0.6 mi from campus", "2.4 mi from campus", "11.8 mi from campus"][i % 3],
    answer: "pending",
    locked: false,
    ...over,
  };
}

const week3 = [card(0), card(1, { answer: "yes" }), card(2)];
const weekMany = Array.from({ length: 8 }, (_, i) => card(i, { answer: i % 2 ? "yes" : "pending" }));
const weekLong = [
  card(0, { dayLabel: "Wednesday, September 30", timeLabel: "10:30 pm", priceLabel: "$118 to $1,250", distanceLabel: "28.4 mi from campus" }),
  card(1, { locked: true, answer: "yes" }),
];

function plan(stage, over = {}) {
  const base = {
    meetupId: "meetup_1",
    seatId: "seat_me",
    stage,
    event: { title: "Indie folk night", venueName: "The UC Theatre", dayLabel: "Thursday, Oct 29", timeLabel: "8:00 pm", priceLabel: "$22" },
    hook: "You both have Big Thief on repeat.",
    me: { seat: "in", ticket: "none", offerExpiresAt: null, left: false },
    partner: { firstName: "Maya", seat: "in", ticket: "none", left: false },
    notice: null,
    previousPartnerFirstName: null,
    meeting: null,
    ticketUrl: null,
    marker: null,
    icebreaker: null,
    beforeCutoff: true,
    canCantMakeIt: true,
    canLeave: false,
    canShare: false,
  };
  const meeting = {
    spotName: "the bench left of the main doors on University Ave",
    howToFind: "Face the theatre; the bench is just left of the glass doors, under the marquee.",
    directionsUrl: "https://www.openstreetmap.org/directions?to=37.8715,-122.2683",
    meetTimeLabel: "7:30 pm",
  };
  const byStage = {
    offer: { me: { seat: "offered", ticket: "none", offerExpiresAt: Date.now() + 2 * HOUR - 60000, left: false }, partner: { firstName: "Maya", seat: "offered", ticket: "none", left: false } },
    waiting: { partner: { firstName: "Maya", seat: "offered", ticket: "none", left: false } },
    set: { meeting, ticketUrl: "https://www.theuctheatre.org/" },
    meetup_day: { meeting, ticketUrl: "https://www.theuctheatre.org/", marker: 12, icebreaker: "Ask which Big Thief song Maya would play for someone who's never heard them.", canCantMakeIt: true },
    after: { meeting, canCantMakeIt: false, canShare: true },
    called_off: { partner: null, notice: "nobody_by_cutoff", beforeCutoff: false, canCantMakeIt: false },
  };
  const merged = { ...base, ...byStage[stage], ...over };
  return merged;
}

const MEETING = plan("set").meeting;
const TICKET = "https://www.theuctheatre.org/";

const plans = {
  offer: plan("offer"),
  offerExpired: plan("offer", { me: { seat: "offered", ticket: "none", offerExpiresAt: Date.now() - 1000, left: false } }),
  offerLong: plan("offer", {
    partner: { firstName: LONG.firstName, seat: "offered", ticket: "none", left: false },
    event: { title: LONG.eventTitle, venueName: LONG.venue, dayLabel: "Wednesday, September 30", timeLabel: "10:30 pm", priceLabel: "$118 to $1,250" },
    hook: "You both have Sufjan Stevens, Adrianne Lenker and Big Thief on repeat.",
  }),
  waiting: plan("waiting"),
  waitingOpenSeat: plan("waiting", { partner: null, notice: "partner_dropped", previousPartnerFirstName: "Maya" }),
  set: plan("set"),
  setMyTicket: plan("set", { me: { seat: "in", ticket: "got", offerExpiresAt: null, left: false } }),
  setBothTickets: plan("set", { me: { seat: "in", ticket: "got", offerExpiresAt: null, left: false }, partner: { firstName: "Maya", seat: "in", ticket: "got", left: false } }),
  setAfterCutoff: plan("set", { beforeCutoff: false }),
  setLong: plan("set", {
    partner: { firstName: LONG.firstName, seat: "in", ticket: "none", left: false },
    event: { title: LONG.eventTitle, venueName: LONG.venue, dayLabel: "Wednesday, September 30", timeLabel: "10:30 pm", priceLabel: "$118 to $1,250" },
  }),
  // The person who stayed keeps the meeting spot and ticket link while the seat is refilled (convex/plans.ts).
  partnerDropped: plan("waiting", { partner: null, notice: "partner_dropped", previousPartnerFirstName: "Maya", meeting: MEETING, ticketUrl: TICKET }),
  partnerDroppedAfterCutoff: plan("waiting", { partner: null, notice: "partner_dropped", previousPartnerFirstName: "Maya", beforeCutoff: false, meeting: MEETING, ticketUrl: TICKET }),
  refilledOffered: plan("waiting", { partner: { firstName: "Jordan", seat: "offered", ticket: "none", left: false }, notice: "partner_replaced", previousPartnerFirstName: "Maya", meeting: MEETING, ticketUrl: TICKET }),
  refilledSet: plan("set", { partner: { firstName: "Jordan", seat: "in", ticket: "none", left: false }, notice: "partner_replaced", previousPartnerFirstName: "Maya" }),
  meetupDay: plan("meetup_day"),
  meetupDayAtMeeting: plan("meetup_day", { canCantMakeIt: false, canLeave: true, canShare: true, me: { seat: "in", ticket: "got", offerExpiresAt: null, left: false }, partner: { firstName: "Maya", seat: "in", ticket: "got", left: false } }),
  meetupDayPartnerLeft: plan("meetup_day", { canCantMakeIt: false, canLeave: true, canShare: true, notice: "partner_left", partner: { firstName: "Maya", seat: "in", ticket: "got", left: true } }),
  meetupDayILeft: plan("meetup_day", { canCantMakeIt: false, canLeave: true, canShare: true, me: { seat: "in", ticket: "got", offerExpiresAt: null, left: true } }),
  meetupDayLong: plan("meetup_day", {
    partner: { firstName: LONG.firstName, seat: "in", ticket: "got", left: false },
    event: { title: LONG.eventTitle, venueName: LONG.venue, dayLabel: "Wednesday, September 30", timeLabel: "10:30 pm", priceLabel: "$118 to $1,250" },
    meeting: { spotName: LONG.spot, howToFind: "Face the hall. " + LONG.spot, directionsUrl: "https://www.openstreetmap.org/", meetTimeLabel: "10:00 pm" },
    marker: 99,
  }),
  calledOff: plan("called_off"),
  eventPulled: plan("called_off", { notice: "event_pulled" }),
  after: plan("after"),
};

const contacts = {
  one: [{ meetupId: "meetup_1", firstName: "Maya", eventTitle: "Indie folk night", dayLabel: "Thursday, Oct 29", shares: [{ kind: "phone", value: "+15105550123" }, { kind: "instagram", value: "maya.listens" }] }],
  many: Array.from({ length: 9 }, (_, i) => ({
    meetupId: `meetup_${i}`,
    firstName: i === 0 ? LONG.firstName : ["Maya", "Jordan", "Priya", "Leo", "Ana", "Kai", "Noor", "Eli"][i % 8],
    eventTitle: i === 0 ? LONG.eventTitle : "Cal vs Stanford, women's volleyball",
    dayLabel: "Thursday, Oct 29",
    shares: i % 3 === 2 ? [] : [{ kind: "phone", value: "+15105550123" }, ...(i % 2 ? [{ kind: "instagram", value: "a.very.long.instagram.handle.for.testing" }] : [])],
  })),
};

module.exports = { plan, HOUR, LONG, schools, me, access, preferencesCustom, preferencesSurprise, taste, card, week3, weekMany, weekLong, plans, contacts };
