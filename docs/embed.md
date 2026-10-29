# Embedding on Squarespace

Requires the Squarespace Business plan or higher; JavaScript in code blocks does not run on lower plans.

1. Build the page as a disabled draft first. Snapshot any live section before replacing it.
2. Add a Code block where the booking box goes (the "Two ways to attend" section in the review drafts) and paste:

```html
<div id="ra-booking" data-api="https://NETLIFY-SITE.netlify.app/api"></div>
<link rel="stylesheet" href="https://NETLIFY-SITE.netlify.app/ra-booking.css">
<script src="https://NETLIFY-SITE.netlify.app/ra-booking.js" defer></script>
```

3. Test on a hidden page with `BOOKING_MODE=sandbox` before switching to live keys.
4. Save and publish are separate confirmations. Publishing needs an explicit yes.
