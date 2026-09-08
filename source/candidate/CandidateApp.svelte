<script lang="ts">
	import { onMount } from 'svelte';
	import DiscShelfPage from '../candidate-bags/DiscShelfPage.svelte';
	import {
		BAG_VERSION,
		createBag,
		parseBagState,
		serializeBagState,
		toggleDiscMembership,
		type BagState
	} from '../candidate-bags/model';
	import { OnTheCourse, type CourseScene, type CourseView } from '../candidate-ui';
	import { createSampleWorkspace } from '../disc-studio/samples';
	import { parseWorkspace, type Workspace } from '../disc-studio/model';
	import { exportCoursePng, renderCourseScene } from './course-renderer.js';

	type Page = 'shelf' | 'course';
	const workspaceKey = 'chainspot.disc-studio.candidate.v1';
	const bagsKey = 'chainspot.disc-studio.candidate.bags.v1';
	const navigationKey = 'chainspot.disc-studio.candidate.navigation.v1';
	const coursePrefsKey = 'chainspot.disc-studio.candidate.course-prefs.v1';
	let workspace = $state<Workspace>(createSampleWorkspace());
	let bagState = $state<BagState>({ version: BAG_VERSION, bags: [] });
	let page = $state<Page>('shelf');
	let selectedDiscId = $state<string | null>(null);
	let selectedBagId = $state<string | null>(null);
	let ready = $state(false);
	let error = $state('');
	let courseView = $state<Partial<CourseView>>({});

	onMount(() => {
		try {
			const storedWorkspace = localStorage.getItem(workspaceKey);
			if (storedWorkspace) workspace = parseWorkspace(storedWorkspace);
			const storedBags = localStorage.getItem(bagsKey);
			bagState = storedBags
				? parseBagState(storedBags, workspace.discs)
				: { version: BAG_VERSION, bags: [createBag('bag-starter', 'Saturday round', workspace.discs.slice(0, 3).map((disc) => disc.id))] };
			page = localStorage.getItem(navigationKey) === 'course' ? 'course' : 'shelf';
			const storedCourseView = localStorage.getItem(coursePrefsKey);
			if (storedCourseView) courseView = JSON.parse(storedCourseView);
		} catch (cause) {
			error = `Saved candidate data could not be opened: ${(cause as Error).message}`;
			bagState = { version: BAG_VERSION, bags: [] };
		}
		selectedDiscId = workspace.discs[0]?.id ?? null;
		selectedBagId = bagState.bags[0]?.id ?? null;
		ready = true;
	});

	$effect(() => {
		if (!ready) return;
		try {
			localStorage.setItem(workspaceKey, JSON.stringify(workspace));
			localStorage.setItem(bagsKey, serializeBagState(bagState, workspace.discs));
			localStorage.setItem(navigationKey, page);
			localStorage.setItem(coursePrefsKey, JSON.stringify(courseView));
		} catch (cause) {
			error = `Candidate changes are session-only: ${(cause as Error).message}`;
		}
	});

	function setPage(next: Page) {
		page = next;
	}

	function addBag(name: string) {
		const id = `bag-${crypto.randomUUID?.() ?? Date.now().toString(36)}`;
		bagState = { ...bagState, bags: [...bagState.bags, createBag(id, name)] };
		selectedBagId = id;
	}

	function toggleMembership(bagId: string, discId: string, member: boolean) {
		bagState = toggleDiscMembership(bagState, bagId, discId, member, workspace.discs);
	}

	function renderScene(current: Workspace, view: CourseView): CourseScene {
		return renderCourseScene(current, view);
	}

	function exportPng(scene: CourseScene): Promise<Blob> {
		return exportCoursePng(scene);
	}
</script>

<div class="app-shell">
	<nav aria-label="Candidate pages">
		<div><strong>DiscStudio</strong><span>merged candidate</span></div>
		<div class="tabs">
			<button class:active={page === 'shelf'} aria-current={page === 'shelf' ? 'page' : undefined} onclick={() => setPage('shelf')}>DiscShelf</button>
			<button class:active={page === 'course'} aria-current={page === 'course' ? 'page' : undefined} onclick={() => setPage('course')}>On the Course</button>
		</div>
	</nav>
	{#if error}<div class="app-error" role="alert"><span>{error}</span><button onclick={() => (error = '')} aria-label="Dismiss error">×</button></div>{/if}
	{#if page === 'shelf'}
		<DiscShelfPage
			discs={workspace.discs}
			bags={bagState.bags}
			{selectedDiscId}
			{selectedBagId}
			onSelectDisc={(id) => (selectedDiscId = id)}
			onSelectBag={(id) => (selectedBagId = id)}
			onCreateBag={addBag}
			onToggleMembership={toggleMembership}
		/>
	{:else}
		<OnTheCourse
			{workspace}
			{renderScene}
			{exportPng}
			initialView={courseView}
			onViewChange={(view) => (courseView = view)}
		/>
	{/if}
</div>

<style>
	:global(*) { box-sizing: border-box; }
	:global(body) { margin: 0; }
	.app-shell { min-height: 100vh; background: #f5f4ed; }
	nav { position: sticky; top: 0; z-index: 20; min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 8px 22px; border-bottom: 1px solid #d8d1c4; background: #fffef9ee; backdrop-filter: blur(8px); color: #243b2d; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
	nav > div:first-child { display: flex; align-items: baseline; gap: 8px; }
	nav strong { font-size: 14px; }
	nav span { color: #758278; font: 9px ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; }
	.tabs { display: flex; gap: 3px; padding: 3px; border: 1px solid #d5cdbf; border-radius: 8px; background: #f5f1e8; }
	.tabs button { border: 0; border-radius: 6px; padding: 7px 12px; color: #68766e; background: transparent; font-size: 11px; cursor: pointer; }
	.tabs button.active { color: #425b2e; background: #e1ead5; font-weight: 700; }
	.app-error { display: flex; justify-content: space-between; gap: 10px; padding: 9px 16px; background: #fff0e8; color: #8f4635; font: 12px Inter, sans-serif; }
	.app-error button { border: 0; background: transparent; color: inherit; font-size: 18px; }
</style>
