// Every guest-facing line, widget and reconfirm page. ONE entry per line, each marked
// "needs Rafa approval" (a test fails if a line lacks the marker).
// Placeholders: {first} {email} {n} {cap} {waiting} {date} {deadline} {eventDate}
//               {time} {min} {currency} {amount} {word} {Word} {recipientLine} {refund}
// {word} / {Word} follow the donation vs contribution decision, so they are not hard-coded.
// Brand rules: no em dashes, no exclamation marks, no emojis, never "journey".

export const strings = {
  tabsLabel: 'Booking type', // needs Rafa approval
  tabs: {
    fullDay: 'Full Day', // needs Rafa approval
    single: 'Single sessions', // needs Rafa approval
  },
  count: {
    spots: '{n} of {cap} spots left', // needs Rafa approval
    full: 'The Full Day is full. {waiting} on the waitlist.', // needs Rafa approval
    fullNoQueue: 'The Full Day is full.', // needs Rafa approval
  },
  closed: {
    title: 'Booking opens on {date}.', // needs Rafa approval
    body: 'Come back then to book your spot.', // needs Rafa approval
  },
  single: {
    intro: 'Choose one or more sessions.', // needs Rafa approval
    legend: 'Sessions', // needs Rafa approval
    full: 'Full. Join the waitlist.', // needs Rafa approval
  },
  wholeDay: {
    tick: "I'm joining for the whole day", // needs Rafa approval
    hint: 'Tick the box to continue.', // needs Rafa approval
  },
  fields: {
    name: 'Full name', // needs Rafa approval
    email: 'Email', // needs Rafa approval
    whatsapp: 'WhatsApp, with country code', // needs Rafa approval
    whatsappHint: 'For example +62 812 3456 7890', // needs Rafa approval
  },
  buttons: {
    free: 'Join for Free', // needs Rafa approval
    donate: 'Join with {Word}', // needs Rafa approval
    waitlist: 'Join the waitlist', // needs Rafa approval
    pay: 'Continue to secure payment', // needs Rafa approval
    skip: 'Skip, keep my free spot', // needs Rafa approval
    orSingle: 'Or book single sessions now', // needs Rafa approval
    bookSingle: 'Book single sessions', // needs Rafa approval
    again: 'Book another guest', // needs Rafa approval
    retry: 'Try again', // needs Rafa approval
    sending: 'One moment', // needs Rafa approval
  },
  amount: {
    title: 'Your spot is held, {first}.', // needs Rafa approval
    intro: 'Choose an amount.', // needs Rafa approval
    other: 'Other', // needs Rafa approval
    otherLabel: 'Your amount ({currency})', // needs Rafa approval
    note: 'Card details are entered on Stripe and never touch this site.', // needs Rafa approval
    handoff: 'Taking you to the secure payment page.', // needs Rafa approval
    handoffLink: 'Continue to payment', // needs Rafa approval
  },
  thanks: {
    free: "You're in, {first}.", // needs Rafa approval
    sessions: 'Your sessions: {list}.', // needs Rafa approval
    fullDay: 'Full Day, {eventDate}.', // needs Rafa approval
    email: 'A confirmation email is on its way to {email}.', // needs Rafa approval
    reconfirm: 'Before {deadline} we will ask you to confirm your Full Day spot by email.', // needs Rafa approval
    paid: 'Thank you. Your {word} has been received.', // needs Rafa approval
    paidBody: 'Your spot is yours. A receipt and confirmation are on their way by email.', // needs Rafa approval
    kept: 'Your payment was not completed. Your free spot is kept.', // needs Rafa approval
  },
  waitlisted: {
    title: "You're on the waitlist, {first}.", // needs Rafa approval
    body: 'If a spot opens, we will email {email} straight away.', // needs Rafa approval
    partial: 'Some sessions were full. You are on the waitlist for those.', // needs Rafa approval
    booked: 'Booked', // needs Rafa approval
    waitlist: 'Waitlist', // needs Rafa approval
  },
  errors: {
    name: 'Enter your name.', // needs Rafa approval
    email: 'Enter a valid email, like name@example.com.', // needs Rafa approval
    whatsapp: 'Enter a WhatsApp number with country code.', // needs Rafa approval
    sessions: 'Choose at least one session.', // needs Rafa approval
    amount: 'Enter an amount of at least {currency} {min}.', // needs Rafa approval
    network: 'We could not reach the booking system. Your details are kept. Please try again.', // needs Rafa approval
    server: 'Something went wrong on our side. Your details are kept. Please try again.', // needs Rafa approval
    rate_limited: 'Too many attempts. Please wait a few minutes and try again.', // needs Rafa approval
    bot: 'We could not verify this request. Please try again.', // needs Rafa approval
    closed: 'Booking is not open yet.', // needs Rafa approval
    full: 'The Full Day has just filled up. You can join the waitlist.', // needs Rafa approval
    session_full: 'One of those sessions is full.', // needs Rafa approval
    in_progress: 'Your booking is being processed. Please wait a moment.', // needs Rafa approval
    not_configured: 'Booking is not available yet.', // needs Rafa approval
    load: 'The booking form could not load. Please refresh the page.', // needs Rafa approval
  },
  reconfirm: {
    title: 'Confirm your Full Day spot', // needs Rafa approval
    intro: "{first}, you're booked for the Radiantly Alive Anniversary on {eventDate}.", // needs Rafa approval
    deadline: 'Please confirm by {deadline}. Unconfirmed spots go to the waitlist.', // needs Rafa approval
    confirm: 'Confirm my spot', // needs Rafa approval
    release: "I can't make it", // needs Rafa approval
    confirmedTitle: 'See you on 1 December, {first}.', // needs Rafa approval
    confirmedBody: 'Your Full Day spot is confirmed. Nothing else to do.', // needs Rafa approval
    releasedTitle: 'Thank you for letting us know.', // needs Rafa approval
    releasedBody: 'Your spot has gone to the next person on the waitlist. You are always welcome to book a single session.', // needs Rafa approval
    closedTitle: 'The confirmation deadline has passed.', // needs Rafa approval
    closedBody: 'Please contact the studio if you still plan to come.', // needs Rafa approval
    alreadyReleasedTitle: 'This spot has been released.', // needs Rafa approval
    alreadyReleasedBody: 'You are welcome to join the waitlist or book a single session.', // needs Rafa approval
    invalidTitle: 'This link is not valid.', // needs Rafa approval
    invalidBody: 'Please use the link in your latest email, or contact the studio.', // needs Rafa approval
    errorTitle: 'Something went wrong.', // needs Rafa approval
    errorBody: 'Nothing has been changed. Please try again in a moment.', // needs Rafa approval
  },
};

export const fmt = (s, vars = {}) =>
  String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));

// {word} and {Word} come from the donation vs contribution decision.
export const withWord = (vars, word) =>
  ({ ...vars, word, Word: word ? word[0].toUpperCase() + word.slice(1) : '' });
