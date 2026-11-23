# Remote playback and DLNA MediaRenderer plan

## Goal

Extend node-mp3stream with network playback support.

The first remote playback provider is DLNA/UPnP AV MediaRenderer.

node-mp3stream is responsible for:

- SSDP discovery
- maintaining the currently known renderer registry
- reading UPnP device/service descriptions
- controlling AVTransport
- controlling RenderingControl
- querying renderer state
- normalizing renderer capabilities
- providing renderer-safe media URLs
- publishing renderer state through SSE

node-mp3stream is not responsible for:

- the JSMusicDB playlist
- playlist index
- shuffle
- next/previous track decisions
- JSMusicDB continuous-play behaviour
- Last.fm scrobbling
- ListenBrainz scrobbling

JSMusicDB remains the playback authority.

This implementation covers DLNA MediaRenderers only.

Do not implement DLNA MediaServer browsing in this change.

## Existing architecture

The Hono application is initialized in:

    app.js

Existing endpoints use small modules under:

    endpoints/

Relevant existing endpoints are:

    /listen
    /stream
    /progress
    /rescan
    /version

Authentication is provided by:

    modules/validateJwt.js

Current SSE clients are stored by:

    modules/sseClients.js

`/listen` already contains the required building blocks for renderer media
streaming:

- music-root validation
- realpath validation
- path traversal protection
- symlink protection
- MIME detection
- full-file responses
- HTTP byte ranges
- 206 responses
- suffix byte ranges
- 416 handling
- streamed Node/Hono responses

Refactor these concerns rather than implementing renderer streaming separately.

## API namespace

Add remote playback endpoints under:

    /api/playback

Endpoints:

    GET    /api/playback/targets
    POST   /api/playback/discover

    PUT    /api/playback/targets/:id/media

    POST   /api/playback/targets/:id/play
    POST   /api/playback/targets/:id/pause
    POST   /api/playback/targets/:id/stop

    PUT    /api/playback/targets/:id/position
    PUT    /api/playback/targets/:id/volume

    GET    /api/playback/targets/:id/state

    GET    /api/playback/media/:token

Do not implement server-side endpoints for:

    next
    previous
    queue
    shuffle
    repeat

Those are JSMusicDB responsibilities.

## Authentication

All `/api/playback` control endpoints require:

    Authorization: Bearer <jwt>

Validate using the existing `validateJwt()` function.

Create a small reusable bearer-auth helper or middleware rather than duplicating
header parsing in every endpoint.

The pattern already used by the image upload endpoint may be reused.

The media-token endpoint is the exception:

    GET /api/playback/media/:token

It is authenticated using the opaque short-lived media token.

It must not require the JSMusicDB JWT because DLNA renderers cannot reliably
supply the normal JSMusicDB authentication mechanism.

Never embed the JSMusicDB JWT in:

- SetAVTransportURI
- DIDL-Lite metadata
- renderer media URLs
- renderer-visible query strings

## Playback target model

Normalize DLNA devices as:

    {
      "id": "dlna:uuid:abc123",
      "type": "dlna",
      "name": "Living Room",
      "manufacturer": "Denon",
      "model": "AVR-X3800H",
      "available": true,
      "capabilities": {
        "play": true,
        "pause": true,
        "stop": true,
        "seek": true,
        "volume": true,
        "mute": true
      }
    }

Use the UPnP UDN/UUID for stable identity.

Do not use:

- IP address
- hostname
- friendly name

as stable target identity.

Addresses can change while the UUID should remain stable.

## New backend structure

Add:

    endpoints/
      playback/
        targets.js
        discover.js
        load.js
        play.js
        pause.js
        stop.js
        seek.js
        volume.js
        state.js
        media.js

    modules/
      playback/
        auth.js
        targetRegistry.js
        mediaTokens.js
        mediaStream.js

        dlna/
          discovery.js
          device.js
          soap.js
          avTransport.js
          renderingControl.js
          connectionManager.js
          didl.js
          events.js

The exact split may be adjusted while implementing, but keep:

- endpoint concerns
- generic playback concerns
- DLNA protocol concerns

separate.

## Target registry

Create an in-memory registry.

Each discovered renderer should keep at least:

    id
    uuid
    location
    friendlyName
    manufacturer
    model
    available
    lastSeenAt

    services:
      avTransport
      renderingControl
      connectionManager

    capabilities

Do not persist IP addresses as authoritative target information.

SSDP discovery updates the registry.

When the same UUID is rediscovered on another address, update the existing
target.

## Discovery

Implement SSDP M-SEARCH for MediaRenderer devices.

At minimum discover:

    urn:schemas-upnp-org:device:MediaRenderer:1

It is acceptable to use:

    ssdp:all

when required for interoperability, provided non-renderer devices are filtered
after reading device descriptions.

Discovery must:

1. send an SSDP M-SEARCH
2. collect responses for a bounded discovery interval
3. deduplicate by UDN/UUID
4. retrieve the device-description XML
5. identify MediaRenderer devices
6. capture AVTransport/RenderingControl/ConnectionManager service URLs
7. update targetRegistry
8. publish target changes through SSE

Do not block the HTTP discovery request until the entire network discovery has
completed.

`POST /api/playback/discover` returns:

    202 Accepted

Discovery results arrive through SSE and become visible through
`GET /api/playback/targets`.

## GET targets

    GET /api/playback/targets

Response:

    {
      "targets": [...]
    }

Return known renderer targets.

Targets that were recently known but are no longer reachable may temporarily
remain in the registry with:

    available: false

Use a reasonable expiry mechanism rather than immediately permanently deleting
devices after one missed discovery response.

## Capabilities

Use actual service/device information where practical.

Relevant sources include:

- exposed UPnP services
- AVTransport actions
- RenderingControl actions
- ConnectionManager.GetProtocolInfo
- observed operation failures

Do not invent:

- maximum sample rate
- maximum bit depth
- codec support

unless it can actually be derived.

For the first implementation, the critical capabilities are:

    play
    pause
    stop
    seek
    volume
    mute

Runtime capability downgrade is acceptable.

For example, if a renderer advertises Seek but consistently rejects:

    Unit = REL_TIME

the target may be marked as not supporting seek.

## Load media

Implement:

    PUT /api/playback/targets/:id/media

Request:

    {
      "source": {
        "type": "library",
        "path": "/The Gathering/Souvenirs/06 - Heroes for Ghosts.flac"
      },
      "metadata": {
        "id": "track-id",
        "title": "Heroes for Ghosts",
        "artist": "The Gathering",
        "album": "Souvenirs",
        "durationMs": 256000,
        "mimeType": "audio/flac",
        "sampleRate": 44100,
        "bitsPerSample": 16,
        "channels": 2
      },
      "autoplay": true,
      "positionMs": 0
    }

Validate the library path using the same rules as `/listen`.

Do not trust the supplied MIME type without resolving the actual file.

Processing:

1. Resolve target.
2. Validate target availability.
3. Resolve music file under MUSICPATH.
4. Create a temporary media token.
5. Determine the HTTP URL reachable by the renderer.
6. Generate DIDL-Lite metadata.
7. Call SetAVTransportURI.
8. Optionally seek to start position.
9. Optionally call Play.
10. Return a mediaId.

Response:

    {
      "targetId": "dlna:uuid:abc123",
      "mediaId": "c69f5811",
      "state": "loading"
    }

`mediaId` identifies this loaded media operation.

It must be associated with renderer state so stale renderer events can be
distinguished from the current track.

## Renderer-reachable base URL

Do not blindly use the Host header used by JSMusicDB.

A browser may reach node-mp3stream using:

    localhost
    a DNS hostname
    a reverse proxy
    HTTPS

while the renderer needs a LAN-reachable HTTP address.

Implement a configurable base URL, for example:

    PLAYBACK_PUBLIC_URL=http://192.168.1.10:16882

If configured, use it for renderer media URLs.

If it is not configured, derive a LAN-reachable address only when this can be
done safely and predictably.

If no usable address can be determined, reject media loading with:

    MEDIA_NOT_REACHABLE

Do not silently hand the renderer a localhost URL.

## Temporary media tokens

Create `modules/playback/mediaTokens.js`.

Tokens must be:

- cryptographically random
- opaque
- unguessable
- scoped to one media resource
- expiring

Store in memory:

    token -> {
      mediaId,
      targetId,
      filePath,
      expiresAt
    }

A lifetime of several hours is acceptable for the first implementation.

The token must remain valid long enough for:

- long tracks
- pauses
- renderer buffering
- renderer range re-requests

Remove expired tokens periodically/lazily.

Replacing a renderer's media may revoke obsolete tokens after a grace period.

Do not expose the original relative library path in the token.

## Renderer media endpoint

Implement:

    GET /api/playback/media/:token

No JWT is required.

Validate:

1. token exists
2. token is not expired
3. referenced file is still within MUSICPATH
4. file still exists

Support the same streaming behaviour as `/listen`.

Refactor `/listen` streaming into a shared module, for example:

    modules/playback/mediaStream.js

The shared implementation should handle:

- Content-Type
- Content-Length
- Accept-Ranges
- Range
- Content-Range
- 200
- 206
- 404
- 416

Both `/listen` and renderer media must use this common code.

## DIDL-Lite

Generate DLNA metadata for SetAVTransportURI.

Minimum metadata:

    dc:title
    upnp:artist
    upnp:album
    upnp:class = object.item.audioItem.musicTrack
    res

Example resource protocol info:

    http-get:*:audio/flac:*

Escape all XML data correctly.

Never interpolate raw title/artist/album/path values into XML without escaping.

Do not include credentials.

Artwork can be added later if supplying a renderer-reachable image URL is
reliable.

It is not required for initial playback support.

## Play

    POST /api/playback/targets/:id/play

Map to:

    AVTransport.Play

typically:

    InstanceID = 0
    Speed = 1

Return:

    204 No Content

Do not report `playing` merely because the SOAP request returned successfully.

Observed state comes from renderer state/event reporting.

## Pause

    POST /api/playback/targets/:id/pause

Map to:

    AVTransport.Pause

Return:

    204

If unsupported, return the standard playback API error.

## Stop

    POST /api/playback/targets/:id/stop

Map to:

    AVTransport.Stop

Return:

    204

## Seek

    PUT /api/playback/targets/:id/position

Request:

    {
      "positionMs": 127500
    }

Convert milliseconds to DLNA REL_TIME.

Example:

    127500
      ->
    00:02:07

Use:

    AVTransport.Seek
    Unit = REL_TIME

Reject negative or non-finite positions.

If seek is unsupported:

    422

with:

    {
      "error": {
        "code": "UNSUPPORTED_OPERATION",
        "message": "The selected renderer does not support seeking.",
        "targetId": "..."
      }
    }

## Volume

    PUT /api/playback/targets/:id/volume

Request:

    {
      "volume": 0.72,
      "muted": false
    }

API volume is normalized:

    0.0 <= volume <= 1.0

Translate to the renderer's RenderingControl scale.

For normal DLNA renderers this will commonly become 0-100.

Use:

    RenderingControl.SetVolume
    RenderingControl.SetMute

where supported.

Do not use device volume to implement ReplayGain.

## State

Implement:

    GET /api/playback/targets/:id/state

Response:

    {
      "targetId": "dlna:uuid:abc123",
      "transport": "playing",
      "mediaId": "c69f5811",
      "positionMs": 127532,
      "durationMs": 256000,
      "volume": 0.72,
      "muted": false,
      "updatedAt": "..."
    }

Normalize UPnP states:

    PLAYING
      -> playing

    PAUSED_PLAYBACK
      -> paused

    STOPPED
      -> stopped

    TRANSITIONING
      -> transitioning

Unknown/manufacturer-specific states:

      -> unknown

Never fabricate a known state solely from the most recent command.

## State observation

Prefer UPnP event subscriptions when reliable.

Support polling as fallback.

Relevant state comes from:

    AVTransport
    RenderingControl

At minimum obtain:

- transport state
- current position
- duration
- volume where supported
- mute where supported

The implementation may begin with polling and introduce event subscriptions
after transport control is working.

Structure the DLNA layer so polling and event subscriptions feed the same
normalized target-state updater.

## Position polling

Do not poll renderers at excessive frequency.

Approximately one position update per second while playing is sufficient.

When paused, polling can be less frequent.

When stopped/idle, position polling may stop entirely.

Publish state changes immediately when practical.

## SSE refactor

The existing SSE implementation is currently primarily used for scan progress.

Extend:

    modules/sseClients.js

from:

    publishSse(data)

to:

    publishSse(event, data)

Implementation should call:

    client.writeSSE({
      id,
      event,
      data: JSON.stringify(payload)
    })

Carry a monotonically increasing process-local event ID.

Full persistent event replay is not required.

## SSE envelope

Use:

    {
      "eventId": "8472",
      "timestamp": "2026-11-23T09:55:43.381Z",
      "targetId": "dlna:uuid:abc123",
      "data": {}
    }

`targetId` may be omitted for non-playback events.

## SSE event names

Existing scan progress becomes:

    library.scan-progress

Remote playback events:

    playback.target-added
    playback.target-updated
    playback.target-removed

    playback.state
    playback.position
    playback.volume
    playback.ended
    playback.error

## Scan progress compatibility

Refactor `rescan.js` to publish:

    library.scan-progress

Do not break existing JSMusicDB scan-progress UI during rollout.

If required for compatibility, temporarily publish the existing unnamed/message
event alongside the new named event.

Remove backwards compatibility only once the corresponding JSMusicDB minimum
backend version has moved forward.

## Target events

### playback.target-added

Publish for a newly discovered renderer.

Data:

    {
      target: PlaybackTargetDescriptor
    }

### playback.target-updated

Publish when:

- address changes
- friendly name changes
- availability changes
- capabilities change
- device metadata changes materially

### playback.target-removed

Publish when a target expires from the registry.

Data:

    {
      targetId: "dlna:uuid:..."
    }

## Playback state event

Publish:

    playback.state

when transport state changes.

Example data:

    {
      "transport": "playing",
      "mediaId": "c69f5811",
      "positionMs": 127532,
      "durationMs": 256000
    }

## Position event

Publish:

    playback.position

approximately once per second while playing.

Example data:

    {
      "mediaId": "c69f5811",
      "positionMs": 129104,
      "durationMs": 256000
    }

## End detection

Publish:

    playback.ended

when the currently loaded item has actually finished.

Example:

    {
      "mediaId": "c69f5811"
    }

Be careful with DLNA STOPPED.

STOPPED can also result from:

- an explicit Stop command
- renderer/device error
- SetAVTransportURI transition
- user controlling the device outside JSMusicDB

Do not equate every STOPPED transition with end-of-track.

Use position/duration, transport history and target state to distinguish a
natural end from an explicit stop.

If natural end cannot be determined reliably for a renderer, expose enough state
for JSMusicDB to recover rather than generating false end events.

False `ended` events are worse than delayed end detection because JSMusicDB will
advance its playlist.

## SSE reconnect

The browser may reconnect with Last-Event-ID.

Persistent event replay is not required for version one.

After reconnect, JSMusicDB can request:

    GET /api/playback/targets
    GET /api/playback/targets/:id/state

State is therefore recoverable without building an event store.

## Error contract

All playback API errors use:

    {
      "error": {
        "code": "...",
        "message": "...",
        "targetId": "...",
        "details": {}
      }
    }

Supported codes:

    TARGET_NOT_FOUND
    TARGET_UNAVAILABLE
    UNSUPPORTED_OPERATION
    UNSUPPORTED_MEDIA
    MEDIA_NOT_FOUND
    MEDIA_NOT_REACHABLE
    INVALID_POSITION
    UPNP_ERROR
    COMMAND_TIMEOUT
    AUTHENTICATION_REQUIRED
    INTERNAL_ERROR

HTTP status mapping:

    400
      malformed request / invalid value

    401
      missing or invalid JWT

    404
      unknown target or media resource

    409
      operation conflicts with current renderer state

    415
      unsupported media

    422
      target lacks requested capability

    504
      renderer timeout

    500
      internal server error

Do not return raw SOAP/XML errors as the public response.

Log the underlying UPnP error and include safe diagnostic information in
`details` when useful.

## SOAP client

Keep SOAP construction/parsing behind the DLNA module.

An endpoint must not construct SOAP XML directly.

The SOAP layer must:

- correctly XML-escape arguments
- use the service control URL
- set SOAPAction correctly
- have bounded request timeouts
- reject malformed XML responses
- normalize UPnP errors
- avoid unrestricted outbound HTTP requests

Only URLs obtained from a discovered and validated UPnP device description
should be contacted.

## Network security

DLNA necessarily requires node-mp3stream to contact LAN devices.

Do not reuse the general `/proxy` endpoint for DLNA control.

That endpoint deliberately blocks private address space to prevent SSRF.

DLNA needs a separate, constrained network path which only contacts:

- addresses obtained through local SSDP discovery
- service URLs belonging to the discovered device
- expected HTTP/UPnP services

Validate discovered URLs before use.

Do not expose an API accepting an arbitrary renderer/control URL from the
browser.

The browser supplies target IDs only.

## Cache middleware

Update `modules/cache.js`.

Playback control and state endpoints must use:

    Cache-Control: private, no-store

At minimum:

    /api/playback/**

must not receive the normal one-year immutable cache policy.

Renderer media also must not be publicly immutable cached.

## CORS

Current CORS methods allow:

    GET, POST

The new API uses PUT.

Update:

    Access-Control-Allow-Methods

to include:

    PUT

Do not broaden allowed origins.

Continue using the existing trusted-origin allowlist.

## Compression

Do not compress audio media responses.

Review the global Hono `compress()` middleware so:

    /listen
    /api/playback/media/:token

are not inadvertently compressed in a way that interferes with ranges or media
streaming.

If Hono already skips incompressible/ranged binary bodies appropriately, verify
this with tests. Otherwise bypass compression for media endpoints.

## OpenAPI

Extend `openapi.yaml` with:

- bearer-authenticated playback endpoints
- target types
- capabilities
- playback state
- load-media request
- position request
- volume request
- PlaybackApiError
- renderer media endpoint
- SSE named events documentation

Document explicitly that node-mp3stream does not own the playlist.

## Version

Increment node-mp3stream minor version when the new playback API is introduced.

JSMusicDB will use the released version as its initial remote-playback minimum
version.

Do not advertise DLNA support through the current generic SSE version constant
alone.

## Testing priorities

### Media security

Test:

- expired media token
- invalid media token
- token cannot escape MUSICPATH
- symlinks outside MUSICPATH remain rejected
- range requests
- suffix ranges
- malformed ranges
- missing media
- JWT does not appear in generated renderer URI

### Target API

Test:

- unknown target
- unavailable target
- invalid position
- invalid volume
- unsupported operation
- renderer timeout

### Discovery

Mock SSDP/device-description responses.

Test:

- duplicate responses
- same UUID at changed IP
- non-renderer devices
- malformed XML
- missing AVTransport service
- device expiry

### SSE

Test:

- named events
- disconnected clients are removed
- playback event envelope
- scan-progress compatibility
- event IDs increment

### DLNA protocol

Mock SOAP responses for:

- SetAVTransportURI
- Play
- Pause
- Stop
- Seek
- GetTransportInfo
- GetPositionInfo
- GetVolume
- SetVolume
- SetMute

Do not require physical DLNA hardware for the automated test suite.

## Implementation order

### Phase 1: shared media streaming

1. Extract `/listen` streaming internals.
2. Keep existing `/listen` API unchanged.
3. Add media-token store.
4. Add `/api/playback/media/:token`.
5. Test range and path security.

### Phase 2: DLNA discovery

1. Add target registry.
2. Add SSDP discovery.
3. Parse device descriptions.
4. Add GET targets.
5. Add POST discover.
6. Publish target SSE events.

### Phase 3: DLNA transport

1. Add SOAP client.
2. Add DIDL-Lite builder.
3. Add SetAVTransportURI/load.
4. Add play.
5. Add pause.
6. Add stop.
7. Add seek.
8. Add state endpoint.

### Phase 4: observation

1. Add state polling.
2. Publish transport state.
3. Publish position.
4. Implement end detection.
5. Add volume and mute.
6. Add UPnP event subscriptions where useful.

### Phase 5: hardening

1. Renderer-specific failure handling.
2. Runtime capability adjustments.
3. Network URL validation.
4. Expiry/cleanup.
5. OpenAPI update.
6. Logging and diagnostics.

## Acceptance criteria

node-mp3stream can discover DLNA MediaRenderers on the local network.

JSMusicDB can obtain those renderers through an authenticated HTTP API.

JSMusicDB only sends a target ID and a library resource to the backend.

The backend can load a JSMusicDB library track on a renderer.

The renderer obtains the media using an opaque temporary URL.

The renderer never receives the JSMusicDB JWT.

HTTP byte ranges work for renderer media.

Play, pause, stop and seek operate when supported by the renderer.

Actual renderer state is available through REST and SSE.

Natural track completion can generate `playback.ended` without interpreting
every STOPPED state as completion.

The backend never advances the JSMusicDB playlist.

Existing `/listen`, rescan, progress and authentication behaviour continue to
work.

The playback endpoints are documented in OpenAPI.

DLNA MediaServer browsing is explicitly outside the scope of this plan.