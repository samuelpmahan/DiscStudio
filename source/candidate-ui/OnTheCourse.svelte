<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Disc, Workspace } from '../disc-studio/model';

	export type CourseMode = 'card' | 'battle';
	export type CourseTheme = 'dark' | 'light';
	export type CourseAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
	export type CourseView = {
		mode: CourseMode;
		theme: CourseTheme;
		anchor: CourseAnchor;
		scale: number;
		cardLayout: 'wide' | 'portrait';
		battleLayout: 'row' | 'stack';
		showInstanceLabel: boolean;
		showFlightNumbers: boolean;
		cardDiscId: string | null;
	};
	export type CourseScene = {
		svg: string;
		cardCount: number;
		blocked?: string;
		disclosures?: string[];
	};
	export type CoursePngExportDetail = { blob: Blob; filename: string; svg: string; view: CourseView };
	export type OnTheCourseProps = {
		workspace: Workspace;
		renderScene?: (workspace: Workspace, view: CourseView) => CourseScene;
		exportPng?: (scene: CourseScene) => Promise<Blob> | Blob;
		onExportPng?: (detail: CoursePngExportDetail) => void;
		initialView?: Partial<CourseView>;
		onViewChange?: (view: CourseView) => void;
	};

	let { workspace, renderScene, exportPng: exportScenePng, onExportPng, initialView, onViewChange }: OnTheCourseProps = $props();
	const contextTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
	const defaultPrefs = {
		mode: 'card' as CourseMode,
		theme: 'dark' as CourseTheme,
		anchor: 'bottom-left' as CourseAnchor,
		scale: 1,
		cardLayout: 'wide' as 'wide' | 'portrait',
		battleLayout: 'row' as 'row' | 'stack',
		showInstanceLabel: true,
		showFlightNumbers: true,
		settingsOpen: true
	};

	let mode = $state<CourseMode>(defaultPrefs.mode);
	let theme = $state<CourseTheme>(defaultPrefs.theme);
	let anchor = $state<CourseAnchor>(defaultPrefs.anchor);
	let scale = $state(defaultPrefs.scale);
	let cardLayout = $state<'wide' | 'portrait'>(defaultPrefs.cardLayout);
	let battleLayout = $state<'row' | 'stack'>(defaultPrefs.battleLayout);
	let showInstanceLabel = $state(defaultPrefs.showInstanceLabel);
	let showFlightNumbers = $state(defaultPrefs.showFlightNumbers);
	let settingsOpen = $state(defaultPrefs.settingsOpen);
	let selectedDiscId = $state('');
	let selectedEntryId = $state<string | null>(null);
	let contextUrl = $state<string | null>(null);
	let contextName = $state('');
	let contextKind = $state<'image' | 'video' | null>(null);
	let hydrated = $state(false);
	let exportBusy = $state(false);
	let message = $state('');
	let error = $state('');
	let videoInput = $state<HTMLInputElement>();
	let videoElement = $state<HTMLVideoElement>();
	let stageElement: HTMLDivElement;

	let selectedDisc = $derived(workspace.discs.find((disc) => disc.id === selectedDiscId));
	let selectedEntry = $derived(workspace.battle.entries.find((entry) => entry.id === selectedEntryId));
	let view = $derived<CourseView>({
		mode,
		theme,
		anchor,
		scale,
		cardLayout,
		battleLayout,
		showInstanceLabel,
		showFlightNumbers,
		cardDiscId: mode === 'card' ? selectedDiscId || null : null
	});
	let scene = $derived(getScene());
	let canExport = $derived(!!exportScenePng && !scene.blocked && !!scene.svg && scene.cardCount > 0 && !exportBusy);

	onMount(() => {
		selectedDiscId = workspace.discs[0]?.id ?? '';
		selectedEntryId = workspace.battle.entries[0]?.id ?? null;
		const supplied = initialView;
		if (supplied?.mode === 'card' || supplied?.mode === 'battle') mode = supplied.mode;
		if (supplied?.theme === 'dark' || supplied?.theme === 'light') theme = supplied.theme;
		if (supplied?.anchor && ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'].includes(supplied.anchor)) anchor = supplied.anchor;
		if (typeof supplied?.scale === 'number' && Number.isFinite(supplied.scale)) scale = Math.min(1.5, Math.max(.5, supplied.scale));
		if (supplied?.cardLayout === 'wide' || supplied?.cardLayout === 'portrait') cardLayout = supplied.cardLayout;
		if (supplied?.battleLayout === 'row' || supplied?.battleLayout === 'stack') battleLayout = supplied.battleLayout;
		if (typeof supplied?.showInstanceLabel === 'boolean') showInstanceLabel = supplied.showInstanceLabel;
		if (typeof supplied?.showFlightNumbers === 'boolean') showFlightNumbers = supplied.showFlightNumbers;
		if (supplied?.cardDiscId && workspace.discs.some((disc) => disc.id === supplied.cardDiscId)) selectedDiscId = supplied.cardDiscId;
		hydrated = true;
	});

	$effect(() => {
		if (hydrated) onViewChange?.(view);
	});

	onDestroy(() => revokeVideo());

	function getScene(): CourseScene {
		if (!renderScene) return { svg: '', cardCount: 0, blocked: 'Preview renderer is unavailable.' };
		try {
			return renderScene(workspace, view);
		} catch (cause) {
			return { svg: '', cardCount: 0, blocked: `Preview is unavailable: ${(cause as Error).message}` };
		}
	}

	function chooseMode(next: CourseMode) {
		mode = next;
		message = next === 'card' ? 'Single Disc is a view choice; editor battle selection stays separate.' : 'Disc Battle uses authored highlight and winner emphasis from the shared workspace.';
	}

	function inspectEntry(id: string) {
		selectedEntryId = id;
		const entry = workspace.battle.entries.find((item) => item.id === id);
		if (entry) selectedDiscId = entry.discId;
		message = 'Entry selection is view-only and is never passed to export.';
	}

	function revokeVideo() {
		if (contextUrl) URL.revokeObjectURL(contextUrl);
		contextUrl = null;
		contextName = '';
		contextKind = null;
	}

	function chooseVideo(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!contextTypes.includes(file.type) || file.size > 300 * 1024 * 1024) {
			error = 'Choose a JPG, PNG, WebP, MP4, or WebM under 300 MB.';
			return;
		}
		revokeVideo();
		contextUrl = URL.createObjectURL(file);
		contextName = file.name;
		contextKind = file.type.startsWith('video/') ? 'video' : 'image';
		message = 'Your footage is local preview context and stays out of the transparent PNG.';
		queueMicrotask(() => contextKind === 'video' && videoElement?.play().catch(() => undefined));
	}

	function clearVideo() {
		revokeVideo();
		message = 'Footage cleared.';
	}

	async function exportPreview() {
		if (!canExport || !exportScenePng) return;
		exportBusy = true;
		error = '';
		try {
			const blob = await exportScenePng(scene);
			const filename = `chainspot-course-${mode}.png`;
			const detail = { blob, filename, svg: scene.svg, view };
			onExportPng?.(detail);
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			link.click();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000);
			message = 'Transparent PNG saved. Footage and editor selection are excluded.';
		} catch (cause) {
			error = (cause as Error).message;
		} finally {
			exportBusy = false;
		}
	}

	function imageSrc(disc: Disc): string {
		return disc.image?.src ?? '';
	}
</script>

<svelte:head>
	<title>ChainSpot · On the Course</title>
	<meta name="description" content="Place a single disc or battle graphic over your own course footage." />
</svelte:head>

<div class="course" class:light={theme === 'light'}>
	<header class="topbar">
		<div class="brand"><span class="mark" aria-hidden="true">◒</span><strong>CHAINSPOT</strong><span class="divider"></span><span>ON THE COURSE</span><small>PROVISIONAL</small></div>
		<div class="mode-switch" aria-label="Graphic mode"><button class:active={mode === 'card'} onclick={() => chooseMode('card')} aria-pressed={mode === 'card'}>Single Disc</button><button class:active={mode === 'battle'} onclick={() => chooseMode('battle')} aria-pressed={mode === 'battle'}>Disc Battle</button></div>
		<button class="export-top" onclick={exportPreview} disabled={!canExport}>{exportBusy ? 'Preparing…' : 'Transparent PNG ↓'}</button>
	</header>

	{#if error}<div class="notice error" role="alert"><span>{error}</span><button onclick={() => (error = '')} aria-label="Dismiss error">×</button></div>{/if}
	{#if message}<div class="notice" role="status"><span>{message}</span><button onclick={() => (message = '')} aria-label="Dismiss notice">×</button></div>{/if}

	<main class="page">
		<div class="page-heading"><div><span class="eyebrow">ON THE COURSE</span><h1>Put it in the frame.</h1><p>Preview your graphic over footage, then export only the transparent layer.</p></div><button class="settings-toggle" onclick={() => (settingsOpen = !settingsOpen)} aria-expanded={settingsOpen}>Design settings {settingsOpen ? '⌃' : '⌄'}</button></div>
		{#if settingsOpen}<section class="settings" aria-label="Design settings">
			<div class="setting"><div><strong>Theme</strong><small>Sets the graphic treatment and preview canvas.</small></div><div class="segmented"><button class:active={theme === 'dark'} onclick={() => (theme = 'dark')} aria-pressed={theme === 'dark'}>Dark</button><button class:active={theme === 'light'} onclick={() => (theme = 'light')} aria-pressed={theme === 'light'}>Light</button></div></div>
			<div class="setting"><div><strong>Layout</strong><small>{mode === 'card' ? 'Single Disc card shape.' : 'Disc Battle arrangement.'}</small></div><div class="segmented">{#if mode === 'card'}<button class:active={cardLayout === 'wide'} onclick={() => (cardLayout = 'wide')} aria-pressed={cardLayout === 'wide'}>Wide</button><button class:active={cardLayout === 'portrait'} onclick={() => (cardLayout = 'portrait')} aria-pressed={cardLayout === 'portrait'}>Portrait</button>{:else}<button class:active={battleLayout === 'row'} onclick={() => (battleLayout = 'row')} aria-pressed={battleLayout === 'row'}>Row</button><button class:active={battleLayout === 'stack'} onclick={() => (battleLayout = 'stack')} aria-pressed={battleLayout === 'stack'}>Stack</button>{/if}</div></div>
			<div class="setting"><div><strong>Screen placement</strong><small>Choose where the overlay sits in the frame.</small></div><select bind:value={anchor} aria-label="Screen placement"><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option><option value="center">Center</option></select></div>
			<div class="setting"><div><strong>Overlay size</strong><small>{Math.round(scale * 100)}% of the renderer’s designed size.</small></div><input class="range" type="range" min="0.5" max="1.5" step="0.05" bind:value={scale} aria-label="Overlay size" /></div>
			<div class="setting toggles"><label><input type="checkbox" bind:checked={showFlightNumbers} /> Show flight numbers</label><label><input type="checkbox" bind:checked={showInstanceLabel} /> Show nickname / variant</label></div>
		</section>{/if}

		<section class="stage-card" aria-label="On the Course preview">
			<div class="stage-head"><div><span class="eyebrow">{mode === 'card' ? 'SINGLE DISC' : 'DISC BATTLE'}</span><h2>{contextUrl ? 'Preview over your footage' : 'Transparent overlay preview'}</h2></div><span class="stage-size">16:9 · {theme}</span></div>
			<div class="stage" class:stage-dark={theme === 'dark'} class:stage-light={theme === 'light'} bind:this={stageElement}>
				{#if contextUrl}{#if contextKind === 'video'}<video class="context-video" bind:this={videoElement} src={contextUrl} controls muted loop playsinline onerror={clearVideo}></video>{:else}<img class="context-image" src={contextUrl} alt="Local course context" onerror={clearVideo} />{/if}{/if}
				{#if scene.blocked}<div class="blocked"><strong>{scene.blocked}</strong><p>Choose a supported renderer result to enable export.</p></div>{:else if scene.svg}<div class="overlay">{@html scene.svg}</div>{:else}<div class="blocked"><strong>Nothing to preview yet.</strong><p>Select a disc or add a battle entry.</p></div>{/if}
			</div>
			<div class="stage-foot"><span>{contextUrl ? `${contextName} · local context` : 'Checkerboard shows transparent areas'}</span><span>Selection stays outside export</span></div>
		</section>

		<div class="below-stage">
			<section class="footage-card" aria-label="Footage controls"><div class="card-head"><div><span class="eyebrow">YOUR FOOTAGE</span><h2>Context image or video</h2></div><button class="quiet" onclick={clearVideo} disabled={!contextUrl}>Clear</button></div>{#if contextUrl}<p>{contextName} · object URL active</p>{:else}<p>Choose a JPG, PNG, WebP, MP4, or WebM to inspect placement in the 16:9 stage.</p>{/if}<input class="hidden" bind:this={videoInput} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onchange={chooseVideo} aria-label="Choose footage" /><button class="outline" onclick={() => videoInput?.click()}>＋ Choose footage</button></section>
			<section class="selection-card" aria-label="Course selection"><div class="card-head"><div><span class="eyebrow">VIEW CHOICE</span><h2>{mode === 'card' ? 'Single Disc' : 'Disc Battle'}</h2></div><span class="view-pill">VIEW ONLY</span></div>{#if mode === 'card'}<label class="select-label">Disc<select bind:value={selectedDiscId} aria-label="Single Disc choice">{#each workspace.discs as disc (disc.id)}<option value={disc.id}>{disc.manufacturer} · {disc.mold}{disc.variant ? ` · ${disc.variant}` : ''}</option>{/each}</select></label><p>Single Disc is an explicit view preference. Editor selectedEntryId is not used.</p>{:else}<div class="entry-list">{#each workspace.battle.entries as entry, index (entry.id)}{@const disc = workspace.discs.find((item) => item.id === entry.discId)}<button class="entry" class:selected={selectedEntryId === entry.id} onclick={() => inspectEntry(entry.id)} aria-pressed={selectedEntryId === entry.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{disc?.mold || 'Untitled disc'}</strong><small>{disc?.manufacturer || 'Unknown'} · {entry.score}</small>{#if workspace.battleVisual.highlightedEntryId === entry.id}<i class="highlight">Highlight</i>{/if}{#if workspace.battleVisual.emphasizedEntryIds.includes(entry.id)}<i class="winner">★ Winner</i>{/if}</button>{/each}</div><p>Selection is view-only. Authored highlight and multiple winners come from battleVisual.</p>{/if}</section>
		</div>

		{#if scene.disclosures?.length}<div class="disclosures" aria-label="Export notes"><strong>Export note</strong>{#each scene.disclosures as disclosure}<span>{disclosure}</span>{/each}</div>{/if}
	</main>
</div>

<style>
	:global(*) { box-sizing: border-box; }
	:global(body) { margin: 0; background: #f5f4ed; color: #243b2d; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
	:global(button), :global(input), :global(select) { font: inherit; }
	:global(button) { cursor: pointer; }
	:global(button:disabled) { cursor: not-allowed; opacity: .45; }
	.course { min-height: 100vh; background: #f5f4ed; color: #243b2d; }
	.topbar { min-height: 72px; display: flex; align-items: center; gap: 24px; padding: 13px 24px; background: #fffef9; border-bottom: 1px solid #d8d1c4; }
	.brand { display: flex; align-items: center; gap: 9px; white-space: nowrap; font-size: 13px; letter-spacing: .1em; }
	.brand small { color: #68766e; font: 9px ui-monospace, monospace; letter-spacing: .08em; }
	.mark { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 9px; background: #6e8d45; color: #fffef9; font-size: 21px; transform: rotate(-18deg); }
	.divider { width: 1px; height: 17px; background: #b8b1a4; }
	.mode-switch { display: flex; gap: 3px; margin: auto; padding: 3px; border: 1px solid #d5cdbf; border-radius: 8px; background: #f5f1e8; }
	.mode-switch button, .export-top, .settings-toggle, .quiet { border: 0; border-radius: 6px; padding: 8px 11px; color: #68766e; background: transparent; }
	.mode-switch button.active { color: #425b2e; background: #e1ead5; font-weight: 700; }
	.mode-switch button:hover, .settings-toggle:hover, .quiet:hover { background: #eee9df; color: #425b2e; }
	.export-top { color: #fffef9; background: #5f7c3b; font-size: 11px; }
	.export-top:hover { background: #4d6930; }
	.notice { display: flex; justify-content: space-between; gap: 12px; margin: 12px auto 0; max-width: 1180px; padding: 9px 13px; border: 1px solid #b7c99f; border-radius: 8px; background: #edf3e4; color: #425b2e; font-size: 12px; }
	.notice.error { border-color: #d5a18d; background: #fff0e8; color: #8f4635; }
	.notice button { border: 0; background: transparent; color: inherit; font-size: 18px; }
	.page { max-width: 1180px; margin: auto; padding: 36px 24px 64px; }
	.page-heading, .stage-head, .stage-foot, .card-head, .setting { display: flex; align-items: center; justify-content: space-between; gap: 15px; }
	.page-heading { align-items: flex-start; margin-bottom: 18px; }
	.eyebrow { color: #758278; font: 700 9px ui-monospace, monospace; letter-spacing: .16em; }
	h1, h2, p { margin: 0; }
	h1 { margin-top: 5px; font-size: clamp(28px, 5vw, 52px); line-height: 1; letter-spacing: -.06em; }
	h2 { margin-top: 5px; font-size: 16px; letter-spacing: -.03em; }
	.page-heading p { margin-top: 9px; color: #68766e; font-size: 12px; }
	.settings { display: grid; gap: 0; margin-bottom: 17px; padding: 14px 16px; border: 1px solid #d8d1c4; border-radius: 10px; background: #fffef9; }
	.setting { padding: 11px 0; border-bottom: 1px solid #e6dfd4; }
	.setting:last-child { border-bottom: 0; }
	.setting > div:first-child { display: grid; gap: 3px; }
	.setting small, .footage-card p, .selection-card p { color: #68766e; font-size: 10px; }
	.setting select, .select-label select { min-width: 170px; border: 1px solid #d5cdbf; border-radius: 6px; padding: 7px 9px; color: #243b2d; background: #f5f1e8; }
	.segmented { display: flex; gap: 3px; padding: 3px; border: 1px solid #d5cdbf; border-radius: 7px; background: #f5f1e8; }
	.segmented button { border: 0; border-radius: 5px; padding: 6px 9px; color: #68766e; background: transparent; font-size: 10px; }
	.segmented button.active { color: #425b2e; background: #e1ead5; font-weight: 700; }
	.range { width: 180px; accent-color: #6e8d45; }
	.toggles { justify-content: flex-start; gap: 20px; color: #425b2e; font-size: 11px; }
	.toggles label { display: flex; align-items: center; gap: 7px; }
	.toggles input { accent-color: #6e8d45; }
	.stage-card, .footage-card, .selection-card { border: 1px solid #d8d1c4; border-radius: 12px; overflow: hidden; background: #fffef9; }
	.stage-head { padding: 15px 17px; }
	.stage-size { color: #758278; font: 10px ui-monospace, monospace; text-transform: uppercase; }
	.stage { position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background-color: #e9e4da; background-image: linear-gradient(45deg, #dcd5c8 25%, transparent 25%), linear-gradient(-45deg, #dcd5c8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #dcd5c8 75%), linear-gradient(-45deg, transparent 75%, #dcd5c8 75%); background-size: 26px 26px; background-position: 0 0, 0 13px, 13px -13px, -13px 0; }
	.stage-dark { background-color: #27342d; background-image: linear-gradient(45deg, #354239 25%, transparent 25%), linear-gradient(-45deg, #354239 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #354239 75%), linear-gradient(-45deg, transparent 75%, #354239 75%); }
	.stage-light { background-color: #e9e4da; }
	.context-video, .context-image { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; object-fit: contain; background: #d9d4ca; }
	.overlay { position: relative; z-index: 1; width: 100%; height: 100%; pointer-events: none; }
	.overlay :global(svg) { display: block; width: 100%; height: 100%; }
	.blocked { position: relative; z-index: 2; max-width: 330px; padding: 20px; border: 1px solid #d5a18d; border-radius: 9px; background: #fff0e8; color: #8f4635; text-align: center; }
	.blocked p { margin-top: 6px; color: #a86250; font-size: 10px; }
	.stage-foot { padding: 10px 15px; border-top: 1px solid #e3dbcf; color: #758278; font: 10px ui-monospace, monospace; }
	.below-stage { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
	.footage-card, .selection-card { padding: 15px; }
	.card-head { align-items: flex-start; margin-bottom: 12px; }
	.card-head h2 { font-size: 14px; }
	.footage-card p { min-height: 31px; line-height: 1.5; }
	.footage-card .outline { margin-top: 11px; }
	.quiet { padding: 5px 7px; font-size: 10px; }
	.outline { width: 100%; border: 1px solid #8aa176; border-radius: 6px; padding: 8px 10px; color: #425b2e; background: transparent; }
	.outline:hover { background: #eaf1df; }
	.hidden { display: none; }
	.view-pill { color: #68766e; font: 9px ui-monospace, monospace; letter-spacing: .08em; }
	.select-label { display: grid; gap: 6px; color: #68766e; font: 10px ui-monospace, monospace; }
	.select-label select { width: 100%; }
	.selection-card p { margin-top: 10px; }
	.entry-list { display: grid; gap: 5px; }
	.entry { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto auto; gap: 8px; align-items: center; width: 100%; padding: 8px; border: 1px solid transparent; border-radius: 6px; text-align: left; color: #243b2d; background: #f2eee5; }
	.entry:hover, .entry.selected { border-color: #9db087; background: #e8efdc; }
	.entry > span { color: #758278; font: 10px ui-monospace, monospace; }
	.entry strong, .entry small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.entry small { color: #68766e; font-size: 10px; }
	.entry i { padding: 3px 5px; border-radius: 4px; font: 9px ui-monospace, monospace; font-style: normal; white-space: nowrap; }
	.highlight { color: #425b2e; background: #dcebc8; }
	.winner { color: #8e6723; background: #f5e9ca; }
	.disclosures { display: grid; gap: 4px; margin-top: 12px; padding: 10px 12px; border: 1px solid #d8d1c4; border-radius: 7px; background: #fffef9; color: #68766e; font-size: 10px; }
	.disclosures strong { color: #425b2e; }
	@media (max-width: 700px) { .topbar { flex-wrap: wrap; gap: 12px; } .mode-switch { order: 3; width: 100%; margin: 0; } .mode-switch button { flex: 1; } .export-top { margin-left: auto; } .page { padding: 25px 13px 40px; } .setting { align-items: flex-start; flex-wrap: wrap; } .setting select, .range { width: 100%; } .below-stage { grid-template-columns: 1fr; } .stage-foot { display: grid; gap: 4px; } }
</style>
