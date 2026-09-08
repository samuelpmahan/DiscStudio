import type { Disc } from '../disc-studio/model';

export const BAG_VERSION = 1 as const;
export const MAX_BAGS = 100;
export const MAX_BAG_NAME = 100;
export type Bag = { id: string; name: string; discIds: string[] };
export type BagState = { version: typeof BAG_VERSION; bags: Bag[] };
export type ShelfIdentity = readonly Disc[] | readonly string[];

function fail(message: string): never {
	throw new Error(`Invalid bag state: ${message}`);
}

function shelfIds(shelf: ShelfIdentity | undefined): Set<string> | undefined {
	if (!shelf) return undefined;
	const ids = new Set<string>();
	for (const item of shelf) {
		const id = typeof item === 'string' ? item : item?.id;
		if (typeof id !== 'string' || !id.trim()) return fail('shelf discs must have nonempty identifiers.');
		if (ids.has(id)) return fail(`shelf contains duplicate disc identifier ${id}.`);
		ids.add(id);
	}
	return ids;
}

function text(value: unknown, label: string, max: number): string {
	if (typeof value !== 'string' || value.length > max || !value.trim()) return fail(`${label} is required.`);
	return value;
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
