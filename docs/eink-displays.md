# E-ink displays

A machine's open trouble tickets are served as an image for an e-ink display
mounted on it:

```
GET /equipment/<machine>/trouble-tickets.png?width=800&height=480&tones=4&wait=0
```

`<machine>` is the machine's uuid or its readable slug (`wood-shop-band-saw`).
The address is public - a display cannot log in - and the image only shows what
a member standing at the machine could read anyway: titles, statuses and the
date each was reported, never who reported it.

This page is the contract a display's firmware can rely on. Displays are small
devices that are reflashed rarely and often run deliberately minimal code, so a
change to anything below breaks them silently. Change it only by adding an
option a display asks for, never by changing what an existing request gets.

## Asking

| parameter | meaning | default |
| --- | --- | --- |
| `width`, `height` | the panel's size in pixels, 64 to 2000 | 800, 480 |
| `tones` | how many tones the panel shows: `4`, or `2` for black and white | 4 |
| `wait` | seconds the display will wait for a change (see Polling); over 55 counts as 55 | 0 |

Anything else in the query is ignored. A value that cannot be honoured is
answered `400` with a plain-text reason; an unknown machine is `404`.

## The image

- A PNG exactly `width` × `height`, whatever the content.
- Greyscale (colour type 0), non-interlaced. Never RGBA, palette or
  interlaced.
  - `tones=4`: 2 bits per pixel, `0` black, `1` dark grey, `2` light grey, `3`
    white.
  - `tones=2`: 1 bit per pixel, `0` black, `1` white. Drawn for black and
    white rather than reduced from grey: secondary text is black, separators
    are thin black lines, and anti-aliased edges are cut at mid-grey here, so
    every two-tone panel shows the same picture.
- Drawn from the tickets alone - no clock, no counter - so the same tickets
  always give the same bytes and a display only redraws when something it shows
  has changed.

## Polling

- Every image carries an `ETag` that is a hash of its bytes: equal tags mean
  equal images.
- Send the last tag back as `If-None-Match` and an unchanged image is answered
  `304 Not Modified` with no body - nothing to download, nothing to redraw.
- `Cache-Control: no-cache`: anything in between must check back rather than
  serve a stored copy.
- No cookies. The request is not given a session, so nothing is set on the
  response and a display has nothing to store or send back.

### Waiting for a change

A display that sends `If-None-Match` with the tag it has, and `wait=N`, is held
for up to `N` seconds (55 at most) instead of being answered at once:

- the image changes while it waits: `200` with the new image and tag, as soon
  as the change reaches the app's read model (refreshed every 10 seconds);
- the wait runs out: `304 Not Modified`, as if it had not waited.

A display that does not already have the current image is answered at once,
whatever `wait` says. The cap keeps a held request inside the 60 seconds of
silence after which Fly's proxy drops a connection, so a display can simply
ask again the moment it is answered - one request a minute when nothing
changes, and changes on the glass within seconds. A held request costs a
timer and a read of the read model's event index once a second; the image is
only redrawn when that index moves.
