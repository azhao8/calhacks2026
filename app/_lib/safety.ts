// Safety resources for "Need help?" on meetup day (S13) and the menu (S16), from
// docs/safety-resources.md. Not verified yet: a teammate opens each official page on a phone,
// checks the number and hours, then sets `checked: true` on that row. Only checked rows show;
// until then students see the top line and 911 only. Numbers use spaces, never dashes.

export type SafetyRow = {
  name: string;
  phone: string | null; // as shown
  tel: string | null; // for the tel: link
  when: string;
  url: string;
  line: string; // student-facing, as written in the doc
  meetupDay: boolean; // in the short S13 list (the menu shows every row)
  checked: boolean;
};

export const SAFETY_TOP_LINE = "Melos isn't an emergency service, and we don't watch meetups. If you're in danger, call 911.";

export const SAFETY_ROWS: SafetyRow[] = [
  {
    name: "UC Berkeley police, emergency from a cell",
    phone: "510 642 3333",
    tel: "+15106423333",
    when: "Any time",
    url: "https://ucpd.berkeley.edu/make-report",
    line: "On or near campus, this reaches UC Berkeley police straight from your phone.",
    meetupDay: true,
    checked: false,
  },
  {
    name: "Safewalk",
    phone: "510 642 9255",
    tel: "+15106429255",
    when: "Dusk to a 2:30 am last request",
    url: "https://nightsafety.berkeley.edu/nightsafety/escort",
    line: "A free escort can walk with you around campus after dark.",
    meetupDay: true,
    checked: false,
  },
  {
    name: "BART police",
    phone: "510 464 7000",
    tel: "+15104647000",
    when: "Any time",
    url: "https://www.bart.gov/about/police/contact",
    line: "In a BART station or on a train, this reaches BART police directly.",
    meetupDay: true,
    checked: false,
  },
  {
    name: "PATH to Care Center care line",
    phone: "510 643 2005",
    tel: "+15106432005",
    when: "24/7, confidential",
    url: "https://care.berkeley.edu/care-line",
    line: "Confidential support for sexual violence or harassment, any hour, no report needed.",
    meetupDay: true,
    checked: false,
  },
  {
    name: "988 Suicide and Crisis Lifeline",
    phone: "988",
    tel: "988",
    when: "24/7, call or text",
    url: "https://988lifeline.org/get-help/",
    line: "Call or text 988 to talk with someone, day or night.",
    meetupDay: true,
    checked: false,
  },
  {
    name: "UC Berkeley police, non-emergency",
    phone: "510 642 6760",
    tel: "+15106426760",
    when: "24 hours",
    url: "https://ucpd.berkeley.edu/contact-information",
    line: "Call campus police about anything that isn't an emergency, day or night.",
    meetupDay: false,
    checked: false,
  },
  {
    name: "Night Safety Shuttle",
    phone: null,
    tel: null,
    when: "About 7:30 pm to 3:00 am",
    url: "https://nightsafety.berkeley.edu/nightsafety/nightshuttles",
    line: "Free night buses run between campus, Downtown Berkeley BART, and residence halls.",
    meetupDay: false,
    checked: false,
  },
  {
    name: "Door to Door rides",
    phone: "510 642 9255",
    tel: "+15106429255",
    when: "3:00 am to 5:30 am",
    url: "https://nightsafety.berkeley.edu/nightsafety/door2door",
    line: "After 3 am, book a free ride home near campus.",
    meetupDay: false,
    checked: false,
  },
  {
    name: "UHS after-hours counseling",
    phone: "855 817 5667",
    tel: "+18558175667",
    when: "Evenings, weekends, holidays",
    url: "https://uhs.berkeley.edu/counseling/urgent",
    line: "Talk to a counselor when UHS is closed, including nights and weekends.",
    meetupDay: false,
    checked: false,
  },
  {
    name: "Berkeley police, non-emergency",
    phone: "510 981 5900",
    tel: "+15109815900",
    when: "24 hours",
    url: "https://berkeleyca.gov/safety-health/police/report-crime",
    line: "Call Berkeley police about something off campus that isn't an emergency.",
    meetupDay: false,
    checked: false,
  },
  {
    name: "Oakland police, non-emergency",
    phone: "510 777 3333",
    tel: "+15107773333",
    when: "24/7, a phone menu plays first",
    url: "https://www.oaklandca.gov/Public-Safety-Streets/Report-a-Crime/Report-a-Crime-in-Person-or-Phone",
    line: "Call Oakland police about something in Oakland that isn't an emergency.",
    meetupDay: false,
    checked: false,
  },
];

// Rows a student may see: checked ones only, the short list on meetup day and all of them in the menu.
export function visibleSafetyRows(list: "meetup_day" | "menu", rows: SafetyRow[] = SAFETY_ROWS): SafetyRow[] {
  return rows.filter((row) => row.checked && (list === "menu" || row.meetupDay));
}
