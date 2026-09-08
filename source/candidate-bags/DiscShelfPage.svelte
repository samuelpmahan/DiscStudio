<script lang="ts">
	import DiscCard from '../disc-studio/DiscCard.svelte';
	import { readPhoto } from '../disc-studio/localDraft';
	import { defaultAppearance, neutralCard, type Disc, type FlightNumbers } from '../disc-studio/model';
	import { bagContains, missingDiscIds, type Bag } from './model';

	export type DiscShelfPageProps = {
		discs: Disc[];
		bags: Bag[];
		selectedDiscId?: string | null;
		selectedBagId?: string | null;
		onSelectDisc?: (discId: string) => void;
		onSelectBag?: (bagId: string | null) => void;
		onCreateBag?: (name: string) => void;
		onToggleMembership?: (bagId: string, discId: string, member: boolean) => void;
		onCreateDisc?: (image: Disc['image']) => void;
		onUpdateDisc?: (discId: string, patch: Partial<Disc>) => void;
	};

	let {
		discs,
		bags,
		selectedDiscId = undefined,
		selectedBagId = undefined,
		onSelectDisc,
		onSelectBag,
		onCreateBag,
		onToggleMembership,
		onCreateDisc,
		onUpdateDisc
	}: DiscShelfPageProps = $props();

	let localDiscId = $state<string | null>(null);
	let localBagId = $state<string | null>(null);
	let query = $state('');
	let newBagName = $state('');
	let message = $state('');
	let error = $state('');
	let photoInput = $state<HTMLInputElement>();
	let replacePhotoInput = $state<HTMLInputElement>();
	let photoBusy = $state(false);

	const shelfAppearance = { ...defaultAppearance, theme: 'paper' as const, layout: 'showcase' as const, imageFit: 'contain' as const };
	let activeDiscId = $derived(selectedDiscId !== undefined ? selectedDiscId : localDiscId ?? discs[0]?.id ?? null);
	let activeBagId = $derived(selectedBagId !== undefined ? selectedBagId : localBagId);
	let selectedDisc = $derived(discs.find((disc) => disc.id === activeDiscId) ?? null);
	let activeBag = $derived(bags.find((bag) => bag.id === activeBagId) ?? null);
	let filteredDiscs = $derived(
		discs.filter((disc) =>
			`${disc.manufacturer} ${disc.mold} ${disc.variant}`.toLowerCase().includes(query.trim().toLowerCase())
		)
	);
	let visibleDiscs = $derived(
		activeBag
			? filteredDiscs.filter((disc) => activeBag.discIds.includes(disc.id))
			: filteredDiscs
	);

	function selectDisc(discId: string) {
		localDiscId = discId;
		onSelectDisc?.(discId);
		message = 'Disc selected. Edit its details in the inspector.';
		error = '';
	}

	function selectBag(bagId: string | null) {
		localBagId = bagId;
		onSelectBag?.(bagId);
		error = '';
	}

	function buildBag() {
		const name = newBagName.trim();
		if (!name) {
			error = 'Give this bag a name first.';
			return;
		}
		if (!onCreateBag) {
			error = 'Bag creation is not wired to a parent yet.';
			return;
		}
		onCreateBag(name);
		newBagName = '';
		message = `${name} is ready for discs.`;
		error = '';
	}

	function toggleMembership(bag: Bag) {
		if (!selectedDisc) {
			error = 'Choose a shelf disc before changing bag membership.';
			return;
		}
		const member = !bagContains(bag, selectedDisc.id);
		if (!onToggleMembership) {
			error = 'Bag membership is not wired to a parent yet.';
			return;
		}
		try {
			onToggleMembership(bag.id, selectedDisc.id, member);
			message = member ? `Added ${selectedDisc.mold} to ${bag.name}.` : `Removed ${selectedDisc.mold} from ${bag.name}.`;
			error = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Bag membership could not be changed.';
		}
	}

	function missingFor(bag: Bag): string[] {
		return missingDiscIds(bag, discs);
	}

	async function addDiscFromPhoto(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !onCreateDisc) return;
		photoBusy = true;
		error = '';
		try {
			onCreateDisc(await readPhoto(file));
			message = 'Disc added. Add details in the inspector.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Disc photo could not be added.';
		} finally {
			photoBusy = false;
		}
	}

	async function replacePhoto(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !selectedDisc || !onUpdateDisc) return;
		photoBusy = true;
		error = '';
		try {
			onUpdateDisc(selectedDisc.id, { image: await readPhoto(file) });
			message = 'Disc photo replaced.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Disc photo could not be replaced.';
		} finally {
			photoBusy = false;
		}
	}

	function updateFact(patch: Partial<Disc>) {
		if (selectedDisc && onUpdateDisc) onUpdateDisc(selectedDisc.id, patch);
	}

	function updateFlight(key: keyof FlightNumbers, value: string) {
		if (!selectedDisc) return;
		const next = { ...(selectedDisc.flight ?? {}) } as Partial<FlightNumbers>;
		next[key] = value === '' ? null : Number(value);
		updateFact({ flight: next });
	}
</script>

<svelte:head>
	<title>ChainSpot · Disc Shelf</title>
	<meta name="description" content="A warm local shelf for physical discs and reusable bags." />
</svelte:head>

<div class="shelf-page">
		<header class="topbar">
		<div class="brand"><span class="mark" aria-hidden="true">◎</span><strong>CHAINSPOT</strong><span class="divider"></span><span>DISC SHELF</span><small>LOCAL</small></div>
		<div class="top-note">Your physical shelf, organized your way.</div>
			<div class="top-actions"><span class="local-dot">LOCAL SHELF</span><button class="build" onclick={() => document.getElementById('new-bag-name')?.focus()}>＋ Build a bag</button></div>
	</header>

	{#if error}<div class="notice error" role="alert"><span>{error}</span><button onclick={() => (error = '')} aria-label="Dismiss error">×</button></div>{/if}
	{#if message}<div class="notice" role="status"><span>{message}</span><button onclick={() => (message = '')} aria-label="Dismiss notice">×</button></div>{/if}

	<div class="columns">
		<aside class="left-column" aria-label="Disc shelf and bags">
			<section class="panel shelf-panel">
				<span class="eyebrow">YOUR PHYSICAL SHELF</span>
					<div class="title-row"><div><h1>Disc shelf <span>{discs.length}</span></h1><p class="subtle">Every entry is one physical disc. A disc can live in more than one bag.</p></div><button class="add-disc" onclick={() => photoInput?.click()} disabled={photoBusy}>{photoBusy ? 'Adding…' : '＋ Add disc photo'}</button></div>
					<input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" bind:this={photoInput} onchange={addDiscFromPhoto} aria-label="Photo for new disc" />
				<label class="search"><span aria-hidden="true">⌕</span><input bind:value={query} aria-label="Search disc shelf" placeholder="Find a disc…" /></label>
				<div class="disc-list">
					{#each filteredDiscs as disc (disc.id)}
						<button class="disc-row" class:selected={disc.id === activeDiscId} aria-pressed={disc.id === activeDiscId} onclick={() => selectDisc(disc.id)}>
							<div class="thumb">{#if disc.image}<img src={disc.image.src} alt={disc.image.alt || `${disc.mold} photo`} />{:else}<span aria-hidden="true">◎</span>{/if}</div>
							<span class="disc-copy"><small>{disc.manufacturer || 'MANUFACTURER'}</small><strong>{disc.mold || 'Untitled disc'}</strong><span>{disc.variant || 'No variant'}</span></span>
						</button>
					{/each}
					{#if filteredDiscs.length === 0}<p class="empty">No matching discs.</p>{/if}
				</div>
			</section>

			<section class="panel bags-panel" aria-label="Disc bags">
				<div class="section-heading"><div><span class="eyebrow">REUSABLE GROUPS</span><h2>My bags</h2></div><span class="tag">{bags.length}</span></div>
				<button class="bag-row" class:selected={activeBagId === null} aria-pressed={activeBagId === null} onclick={() => selectBag(null)}><span class="bag-icon">⌂</span><span><strong>All shelf discs</strong><small>{discs.length} physical discs</small></span></button>
				{#each bags as bag (bag.id)}
					{@const missing = missingFor(bag)}
					<button class="bag-row" class:selected={activeBagId === bag.id} aria-pressed={activeBagId === bag.id} onclick={() => selectBag(bag.id)}><span class="bag-icon">▱</span><span><strong>{bag.name}</strong><small>{bag.discIds.length} {bag.discIds.length === 1 ? 'disc' : 'discs'}</small>{#if missing.length}<em>⚠ {missing.length} missing disc{missing.length === 1 ? '' : 's'}</em>{/if}</span></button>
				{/each}
				<form class="new-bag" onsubmit={(event) => { event.preventDefault(); buildBag(); }}><label for="new-bag-name">Build a bag</label><div><input id="new-bag-name" bind:value={newBagName} maxlength="100" placeholder="e.g. Saturday round" /><button type="submit" aria-label="Create bag">＋</button></div></form>
				<p class="panel-note">A disc can be in more than one bag. Your shelf stays intact.</p>
			</section>
		</aside>

		<main class="center-column" aria-label="Disc shelf cards">
			<div class="center-heading"><div><span class="eyebrow">DISC SHELF FIRST</span><h2>{activeBag ? activeBag.name : 'All your discs'}</h2><p>{activeBag ? 'A reusable view of this bag.' : 'Choose a bag or keep the whole shelf in view.'}</p></div><span class="count-pill">{visibleDiscs.length} shown</span></div>
			{#if activeBag && missingFor(activeBag).length}<div class="missing-notice" role="alert"><strong>This bag has missing shelf references.</strong><span>{missingFor(activeBag).join(', ')}</span><small>Those memberships stay visible until the parent repairs the shelf.</small></div>{/if}
			<div class="card-grid">
				{#each visibleDiscs as disc (disc.id)}
					<button class="card-button" class:selected={disc.id === activeDiscId} aria-label={`Inspect ${disc.manufacturer} ${disc.mold}`} aria-pressed={disc.id === activeDiscId} onclick={() => selectDisc(disc.id)}><DiscCard disc={disc} appearance={shelfAppearance} state={neutralCard} /></button>
				{/each}
			</div>
			{#if visibleDiscs.length === 0}<div class="empty-card"><strong>{activeBag ? 'This bag has no shelf discs yet.' : 'Your shelf is empty.'}</strong><p>Choose a disc on the left to inspect it.</p></div>{/if}
		</main>

		<aside class="right-column" aria-label="Disc inspector">
			<section class="panel inspector">
					<span class="eyebrow">DISC DETAILS</span>
				{#if selectedDisc}
						<div class="inspector-heading"><h2>{selectedDisc.mold || 'Untitled disc'}</h2><span class="tag">EDITABLE</span></div>
						<div class="inspector-photo">{#if selectedDisc.image}<img src={selectedDisc.image.src} alt={selectedDisc.image.alt || `${selectedDisc.mold} photo`} />{:else}<span aria-hidden="true">◎</span>{/if}</div>
						<input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" bind:this={replacePhotoInput} onchange={replacePhoto} aria-label="Replace disc photo" />
						<button class="outline full" onclick={() => replacePhotoInput?.click()} disabled={photoBusy}>{photoBusy ? 'Preparing photo…' : selectedDisc.image ? 'Replace disc photo' : 'Add disc photo'}</button>
						{#if selectedDisc.image}<button class="text-button full" onclick={() => updateFact({ image: null })}>Remove photo</button>{/if}
						<div class="facts-form"><label for="manufacturer">Manufacturer<input id="manufacturer" autocomplete="organization" value={selectedDisc.manufacturer} oninput={(event) => updateFact({ manufacturer: event.currentTarget.value })} /></label><label for="mold">Mold / disc name<input id="mold" autocomplete="off" value={selectedDisc.mold} oninput={(event) => updateFact({ mold: event.currentTarget.value })} /></label><label for="variant">Specimen details<input id="variant" autocomplete="off" value={selectedDisc.variant} oninput={(event) => updateFact({ variant: event.currentTarget.value })} /></label><fieldset class="flight-fields"><legend>Flight numbers</legend><div class="flight-inputs">{#each ['speed', 'glide', 'turn', 'fade'] as key}<label for={`flight-${key}`}>{key}<input id={`flight-${key}`} type="number" step="any" value={selectedDisc.flight?.[key as keyof FlightNumbers] ?? ''} oninput={(event) => updateFlight(key as keyof FlightNumbers, event.currentTarget.value)} /></label>{/each}</div></fieldset></div>
						<p class="hint">Photos stay in this browser. Crop and recognition are not included.</p>
				{:else}<div class="empty"><strong>Choose a disc</strong><p>The inspector follows shelf selection.</p></div>{/if}
			</section>
			<section class="panel membership-panel"><div class="section-heading"><div><span class="eyebrow">BAG MEMBERSHIP</span><h2>Place this disc</h2></div><span class="tag">{selectedDisc ? 'EDIT' : '—'}</span></div>
				{#if selectedDisc}{#each bags as bag (bag.id)}<button class="membership" class:member={bagContains(bag, selectedDisc.id)} onclick={() => toggleMembership(bag)} aria-pressed={bagContains(bag, selectedDisc.id)}><span>{bagContains(bag, selectedDisc.id) ? '✓' : '+'}</span><strong>{bag.name}</strong><small>{bagContains(bag, selectedDisc.id) ? 'In this bag' : 'Add to bag'}</small></button>{/each}{#if bags.length === 0}<p class="empty">Build your first bag on the left.</p>{/if}{:else}<p class="empty">Select a physical disc to manage its bag memberships.</p>{/if}
				<p class="panel-note">A disc can be in several bags at once. Removing it here leaves the shelf untouched.</p>
			</section>
		</aside>
	</div>
</div>

<style>
	:global(*) { box-sizing: border-box; }
	:global(body) { margin: 0; background: #f3f1e9; color: #243b2d; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
	:global(button), :global(input) { font: inherit; }
	:global(button) { cursor: pointer; }
	:global(button:disabled) { cursor: not-allowed; opacity: .45; }
	.shelf-page { min-height: 100vh; background: #f3f1e9; color: #243b2d; }
	.topbar { min-height: 72px; display: flex; align-items: center; gap: 24px; padding: 13px 24px; border-bottom: 1px solid #d8d1c4; background: #fffdf8; }
	.brand { display: flex; align-items: center; gap: 9px; white-space: nowrap; font-size: 13px; letter-spacing: .11em; }
	.brand small { color: #68766e; font: 9px ui-monospace, monospace; letter-spacing: .08em; }
	.mark { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 9px; background: #6e8d45; color: #fffdf8; font-size: 22px; transform: rotate(-18deg); }
	.divider { width: 1px; height: 17px; background: #b8b1a4; }
	.top-note { margin: auto; color: #68766e; font-size: 12px; }
	.top-actions { display: flex; align-items: center; gap: 13px; }
	.local-dot { color: #6e8d45; font: 10px ui-monospace, monospace; letter-spacing: .07em; }
	.local-dot::before { content: '●'; margin-right: 6px; }
	.build { border: 0; border-radius: 7px; padding: 9px 12px; background: #2e4937; color: #fffdf8; font-size: 11px; }
	.build:hover { background: #486443; }
	.notice { margin: 12px 24px 0; padding: 9px 13px; border: 1px solid #84956f; border-radius: 8px; background: #edf3e4; color: #6e8d45; display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
	.notice.error { border-color: #9a5f52; background: #fff0e8; color: #a54f3d; }
	.notice button { border: 0; background: transparent; color: inherit; font-size: 18px; }
	.columns { display: grid; grid-template-columns: 268px minmax(520px, 1fr) 252px; max-width: 1800px; min-height: calc(100vh - 72px); margin: auto; }
	.left-column, .right-column { display: grid; align-content: start; gap: 12px; padding: 20px 13px; }
	.left-column { border-right: 1px solid #d8d1c4; }
	.right-column { border-left: 1px solid #d8d1c4; }
	.center-column { min-width: 0; padding: 28px 26px 48px; }
	.panel { border: 1px solid #d8d1c4; border-radius: 12px; background: #fffdf8; }
	.shelf-panel, .bags-panel, .inspector, .membership-panel { padding: 17px 15px; }
	.eyebrow { color: #68766e; font: 700 9px ui-monospace, monospace; letter-spacing: .17em; }
	h1, h2, p { margin: 0; }
	h1 { font-size: 19px; letter-spacing: -.04em; }
	h2 { font-size: 18px; letter-spacing: -.04em; }
	.title-row, .section-heading, .center-heading, .inspector-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
	.title-row { margin-top: 8px; align-items: center; }
	.title-row > div { min-width: 0; }
	.add-disc { flex: 0 0 auto; border: 1px solid #70915e; border-radius: 7px; padding: 8px 9px; color: #425b2e; background: #e5eedb; font-size: 10px; white-space: nowrap; }
	.title-row h1 span { color: #6e8d45; font: 11px ui-monospace, monospace; }
	.subtle, .center-heading p, .panel-note { color: #68766e; font-size: 11px; line-height: 1.5; }
	.subtle { margin-top: 6px; }
	.tag, .count-pill { color: #6e8d45; font: 9px ui-monospace, monospace; letter-spacing: .09em; border: 1px solid #8ba073; border-radius: 5px; padding: 4px 6px; white-space: nowrap; }
	.count-pill { align-self: end; }
	.search { display: flex; align-items: center; gap: 7px; margin: 17px 0 11px; padding: 0 9px; border: 1px solid #d5cdbf; border-radius: 7px; color: #68766e; }
	.search input { width: 100%; min-width: 0; border: 0; outline: 0; padding: 9px 0; color: #243b2d; background: transparent; }
	.disc-list { display: grid; gap: 4px; }
	.disc-row, .bag-row { width: 100%; display: flex; align-items: center; gap: 9px; padding: 7px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: inherit; text-align: left; }
	.disc-row:hover, .disc-row.selected, .bag-row:hover, .bag-row.selected { border-color: #506544; background: #eee9df; }
	.thumb { width: 42px; height: 42px; flex: 0 0 auto; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: #e3ded3; color: #8c9b8f; font-size: 23px; }
	.thumb img { width: 100%; height: 100%; object-fit: contain; }
	.disc-copy { min-width: 0; display: grid; gap: 2px; }
	.disc-copy small, .disc-copy span, .bag-row small, .bag-row em { overflow: hidden; color: #68766e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
	.disc-copy small { text-transform: uppercase; letter-spacing: .08em; }
	.disc-copy strong, .bag-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
	.empty { color: #86968c; font-size: 11px; padding: 13px 4px; }
	.bags-panel { display: grid; gap: 5px; }
	.bags-panel h2 { margin-top: 4px; }
	.bag-icon { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 6px; background: #e4ebda; color: #6e8d45; }
	.bag-row > span:last-child { min-width: 0; display: grid; gap: 2px; }
	.bag-row em { color: #a54f3d; font-style: normal; }
	.new-bag { display: grid; gap: 6px; margin-top: 11px; padding-top: 12px; border-top: 1px solid #e2dbcf; }
	.new-bag label { color: #68766e; font: 9px ui-monospace, monospace; letter-spacing: .1em; text-transform: uppercase; }
	.new-bag div { display: flex; border: 1px solid #d5cdbf; border-radius: 7px; overflow: hidden; }
	.new-bag input { min-width: 0; width: 100%; border: 0; outline: 0; padding: 8px; background: transparent; font-size: 11px; }
	.new-bag button { width: 31px; border: 0; background: #e4ebda; color: #506544; }
	.panel-note { margin-top: 9px; padding-top: 10px; border-top: 1px solid #e2dbcf; }
	.center-heading { margin-bottom: 17px; align-items: end; }
	.center-heading h2 { margin-top: 6px; font-size: clamp(23px, 3vw, 34px); }
	.center-heading p { margin-top: 5px; }
	.missing-notice { display: grid; gap: 4px; margin: 0 0 14px; padding: 10px 12px; border-left: 3px solid #a54f3d; background: #fff0e8; color: #8f4635; font-size: 11px; }
	.missing-notice span { font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
	.missing-notice small { color: #a86250; }
	.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; align-items: stretch; }
	.card-button { min-width: 0; min-height: 410px; border: 2px solid transparent; border-radius: 15px; padding: 0; background: transparent; color: inherit; text-align: left; }
	.card-button:hover, .card-button.selected { border-color: #6e8d45; }
	.card-button :global(.disc-card) { border-radius: 13px; }
	.empty-card { display: grid; place-items: center; min-height: 320px; padding: 30px; border: 1px dashed #b8b1a4; border-radius: 12px; color: #68766e; text-align: center; }
	.empty-card p { margin-top: 6px; font-size: 11px; }
	.inspector { min-height: 300px; }
	.inspector-heading { margin-top: 7px; align-items: center; }
	.inspector-photo { display: grid; place-items: center; height: 174px; margin: 15px 0; overflow: hidden; border-radius: 9px; background: #e3ded3; color: #8c9b8f; font-size: 55px; }
	.inspector-photo img { width: 100%; height: 100%; object-fit: contain; }
	.hidden { display: none; }
	.outline { width: 100%; border: 1px solid #8aa176; border-radius: 6px; padding: 8px 10px; color: #425b2e; background: transparent; font-size: 10px; }
	.outline:hover { background: #eaf1df; }
	.text-button { border: 0; padding: 5px 0; color: #506544; background: transparent; font-size: 10px; text-align: left; }
	.text-button:hover { color: #2e4937; text-decoration: underline; }
	.full { width: 100%; }
	.facts-form { display: grid; gap: 8px; margin-top: 14px; }
	.flight-fields { min-width: 0; margin: 2px 0 0; padding: 0; border: 0; }
	.flight-fields legend { padding: 0; color: #84948b; font: 9px ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; }
	.facts-form label, .flight-inputs label { display: grid; gap: 4px; color: #84948b; font: 9px ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; }
	.facts-form input { width: 100%; border: 1px solid #d5cdbf; border-radius: 6px; padding: 7px 8px; color: #243b2d; background: #fffef9; font: 11px Inter, sans-serif; }
	.flight-inputs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
	.flight-inputs input { min-width: 0; }
	.hint { margin-top: 9px; color: #68766e; font-size: 10px; line-height: 1.4; }
	.membership-panel { display: grid; gap: 5px; }
	.membership-panel h2 { margin-top: 4px; }
	.membership { display: grid; grid-template-columns: 23px minmax(0, 1fr) auto; gap: 7px; align-items: center; padding: 8px; border: 1px solid transparent; border-radius: 7px; background: #f0ece3; color: #243b2d; text-align: left; }
	.membership:hover, .membership.member { border-color: #70915e; background: #e5eedb; }
	.membership > span { color: #6e8d45; font-weight: 700; }
	.membership strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
	.membership small { color: #68766e; font-size: 9px; }
	@media (max-width: 1120px) { .columns { grid-template-columns: 235px minmax(0, 1fr); } .right-column { grid-column: 1 / -1; grid-template-columns: 1fr 1fr; border-left: 0; border-top: 1px solid #d8d1c4; } }
	@media (max-width: 720px) { .topbar { flex-wrap: wrap; } .top-note { order: 3; width: 100%; margin: 0; } .columns { display: block; } .left-column, .right-column { border: 0; border-bottom: 1px solid #d8d1c4; } .right-column { display: grid; grid-template-columns: 1fr; } .center-column { padding: 22px 13px 35px; } .card-grid { grid-template-columns: 1fr; } }
	@media (max-width: 420px) { .title-row { align-items: stretch; flex-direction: column; } .add-disc { width: 100%; } .top-actions { width: 100%; justify-content: space-between; } }
</style>
