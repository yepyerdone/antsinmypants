# Security Specification - Blackjack 99

## 1. Data Invariants
- A Room must have a host.
- A Player can only join a Room if it's in 'waiting' status.
- A Player can only update their own hand/status.
- Only the host can update the Room's dealerHand, phase, and round.
- Once a player is 'eliminated', they cannot return to 'playing' in that room.

## 2. The "Dirty Dozen" Payloads (Deny Cases)

1. Create a room as anonymous user (if auth required).
2. Update another player's hand.
3. Update specific room fields (like hostId) after creation.
4. Join a room that has already started (status: 'playing').
5. Set `status` to 'winner' directly by a non-host player.
6. Inject 1MB string into player name.
7. Set `round` to 99999 as a non-host.
8. Delete the room as a non-host.
9. Rapidly update room state to cause "denial of wallet" (checked via rate limiting or logic).
10. Update own player record after being eliminated.
11. Host spoofing: try to update a room by passing a different hostId in request.
12. Creating a player record for a different UID.

## 3. Test Runner (Draft)
The `firestore.rules.test.ts` will verify these cases.
