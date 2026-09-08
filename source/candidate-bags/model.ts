import type { Disc } from '../disc-studio/model';

export const BAG_VERSION = 1 as const;
export const MAX_BAGS = 100;
export const MAX_BAG_NAME = 100;
export type Bag = { id: string; name: string; discIds: string[] };
export type BagState = { version: typeof BAG_VERSION; bags: Bag[] };
export type ShelfIdentity = readonly Disc[] | readonly string[];
export type BattleStateEntry = { id: string; discId: string; score: number };
export type BattleStateSnapshot = { id: string; entries: BattleStateEntry[]; highlightedEntryId: string | null; winnerEntryIds: string[]; imageExport: string | null };
export type BattleSnapshotState = { version: 1; snapshots: BattleStateSnapshot[] };

function fail(message: string): never { throw new Error(`Invalid bag state: ${message}`); }
function shelfIds(shelf: ShelfIdentity | undefined): Set<string> | undefined {
 if (!shelf) return undefined;
 const ids = new Set<string>();
 for (const item of shelf) { const id = typeof item === 'string' ? item : item?.id; if (typeof id !== 'string' || !id.trim()) return fail('shelf discs must have nonempty identifiers.'); if (ids.has(id)) return fail(`shelf contains duplicate disc identifier ${id}.`); ids.add(id); }
 return ids;
}
function text(value: unknown, label: string, max: number): string { if (typeof value !== 'string' || value.length > max || !value.trim()) return fail(`${label} is required.`); return value; }

function snapshotEntry(value: unknown): BattleStateEntry {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('battle entry is malformed.');
	const candidate = value as { id?: unknown; discId?: unknown; score?: unknown };
	const id = text(candidate.id, 'entry identifier', 200);
	const discId = text(candidate.discId, 'disc identifier', 200);
	if (typeof candidate.score !== 'number' || !Number.isFinite(candidate.score)) return fail('score must be finite.');
	return { id, discId, score: candidate.score };
}

/** Validate and deep-clone ordered battle snapshots. Every state is independently complete. */
export function validateBattleSnapshotState(input: unknown, shelf?: ShelfIdentity): BattleSnapshotState {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('expected battle snapshot state object.');
	const value = input as { version?: unknown; snapshots?: unknown };
	if (value.version !== 1 || !Array.isArray(value.snapshots)) return fail('unsupported snapshot version or missing snapshots.');
	const available = shelfIds(shelf);
	const snapshotIds = new Set<string>();
	const snapshots = value.snapshots.map((raw, index): BattleStateSnapshot => {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(`snapshot ${index + 1} is malformed.`);
		const candidate = raw as { id?: unknown; entries?: unknown; highlightedEntryId?: unknown; winnerEntryIds?: unknown; imageExport?: unknown };
		const id = text(candidate.id, 'snapshot identifier', 200);
		if (snapshotIds.has(id)) return fail(`duplicate snapshot identifier ${id}.`);
		snapshotIds.add(id);
		if (!Array.isArray(candidate.entries)) return fail(`snapshot ${id} entries must be a list.`);
		const entries = candidate.entries.map(snapshotEntry);
		const entryIds = new Set<string>();
		for (const entry of entries) {
			if (entryIds.has(entry.id)) return fail(`snapshot ${id} contains duplicate entry identifier.`);
			if (available && !available.has(entry.discId)) return fail(`snapshot ${id} references missing disc ${entry.discId}.`);
			entryIds.add(entry.id);
		}
		const highlightedEntryId = candidate.highlightedEntryId === null ? null : text(candidate.highlightedEntryId, 'highlighted entry identifier', 200);
		if (highlightedEntryId !== null && !entryIds.has(highlightedEntryId)) return fail(`snapshot ${id} highlight references an absent entry.`);
		if (!Array.isArray(candidate.winnerEntryIds)) return fail(`snapshot ${id} winners must be a list.`);
		const winnerEntryIds = candidate.winnerEntryIds.map((winner) => text(winner, 'winner entry identifier', 200));
		if (new Set(winnerEntryIds).size !== winnerEntryIds.length || winnerEntryIds.some((winner) => !entryIds.has(winner))) return fail(`snapshot ${id} winners reference an absent or duplicate entry.`);
		const imageExport = candidate.imageExport === null || candidate.imageExport === undefined ? null : text(candidate.imageExport, 'snapshot image export', 4_500_000);
		return { id, entries, highlightedEntryId, winnerEntryIds, imageExport };
	});
	return { version: 1, snapshots };
}

export function createBattleSnapshot(id: string, entries: readonly BattleStateEntry[] = [], imageExport: string | null = null): BattleStateSnapshot {
	return validateBattleSnapshotState({ version: 1, snapshots: [{ id, entries, highlightedEntryId: null, winnerEntryIds: [], imageExport }] }).snapshots[0];
}

function snapshotState(snapshots: readonly BattleStateSnapshot[], shelf?: ShelfIdentity): BattleSnapshotState {
	return validateBattleSnapshotState({ version: 1, snapshots }, shelf);
}

export function appendBattleSnapshot(state: BattleSnapshotState, snapshot: BattleStateSnapshot, shelf?: ShelfIdentity): BattleSnapshotState {
	const checked = validateBattleSnapshotState(state, shelf);
	return snapshotState([...checked.snapshots, snapshot], shelf);
}

export function updateBattleSnapshot(state: BattleSnapshotState, snapshotId: string, patch: Partial<Omit<BattleStateSnapshot, 'id'>>, shelf?: ShelfIdentity): BattleSnapshotState {
	const checked = validateBattleSnapshotState(state, shelf);
	if (!checked.snapshots.some((snapshot) => snapshot.id === snapshotId)) throw new Error(`Snapshot ${snapshotId} was not found.`);
	return snapshotState(checked.snapshots.map((snapshot) => snapshot.id === snapshotId ? { ...snapshot, ...patch, entries: patch.entries ? patch.entries.map((entry) => ({ ...entry })) : snapshot.entries.map((entry) => ({ ...entry })), winnerEntryIds: patch.winnerEntryIds ? [...patch.winnerEntryIds] : [...snapshot.winnerEntryIds] } : snapshot));
}

/** Author a change as a new timeline state; the source snapshot is never replaced. */
export function forkBattleSnapshot(state: BattleSnapshotState, sourceId: string, newId: string, patch: Partial<Omit<BattleStateSnapshot, 'id'>>, shelf?: ShelfIdentity): BattleSnapshotState {
	const checked = validateBattleSnapshotState(state, shelf);
	const source = checked.snapshots.find((snapshot) => snapshot.id === sourceId);
	if (!source) throw new Error(`Snapshot ${sourceId} was not found.`);
	return appendBattleSnapshot(checked, {
		...source,
		...patch,
		id: newId,
		entries: (patch.entries ?? source.entries).map((entry) => ({ ...entry })),
		winnerEntryIds: [...(patch.winnerEntryIds ?? source.winnerEntryIds)]
	}, shelf);
}

/** Reorder entries inside one complete snapshot while preserving stable entry and disc IDs. */
export function reorderBattleSnapshotEntries(state: BattleSnapshotState, snapshotId: string, entryId: string, offset: -1 | 1, shelf?: ShelfIdentity): BattleSnapshotState {
	const checked = validateBattleSnapshotState(state, shelf);
	const source = checked.snapshots.find((snapshot) => snapshot.id === snapshotId);
	if (!source) throw new Error(`Snapshot ${snapshotId} was not found.`);
	const index = source.entries.findIndex((entry) => entry.id === entryId), target = index + offset;
	if (index < 0 || target < 0 || target >= source.entries.length) return checked;
	const entries = source.entries.map((entry) => ({ ...entry }));
	[entries[index], entries[target]] = [entries[target], entries[index]];
	return forkBattleSnapshot(checked, snapshotId, `${snapshotId}-edit-${Date.now().toString(36)}`, { entries }, shelf);
}

export function duplicateBattleSnapshot(state: BattleSnapshotState, sourceId: string, newId: string, shelf?: ShelfIdentity): BattleSnapshotState {
	const checked = validateBattleSnapshotState(state, shelf);
	const source = checked.snapshots.find((snapshot) => snapshot.id === sourceId);
	if (!source) throw new Error(`Snapshot ${sourceId} was not found.`);
	return appendBattleSnapshot(checked, { ...source, id: newId, entries: source.entries.map((entry) => ({ ...entry })), winnerEntryIds: [...source.winnerEntryIds] }, shelf);
}

export function reorderBattleSnapshots(state: BattleSnapshotState, snapshotId: string, offset: -1 | 1, shelf?: ShelfIdentity): BattleSnapshotState {
	const checked = validateBattleSnapshotState(state, shelf);
	const index = checked.snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
	const target = index + offset;
	if (index < 0 || target < 0 || target >= checked.snapshots.length) return checked;
	const snapshots = [...checked.snapshots];
	[snapshots[index], snapshots[target]] = [snapshots[target], snapshots[index]];
	return snapshotState(snapshots, shelf);
}

export function serializeBattleSnapshotState(state: BattleSnapshotState, shelf?: ShelfIdentity): string {
	return JSON.stringify(validateBattleSnapshotState(state, shelf));
}

export function parseBattleSnapshotState(raw: string, shelf?: ShelfIdentity): BattleSnapshotState {
	if (typeof raw !== 'string' || raw.length > 5_000_000) return fail('serialized snapshot state is too large.');
	try { return validateBattleSnapshotState(JSON.parse(raw), shelf); }
	catch (cause) { if (cause instanceof Error && cause.message.startsWith('Invalid bag state:')) throw cause; return fail('serialized snapshot state is not valid JSON.'); }
}

function idList(value: unknown, available: Set<string> | undefined, bagName: string): string[] {
	if (!Array.isArray(value)) return fail(`${bagName} memberships must be a list.`);
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const item of value) {
		const id = text(item, 'disc identifier', 200);
		if (seen.has(id)) return fail(`${bagName} contains a duplicate disc membership.`);
		if (available && !available.has(id)) return fail(`${bagName} references missing disc ${id}.`);
		seen.add(id);
		ids.push(id);
	}
	return ids;
}

/** Validate and clone serialized bag data. Missing shelf references fail here. */
export function validateBagState(input: unknown, shelf?: ShelfIdentity): BagState {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('expected an object.');
	const value = input as { version?: unknown; bags?: unknown };
	if (value.version !== BAG_VERSION || !Array.isArray(value.bags)) return fail('unsupported version or missing bags.');
	if (value.bags.length > MAX_BAGS) return fail(`at most ${MAX_BAGS} bags are supported.`);
	const available = shelfIds(shelf);
	const bagIds = new Set<string>();
	const bags = value.bags.map((raw, index): Bag => {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(`bag ${index + 1} is malformed.`);
		const candidate = raw as { id?: unknown; name?: unknown; discIds?: unknown };
		const id = text(candidate.id, 'bag identifier', 200);
		if (bagIds.has(id)) return fail(`duplicate bag identifier ${id}.`);
		bagIds.add(id);
		const name = text(candidate.name, 'bag name', MAX_BAG_NAME);
		return { id, name, discIds: idList(candidate.discIds, available, `Bag ${name}`) };
	});
	return { version: BAG_VERSION, bags };
}

/** Make one stable bag record. The caller supplies the durable identifier. */
export function createBag(id: string, name: string, discIds: readonly string[] = []): Bag {
	const state = validateBagState({ version: BAG_VERSION, bags: [{ id, name, discIds: [...discIds] }] });
	return state.bags[0];
}

function findBag(state: BagState, bagId: string): Bag {
	const bag = state.bags.find((candidate) => candidate.id === bagId);
	if (!bag) throw new Error(`Bag ${bagId} was not found.`);
	return bag;
}

function requireDisc(shelf: ShelfIdentity, discId: string): void {
	const ids = shelfIds(shelf);
	if (!ids?.has(discId)) throw new Error(`Disc ${discId} was not found on the shelf.`);
}

/** Add a membership immutably. A physical Disc record is never cloned. */
export function addDiscToBag(state: BagState, bagId: string, discId: string, shelf: ShelfIdentity): BagState {
	const checked = validateBagState(state, shelf);
	requireDisc(shelf, discId);
	const bag = findBag(checked, bagId);
	if (bag.discIds.includes(discId)) return checked;
	return {
		version: BAG_VERSION,
		bags: checked.bags.map((candidate) =>
			candidate.id === bagId ? { ...candidate, discIds: [...candidate.discIds, discId] } : { ...candidate, discIds: [...candidate.discIds] }
		)
	};
}

/** Remove a membership immutably. The Disc itself remains on the shelf. */
export function removeDiscFromBag(state: BagState, bagId: string, discId: string, shelf: ShelfIdentity): BagState {
	const checked = validateBagState(state, shelf);
	const bag = findBag(checked, bagId);
	return {
		version: BAG_VERSION,
		bags: checked.bags.map((candidate) =>
			candidate.id === bagId ? { ...candidate, discIds: candidate.discIds.filter((id) => id !== discId) } : { ...candidate, discIds: [...candidate.discIds] }
		)
	};
}

export function toggleDiscMembership(state: BagState, bagId: string, discId: string, member: boolean, shelf: ShelfIdentity): BagState {
	return member ? addDiscToBag(state, bagId, discId, shelf) : removeDiscFromBag(state, bagId, discId, shelf);
}

export function bagContains(bag: Bag, discId: string): boolean {
	return bag.discIds.includes(discId);
}

export function missingDiscIds(bag: Bag, shelf: ShelfIdentity): string[] {
	const available = shelfIds(shelf) ?? new Set<string>();
	return bag.discIds.filter((id) => !available.has(id));
}

/** Pure persistence adapter: validate and serialize a clean snapshot. */
export function serializeBagState(state: BagState, shelf?: ShelfIdentity): string {
	return JSON.stringify(validateBagState(state, shelf));
}

/** Pure persistence adapter: parse and validate a stored snapshot. */
export function parseBagState(raw: string, shelf?: ShelfIdentity): BagState {
	if (typeof raw !== 'string' || raw.length > 1_000_000) return fail('serialized state is too large.');
	try {
		return validateBagState(JSON.parse(raw), shelf);
	} catch (cause) {
		if (cause instanceof Error && cause.message.startsWith('Invalid bag state:')) throw cause;
		return fail('serialized state is not valid JSON.');
	}
}
