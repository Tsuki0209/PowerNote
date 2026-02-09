<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import toast, { Toaster } from 'svelte-french-toast';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Select from '$lib/components/Select.svelte';

	let files = $state<any[]>([]);
	let isSidebarOpen = $state(true);
	let showModal = $state<'create' | 'import' | null>(null);

	// タブ管理
	let tabs = $state<any[]>([]);
	let activeTabId = $state<string | null>(null);
	let selectedFile = $derived(tabs.find((t) => t.id === activeTabId) || null);

	let activeView = $state<'editor' | 'settings'>('editor');
	let isDarkMode = $state(true);

	let createType = $state<'file' | 'folder'>('file');
	let newName = $state('');
	let targetFolderId = $state<string | null>(null);

	// タブスクロール制御
	let scrollContainer = $state<HTMLDivElement | null>(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	let folders = $derived(files.filter((f) => f.is_folder));
	let folderOptions = $derived([
		{ id: null, name: '/ Root' },
		...folders.map((f) => ({ id: f.id, name: f.name }))
	]);

	async function fetchFiles() {
		const { data } = await supabase.from('files').select('*').order('name', { ascending: true });
		files = data || [];
	}

	function handleSelect(file: any) {
		if (file.is_folder) return;
		activeView = 'editor';
		const existingTab = tabs.find((t) => t.id === file.id);
		if (!existingTab) {
			tabs = [...tabs, { ...file }];
		}
		activeTabId = file.id;
		setTimeout(checkScroll, 50);
	}

	function closeTab(id: string, event: MouseEvent) {
		event.stopPropagation();
		const index = tabs.findIndex((t) => t.id === id);
		tabs = tabs.filter((t) => t.id !== id);
		if (activeTabId === id) {
			if (tabs.length > 0) {
				activeTabId = tabs[Math.max(0, index - 1)].id;
			} else {
				activeTabId = null;
			}
		}
		setTimeout(checkScroll, 50);
	}

	function checkScroll() {
		if (!scrollContainer) return;
		const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
		canScrollLeft = scrollLeft > 1;
		canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;
	}

	function scrollTabs(direction: 'left' | 'right') {
		if (!scrollContainer) return;
		const amount = 240;
		scrollContainer.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
	}

	function handleWheel(e: WheelEvent) {
		if (!scrollContainer) return;
		if (e.deltaY !== 0) {
			e.preventDefault();
			scrollContainer.scrollLeft += e.deltaY;
			checkScroll();
		}
	}

	function openSettings() {
		activeView = 'settings';
		activeTabId = null;
	}

	function toggleTheme() {
		isDarkMode = !isDarkMode;
		if (isDarkMode) document.documentElement.classList.add('dark');
		else document.documentElement.classList.remove('dark');
	}

	function closeModals() {
		showModal = null;
		newName = '';
		targetFolderId = null;
	}

	async function handleCreate() {
		if (!newName) return toast.error('Name required');
		const isFolder = createType === 'folder';
		const { error } = await supabase
			.from('files')
			.insert([
				{
					name: newName,
					extension: isFolder ? null : 'txt',
					is_folder: isFolder,
					parent_id: targetFolderId,
					content: ''
				}
			]);
		if (error) toast.error('Error creating item');
		else {
			closeModals();
			await fetchFiles();
		}
	}

	async function handleImport(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.[0]) return;
		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = async (e) => {
			const content = e.target?.result as string;
			const name = file.name.split('.').slice(0, -1).join('.') || file.name;
			const ext = file.name.split('.').pop() || 'txt';
			await supabase
				.from('files')
				.insert([{ name, extension: ext, content, is_folder: false, parent_id: targetFolderId }]);
			closeModals();
			fetchFiles();
		};
		reader.readAsText(file);
	}

	onMount(() => {
		fetchFiles();
		if (isDarkMode) document.documentElement.classList.add('dark');
		window.addEventListener('resize', checkScroll);
		return () => window.removeEventListener('resize', checkScroll);
	});
</script>

<Toaster />

<div
	class="flex h-screen w-full gap-2 overflow-hidden bg-(--bg-main) p-2 font-sans md:gap-4 md:p-4"
>
	{#if isSidebarOpen}
		<Sidebar
			{files}
			onSelect={handleSelect}
			onOpenModal={(t) => (showModal = t)}
			onOpenSettings={openSettings}
			selectedId={activeTabId}
			{activeView}
		/>
	{/if}

	<main
		class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-(--border-color) bg-(--bg-sidebar) shadow-sm"
	>
		<header
			class="flex h-16 shrink-0 items-center gap-2 border-b border-(--border-color)/30 bg-(--bg-sidebar) px-4"
		>
			<button
				onclick={() => (isSidebarOpen = !isSidebarOpen)}
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
				aria-label="Toggle Sidebar"
			>
				<svg
					class="h-5 w-5 opacity-40"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"><path d="M4 6h16M4 12h16M4 18h7" /></svg
				>
			</button>

			<div class="group/header relative h-full flex-1 overflow-hidden">
				{#if activeView === 'editor'}
					{#if canScrollLeft}
						<div
							class="absolute left-0 z-10 flex h-full items-center bg-linear-to-r from-(--bg-sidebar) via-(--bg-sidebar) to-transparent pr-12"
						>
							<button
								onclick={() => scrollTabs('left')}
								class="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar) shadow-sm transition-transform hover:scale-110"
								aria-label="Scroll tabs left"
							>
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"><path d="M15 18l-6-6 6-6" /></svg
								>
							</button>
						</div>
					{/if}

					<div
						bind:this={scrollContainer}
						onscroll={checkScroll}
						onwheel={handleWheel}
						class="scrollbar-none flex h-full items-center gap-2 overflow-x-auto scroll-smooth px-4"
					>
						{#each tabs as tab (tab.id)}
							<div
								class="group relative flex h-9 w-40 shrink-0 items-center overflow-hidden rounded-full transition-all {activeTabId ===
								tab.id
									? 'bg-(--accent-color)/10 ring-1 ring-(--accent-color)/30'
									: 'bg-(--bg-main)/50 hover:bg-black/5 dark:hover:bg-white/5'}"
								title="{tab.name}.{tab.extension}"
							>
								<button
									onclick={() => (activeTabId = tab.id)}
									class="flex h-full min-w-0 flex-1 items-center gap-2 pr-2 pl-4 text-[12px] font-bold transition-colors"
								>
									<svg
										class="h-3.5 w-3.5 shrink-0 opacity-40"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><path
											d="M13 2v7h7"
										/></svg
									>
									<span
										class="pointer-events-none truncate {activeTabId === tab.id
											? 'text-(--accent-color)'
											: 'text-(--text-muted)'}">{tab.name}.{tab.extension}</span
									>
								</button>
								<button
									onclick={(e) => closeTab(tab.id, e)}
									class="absolute right-2 rounded-full bg-inherit p-1 text-(--text-muted) opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
									aria-label="Close tab"
								>
									<svg
										class="h-3 w-3"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3"><path d="M18 6L6 18M6 6l12 12" /></svg
									>
								</button>
							</div>
						{/each}
						<div class="h-1 w-4 shrink-0"></div>
					</div>

					{#if canScrollRight}
						<div
							class="absolute top-0 right-0 z-10 flex h-full items-center bg-linear-to-l from-(--bg-sidebar) via-(--bg-sidebar) to-transparent pl-12"
						>
							<button
								onclick={() => scrollTabs('right')}
								class="mr-1 flex h-7 w-7 items-center justify-center rounded-full border border-(--border-color)/50 bg-(--bg-sidebar) shadow-sm transition-transform hover:scale-110"
								aria-label="Scroll tabs right"
							>
								<svg
									class="h-4 w-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="3"><path d="M9 18l6-6-6-6" /></svg
								>
							</button>
						</div>
					{/if}
				{:else}
					<div class="flex h-full items-center px-2">
						<div
							class="flex h-9 w-fit items-center rounded-full bg-(--accent-color)/10 px-4 ring-1 ring-(--accent-color)/20"
						>
							<span class="text-[12px] font-bold text-(--accent-color)">Settings</span>
						</div>
					</div>
				{/if}
			</div>
		</header>

		<div class="relative flex-1 overflow-hidden">
			{#if activeView === 'settings'}
				<div class="h-full overflow-y-auto scroll-smooth px-4">
					<div class="mx-auto max-w-2xl px-8 py-16">
						<h2 class="mb-12 text-4xl font-black tracking-tighter">Settings</h2>
						<div class="space-y-12">
							<section>
								<h3 class="text-label mb-6">Appearance</h3>
								<div
									class="flex items-center justify-between rounded-3xl border border-(--border-color)/50 bg-(--bg-main) p-8"
								>
									<div>
										<p class="text-sm font-bold">Dark Mode</p>
										<p class="mt-1 text-xs opacity-50">High contrast dark theme</p>
									</div>
									<button onclick={toggleTheme} class="btn-primary px-8 py-2.5"
										>{isDarkMode ? 'Dark' : 'Light'}</button
									>
								</div>
							</section>
						</div>
					</div>
				</div>
			{:else if selectedFile}
				<textarea
					bind:value={selectedFile.content}
					class="h-full w-full resize-none overflow-y-auto border-none bg-transparent p-12 font-mono text-[16px] leading-relaxed ring-0 outline-none focus:ring-0"
					spellcheck="false"
					placeholder="Start writing..."
				></textarea>
			{:else}
				<div class="flex h-full flex-col items-center justify-center">
					<div class="relative mb-6">
						<div
							class="absolute inset-0 scale-150 rounded-full bg-(--accent-color) opacity-10 blur-3xl"
						></div>
						<svg
							class="relative h-16 w-16 opacity-10"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1"
							><path
								d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
							/></svg
						>
					</div>
					<span class="text-[11px] font-black tracking-[0.5em] uppercase opacity-20"
						>Select a file to begin</span
					>
				</div>
			{/if}
		</div>
	</main>
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
		<div class="w-96 rounded-4xl border border-(--border-color) bg-(--bg-modal) p-10 shadow-2xl">
			<h3 class="modal-title mb-8">{showModal === 'create' ? 'Create New Item' : 'Import File'}</h3>
			<div class="space-y-6">
				{#if showModal === 'create'}
					<div class="flex gap-1 rounded-2xl bg-(--bg-input) p-1">
						<button
							type="button"
							onclick={() => (createType = 'file')}
							class="flex-1 rounded-xl py-2 text-xs font-bold transition-all {createType === 'file'
								? 'bg-(--bg-sidebar) shadow-sm'
								: 'opacity-40'}">File</button
						>
						<button
							type="button"
							onclick={() => (createType = 'folder')}
							class="flex-1 rounded-xl py-2 text-xs font-bold transition-all {createType ===
							'folder'
								? 'bg-(--bg-sidebar) shadow-sm'
								: 'opacity-40'}">Folder</button
						>
					</div>
					<input
						bind:value={newName}
						class="input-base w-full outline-none"
						placeholder="Enter name..."
					/>
				{:else}
					<div
						class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-(--border-color) p-8 transition-colors hover:border-(--accent-color)/50"
					>
						<input
							type="file"
							onchange={handleImport}
							class="w-full text-xs opacity-50 file:hidden"
							aria-label="Choose file to import"
						/>
						<span class="mt-2 text-[10px] font-bold uppercase opacity-30">Click to upload</span>
					</div>
				{/if}
				<Select
					label="Target Location"
					value={targetFolderId}
					options={folderOptions}
					onSelect={(id) => (targetFolderId = id)}
				/>
			</div>
			<div class="mt-10 flex gap-3">
				<button type="button" onclick={closeModals} class="btn-ghost flex-1">Cancel</button>
				{#if showModal === 'create'}
					<button type="button" onclick={handleCreate} class="btn-primary flex-1">Create</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
