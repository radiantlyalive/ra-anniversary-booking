// Every guest-facing line in the widget. All lines need Rafa's approval before launch.
// Brand rules: no em dashes, no exclamation marks, no emojis, never "journey".

export const strings = {
  tabs: { fullDay: 'Full Day', single: 'Single sessions' },             // needs Rafa approval
  spotsLeft: (n, cap) => `${n} of ${cap} places left`,                    // needs Rafa approval
  full: (waiting) => `The Full Day is full. ${waiting} on the waitlist.`, // needs Rafa approval
  wholeDayTick: "I'm joining for the whole day",                         // from the deck
  wholeDayHint: 'Tick the box above to continue.',                       // needs Rafa approval
  fields: { name: 'Full name', email: 'Email', whatsapp: 'WhatsApp, with country code' },
  errors: {
    name: 'Enter your name.',
    email: 'Enter a valid email, like name@example.com.',
    whatsapp: 'Enter a WhatsApp number with country code.',
    sessions: 'Choose at least one session.',
    amount: (min) => `Enter an amount of at least IDR ${min.toLocaleString('en-US')}.`,
    generic: 'Something went wrong. Your details are kept; please try again.',
  },
  buttons: {
    free: 'Join for Free',
    donate: 'Join with Donation',      // word depends on P3
    waitlist: 'Join the waitlist',
    pay: 'Continue to secure payment',
    skip: 'Skip, keep my free place',
    orSingle: 'Or book single sessions now',
  },
  held: (first) => `Your place is held, ${first}.`,                       // needs Rafa approval
  booked: (first) => `You're in, ${first}.`,                              // needs Rafa approval
  thanked: (first) => `Thank you, ${first}. You're in.`,                  // needs Rafa approval
  waitlisted: (first) => `You're on the waitlist, ${first}.`,             // needs Rafa approval
  reconfirm: {
    title: 'Confirm your Full Day place',
    confirm: 'Confirm my place',
    release: "I can't make it",
    confirmed: (first) => `See you on 1 December, ${first}.`,
    released: 'Thank you for letting us know. Your place has gone to the next person on the waitlist.',
  },
};
