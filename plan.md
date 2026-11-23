# node-mp3stream TypeScript and OpenAPI migration plan

## 1. Goal

Migrate node-mp3stream from JavaScript to TypeScript and make the
node-mp3stream OpenAPI specification the authoritative contract for all public
HTTP APIs.

The OpenAPI specification lives in a separate repository:

    https://github.com/lucienimmink/node-mp3stream-openapi-spec

It is included in this repository as a Git submodule.

The end state must satisfy these principles:

1. All application source code is TypeScript.
2. The OpenAPI specification is the source of truth for the public HTTP API.
3. Request and response types are generated from the OpenAPI specification.
4. Public HTTP handlers are statically checked against generated contract types.
5. Incoming requests are runtime validated against the API contract.
6. JSON responses are contract validated during automated tests.
7. All authenticated endpoints use:

       Authorization: Bearer <jwt>

8. JWTs are never accepted in URLs or query parameters.
9. Generated files are never manually edited.
10. CI detects divergence between:
    - OpenAPI specification
    - generated types
    - registered routes
    - endpoint implementations
11. Internal application/domain code does not depend directly on OpenAPI types.
12. Binary streaming and SSE remain streaming operations and are not buffered
    for validation.
13. Existing functionality must be covered by tests before behavioural changes
    are introduced.

This migration must be performed incrementally.

Do not combine the TypeScript conversion, authentication migration, media API,
SSE redesign and DLNA implementation into one refactoring step.


## 2. Architectural end state

The target architecture is:

    node-mp3stream-openapi-spec
                |
                | Git submodule
                v
         api-spec/openapi.yaml
                |
                | generate
                v
       generated/openapi/*
                |
          +-----+------+
          |            |
          v            v
    static types    runtime contract
          |         validation
          |            |
          +------+- ----+
                 |
                 v
            HTTP adapter
                 |
                 v
        application services
                 |
        +--------+---------+
        |        |         |
        v        v         v
      media    library    playback
                           |
                         DLNA

The OpenAPI boundary ends at the HTTP adapter.

Do not pass generated OpenAPI types deep into application services or
infrastructure.


## 3. Source layout

Migrate the current project towards:

    node-mp3stream/
    |
    +-- api-spec/
    |   +-- openapi.yaml
    |
    +-- src/
    |   |
    |   +-- app.ts
    |   +-- server.ts
    |   |
    |   +-- generated/
    |   |   +-- openapi/
    |   |       +-- schema.d.ts
    |   |       +-- manifest.json
    |   |
    |   +-- openapi/
    |   |   +-- operation.ts
    |   |   +-- request.ts
    |   |   +-- response.ts
    |   |   +-- validation.ts
    |   |   +-- registry.ts
    |   |
    |   +-- middleware/
    |   |   +-- bearerAuth.ts
    |   |   +-- cors.ts
    |   |   +-- errorHandler.ts
    |   |   +-- cache.ts
    |   |
    |   +-- endpoints/
    |   |   +-- authentication/
    |   |   +-- library/
    |   |   +-- artwork/
    |   |   +-- media/
    |   |   +-- events/
    |   |   +-- playback/
    |   |   +-- system/
    |   |
    |   +-- services/
    |   |   +-- authentication/
    |   |   +-- library/
    |   |   +-- media/
    |   |   +-- playback/
    |   |
    |   +-- infrastructure/
    |   |   +-- filesystem/
    |   |   +-- jwt/
    |   |   +-- sse/
    |   |   +-- dlna/
    |   |
    |   +-- domain/
    |       +-- errors.ts
    |       +-- playback.ts
    |       +-- media.ts
    |
    +-- test/
    |   +-- unit/
    |   +-- contract/
    |   +-- integration/
    |   +-- fixtures/
    |
    +-- package.json
    +-- tsconfig.json
    +-- .gitmodules

Do not move every file purely to satisfy this directory structure before its
code is otherwise touched.

Use this as the target structure.


## 4. OpenAPI submodule

Add the OpenAPI repository as:

    api-spec/

The repository must contain the authoritative OpenAPI document.

Expected configuration:

    [submodule "api-spec"]
        path = api-spec
        url = https://github.com/lucienimmink/node-mp3stream-openapi-spec.git
        branch = main

A normal checkout must initialize the submodule:

    git submodule update --init --recursive

To deliberately update the API contract:

    git submodule update --remote api-spec

Updating the submodule changes the contract version used by node-mp3stream and
must therefore be committed explicitly in node-mp3stream.

Never automatically follow an arbitrary newer API-spec commit at runtime or
during deployment.

node-mp3stream must always build against the exact spec commit recorded by the
parent repository.


## 5. TypeScript configuration

Add TypeScript and initially permit checked JavaScript during the migration.

Use a strict configuration.

Example:

    {
      "compilerOptions": {
        "target": "ES2023",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",

        "strict": true,
        "noUncheckedIndexedAccess": true,
        "exactOptionalPropertyTypes": true,
        "noImplicitOverride": true,
        "noFallthroughCasesInSwitch": true,
        "useUnknownInCatchVariables": true,

        "verbatimModuleSyntax": true,
        "resolveJsonModule": true,

        "allowJs": true,
        "checkJs": true,

        "rootDir": ".",
        "noEmit": true,

        "types": [
          "node"
        ]
      },

      "include": [
        "src/**/*.ts",
        "src/**/*.js",
        "test/**/*.ts"
      ]
    }

During the migration:

    allowJs = true
    checkJs = true

At the end of the migration:

    allowJs = false

No production `.js` source files should remain under `src/`.


## 6. Do not add a compile step unless required

Prefer running TypeScript directly using Node.js native TypeScript support if
the Node.js version used by node-mp3stream fully supports the TypeScript syntax
used by this project.

Keep TypeScript syntax erasable where practical.

Do not introduce:

- decorators
- enums requiring transformation
- namespaces
- TypeScript-only runtime constructs

Prefer:

    type
    interface
    const objects
    discriminated unions

If the project's supported Node.js version cannot run the chosen TypeScript
syntax directly and reliably, use a minimal compilation/transformation step.

The production runtime must never depend on type checking.


## 7. OpenAPI toolchain

Use the following responsibilities:

### Redocly CLI

Use for:

- OpenAPI linting
- OpenAPI bundling
- reference validation

### openapi-typescript

Use for:

- generating TypeScript `paths`
- generating TypeScript `operations`
- generating component schema types

Do not hand-write duplicate public API interfaces.

### OpenAPI runtime validator

Use an OpenAPI 3.1 compatible request validator for actual incoming requests.

The validator must support the OpenAPI constructs used by the specification.

Do not assume the generator's compile-time types provide runtime validation.

### Contract response validator

Use the bundled OpenAPI document in automated tests to validate JSON response
status codes, content types and bodies.

Do not buffer streaming media or SSE responses for body validation.


## 8. Generated code

Generate:

    src/generated/openapi/schema.d.ts

from:

    api-spec/openapi.yaml

No generated file may be manually modified.

Generated files should contain a header similar to:

    THIS FILE IS GENERATED.
    DO NOT EDIT.
    Source: api-spec/openapi.yaml

Also generate:

    src/generated/openapi/manifest.json

containing at least:

    {
      "specCommit": "...",
      "generatedAt": "...",
      "generator": "openapi-typescript",
      "generatorVersion": "..."
    }

`specCommit` must be the Git commit checked out in the OpenAPI submodule.


## 9. Generation scripts

Add package scripts equivalent to:

    spec:lint
    spec:bundle
    spec:generate
    spec:check
    typecheck
    test
    test:unit
    test:contract
    test:integration
    validate

The desired validation chain is:

    pnpm run validate

which performs:

    spec lint
        |
        v
    spec bundle
        |
        v
    generate OpenAPI types
        |
        v
    verify generated files unchanged
        |
        v
    TypeScript typecheck
        |
        v
    unit tests
        |
        v
    contract tests
        |
        v
    integration tests

`spec:check` must regenerate generated output and fail when Git detects a
difference.

An updated spec submodule without regenerated contracts must therefore fail CI.


## 10. API contract types

The generated OpenAPI file provides:

    paths
    operations
    components

Use operation IDs as the stable connection between the API definition and
implementation.

Every public operation must have a unique `operationId`.

Examples:

    authenticate
    checkLogin
    createMediaResource
    streamMediaResource
    startLibraryScan
    getScanProgress
    subscribeToEvents
    getPlaybackTargets
    discoverPlaybackTargets
    loadPlaybackMedia
    playPlaybackTarget
    pausePlaybackTarget
    stopPlaybackTarget
    seekPlaybackTarget
    setPlaybackTargetVolume
    getPlaybackTargetState
    getVersion

Do not identify operations internally by manually duplicated URL strings when
an operation ID can be used.


## 11. Operation type utilities

Create:

    src/openapi/operation.ts

Define helpers around generated `operations`.

The application should be able to express:

    JsonRequestBody<'loadPlaybackMedia'>

    JsonResponse<'loadPlaybackMedia', 200>

    PathParameters<'seekPlaybackTarget'>

without handlers containing deeply nested generated type indexing.

These utilities must themselves derive from:

    generated/openapi/schema.d.ts

They may not redefine schemas manually.


## 12. Operation registry

Create an explicit registry mapping every OpenAPI operation to an
implementation.

Conceptually:

    const implementations = {
      authenticate,
      checkLogin,
      createMediaResource,
      streamMediaResource,
      startLibraryScan,
      getScanProgress,
      subscribeToEvents,
      getPlaybackTargets,
      discoverPlaybackTargets,
      loadPlaybackMedia,
      playPlaybackTarget,
      pausePlaybackTarget,
      stopPlaybackTarget,
      seekPlaybackTarget,
      setPlaybackTargetVolume,
      getPlaybackTargetState,
      getVersion,
    } satisfies OperationImplementations;

The TypeScript definition of `OperationImplementations` must be derived from:

    keyof operations

The compiler must fail when:

- the specification introduces an operation without an implementation;
- an implementation references an operation no longer in the spec;
- duplicate operation implementations exist.

Exceptions must be explicit and documented.


## 13. Route registration

Avoid duplicating all routes manually in several places.

The final desired flow is:

    OpenAPI path + method + operationId
                  |
                  v
        implementation registry
                  |
                  v
              Hono route

Create:

    src/openapi/registry.ts

to register route implementations.

Do not make application services aware of Hono.


## 14. HTTP adapter boundary

Each endpoint is an adapter between:

    HTTP/OpenAPI
        |
        v
    application/domain

Endpoint responsibilities are limited to:

- reading validated input
- obtaining authenticated identity
- calling application services
- translating domain output to the documented response
- translating domain errors through centralized error handling

Endpoints must not contain reusable business logic.


## 15. Domain types

Internal services must use internal domain models.

Example:

    interface MediaResource {
      id: string;
      path: string;
      expiresAt: Date;
    }

not:

    components['schemas']['CreateMediaResponse']

OpenAPI types belong to the boundary.

This prevents an HTTP schema change from automatically turning into a
filesystem, DLNA or library-domain change.


## 16. Bearer authentication

All authenticated endpoints use exclusively:

    Authorization: Bearer <jwt>

Create:

    src/middleware/bearerAuth.ts

Responsibilities:

1. Read Authorization header.
2. Require Bearer authentication scheme.
3. Extract token.
4. Validate JWT.
5. Attach authenticated claims to the Hono context.
6. Return the documented authentication error when invalid.

The following mechanisms must be removed:

    ?jwt=
    X-Cred

The server must not silently continue accepting old authentication methods.


## 17. Reject JWTs in URLs

This is a security invariant.

A JWT must never appear in:

- query parameters
- paths
- generated URLs
- media URLs
- SSE URLs
- DLNA URLs
- DIDL-Lite
- logs intentionally produced by application code

Add middleware that detects the legacy query parameter:

    jwt

If present, reject the request.

Do not treat it as authentication.

Tests must explicitly verify this.


## 18. Authentication errors

Authentication errors must use the API's standard error structure where the
OpenAPI operation specifies JSON errors.

Do not return different authentication response shapes from different
endpoints.

The authentication middleware and central error middleware own this mapping.


## 19. Domain errors

Create:

    src/domain/errors.ts

Use specific domain errors, such as:

    AuthenticationRequiredError
    InvalidRequestError

    MediaNotFoundError
    MediaNotReachableError

    TargetNotFoundError
    TargetUnavailableError

    UnsupportedOperationError
    UnsupportedMediaError

    InvalidPositionError
    CommandTimeoutError

Internal services throw domain errors, not Hono responses.


## 20. Central error mapping

Create:

    src/middleware/errorHandler.ts

Map domain errors into OpenAPI responses.

Examples:

    AuthenticationRequiredError
        -> 401

    MediaNotFoundError
        -> 404 MEDIA_NOT_FOUND

    TargetNotFoundError
        -> 404 TARGET_NOT_FOUND

    TargetUnavailableError
        -> 409 TARGET_UNAVAILABLE

    UnsupportedMediaError
        -> 415 UNSUPPORTED_MEDIA

    UnsupportedOperationError
        -> 422 UNSUPPORTED_OPERATION

    CommandTimeoutError
        -> 504 COMMAND_TIMEOUT

Unhandled errors:

        -> 500 INTERNAL_ERROR

Unknown internal exception details must not be exposed to API consumers.

Log the original error internally.


## 21. Request runtime validation

Every non-streaming public operation must be validated against OpenAPI before
its handler executes.

Validate:

- path parameters
- query parameters
- headers
- Content-Type
- JSON body
- required values
- enums
- min/max constraints
- string formats where appropriate

Invalid input must never reach application services.

Validation errors must produce a consistent 400 response.


## 22. Content-Type validation

Do not silently accept arbitrary request formats.

For example, an operation documented as:

    application/json

must reject an incompatible Content-Type when it has a body.

Multipart endpoints must independently validate:

    multipart/form-data

Binary streaming endpoints are separate.


## 23. Response typing

Handlers returning JSON must be statically restricted to responses documented
for their operation.

For example, `loadPlaybackMedia` may return:

    200
    400
    401
    404
    409
    415
    422
    500
    504

It must not casually introduce:

    201

without first changing the OpenAPI specification.

The TypeScript handler abstraction should make undocumented response status
codes difficult or impossible to return.


## 24. Response runtime validation

During tests, validate all JSON responses against OpenAPI.

Validation covers:

- documented status code
- documented content type
- body schema
- required fields
- enum values
- additionalProperties rules

Response validation should also be available in a development-only mode.

Do not enable expensive response body validation by default in production.


## 25. Streaming endpoints

Do not buffer media responses.

Streaming operations include at least:

    GET /api/media/{token}

Streaming contract tests validate:

- HTTP status
- Content-Type
- Content-Length
- Accept-Ranges
- Content-Range
- requested bytes
- end-of-stream behaviour

They do not validate the entire body using a JSON schema.


## 26. Temporary media resource architecture

Browser audio and DLNA playback both use:

    POST /api/media

to obtain an opaque temporary media URL.

Then:

    GET /api/media/{token}

retrieves the stream.

The JWT is only supplied to:

    POST /api/media

using Bearer authentication.

The media URL itself contains no JWT.


## 27. Extract media streaming logic

Refactor the current `/listen` implementation.

Move shared filesystem and Range logic into an internal media service.

Responsibilities include:

- MUSICPATH resolution
- realpath validation
- traversal protection
- symlink protection
- file existence
- MIME type
- byte ranges
- suffix ranges
- Content-Range
- Content-Length
- stream creation

Do not copy the current streaming logic into the new endpoint.

Use one implementation.


## 28. `/listen` removal strategy

The old authenticated URL pattern:

    /listen?path=...&jwt=...

must not remain functional.

Because this migration explicitly accepts a breaking change, do not preserve
legacy query JWT behaviour.

Once `/api/media` is implemented and JSMusicDB has migrated, remove `/listen`
from the exposed API and implementation.

If a transitional response is useful, `/listen` may temporarily return:

    410 Gone

without accepting or validating a query JWT.

Do not redirect because that would risk propagating the old URL and JWT.


## 29. SSE authentication

`/stream` uses:

    Authorization: Bearer <jwt>

The server must not accept:

    /stream?jwt=...

JSMusicDB will consume the stream with Fetch rather than native EventSource.


## 30. SSE implementation

Keep SSE streaming efficient and asynchronous.

SSE payload types must derive from OpenAPI component schemas.

Create:

    src/infrastructure/sse/

with:

    clients.ts
    publisher.ts
    events.ts

Use a typed event map.

Conceptually:

    interface SseEventMap {
      'library.scan-progress': LibraryScanEventData;
      'playback.target-added': PlaybackTargetEventData;
      'playback.target-updated': PlaybackTargetEventData;
      'playback.target-removed': PlaybackTargetRemovedEventData;
      'playback.state': PlaybackStateEventData;
      'playback.position': PlaybackPositionEventData;
      'playback.volume': PlaybackVolumeEventData;
      'playback.ended': PlaybackEndedEventData;
      'playback.error': PlaybackErrorEventData;
    }

`publishSse()` is generic over the event name.

TypeScript must reject invalid payloads.


## 31. SSE event envelope

Every event uses:

    {
      eventId,
      timestamp,
      targetId?,
      data
    }

The SSE `id:` field and the JSON `eventId` field must refer to the same event.

IDs may be process-local.

Persistent SSE history is not required.


## 32. SSE tests

Test:

- authentication required
- query JWT rejected
- proper `text/event-stream`
- event name
- event ID
- envelope
- JSON payload
- disconnected clients removed
- multiple clients receive an event
- one broken client does not prevent other clients receiving an event
- event IDs increment
- playback payload compile-time typing
- library scan payload compatibility


## 33. TypeScript migration order

Migrate infrastructure bottom-up.

Recommended order:

### Phase A

Convert:

    config
    simple utilities
    JWT validation
    filesystem utilities
    logging

### Phase B

Convert:

    middleware
    CORS
    cache rules
    authentication

### Phase C

Convert simple endpoints:

    /version
    /public-key
    /login
    /progress

### Phase D

Convert:

    /authenticate
    /rescan
    /image
    /proxy

### Phase E

Implement:

    /api/media
    /api/media/{token}

### Phase F

Convert SSE.

### Phase G

Implement playback/DLNA APIs directly in TypeScript.

Avoid writing new playback code in JavaScript.


## 34. Characterization tests before conversion

Before materially changing an existing JavaScript module, write tests describing
its current required behaviour.

Priority areas:

- JWT validation
- MUSICPATH security
- range streaming
- image proxy SSRF protection
- authentication
- rescan state
- SSE connection handling

A TypeScript conversion commit should ideally change types and structure, not
functional behaviour.


## 35. Unit tests

Unit tests cover isolated code.

At minimum test:

### Authentication

- valid JWT
- expired JWT
- malformed JWT
- missing Authorization header
- wrong authentication scheme
- `jwt` query parameter rejected

### Media path resolution

- valid relative path
- leading slash
- `..` traversal
- encoded traversal where applicable
- symlink inside root
- symlink escaping root
- nonexistent path
- directory instead of file

### Range parser

- no range
- explicit range
- open-ended range
- suffix range
- first byte
- last byte
- range larger than file
- start past EOF
- reversed range
- malformed range
- multiple ranges if unsupported

### Media tokens

- generated token has sufficient entropy
- token resolves correct resource
- token scope
- expiration
- unknown token
- revoked token
- cleanup
- original path not encoded in token

### Errors

- each domain error maps to expected HTTP status
- expected error code
- internal exception maps to generic 500
- internal stack/error data does not leak


## 36. Contract tests

Contract tests exercise the Hono application as HTTP without requiring an
external server process.

For every OpenAPI JSON operation:

1. send a valid request;
2. verify status is documented;
3. verify Content-Type;
4. validate JSON body against OpenAPI;
5. test required parameter failure;
6. test authentication where applicable.

Build reusable contract helpers rather than separate validator setup in every
test.


## 37. Operation coverage test

Parse the bundled OpenAPI specification.

Extract all:

    operationId

values.

Compare them with the operation implementation registry.

Fail when:

    spec operations != implemented operations

The error should report:

- missing implementations
- unknown implementations
- duplicate operation IDs


## 38. Route coverage test

For every operation in OpenAPI, verify that Hono has a reachable route with the
documented:

- HTTP method
- path

Do not rely on operation implementation coverage alone.

A handler that exists but is not registered is still a broken API.


## 39. Authentication contract tests

For every authenticated operation, test:

### Missing token

Expect:

    401

### Invalid Bearer token

Expect:

    401

### Valid Bearer token

Request proceeds to endpoint validation/implementation.

### JWT in query

For example:

    ?jwt=abc

Expect rejection.

### JWT only in query

Must never authenticate.

### X-Cred

Must never authenticate.

This prevents authentication regressions during migration.


## 40. OpenAPI validation tests

The OpenAPI document itself must pass:

- Redocly lint
- OpenAPI 3.1 parsing
- all `$ref` resolution
- unique operation IDs

Fail CI for warnings considered contract defects.

Prefer explicit Redocly configuration over relying on defaults.


## 41. Integration tests

Integration tests combine real infrastructure components where useful.

Test at minimum:

### Media lifecycle

    authenticate/test token
        -> POST /api/media
        -> GET returned media capability
        -> bytes equal source file

### Range lifecycle

    POST /api/media
        -> GET Range bytes=...
        -> validate 206/body

### SSE

    open authenticated stream
        -> trigger library event
        -> receive expected named event

### Authentication

    authenticated operation
        -> valid response

    same operation with query JWT
        -> rejected


## 42. Test filesystem

Never use the developer's actual MUSICPATH during tests.

Create temporary test libraries containing fixtures such as:

    music/
      track.mp3
      track.flac
      nested/
        track.ogg

and controlled symlinks.

Clean temporary directories after tests.


## 43. DLNA unit and integration testing

DLNA implementation should not require physical hardware for CI.

Provide test doubles for:

- SSDP
- UPnP device descriptions
- SOAP endpoints
- ConnectionManager
- AVTransport
- RenderingControl

Use fixture XML for representative devices.

Tests must cover:

- target discovered
- duplicate target
- same UUID at new IP
- malformed device XML
- missing AVTransport
- pause unsupported
- seek unsupported
- command timeout
- UPnP error
- media load
- transport state normalization
- renderer volume normalization
- natural end detection
- explicit stop is not interpreted as natural end


## 44. Security validation

Security tests are mandatory.

### JWT leakage

Inspect generated media URL:

    expect(url).not.toContain(jwt)

Inspect DIDL metadata:

    expect(didl).not.toContain(jwt)

Inspect exposed SSE URL:

    must contain no JWT

### Path traversal

Test raw and encoded traversal candidates.

### SSRF

Retain existing `/proxy` external-network restrictions.

Do not reuse `/proxy` for DLNA.

DLNA network access is limited to devices discovered on the local network and
their validated UPnP service URLs.

### Media token

Attempt random/modified tokens and ensure access is denied.

### CORS

Verify only configured trusted UI origins receive allowed CORS headers.

Verify:

    Authorization

is permitted.

Verify:

    GET
    POST
    PUT

are permitted when used by the spec.


## 45. Logging security

Never log:

- Authorization header
- raw JWT
- passwords
- encrypted authentication payload unnecessarily
- media capability token at normal log level
- complete media capability URL at normal log level

Logging middleware must redact:

    Authorization

If request headers are logged in development, redact the value.

Avoid logging complete URLs containing sensitive capability tokens.


## 46. Cache validation

Authenticated API responses must not accidentally receive long-lived public
caching.

Verify:

    /api/**
    /stream

use appropriate no-store/private behaviour.

Do not apply immutable cache headers to:

- authentication responses
- playback state
- target lists
- media capability creation
- SSE

Streaming media may use its own deliberate cache policy.


## 47. Regression tests for current features

Before removing JavaScript equivalents, confirm:

- authentication works
- public key works
- artwork retrieval works
- artwork upload works
- image proxy security works
- rescanning works
- progress reporting works
- SSE works
- media streaming works
- HTTP Range works
- version endpoint works


## 48. Type-level tests

Where useful, add compile-only tests proving invalid endpoint implementations
fail TypeScript.

Examples:

A handler returning:

    {
      volume: "72"
    }

where OpenAPI requires a number must not compile.

An unknown operation ID:

    "playTrack"

must not compile.

An invalid SSE payload must not compile.

These tests can use:

    // @ts-expect-error

to assert known invalid examples.


## 49. Generated-code drift validation

CI must execute generation and then:

    git diff --exit-code

against generated OpenAPI files.

This detects:

- spec changed but generation forgotten
- generator version changed output
- generated output edited manually

The generation process must be deterministic.


## 50. Package lock determinism

Commit the package lock file.

Generator, validator and lint tool versions must be pinned through the package
manager.

Do not depend on globally installed OpenAPI tools in CI.


## 51. CI pipeline

Use this logical order:

    checkout
      |
      v
    initialize submodules
      |
      v
    package install
      |
      v
    OpenAPI lint
      |
      v
    OpenAPI bundle
      |
      v
    OpenAPI generation
      |
      v
    generated drift check
      |
      v
    TypeScript typecheck
      |
      v
    unit tests
      |
      v
    contract tests
      |
      v
    integration tests
      |
      v
    security-focused tests

The repository checkout must include:

    submodules: recursive


## 52. OpenAPI breaking-change validation

Compare the new API specification against the most recently released contract.

Automatically detect changes such as:

- removed endpoint
- removed response
- removed property
- required property added
- request narrowed
- response narrowed
- operation ID changed
- authentication changed

A breaking change must be intentional.

The Bearer-only authentication migration is an intentional breaking change.

Once complete, future accidental breaking changes must fail CI.


## 53. API versioning

Version the OpenAPI contract independently from the node-mp3stream application.

Example:

    node-mp3stream-openapi-spec
        1.0.0

    node-mp3stream
        6.0.0

The Bearer-only authentication migration is a major node-mp3stream change
because existing clients using query JWT or X-Cred stop working.

Do not make application and contract version numbers artificially identical.


## 54. Development workflow

Normal code change:

    git pull
    git submodule update --init --recursive
    npm ci
    npm run validate

Intentional API update:

    cd api-spec
    git checkout main
    git pull
    cd ..

or:

    git submodule update --remote api-spec

Then:

    npm run spec:generate
    npm run validate
    git add api-spec src/generated
    git commit

Review the OpenAPI submodule commit change and generated contract diff together.


## 55. Code review rules

Reject changes that:

- add request/response interfaces duplicating OpenAPI
- manually edit generated code
- accept JWT in query parameters
- introduce a public route missing from OpenAPI
- introduce an OpenAPI operation without implementation
- return undocumented status codes
- bypass runtime validation without a documented streaming reason
- put Hono response objects inside domain/application services
- use OpenAPI-specific types in DLNA or filesystem infrastructure unnecessarily


## 56. Migration phase 1: safety net

Before structural migration:

1. Add test infrastructure.
2. Add characterization tests.
3. Add tests for media Range handling.
4. Add path/security tests.
5. Add authentication tests.
6. Add SSE tests.
7. Get existing tests green.

No API behaviour change in this phase.


## 57. Migration phase 2: TypeScript foundation

1. Add TypeScript.
2. Add strict tsconfig.
3. Enable checkJs.
4. Move runtime entry point under `src`.
5. Convert shared utilities first.
6. Convert configuration.
7. Convert middleware.
8. Keep tests green after each converted area.


## 58. Migration phase 3: OpenAPI generation

1. Add spec submodule.
2. Add Redocly.
3. Add OpenAPI bundling.
4. Add openapi-typescript.
5. Generate types.
6. Commit generated output.
7. Add generated drift check.
8. Add operation ID coverage test.


## 59. Migration phase 4: OpenAPI HTTP adapters

1. Create operation type helpers.
2. Create operation registry.
3. Create centralized error mapping.
4. Add runtime request validation.
5. Migrate `/version`.
6. Migrate `/public-key`.
7. Migrate `/progress`.
8. Migrate `/login`.
9. Validate responses against OpenAPI.

Use these simple endpoints to prove the architecture before touching streams.


## 60. Migration phase 5: Bearer-only authentication

1. Convert all authentication handling to Bearer.
2. Remove X-Cred support.
3. Remove query JWT support.
4. Reject legacy `jwt` query arguments.
5. Update CORS.
6. Add authentication tests for every protected operation.
7. Verify logs redact Authorization.


## 61. Migration phase 6: remaining existing endpoints

Migrate:

    /authenticate
    /rescan
    /image
    /proxy

Ensure their behaviour is expressed through the spec.

Remove duplicated request/response validation.


## 62. Migration phase 7: media API

1. Extract `/listen` media logic.
2. Add media token service.
3. Implement POST `/api/media`.
4. Implement GET `/api/media/{token}`.
5. Validate all ranges.
6. Validate path security.
7. Validate token expiry.
8. Validate JWT never enters media URL.
9. Migrate clients.
10. Remove `/listen`.


## 63. Migration phase 8: SSE

1. Convert existing SSE modules to TypeScript.
2. Implement Bearer authentication.
3. Implement typed named events.
4. Add common envelope.
5. Add event IDs.
6. Preserve streaming behaviour.
7. Add full SSE tests.
8. Remove query JWT support permanently.


## 64. Migration phase 9: DLNA playback

Implement the playback API directly against the generated OpenAPI contract.

No JavaScript version should be created first.

Implement:

    GET  /api/playback/targets
    POST /api/playback/discover

    PUT  /api/playback/targets/{targetId}/media

    POST /api/playback/targets/{targetId}/play
    POST /api/playback/targets/{targetId}/pause
    POST /api/playback/targets/{targetId}/stop

    PUT  /api/playback/targets/{targetId}/position
    PUT  /api/playback/targets/{targetId}/volume

    GET  /api/playback/targets/{targetId}/state

Use:

    OpenAPI
        -> HTTP adapter
        -> playback service
        -> DLNA adapter

DLNA infrastructure must not know about Hono.


## 65. Migration phase 10: remove JavaScript migration support

Once all source files are TypeScript:

1. Set:

       allowJs: false

2. Remove:
   - JavaScript-only JSDoc contract workarounds
   - old JS source files
   - duplicate compatibility modules

3. Run full validation.

There should be no application `.js` source remaining except unavoidable
generated/vendor artefacts.


## 66. Final validation

Before the TypeScript/OpenAPI migration is considered complete, run:

    clean checkout
    initialize submodules
    npm ci
    npm run validate

Do this without globally installed project tools.

Then verify a production-like start of node-mp3stream.


## 67. Definition of Done

The migration is complete only when all of the following are true.

### TypeScript

- All application source is TypeScript.
- `strict` is enabled.
- `allowJs` is disabled.
- Typecheck passes without ignored project errors.

### OpenAPI

- OpenAPI is the source of truth for the public API.
- Every HTTP operation has a unique operation ID.
- Types are generated from OpenAPI.
- Generated output is deterministic.
- Generated files are not manually edited.
- Every spec operation has an implementation.
- Every implementation corresponds to a spec operation.
- Every documented route is actually registered.

### Runtime contracts

- Request data is runtime validated.
- Invalid input is rejected before entering application services.
- JSON responses are contract validated in tests.
- Streaming endpoints are protocol tested.

### Authentication

- Bearer authentication is the only JWT authentication mechanism.
- `?jwt=` is rejected.
- `X-Cred` is unsupported.
- JWTs never occur in media URLs.
- JWTs never occur in SSE URLs.
- JWTs never occur in DLNA URLs or metadata.
- Authorization headers are redacted in logs.

### Media

- Browser playback uses capability media URLs.
- Remote renderers use capability media URLs.
- Range requests work.
- Path traversal is prevented.
- Escaping symlinks are prevented.
- Expired/invalid media tokens are rejected.

### SSE

- SSE uses Bearer authentication.
- Events are named and typed.
- Event payloads derive from OpenAPI schemas.
- Broken clients are cleaned up.
- Query JWT is impossible.

### Tests

- Unit tests pass.
- Contract tests pass.
- Integration tests pass.
- Security tests pass.
- Type-level tests pass.
- OpenAPI lint passes.
- Generated drift check passes.
- Operation coverage passes.
- Route coverage passes.

### CI

- CI initializes the OpenAPI submodule.
- CI generates contracts.
- CI detects stale generated output.
- CI typechecks TypeScript.
- CI runs all relevant tests.
- CI detects unintended OpenAPI breaking changes.

### Architecture

- Hono is confined to the HTTP adapter layer.
- OpenAPI generated types are confined primarily to the API boundary.
- Application services use domain types.
- Filesystem infrastructure does not depend on OpenAPI.
- DLNA infrastructure does not depend on OpenAPI or Hono.
- Business behaviour can be tested without starting an HTTP server.

At this point node-mp3stream has one authoritative external contract, a
type-safe implementation boundary and runtime verification that the actual
server continues to implement that contract.