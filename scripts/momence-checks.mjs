// Runs the three Momence checks against the TEST session only.
// Refuses to run unless BOOKING_MODE=sandbox and MOMENCE_TEST_SESSION_ID is set.
if (process.env.BOOKING_MODE !== 'sandbox' || !process.env.MOMENCE_TEST_SESSION_ID) {
  console.error('Set BOOKING_MODE=sandbox and MOMENCE_TEST_SESSION_ID first. Never run against a real session.');
  process.exit(1);
}
console.log('TODO: implement once docs/momence.md is filled in.');
