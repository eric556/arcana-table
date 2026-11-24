# Authoritative rooms (protocol 9)

The room host owns the complete canonical game: every player's cards, private
zone order, face state, counters, permissions, combat, attachments, and stack.
A connected client submits commands, never a replacement player snapshot. The
host authenticates the connection's seat, validates the command, applies the
whole transaction, saves a checkpoint, then sends a filtered snapshot to each
seat. The host's UI also renders a filtered snapshot.

`lib/authority.ts` is the transaction boundary. Card commands use source-zone
preconditions, combat uses a combat ID, and stack resolution uses an entry ID
and stack revision. A cast with a target is atomic. Approved shared-card moves
and stack resolution complete inside that transaction; there is no owner-side
acknowledgement needed to finish a move. An offline original owner does not
block resolving or moving a card whose controller already has permission.

`lib/network.ts` transports these commands over reliable PeerJS data channels.
Each seat sends ordered sequence numbers and unique command IDs. The host
persists its sequence high-water marks, including rejected commands, so retries
cannot repeat an operation. Guests persist an ordered outbox before sending it;
acknowledged entries are removed only after the host confirms them. Reconnecting
replaces local state with the full current seat snapshot, including private
cards, then retries unacknowledged commands. A lost acknowledgement is safe.

## Recovery

The host checkpoint in localStorage includes the full room, seat-token mapping,
sequence ledgers, and connection options. A refreshed or reopened host chooses
**Resume hosted room** to reclaim the same room code. Guests reconnect with the
same seat token. Connection settings offers **Refresh & reconnect** to both
host and guests. A resumed host marks guests disconnected until they return.
Reclaiming a guest seat invalidates the old connection before accepting writes.

Saving precedes publication. If host storage fails, the change is not committed
or acknowledged; a guest's outbox retains the command for retry. Storage errors
are surfaced. Explicitly leaving a hosted room removes its recovery checkpoint.
There is one saved hosted room per browser profile. Guest credentials/outboxes
belong to their browser tab. Clearing storage removes recovery. There is no
host migration: play pauses while the host is offline. Signaling uses PeerJS
Cloud; some networks need a configured TURN relay. Older rooms cannot join
protocol 9; all players should refresh and create a new room after this update.

## Privacy and trust

The host is trusted and has technical access to hidden cards. The normal host
screen hides them. Guests receive only their own private zones, the public table,
and identities of face-down cards they are explicitly allowed to inspect or
control. Other players' hands, libraries, sideboards, and unapproved face-down
identities are omitted, not merely hidden by CSS. This is a friends' tabletop,
not an anti-cheat server. Private identity delivery is now part of the host's
per-seat snapshot rather than a separate encrypted relay from the original tab.

## Manual exile interactions

Library requests require approval by the owner. Presets cover top-X, exile until
a nonland (Ryan Sinclair), and exile until an instant/sorcery with the rest
shuffled back (Wand of Wonder). Permissions can grant play, cast only, look only,
or no access; they include a duration/cost note. Graveyard/exile requests can
approve a specific card. Face-down exile identifies cards only for approved
viewers. Custody remains with the original owner; control changes for borrowed
spells/permanents. Return moves go to the owner's zones. Adventures resolve to
exile with a cast permission for the caster. Costs, timing, duration expiration,
card effects and triggers remain manual.

The importer includes **Use feature test deck**, also at
`/decks/feature-test.txt`. It contains 60 cards including a commander, deliberately
not a legal Commander list. Search the library to find Sagas, Classes, levelers,
Rooms, Adventures, split/modal cards, face-down cards, exile/borrowed-card effects,
attachments, tokens, poison, scry, surveil, and stack responses.

## Verification

`tests/authority.mjs` tests transactions, authorization, private views, stale
moves, duplicate sequences, borrowed ownership, and face/progression state.
`tests/recovery.mjs` exercises four RoomNetwork instances over simulated reliable
connections with dropped commands/snapshots, guest and host restarts, seat
reclaim, storage failure, stale local state, and offline-owner resolution.
These transport tests do not verify external STUN/TURN reachability.

## Shared physical table

Every seat renders the same public playmats in a locally pannable, zoomable view.
You, player-name, and Whole table shortcuts move only the camera. Stack opens a floating panel without changing the camera. Drag
empty felt or use the Pan tool; scroll/pinch to zoom. Each seat has a 3600 × 2800 battlefield surrounding its 1120 × 760 playmat.
Drop coordinates account for camera scale. Positions tagged `space: area` are
normalized across the larger battlefield; existing untagged positions retain their
original location on the mat. Both forms survive host validation and reconnect.

You / player-name shortcuts frame the mat and all its loose battlefield cards.
Your area / Full area shows the entire territory; the playmat focus button returns
to the physical mat. Whole table frames the occupied seats. Overflow cards use
spaced positions outside the mat instead of squeezing every row onto it. Area
borders and player labels remain readable at overview zoom levels.

Library piles expose counts only; clicking an opponent's pile opens an exile
request. Graveyard, exile, and command piles open public inspection. Hand backs
show counts without transmitting identities. Your actual hand floats in a shallow fan over the bottom of the felt without reserving a separate panel. On touch, drag empty felt to pan and use two fingers anywhere on the table (including cards) to pan/pinch. A second contact cancels card movement. Large hands swipe horizontally; one-finger card drags and battlefield double-taps retain their usual actions.

A battlefield card can grant one other seat movement permission after owner
approval. This permits repositioning and moves to the original owner's zones,
not tapping, control changes, or private inspection. The owner can revoke it;
leaving the battlefield clears it. Dragging an unapproved card requests approval.

Exile requests offer face-up/down, owner/requester pile, play, and private-look
choices. Visual exile location is independent of canonical ownership. The owner
and approved recipient can reveal or conceal an exiled card; this does not grant
other seats access to its hidden identity. Moving out of exile clears its pile
assignment. Host snapshots enforce the same filtering after reconnect.

## Floating stack and touch feedback

A new top-of-stack entry opens the floating stack panel for each player. The panel
can be minimized; acknowledgements and target edits do not reopen it. Resolving
the final entry closes it. Cards scroll horizontally while No response and Resolve
top card remain outside the scrolling area. Stack actions still submit the same
host-authoritative commands; this changes presentation, not priority or rules.

Touch drags show the selected card above the finger and fade its source. Preview
lookup uses the viewer's private hand rather than the filtered public snapshot,
so hand drags remain visible without disclosing opponents' cards. A second touch
cancels the preview and card move before table pinching begins.

## Mobile viewport rendering

The expanded world is projected into a viewport-sized, untransformed DOM surface.
Playmats are drawn as separate objects near the viewport, battlefield hit areas
are clipped to the viewport, and territory borders are screen-space SVG strokes.
Clipped hit areas retain the full battlefield origin and scale for drop conversion.
Offscreen cards remain mounted but hidden so their art does not reload while panning.
Camera input updates its reference immediately and publishes at most once per
animation frame. Card content is memoized across camera-only updates. Mobile
removes backdrop blur and the layered table textures to reduce repaint cost.

The uploaded Android recording showed parts of the mat disappearing during rapid
pinch/zoom. Automated geometry/touch checks and browser layout/drag checks cover
the replacement renderer; a matching Android GPU/browser reproduction was not
available in the development environment.
