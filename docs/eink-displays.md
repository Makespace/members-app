# E-ink displays

A machine's open trouble tickets are served as an image for an e-ink display
mounted on it:

```
GET /equipment/<machine>/trouble-tickets.png?width=800&height=480&tones=4
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
