<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import BattleView from '../disc-studio/BattleView.svelte';
	import { createSampleWorkspace } from '../disc-studio/samples';
	import { flightKeys, formatNumber, parseWorkspace, type Disc, type Workspace } from '../disc-studio/model';

	export type CandidateExportView = { layout: 'row' | 'stack' };
	export type CandidateScene = { svg: string; cardCount: number; blocked?: string; disclosures?: string[] };
	export type CandidatePngExportDetail = { blob: Blob; filename: string; svg: string };
	export type CandidateStudioProps = {
		renderScene?: (workspace: Workspace, view: CandidateExportView) => CandidateScene;
		exportPng?: (scene: CandidateScene) => Promise<Blob> | Blob;
		onExportPng?: (detail: CandidatePngExportDetail) => void;
	};

	let { renderScene, exportPng: exportScenePng, onExportPng }: CandidateStudioProps = $props();

	const storageKey = 'chainspot.disc-studio.candidate.v1';
	const prefsKey = 'chainspot.disc-studio.candidate.prefs.v1';
	const supportedVideoTypes = ['video/mp4', 'video/webm'];
	let workspace = $state<Workspace>(createSampleWorkspace());
	const mode = 'battle' as const;
	type CandidateStyle = 'big-photo' | 'compact-score';
	let style = $state<CandidateStyle>('compact-score');
	let exportLayout = $state<'row' | 'stack'>('row');
	let settingsOpen = $state(false);
	let selectedDiscId = $state('');
	let selectedEntryId = $state<string | null>(null);
	let query = $state('');
	let message = $state('');
	let error = $state('');
	let hydrated = $state(false);
	let contextUrl = $state<string | null>(null);
	let contextName = $state('');
	let videoInput = $state<HTMLInputElement>();
	let videoElement = $state<HTMLVideoElement>();
	let rootElement: HTMLDivElement;
	let exportBusy = $state(false);

	let selectedDisc = $derived(workspace.discs.find((disc) => disc.id === selectedDiscId));
	let selectedEntry = $derived(workspace.battle.entries.find((entry) => entry.id === selectedEntryId));
	let visibleDiscs = $derived(
		workspace.discs.filter((disc) =>
			`${disc.manufacturer} ${disc.mold} ${disc.variant}`.toLowerCase().includes(query.toLowerCase())
		)
	);
	let scene = $derived(getScene());
	let compactExportAvailable = $derived(style === 'compact-score' && !scene.blocked && !!scene.svg && scene.cardCount > 0 && !!exportScenePng);

	onMount(() => {
		try {
			const raw = localStorage.getItem(storageKey);
			if (raw) {
				const restored = parseWorkspace(raw);
				workspace = restored;
				selectedDiscId = restored.discs[0]?.id ?? '';
				selectedEntryId = restored.battle.entries[0]?.id ?? null;
				message = 'Restored the candidate shelf from this browser.';
			}
		} catch (cause) {
			error = `Candidate draft could not be restored: ${(cause as Error).message}`;
		}
		try {
			const rawPrefs = localStorage.getItem(prefsKey);
			if (rawPrefs) {
				const prefs = JSON.parse(rawPrefs) as { style?: CandidateStyle; exportLayout?: 'row' | 'stack'; settingsOpen?: boolean };
				if (prefs.style === 'big-photo' || prefs.style === 'compact-score') style = prefs.style;
				if (prefs.exportLayout === 'row' || prefs.exportLayout === 'stack') exportLayout = prefs.exportLayout;
				if (typeof prefs.settingsOpen === 'boolean') settingsOpen = prefs.settingsOpen;
			}
		} catch (cause) {
			error = `Candidate settings could not be restored: ${(cause as Error).message}`;
		}
		if (!selectedDiscId) selectedDiscId = workspace.discs[0]?.id ?? '';
		if (!selectedEntryId) selectedEntryId = workspace.battle.entries[0]?.id ?? null;
		hydrated = true;
		return () => {
			hydrated = false;
		};
	});

	$effect(() => {
		if (!hydrated) return;
		try {
			localStorage.setItem(storageKey, JSON.stringify(workspace));
			localStorage.setItem(prefsKey, JSON.stringify({ style, exportLayout, settingsOpen }));
		} catch (cause) {
			error = `Candidate changes are session-only: ${(cause as Error).message}`;
		}
	});

	onDestroy(() => revokeContextUrl());

	function getScene(): CandidateScene {
		if (style === 'big-photo') return { svg: '', cardCount: 0, blocked: 'Big photo cards are preview-only.' };
		if (!renderScene) return { svg: '', cardCount: 0, blocked: 'Renderer callback is not wired yet.' };
		try { return renderScene(workspace, { layout: exportLayout }); }
		catch (cause) { return { svg: '', cardCount: 0, blocked: `Renderer could not prepare this battle: ${(cause as Error).message}` }; }
	}

	function selectDisc(id: string) {
		selectedDiscId = id;
		message = 'Shelf selection is view-only; exported artwork follows the selected mode.';
	}

	function inspectEntry(id: string) {
		selectedEntryId = id;
		const entry = workspace.battle.entries.find((item) => item.id === id);
		if (entry) selectedDiscId = entry.discId;
		message = 'Entry selection is view-only. Authored highlight and winner emphasis remain separate.';
	}

	function revokeContextUrl() {
		if (contextUrl) URL.revokeObjectURL(contextUrl);
		contextUrl = null;
		contextName = '';
	}

	function chooseVideo(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!supportedVideoTypes.includes(file.type) || file.size > 300 * 1024 * 1024) {
			error = 'Choose an MP4 or WebM video under 300 MB.';
			return;
		}
		revokeContextUrl();
		contextUrl = URL.createObjectURL(file);
		contextName = file.name;
		message = 'Video context is local preview only; it is excluded from the transparent PNG.';
		queueMicrotask(() => videoElement?.play().catch(() => undefined));
	}

	function clearVideo() {
		revokeContextUrl();
		message = 'Video context cleared.';
	}

	async function exportPreview() {
		if (!compactExportAvailable || exportBusy || !exportScenePng) return;
		exportBusy = true;
		error = '';
		try {
			const blob = await exportScenePng(scene);
			const filename = 'chainspot-candidate-battle.png';
			const detail = { blob, filename, svg: scene.svg };
			onExportPng?.(detail);
			rootElement.dispatchEvent(new CustomEvent<CandidatePngExportDetail>('candidate-png-export', { detail }));
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			link.click();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000);
			message = 'Transparent PNG exported. Video context and editor selection are not included.';
		} catch (cause) {
			error = (cause as Error).message;
		} finally {
			exportBusy = false;
		}
	}

	function cardImage(disc: Disc): string {
		if (disc.image?.src) return disc.image.src;
		return '';
	}
</script>

<svelte:head>
	<title>ChainSpot · Candidate</title>
	<meta name="description" content="A local DiscBattle workspace with transparent preview and export." />
</svelte:head>

<div class="candidate" bind:this={rootElement}>
	<header class="topbar">
		<div class="brand"><span class="mark" aria-hidden="true">◎</span><strong>CHAINSPOT</strong><span class="divider"></span><span>CANDIDATE</span><small>PROVISIONAL</small></div>
		<div class="mode-switch" aria-label="Candidate style"><span>{style === 'big-photo' ? 'Big photo' : 'Compact score'}</span><small>{workspace.battle.entries.length} entries</small></div>
		<div class="top-actions"><span class="save-dot">{hydrated ? 'Candidate saved locally' : 'Opening candidate…'}</span><button class="quiet" onclick={exportPreview} disabled={!compactExportAvailable || exportBusy}>{exportBusy ? 'Preparing…' : 'Export transparent PNG ↓'}</button></div>
	</header>

	{#if error}<div class="notice error" role="alert"><span>{error}</span><button onclick={() => (error = '')} aria-label="Dismiss error">×</button></div>{/if}
	{#if message}<div class="notice" role="status"><span>{message}</span><button onclick={() => (message = '')} aria-label="Dismiss notice">×</button></div>{/if}

	<div class="workspace">
		<aside class="shelf panel" aria-label="Candidate disc shelf">
			<div class="eyebrow">YOUR DISC SHELF</div>
			<div class="panel-title"><h2>Disc shelf <span>{workspace.discs.length}</span></h2><span class="candidate-tag">LOCAL</span></div>
			<p class="subtle">Actual manufacturer, mold, variant, flight facts, and specimen images.</p>
			<label class="search"><span aria-hidden="true">⌕</span><input bind:value={query} aria-label="Search candidate shelf" placeholder="Find a disc…" /></label>
			<div class="shelf-list">
				{#each visibleDiscs as disc (disc.id)}
					<button class="shelf-item" class:chosen={selectedDiscId === disc.id} aria-pressed={selectedDiscId === disc.id} onclick={() => selectDisc(disc.id)}>
						<div class="thumb">{#if cardImage(disc)}<img src={cardImage(disc)} alt={disc.image?.alt ?? `${disc.mold} photo`} />{:else}<span aria-hidden="true">◎</span>{/if}</div>
						<div class="shelf-copy"><small>{disc.manufacturer || 'MANUFACTURER'}</small><strong>{disc.mold || 'Untitled disc'}</strong><span>{disc.variant || 'No variant'}</span><code>{flightKeys.map((key) => formatNumber(disc.flight[key])).join(' / ')}</code></div>
						{#if disc.image}<span class="photo-dot" title="Embedded image source" aria-label="Has embedded image"></span>{/if}
					</button>
				{/each}
				{#if visibleDiscs.length === 0}<p class="empty">No matching discs.</p>{/if}
			</div>
			<p class="view-only-note">Shelf selection is view-only. It does not mutate the battle data.</p>
		</aside>

		<main class="main">
			<div class="main-heading"><div><span class="eyebrow">DISC BATTLE WORKSPACE</span><h1>Shell + transparent scene</h1></div><button class="quiet settings-toggle" onclick={() => (settingsOpen = !settingsOpen)} aria-expanded={settingsOpen}>Design settings {settingsOpen ? '⌃' : '⌄'}</button></div>
			{#if settingsOpen}<section class="settings panel" aria-label="Candidate design settings"><div><span class="eyebrow">SUPPORTED CONTROLS</span><h2>Choose the visible style</h2></div><div class="setting-row"><div class="setting-copy"><strong>Card treatment</strong><small>Big photo cards are preview-only. Compact score cards can export a transparent PNG.</small></div><div class="segmented"><button class:active={style === 'big-photo'} onclick={() => (style = 'big-photo')} aria-pressed={style === 'big-photo'}>Big photo</button><button class:active={style === 'compact-score'} onclick={() => (style = 'compact-score')} aria-pressed={style === 'compact-score'}>Compact score</button></div></div><div class="setting-row"><div class="setting-copy"><strong>Export layout</strong><small>Only Row and Stack are available. Grid remains unavailable.</small></div><div class="segmented"><button class:active={exportLayout === 'row'} onclick={() => (exportLayout = 'row')} aria-pressed={exportLayout === 'row'}>Row</button><button class:active={exportLayout === 'stack'} onclick={() => (exportLayout = 'stack')} aria-pressed={exportLayout === 'stack'}>Stack</button></div></div></section>{/if}
			<div class="preview-toolbar"><strong>THE BATTLE OVERLAY</strong><span>1920 × 1080 transparent canvas</span><button class="quiet" onclick={exportPreview} disabled={!compactExportAvailable || exportBusy}>PNG ↓</button></div>
			<div class="preview-grid">
				<section class="preview-stage" aria-label="Transparent SVG preview over optional local video">
					<div class="stage-label"><span>TRANSPARENT PREVIEW</span><span>{style === 'big-photo' ? 'B PREVIEW' : scene.blocked ? 'BLOCKED' : `${scene.cardCount} card${scene.cardCount === 1 ? '' : 's'}`}</span></div>
					<div class="checker">
						{#if contextUrl}<video class="context-video" bind:this={videoElement} src={contextUrl} controls muted loop playsinline onerror={clearVideo}></video>{/if}
						{#if style === 'big-photo'}<div class="b-preview" aria-label="Big photo battle preview"><BattleView workspace={workspace} selectedEntryId={selectedEntryId} onselect={inspectEntry} /></div>
						{:else if scene.blocked}<div class="blocked"><strong>{scene.blocked}</strong><p>Export is disabled for this state.</p></div>
						{:else if scene.svg}<div class="overlay" aria-label="Rendered transparent overlay">{@html scene.svg}</div>
						{:else}<div class="blocked"><strong>Select a disc or add a battle entry.</strong></div>{/if}
					</div>
					<p class="stage-foot">Transparent PNG contains the disc scene only. Video context, selection, and editor notes stay outside the export.</p>
				</section>
				<section class="context-card" aria-label="Video context controls">
					<div class="context-head"><div><span class="eyebrow">VIDEO CONTEXT</span><h2>Preview over a local clip</h2></div><button class="quiet" onclick={clearVideo} disabled={!contextUrl}>Clear</button></div>
					{#if contextUrl}<small class="file-name">{contextName} · local object URL · layered in the stage</small>{:else}<div class="video-empty"><strong>Choose an MP4 or WebM</strong><p>The clip sits behind the preview. It is never embedded in the PNG.</p></div>{/if}
					<input class="hidden" bind:this={videoInput} type="file" accept="video/mp4,video/webm" onchange={chooseVideo} aria-label="Choose local video context" />
					<button class="outline full" onclick={() => videoInput?.click()}>＋ Choose local video</button>
				</section>
			</div>
			<div class="renderer-note"><strong>Export details:</strong> Image fit <code>{workspace.cardAppearance.imageFit}</code> is previewed with the available card treatment. Grid export is unavailable. Big photo cards render in this preview only; Compact score export preserves the authored highlight and multiple winner emphasis while selection stays view-only.</div>
			{#if scene.disclosures?.length}<div class="disclosures" aria-label="Export notes"><strong>Export note</strong>{#each scene.disclosures as disclosure}<span>{disclosure}</span>{/each}</div>{/if}

			<section class="battle-shelf panel" aria-label="Battle entries">
				<div class="section-heading"><div><span class="eyebrow">BATTLE VISUAL STATE</span><h2>Inspect the authored lineup</h2></div><span class="view-only-pill">VIEW ONLY</span></div>
				<p class="subtle">Selection is editor-only. Highlight is read from <code>battleVisual.highlightedEntryId</code>; winner emphasis can appear on multiple entries.</p>
				<div class="entry-list">
					{#each workspace.battle.entries as entry, index (entry.id)}
						{@const disc = workspace.discs.find((item) => item.id === entry.discId)}
						<button class="entry-row" class:selected={selectedEntryId === entry.id} onclick={() => inspectEntry(entry.id)} aria-pressed={selectedEntryId === entry.id}>
							<span class="entry-index">{String(index + 1).padStart(2, '0')}</span><span class="entry-name"><strong>{disc?.mold || 'Untitled disc'}</strong><small>{disc?.manufacturer || 'Unknown manufacturer'}</small></span><span class="entry-score">{formatNumber(entry.score)}</span>
							{#if workspace.battleVisual.highlightedEntryId === entry.id}<span class="state highlight">● Highlight</span>{/if}
							{#if workspace.battleVisual.emphasizedEntryIds.includes(entry.id)}<span class="state winner">★ Winner</span>{/if}
						</button>
					{/each}
				</div>
			</section>
		</main>

		<aside class="inspector panel" aria-label="Candidate inspector">
			<div class="eyebrow">VIEW-ONLY INSPECTOR</div><div class="panel-title"><h2>{selectedDisc?.mold || 'Disc details'}</h2><span class="candidate-tag">B FACTS</span></div>
			{#if selectedDisc}<div class="inspector-photo">{#if cardImage(selectedDisc)}<img src={cardImage(selectedDisc)} alt={selectedDisc.image?.alt ?? selectedDisc.mold} />{:else}<span aria-hidden="true">◎</span>{/if}</div><dl><div><dt>Manufacturer</dt><dd>{selectedDisc.manufacturer || '—'}</dd></div><div><dt>Mold</dt><dd>{selectedDisc.mold || '—'}</dd></div><div><dt>Variant</dt><dd>{selectedDisc.variant || '—'}</dd></div><div><dt>Flight</dt><dd>{flightKeys.map((key) => `${key} ${formatNumber(selectedDisc.flight[key])}`).join(' · ')}</dd></div></dl>{:else}<p class="empty">Choose a shelf disc to inspect its B facts.</p>{/if}
			{#if selectedEntry}<div class="selected-entry"><span class="eyebrow">SELECTED ENTRY · EDITOR ONLY</span><strong>{selectedEntry.id}</strong><span>score {formatNumber(selectedEntry.score)}</span></div>{/if}
			<p class="view-only-note">Selection and highlight are shown for inspection. The export reads authored visual state and never uses <code>selectedEntryId</code>.</p>
		</aside>
	</div>
</div>

<style>
	:global(*) { box-sizing: border-box; }
	:global(body) { margin: 0; background: #f5f4ed; color: #243b2d; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
	:global(button), :global(input) { font: inherit; }
	:global(button) { cursor: pointer; }
	:global(button:disabled) { cursor: not-allowed; opacity: .45; }
	.candidate { min-height: 100vh; background: #f5f4ed; color: #243b2d; }
	.topbar { min-height: 72px; border-bottom: 1px solid #d8d1c4; display: flex; align-items: center; gap: 24px; padding: 13px 24px; background: #fffdf8; }
	.brand { display: flex; align-items: center; gap: 9px; white-space: nowrap; font-size: 13px; letter-spacing: .11em; }
	.brand small { color: #68766e; font: 9px ui-monospace, monospace; letter-spacing: .08em; }
	.mark { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 9px; background: #6e8d45; color: #fffdf8; font-size: 22px; transform: rotate(-18deg); }
	.divider { width: 1px; height: 17px; background: #b8b1a4; }
	.mode-switch { display: flex; gap: 4px; margin: auto; padding: 4px; border: 1px solid #d5cdbf; border-radius: 10px; background: #f5f1e8; }
	.mode-switch span { color: #6e8d45; font-size: 11px; padding: 3px 4px; }
	.mode-switch small { color: #68766e; font: 9px ui-monospace, monospace; padding: 3px 4px; }
	.top-actions { display: flex; align-items: center; gap: 12px; }
	.save-dot { color: #a9b8a6; font: 10px ui-monospace, monospace; }
	.save-dot::before { content: '●'; color: #6e8d45; margin-right: 6px; }
	.quiet:hover { color: #6e8d45; background: #ece8de; }
	.notice { margin: 12px 24px 0; padding: 9px 13px; border: 1px solid #84956f; border-radius: 8px; background: #edf3e4; color: #6e8d45; display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
	.notice.error { border-color: #9a5f52; background: #fff0e8; color: #a54f3d; }
	.notice button { border: 0; background: transparent; color: inherit; font-size: 18px; }
	.workspace { display: grid; grid-template-columns: 252px minmax(500px, 1fr) 244px; max-width: 1800px; min-height: calc(100vh - 72px); margin: auto; }
	.panel { background: #fffdf8; }
	.shelf { padding: 24px 16px; border-right: 1px solid #d8d1c4; }
	.inspector { padding: 24px 16px; border-left: 1px solid #d8d1c4; }
	.eyebrow { color: #68766e; font: 700 9px ui-monospace, monospace; letter-spacing: .17em; }
	.panel-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
	h1, h2, p { margin: 0; }
	h1 { font-size: clamp(24px, 3vw, 38px); letter-spacing: -.05em; }
	h2 { font-size: 17px; letter-spacing: -.03em; }
	.candidate-tag, .view-only-pill { color: #6e8d45; font: 9px ui-monospace, monospace; letter-spacing: .1em; border: 1px solid #506544; border-radius: 5px; padding: 4px 6px; }
	.subtle, .view-only-note { color: #68766e; font-size: 11px; line-height: 1.5; margin-top: 6px; }
	.search { display: flex; align-items: center; gap: 7px; margin: 18px 0 12px; padding: 0 9px; border: 1px solid #d5cdbf; border-radius: 7px; color: #68766e; }
	.search input { min-width: 0; width: 100%; border: 0; outline: 0; padding: 9px 0; color: #243b2d; background: transparent; }
	.shelf-list { display: grid; gap: 5px; }
	.shelf-item { position: relative; width: 100%; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 9px; align-items: center; padding: 7px; text-align: left; border: 1px solid transparent; border-radius: 8px; background: transparent; color: inherit; }
	.shelf-item:hover, .shelf-item.chosen { background: #eee9df; border-color: #435548; }
	.thumb { width: 44px; height: 44px; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: #e3ded3; color: #8c9b8f; font-size: 25px; }
	.thumb img { width: 100%; height: 100%; object-fit: contain; }
	.shelf-copy { min-width: 0; display: grid; gap: 2px; }
	.shelf-copy small, .shelf-copy span { overflow: hidden; color: #68766e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
	.shelf-copy small { text-transform: uppercase; letter-spacing: .09em; }
	.shelf-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
	.shelf-copy code { color: #6e8d45; font: 9px ui-monospace, monospace; }
	.photo-dot { position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 99px; background: #6e8d45; }
	.empty { color: #86968c; font-size: 11px; padding: 13px 4px; }
	.view-only-note { border-top: 1px solid #d8d1c4; padding-top: 13px; margin-top: 17px; }
	.view-only-note code, .renderer-note code, .battle-shelf code { color: #6e8d45; font: 10px ui-monospace, monospace; }
	.main { min-width: 0; padding: 27px 26px 42px; }
	.main-heading, .preview-toolbar, .context-head, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.main-heading { margin-bottom: 21px; }
	.preview-toolbar { margin-bottom: 8px; color: #68766e; font: 10px ui-monospace, monospace; letter-spacing: .08em; }
	.preview-grid { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 12px; align-items: stretch; }
	.settings { margin: -8px 0 14px; padding: 14px; border: 1px solid #d8d1c4; border-radius: 10px; background: #fffdf8; }
	.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding-top: 12px; margin-top: 12px; border-top: 1px solid #e2dbcf; }
	.setting-copy { display: grid; gap: 3px; }
	.setting-copy small { color: #68766e; font-size: 10px; }
	.segmented { display: flex; gap: 3px; padding: 3px; border: 1px solid #d5cdbf; border-radius: 7px; background: #f5f4ed; }
	.segmented button { border: 0; border-radius: 5px; padding: 6px 8px; color: #68766e; background: transparent; font-size: 10px; }
	.segmented button.active { background: #e1ead5; color: #425b2e; font-weight: 700; }
	.preview-stage, .context-card, .battle-shelf { border: 1px solid #d8d1c4; border-radius: 12px; background: #fffdf8; overflow: hidden; }
	.stage-label, .stage-foot { display: flex; justify-content: space-between; gap: 10px; padding: 11px 14px; color: #8fa198; font: 9px ui-monospace, monospace; letter-spacing: .08em; }
	.stage-foot { border-top: 1px solid #d8d1c4; line-height: 1.4; letter-spacing: 0; }
	.checker { position: relative; min-height: 345px; aspect-ratio: 16 / 9; display: grid; place-items: center; overflow: auto; padding: 20px; background-color: #ebe6dc; background-image: linear-gradient(45deg, #dcd5c8 25%, transparent 25%), linear-gradient(-45deg, #dcd5c8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #dcd5c8 75%), linear-gradient(-45deg, transparent 75%, #dcd5c8 75%); background-size: 26px 26px; background-position: 0 0, 0 13px, 13px -13px, -13px 0; }
	.context-video { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; border: 0; object-fit: contain; background: #e3ded3; }
	.overlay { position: relative; z-index: 1; width: min(100%, 780px); aspect-ratio: 16 / 9; filter: drop-shadow(0 10px 16px #53614635); }
	.overlay :global(svg) { width: 100%; height: 100%; }
	.blocked { max-width: 340px; padding: 22px; border: 1px solid #aa765f; border-radius: 10px; background: #fff0e8; color: #8f4635; text-align: center; }
	.blocked p { margin-top: 7px; color: #a86250; font-size: 11px; }
	.context-card { padding: 13px; }
	.context-head { align-items: flex-start; margin-bottom: 11px; }
	.context-head h2 { margin-top: 5px; font-size: 14px; }
	.b-preview { position: relative; z-index: 1; width: 100%; max-width: 900px; overflow: auto; padding: 15px; }
	.b-preview :global(.battle) { min-width: 620px; }
	.video-empty { display: grid; place-items: center; min-height: 124px; padding: 14px; border-radius: 7px; background: #f5f1e8; color: #bdcbbd; text-align: center; }
	.video-empty p { margin-top: 7px; color: #7d897f; font-size: 10px; }
	.file-name { display: block; overflow: hidden; margin: 8px 0; color: #68766e; font: 9px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
	.outline { width: 100%; border: 1px solid #859b71; border-radius: 7px; padding: 8px; color: #6e8d45; background: transparent; }
	.outline:hover { background: #2b3a30; }
	.hidden { display: none; }
	.disclosures { display: grid; gap: 4px; margin: -7px 0 17px; padding: 9px 12px; border: 1px solid #d8d1c4; border-radius: 7px; background: #fffef9; color: #68766e; font-size: 10px; }
	.disclosures strong { color: #425b2e; font-size: 10px; }
	.renderer-note { margin: 11px 0 17px; padding: 11px 13px; border-left: 3px solid #6e8d45; background: #f0ebdf; color: #68766e; font-size: 11px; line-height: 1.5; }
	.battle-shelf { padding: 15px; }
	.section-heading { align-items: flex-start; }
	.section-heading h2 { margin-top: 5px; }
	.entry-list { display: grid; gap: 5px; margin-top: 13px; }
	.entry-row { width: 100%; display: grid; grid-template-columns: 27px minmax(100px, 1fr) auto auto; gap: 8px; align-items: center; padding: 9px; text-align: left; border: 1px solid transparent; border-radius: 7px; background: #f0ece3; color: #243b2d; }
	.entry-row:hover, .entry-row.selected { border-color: #70915e; background: #e5eedb; }
	.entry-index { color: #7d897f; font: 10px ui-monospace, monospace; }
	.entry-name { display: grid; gap: 2px; min-width: 0; }
	.entry-name strong, .entry-name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.entry-name small { color: #8fa198; font-size: 10px; }
	.entry-score { color: #6e8d45; font: 700 15px ui-monospace, monospace; }
	.state { padding: 3px 5px; border-radius: 4px; font: 9px ui-monospace, monospace; white-space: nowrap; }
	.state.highlight { background: #e6efd9; color: #6e8d45; }
	.state.winner { background: #f6e7c9; color: #9b6b25; }
	.inspector-photo { display: grid; place-items: center; width: 100%; height: 160px; margin: 18px 0 15px; border-radius: 9px; background: #e3ded3; color: #8c9b8f; font-size: 50px; overflow: hidden; }
	.inspector-photo img { width: 100%; height: 100%; object-fit: contain; }
	dl { margin: 0; display: grid; gap: 10px; }
	dl div { display: grid; gap: 2px; }
	dt { color: #84948b; font: 9px ui-monospace, monospace; letter-spacing: .07em; text-transform: uppercase; }
	dd { margin: 0; color: #243b2d; font-size: 12px; overflow-wrap: anywhere; }
	.selected-entry { display: grid; gap: 4px; margin-top: 18px; padding: 11px; border: 1px solid #c9d8bd; border-radius: 8px; background: #f0f4e9; }
	.selected-entry strong { color: #6e8d45; font: 11px ui-monospace, monospace; overflow-wrap: anywhere; }
	.selected-entry span:last-child { color: #68766e; font: 10px ui-monospace, monospace; }
	@media (max-width: 1100px) { .workspace { grid-template-columns: 215px minmax(0, 1fr); } .inspector { display: none; } .preview-grid { grid-template-columns: 1fr; } .context-card { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .context-head { grid-column: 1 / -1; } .context-card .outline { align-self: end; } }
	@media (max-width: 700px) { .topbar { flex-wrap: wrap; } .mode-switch { order: 3; width: 100%; margin: 0; } .top-actions { margin-left: auto; } .save-dot { display: none; } .workspace { display: block; } .shelf { border-right: 0; border-bottom: 1px solid #d8d1c4; } .main { padding: 20px 13px 30px; } .preview-grid { grid-template-columns: 1fr; } .context-card { display: block; } .context-head { margin-bottom: 11px; } }
</style>

